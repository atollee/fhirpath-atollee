/**
 * FHIRPath Lexer - Tokenizes FHIRPath expressions
 * 
 * This is a native TypeScript implementation that replaces the ANTLR4-based lexer.
 * It produces a stream of tokens that can be consumed by the parser.
 * 
 * @example
 * ```typescript
 * const lexer = new FhirPathLexer("name.given.first()");
 * const tokens = lexer.tokenize();
 * // [IDENTIFIER("name"), DOT, IDENTIFIER("given"), DOT, IDENTIFIER("first"), LPAREN, RPAREN, EOF]
 * ```
 */

import { 
  Token, 
  TokenType, 
  KEYWORDS, 
  getKeywordType 
} from "./tokens.ts";

/**
 * Lexer error with position information
 */
export class LexerError extends Error {
  constructor(
    message: string,
    public readonly position: number,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = "LexerError";
  }
}

/**
 * FHIRPath Lexer
 */
export class FhirPathLexer {
  private pos = 0;
  private line = 1;
  private column = 1;
  private readonly input: string;

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenize the entire input string
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token) {
        // Skip whitespace and comments
        if (token.type !== TokenType.WHITESPACE && 
            token.type !== TokenType.COMMENT &&
            token.type !== TokenType.NEWLINE) {
          tokens.push(token);
        }
      }
    }
    
    tokens.push(this.makeToken(TokenType.EOF, ""));
    return tokens;
  }

  /**
   * Get the next token
   */
  private nextToken(): Token | null {
    if (this.isAtEnd()) {
      return null;
    }

    const start = this.pos;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.peek();

    // Whitespace
    if (this.isWhitespace(char)) {
      return this.readWhitespace();
    }

    // Comments: // ... or /* ... */
    if (char === "/" && (this.peekNext() === "/" || this.peekNext() === "*")) {
      return this.readComment();
    }

    // Strings
    if (char === "'" || char === '"') {
      return this.readString();
    }

    // Numbers
    if (this.isDigit(char) || (char === "." && this.isDigit(this.peekNext()))) {
      return this.readNumber();
    }

    // Date/DateTime/Time literals: @...
    if (char === "@") {
      return this.readDateTimeLiteral();
    }

    // Environment variables: %...
    if (char === "%") {
      return this.readEnvironmentVariable();
    }

    // Special identifiers: $this, $index, $total
    if (char === "$") {
      return this.readSpecialIdentifier();
    }

    // Delimited identifier: `...`
    if (char === "`") {
      return this.readDelimitedIdentifier();
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.readIdentifier();
    }

    // Single/multi-character operators
    return this.readOperator();
  }

  // ============================================================
  // Token readers
  // ============================================================

  private readWhitespace(): Token {
    const start = this.pos;
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 1;
        this.advance();
      } else {
        this.advance();
      }
    }
    return this.makeTokenAt(TokenType.WHITESPACE, this.input.slice(start, this.pos), start);
  }

  private readComment(): Token {
    const start = this.pos;
    this.advance(); // consume first /
    
    if (this.peek() === "/") {
      // Single-line comment
      this.advance(); // consume second /
      while (!this.isAtEnd() && this.peek() !== "\n") {
        this.advance();
      }
    } else if (this.peek() === "*") {
      // Multi-line comment
      this.advance(); // consume *
      while (!this.isAtEnd()) {
        if (this.peek() === "*" && this.peekNext() === "/") {
          this.advance(); // consume *
          this.advance(); // consume /
          break;
        }
        if (this.peek() === "\n") {
          this.line++;
          this.column = 1;
        }
        this.advance();
      }
    }
    
    return this.makeTokenAt(TokenType.COMMENT, this.input.slice(start, this.pos), start);
  }

  private readString(): Token {
    const start = this.pos;
    const quote = this.advance(); // consume opening quote
    let value = "";
    
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance(); // consume backslash
        if (!this.isAtEnd()) {
          const escaped = this.advance();
          switch (escaped) {
            case "n": value += "\n"; break;
            case "r": value += "\r"; break;
            case "t": value += "\t"; break;
            case "\\": value += "\\"; break;
            case "'": value += "'"; break;
            case '"': value += '"'; break;
            case "/": value += "/"; break;
            case "f": value += "\f"; break;
            case "`": value += "`"; break;
            case "u": {
              // Unicode escape: \uXXXX
              let hex = "";
              for (let i = 0; i < 4 && !this.isAtEnd(); i++) {
                hex += this.advance();
              }
              value += String.fromCharCode(parseInt(hex, 16));
              break;
            }
            default:
              value += escaped;
          }
        }
      } else if (this.peek() === "\n") {
        throw new LexerError("Unterminated string", start, this.line, this.column);
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new LexerError("Unterminated string", start, this.line, this.column);
    }
    
    this.advance(); // consume closing quote
    return this.makeTokenAt(TokenType.STRING, value, start);
  }

  private readNumber(): Token {
    const start = this.pos;
    let value = "";
    
    // Integer part
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }
    
    // Decimal part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      value += this.advance(); // consume .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    // Exponent part
    if (this.peek() === "e" || this.peek() === "E") {
      value += this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        value += this.advance();
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    // Check for quantity unit: 1 'kg' or 1 year
    const afterNumber = this.pos;
    this.skipWhitespaceOnly();
    
    if (this.peek() === "'") {
      // UCUM unit in quotes
      const unitToken = this.readString();
      return this.makeTokenAt(TokenType.QUANTITY, value + " '" + unitToken.value + "'", start);
    } else if (this.isLetter(this.peek())) {
      // Time unit without quotes: year, month, day, etc.
      const unitStart = this.pos;
      while (!this.isAtEnd() && this.isIdentifierPart(this.peek())) {
        this.advance();
      }
      const unit = this.input.slice(unitStart, this.pos);
      const timeUnits = ["year", "years", "month", "months", "week", "weeks", "day", "days", 
                         "hour", "hours", "minute", "minutes", "second", "seconds", "millisecond", "milliseconds"];
      if (timeUnits.includes(unit)) {
        return this.makeTokenAt(TokenType.QUANTITY, value + " " + unit, start);
      }
      // Not a time unit, reset position
      this.pos = afterNumber;
    }
    
    return this.makeTokenAt(TokenType.NUMBER, value, start);
  }

  private skipWhitespaceOnly(): void {
    while (!this.isAtEnd() && (this.peek() === " " || this.peek() === "\t")) {
      this.advance();
    }
  }

  private readDateTimeLiteral(): Token {
    const start = this.pos;
    this.advance(); // consume @
    
    let value = "";
    
    // Check for time-only: @T...
    if (this.peek() === "T") {
      this.advance();
      value = "T";
      // Read time part
      while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === ":" || 
             this.peek() === "." || this.peek() === "+" || this.peek() === "-" || this.peek() === "Z")) {
        value += this.advance();
      }
      return this.makeTokenAt(TokenType.TIME, value, start);
    }
    
    // Read date part: YYYY-MM-DD
    while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === "-")) {
      value += this.advance();
    }
    
    // Check for datetime (has T)
    if (this.peek() === "T") {
      value += this.advance();
      // Read time part
      while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === ":" || 
             this.peek() === "." || this.peek() === "+" || this.peek() === "-" || this.peek() === "Z")) {
        value += this.advance();
      }
      return this.makeTokenAt(TokenType.DATETIME, value, start);
    }
    
    return this.makeTokenAt(TokenType.DATE, value, start);
  }

  private readEnvironmentVariable(): Token {
    const start = this.pos;
    this.advance(); // consume %
    
    let value = "%";
    
    // Handle backtick-delimited environment variable: %`var name`
    if (this.peek() === "`") {
      this.advance(); // consume opening `
      value += "`";
      while (!this.isAtEnd() && this.peek() !== "`") {
        value += this.advance();
      }
      if (!this.isAtEnd()) {
        value += this.advance(); // consume closing `
      }
    } else {
      // Regular identifier
      while (!this.isAtEnd() && this.isIdentifierPart(this.peek())) {
        value += this.advance();
      }
    }
    
    return this.makeTokenAt(TokenType.IDENTIFIER, value, start);
  }

  private readSpecialIdentifier(): Token {
    const start = this.pos;
    this.advance(); // consume $
    
    let value = "$";
    while (!this.isAtEnd() && this.isIdentifierPart(this.peek())) {
      value += this.advance();
    }
    
    return this.makeTokenAt(TokenType.IDENTIFIER, value, start);
  }

  private readDelimitedIdentifier(): Token {
    const start = this.pos;
    this.advance(); // consume opening `
    
    let value = "";
    while (!this.isAtEnd() && this.peek() !== "`") {
      if (this.peek() === "\\") {
        this.advance(); // consume backslash
        if (!this.isAtEnd()) {
          const escaped = this.advance();
          if (escaped === "`") {
            value += "`";
          } else {
            value += "\\" + escaped;
          }
        }
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new LexerError("Unterminated delimited identifier", start, this.line, this.column);
    }
    
    this.advance(); // consume closing `
    return this.makeTokenAt(TokenType.DELIMITED_IDENTIFIER, value, start);
  }

  private readIdentifier(): Token {
    const start = this.pos;
    let value = "";
    
    while (!this.isAtEnd() && this.isIdentifierPart(this.peek())) {
      value += this.advance();
    }
    
    // Check if it's a keyword
    const keywordType = getKeywordType(value);
    if (keywordType) {
      return this.makeTokenAt(keywordType, value, start);
    }
    
    return this.makeTokenAt(TokenType.IDENTIFIER, value, start);
  }

  private readOperator(): Token {
    const start = this.pos;
    const char = this.advance();
    
    switch (char) {
      case ".": return this.makeTokenAt(TokenType.DOT, ".", start);
      case ",": return this.makeTokenAt(TokenType.COMMA, ",", start);
      case "+": return this.makeTokenAt(TokenType.PLUS, "+", start);
      case "-": return this.makeTokenAt(TokenType.MINUS, "-", start);
      case "*": return this.makeTokenAt(TokenType.STAR, "*", start);
      case "/": return this.makeTokenAt(TokenType.SLASH, "/", start);
      case "|": return this.makeTokenAt(TokenType.UNION, "|", start);
      case "&": return this.makeTokenAt(TokenType.AMPERSAND, "&", start);
      case "(": return this.makeTokenAt(TokenType.LPAREN, "(", start);
      case ")": return this.makeTokenAt(TokenType.RPAREN, ")", start);
      case "[": return this.makeTokenAt(TokenType.LBRACKET, "[", start);
      case "]": return this.makeTokenAt(TokenType.RBRACKET, "]", start);
      case "{": return this.makeTokenAt(TokenType.LBRACE, "{", start);
      case "}": return this.makeTokenAt(TokenType.RBRACE, "}", start);
      case ":": return this.makeTokenAt(TokenType.COLON, ":", start);
      
      case "=": return this.makeTokenAt(TokenType.EQ, "=", start);
      
      case "!":
        if (this.peek() === "=") {
          this.advance();
          return this.makeTokenAt(TokenType.NE, "!=", start);
        }
        if (this.peek() === "~") {
          this.advance();
          return this.makeTokenAt(TokenType.NOT_EQUIVALENT, "!~", start);
        }
        throw new LexerError(`Unexpected character: ${char}`, start, this.line, this.column);
      
      case "~": return this.makeTokenAt(TokenType.EQUIVALENT, "~", start);
      
      case "<":
        if (this.peek() === "=") {
          this.advance();
          return this.makeTokenAt(TokenType.LE, "<=", start);
        }
        return this.makeTokenAt(TokenType.LT, "<", start);
      
      case ">":
        if (this.peek() === "=") {
          this.advance();
          return this.makeTokenAt(TokenType.GE, ">=", start);
        }
        return this.makeTokenAt(TokenType.GT, ">", start);
      
      default:
        throw new LexerError(`Unexpected character: ${char}`, start, this.line, this.column);
    }
  }

  // ============================================================
  // Helper methods
  // ============================================================

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.input[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.input.length) return "\0";
    return this.input[this.pos + 1];
  }

  private advance(): string {
    const char = this.input[this.pos];
    this.pos++;
    this.column++;
    return char;
  }

  private isWhitespace(char: string): boolean {
    return char === " " || char === "\t" || char === "\r" || char === "\n";
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isLetter(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  }

  private isIdentifierStart(char: string): boolean {
    return this.isLetter(char) || char === "_";
  }

  private isIdentifierPart(char: string): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }

  private makeToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      start: this.pos,
      end: this.pos,
      line: this.line,
      column: this.column,
    };
  }

  private makeTokenAt(type: TokenType, value: string, start: number): Token {
    // Calculate line and column for start position
    let line = 1;
    let column = 1;
    for (let i = 0; i < start; i++) {
      if (this.input[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    
    return {
      type,
      value,
      start,
      end: this.pos,
      line,
      column,
    };
  }
}
