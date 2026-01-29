/**
 * FHIRPath Parser - Recursive Descent Parser
 * 
 * Parses a stream of tokens into an AST (Abstract Syntax Tree).
 * Uses recursive descent with precedence climbing for operators.
 * 
 * Grammar precedence (lowest to highest):
 * 1. implies
 * 2. or, xor
 * 3. and
 * 4. membership (in, contains)
 * 5. equality (=, !=, ~, !~)
 * 6. comparison (<, >, <=, >=)
 * 7. type (is, as)
 * 8. union (|)
 * 9. additive (+, -, &)
 * 10. multiplicative (*, /, div, mod)
 * 11. unary (+, -)
 * 12. invocation (., [], ())
 */

import { FhirPathLexer } from "./lexer.ts";
import { Token, TokenType } from "./tokens.ts";
import type {
  ASTNode,
  BinaryOpNode,
  EmptySetNode,
  EnvVariableNode,
  ExpressionNode,
  FunctionCallNode,
  IdentifierNode,
  IndexerNode,
  IndexNode,
  LiteralNode,
  MemberAccessNode,
  MethodCallNode,
  ParenNode,
  ThisNode,
  TotalNode,
  TypeOpNode,
  TypeSpecifierNode,
  UnaryOpNode,
} from "./ast.ts";

/**
 * Parser error with position information
 */
export class ParserError extends Error {
  constructor(
    message: string,
    public readonly token: Token,
  ) {
    super(`${message} at line ${token.line}, column ${token.column}`);
    this.name = "ParserError";
  }
}

/**
 * FHIRPath Parser
 */
export class FhirPathParser {
  private tokens: Token[] = [];
  private pos = 0;

  /**
   * Parse a FHIRPath expression string
   */
  parse(input: string): ExpressionNode {
    const lexer = new FhirPathLexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const child = this.parseExpression();

    if (!this.isAtEnd()) {
      throw new ParserError(
        `Unexpected token: ${this.peek().value}`,
        this.peek(),
      );
    }

    return {
      type: "Expression",
      child,
      start: 0,
      end: input.length,
    };
  }

  // ============================================================
  // Expression parsing (by precedence)
  // ============================================================

  private parseExpression(): ASTNode {
    return this.parseImplies();
  }

