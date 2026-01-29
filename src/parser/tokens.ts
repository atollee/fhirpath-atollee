/**
 * FHIRPath Token Types
 * 
 * Based on the FHIRPath grammar specification.
 * @see http://hl7.org/fhirpath/N1/grammar.html
 */

export enum TokenType {
  // Literals
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  DATE = "DATE",
  TIME = "TIME",
  DATETIME = "DATETIME",
  QUANTITY = "QUANTITY",
  
  // Identifiers
  IDENTIFIER = "IDENTIFIER",
  DELIMITED_IDENTIFIER = "DELIMITED_IDENTIFIER",
  
  // Keywords
  AND = "AND",
  OR = "OR",
  XOR = "XOR",
  IMPLIES = "IMPLIES",
  IS = "IS",
  AS = "AS",
  IN = "IN",
  CONTAINS = "CONTAINS",
  DIV = "DIV",
  MOD = "MOD",
  TRUE = "TRUE",
  FALSE = "FALSE",
  
  // Operators
  DOT = "DOT",
  COMMA = "COMMA",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  UNION = "UNION",       // |
  AMPERSAND = "AMPERSAND", // &
  
  // Comparison
  EQ = "EQ",             // =
  NE = "NE",             // !=
  EQUIVALENT = "EQUIVALENT", // ~
  NOT_EQUIVALENT = "NOT_EQUIVALENT", // !~
  LT = "LT",             // <
  GT = "GT",             // >
  LE = "LE",             // <=
  GE = "GE",             // >=
  
  // Brackets
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  
  // Special
  DOLLAR = "DOLLAR",     // $this, $index, $total
  PERCENT = "PERCENT",   // %resource, %context, etc.
  COLON = "COLON",
  
  // Control
  EOF = "EOF",
  WHITESPACE = "WHITESPACE",
  NEWLINE = "NEWLINE",
  COMMENT = "COMMENT",
}

/**
 * A single token from the lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  /** Starting position in the input string */
  start: number;
  /** Ending position in the input string */
  end: number;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/**
 * Keywords mapping (case-insensitive)
 */
export const KEYWORDS: Record<string, TokenType> = {
  "and": TokenType.AND,
  "or": TokenType.OR,
  "xor": TokenType.XOR,
  "implies": TokenType.IMPLIES,
  "is": TokenType.IS,
  "as": TokenType.AS,
  "in": TokenType.IN,
  "contains": TokenType.CONTAINS,
  "div": TokenType.DIV,
  "mod": TokenType.MOD,
  "true": TokenType.TRUE,
  "false": TokenType.FALSE,
};

/**
 * Check if a string is a keyword
 */
export function isKeyword(value: string): boolean {
  return value.toLowerCase() in KEYWORDS;
}

/**
 * Get the token type for a keyword
 */
export function getKeywordType(value: string): TokenType | undefined {
  return KEYWORDS[value.toLowerCase()];
}