  // implies (lowest precedence)
  private parseImplies(): ASTNode {
    let left = this.parseOrXor();

    while (this.match(TokenType.IMPLIES)) {
      const operator = "implies";
      const right = this.parseOrXor();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // or, xor
  private parseOrXor(): ASTNode {
    let left = this.parseAnd();

    while (this.check(TokenType.OR) || this.check(TokenType.XOR)) {
      const operator = this.advance().value;
      const right = this.parseAnd();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // and
  private parseAnd(): ASTNode {
    let left = this.parseMembership();

    while (this.match(TokenType.AND)) {
      const right = this.parseMembership();
      left = this.makeBinaryOp("and", left, right);
    }

    return left;
  }

  // in, contains
  private parseMembership(): ASTNode {
    let left = this.parseEquality();

    while (this.check(TokenType.IN) || this.check(TokenType.CONTAINS)) {
      const operator = this.advance().value;
      const right = this.parseEquality();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // =, !=, ~, !~
  private parseEquality(): ASTNode {
    let left = this.parseComparison();

    while (
      this.check(TokenType.EQ) ||
      this.check(TokenType.NE) ||
      this.check(TokenType.EQUIVALENT) ||
      this.check(TokenType.NOT_EQUIVALENT)
    ) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // <, >, <=, >=
  private parseComparison(): ASTNode {
    let left = this.parseType();

    while (
      this.check(TokenType.LT) ||
      this.check(TokenType.GT) ||
      this.check(TokenType.LE) ||
      this.check(TokenType.GE)
    ) {
      const operator = this.advance().value;
      const right = this.parseType();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // is, as
  private parseType(): ASTNode {
    let left = this.parseUnion();

    while (this.check(TokenType.IS) || this.check(TokenType.AS)) {
      const operator = this.advance().value as "is" | "as";
      const targetType = this.parseTypeSpecifier();
      left = {
        type: "TypeOp",
        operator,
        expression: left,
        targetType,
      } as TypeOpNode;
    }

    return left;
  }

  // |
  private parseUnion(): ASTNode {
    let left = this.parseAdditive();

    while (this.match(TokenType.UNION)) {
      const right = this.parseAdditive();
      left = this.makeBinaryOp("|", left, right);
    }

    return left;
  }

  // +, -, &
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (
      this.check(TokenType.PLUS) ||
      this.check(TokenType.MINUS) ||
      this.check(TokenType.AMPERSAND)
    ) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // *, /, div, mod
  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();

    while (
      this.check(TokenType.STAR) ||
      this.check(TokenType.SLASH) ||
      this.check(TokenType.DIV) ||
      this.check(TokenType.MOD)
    ) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = this.makeBinaryOp(operator, left, right);
    }

    return left;
  }

  // +expr, -expr
  private parseUnary(): ASTNode {
    if (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const operator = this.advance().value;
      const operand = this.parseUnary();
      return {
        type: "UnaryOp",
        operator,
        operand,
      } as UnaryOpNode;
    }

    return this.parseInvocation();
  }

  // . and [] and ()
  private parseInvocation(): ASTNode {
    let left = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.DOT)) {
        // Member access or method call
        const name = this.expectIdentifier();

        if (this.check(TokenType.LPAREN)) {
          // Method call: expr.method(args)
          this.advance(); // consume (
          const args = this.parseArgumentList();
          this.expect(TokenType.RPAREN, "Expected ')' after arguments");
          left = {
            type: "MethodCall",
            object: left,
            method: { type: "Identifier", name } as IdentifierNode,
            arguments: args,
          } as MethodCallNode;
        } else {
          // Member access: expr.member
          left = {
            type: "MemberAccess",
            object: left,
            member: { type: "Identifier", name } as IdentifierNode,
          } as MemberAccessNode;
        }
      } else if (this.match(TokenType.LBRACKET)) {
        // Indexer: expr[index]
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']' after index");
        left = {
          type: "Indexer",
          object: left,
          index,
        } as IndexerNode;
      } else {
        break;
      }
    }

    return left;
  }

  // Primary expressions
  private parsePrimary(): ASTNode {
    const token = this.peek();

    // Literals
    if (this.check(TokenType.STRING)) {
      this.advance();
      return {
        type: "Literal",
        literalType: "string",
        value: token.value,
      } as LiteralNode;
    }

    if (this.check(TokenType.NUMBER)) {
      this.advance();
      return {
        type: "Literal",
        literalType: "number",
        value: parseFloat(token.value),
      } as LiteralNode;
    }

    if (this.check(TokenType.QUANTITY)) {
      this.advance();
      const match = token.value.match(/^([\d.]+)\s*(.*)$/);
      if (match) {
        return {
          type: "Literal",
          literalType: "quantity",
          value: parseFloat(match[1]),
          unit: match[2].replace(/^'|'$/g, ""),
        } as LiteralNode;
      }
      throw new ParserError(`Invalid quantity: ${token.value}`, token);
    }

    if (this.check(TokenType.TRUE)) {
      this.advance();
      return { type: "Literal", literalType: "boolean", value: true } as LiteralNode;
    }

    if (this.check(TokenType.FALSE)) {
      this.advance();
      return { type: "Literal", literalType: "boolean", value: false } as LiteralNode;
    }

    if (this.check(TokenType.DATE)) {
      this.advance();
      return { type: "Literal", literalType: "date", value: token.value } as LiteralNode;
    }

    if (this.check(TokenType.TIME)) {
      this.advance();
      return { type: "Literal", literalType: "time", value: token.value } as LiteralNode;
    }

    if (this.check(TokenType.DATETIME)) {
      this.advance();
      return { type: "Literal", literalType: "datetime", value: token.value } as LiteralNode;
    }

    // Empty set: { }
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      this.expect(TokenType.RBRACE, "Expected '}' for empty set");
      return { type: "EmptySet" } as EmptySetNode;
    }

    // Parenthesized expression
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after expression");
      return { type: "Paren", expression: expr } as ParenNode;
    }

    // Identifiers (including special ones)
    if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.DELIMITED_IDENTIFIER)) {
      const name = this.advance().value;

      // Check for special identifiers
      if (name === "$this") {
        return { type: "This" } as ThisNode;
      }
      if (name === "$index") {
        return { type: "Index" } as IndexNode;
      }
      if (name === "$total") {
        return { type: "Total" } as TotalNode;
      }

      // Environment variable
      if (name.startsWith("%")) {
        return { type: "EnvVariable", name: name.slice(1) } as EnvVariableNode;
      }

      // Function call or simple identifier
      if (this.check(TokenType.LPAREN)) {
        this.advance(); // consume (
        const args = this.parseArgumentList();
        this.expect(TokenType.RPAREN, "Expected ')' after arguments");
        return {
          type: "FunctionCall",
          function: { type: "Identifier", name } as IdentifierNode,
          arguments: args,
        } as FunctionCallNode;
      }

      return { type: "Identifier", name } as IdentifierNode;
    }

    // Keywords can also be function calls when followed by (
    // e.g., as(uri), is(Patient) - these are functions, not type operators
    if (this.isKeywordToken(token.type) && this.peekNext()?.type === TokenType.LPAREN) {
      const name = this.advance().value;
      this.advance(); // consume (
      const args = this.parseArgumentList();
      this.expect(TokenType.RPAREN, "Expected ')' after arguments");
      return {
        type: "FunctionCall",
        function: { type: "Identifier", name } as IdentifierNode,
        arguments: args,
      } as FunctionCallNode;
    }

    throw new ParserError(`Unexpected token: ${token.value}`, token);
  }

  // ============================================================
  // Helper methods
  // ============================================================

  private parseArgumentList(): ASTNode[] {
    const args: ASTNode[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    return args;
  }

  private parseTypeSpecifier(): TypeSpecifierNode {
    let namespace: string | undefined;
    let typeName = this.expectIdentifier();

    // Check for namespace: FHIR.Patient, System.String
    if (this.match(TokenType.DOT)) {
      namespace = typeName;
      typeName = this.expectIdentifier();
    }

    return {
      type: "TypeSpecifier",
      namespace,
      typeName,
    };
  }

  private expectIdentifier(): string {
    const token = this.peek();
    // Allow regular identifiers
    if (token.type === TokenType.IDENTIFIER || token.type === TokenType.DELIMITED_IDENTIFIER) {
      this.advance();
      return token.value;
    }
    // Also allow keywords as identifiers (for method names like contains(), in(), etc.)
    // This is needed because FHIRPath allows keywords as function/method names
    if (this.isKeywordToken(token.type)) {
      this.advance();
      return token.value;
    }
    throw new ParserError(`Expected identifier, got ${token.value}`, token);
  }

  private isKeywordToken(type: TokenType): boolean {
    return type === TokenType.AND ||
           type === TokenType.OR ||
           type === TokenType.XOR ||
           type === TokenType.IMPLIES ||
           type === TokenType.IS ||
           type === TokenType.AS ||
           type === TokenType.IN ||
           type === TokenType.CONTAINS ||
           type === TokenType.DIV ||
           type === TokenType.MOD ||
           type === TokenType.TRUE ||
           type === TokenType.FALSE;
  }

  private makeBinaryOp(operator: string, left: ASTNode, right: ASTNode): BinaryOpNode {
    return {
      type: "BinaryOp",
      operator,
      left,
      right,
    };
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private peekNext(): Token | undefined {
    if (this.pos + 1 < this.tokens.length) {
      return this.tokens[this.pos + 1];
    }
    return undefined;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      return this.tokens[this.pos++];
    }
    return this.tokens[this.pos];
  }

  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw new ParserError(message, this.peek());
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
}

/**
 * Convenience function to parse a FHIRPath expression
 */
export function parseFhirPath(input: string): ExpressionNode {
  const parser = new FhirPathParser();
  return parser.parse(input);
}
