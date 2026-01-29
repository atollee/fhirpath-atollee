/**
 * Tests for the native FHIRPath Lexer
 */

import { assertEquals, assertThrows } from "@std/assert";
import { FhirPathLexer, LexerError } from "../src/parser/lexer.ts";
import { TokenType } from "../src/parser/tokens.ts";

Deno.test("lexer: simple identifiers", () => {
  const lexer = new FhirPathLexer("name");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2); // IDENTIFIER + EOF
  assertEquals(tokens[0].type, TokenType.IDENTIFIER);
  assertEquals(tokens[0].value, "name");
});

Deno.test("lexer: dotted path", () => {
  const lexer = new FhirPathLexer("name.given");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 4); // name, DOT, given, EOF
  assertEquals(tokens[0].type, TokenType.IDENTIFIER);
  assertEquals(tokens[0].value, "name");
  assertEquals(tokens[1].type, TokenType.DOT);
  assertEquals(tokens[2].type, TokenType.IDENTIFIER);
  assertEquals(tokens[2].value, "given");
});

Deno.test("lexer: function call", () => {
  const lexer = new FhirPathLexer("name.first()");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 6); // name, DOT, first, LPAREN, RPAREN, EOF
  assertEquals(tokens[2].type, TokenType.IDENTIFIER);
  assertEquals(tokens[2].value, "first");
  assertEquals(tokens[3].type, TokenType.LPAREN);
  assertEquals(tokens[4].type, TokenType.RPAREN);
});

Deno.test("lexer: string literals", () => {
  const lexer = new FhirPathLexer("'hello world'");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.STRING);
  assertEquals(tokens[0].value, "hello world");
});

Deno.test("lexer: string with escapes", () => {
  const lexer = new FhirPathLexer("'hello\\nworld'");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[0].value, "hello\nworld");
});

Deno.test("lexer: numbers", () => {
  const testCases = [
    { input: "42", expected: "42" },
    { input: "3.14", expected: "3.14" },
    { input: "1.5e10", expected: "1.5e10" },
    { input: "2.5E-3", expected: "2.5E-3" },
  ];
  
  for (const { input, expected } of testCases) {
    const lexer = new FhirPathLexer(input);
    const tokens = lexer.tokenize();
    assertEquals(tokens[0].type, TokenType.NUMBER);
    assertEquals(tokens[0].value, expected);
  }
});

Deno.test("lexer: quantity with UCUM unit", () => {
  const lexer = new FhirPathLexer("10 'kg'");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.QUANTITY);
  assertEquals(tokens[0].value, "10 'kg'");
});

Deno.test("lexer: quantity with time unit", () => {
  const lexer = new FhirPathLexer("2 years");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.QUANTITY);
  assertEquals(tokens[0].value, "2 years");
});

Deno.test("lexer: date literal", () => {
  const lexer = new FhirPathLexer("@2024-01-15");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.DATE);
  assertEquals(tokens[0].value, "2024-01-15");
});

Deno.test("lexer: datetime literal", () => {
  const lexer = new FhirPathLexer("@2024-01-15T10:30:00Z");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.DATETIME);
  assertEquals(tokens[0].value, "2024-01-15T10:30:00Z");
});

Deno.test("lexer: time literal", () => {
  const lexer = new FhirPathLexer("@T10:30:00");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 2);
  assertEquals(tokens[0].type, TokenType.TIME);
  assertEquals(tokens[0].value, "T10:30:00");
});

Deno.test("lexer: keywords", () => {
  const keywords = [
    { input: "and", type: TokenType.AND },
    { input: "or", type: TokenType.OR },
    { input: "xor", type: TokenType.XOR },
    { input: "implies", type: TokenType.IMPLIES },
    { input: "is", type: TokenType.IS },
    { input: "as", type: TokenType.AS },
    { input: "true", type: TokenType.TRUE },
    { input: "false", type: TokenType.FALSE },
    { input: "div", type: TokenType.DIV },
    { input: "mod", type: TokenType.MOD },
  ];
  
  for (const { input, type } of keywords) {
    const lexer = new FhirPathLexer(input);
    const tokens = lexer.tokenize();
    assertEquals(tokens[0].type, type, `Expected ${input} to be ${type}`);
  }
});

Deno.test("lexer: comparison operators", () => {
  const operators = [
    { input: "=", type: TokenType.EQ },
    { input: "!=", type: TokenType.NE },
    { input: "<", type: TokenType.LT },
    { input: ">", type: TokenType.GT },
    { input: "<=", type: TokenType.LE },
    { input: ">=", type: TokenType.GE },
    { input: "~", type: TokenType.EQUIVALENT },
    { input: "!~", type: TokenType.NOT_EQUIVALENT },
  ];
  
  for (const { input, type } of operators) {
    const lexer = new FhirPathLexer(input);
    const tokens = lexer.tokenize();
    assertEquals(tokens[0].type, type, `Expected ${input} to be ${type}`);
  }
});

Deno.test("lexer: arithmetic operators", () => {
  const lexer = new FhirPathLexer("1 + 2 - 3 * 4 / 5");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[1].type, TokenType.PLUS);
  assertEquals(tokens[3].type, TokenType.MINUS);
  assertEquals(tokens[5].type, TokenType.STAR);
  assertEquals(tokens[7].type, TokenType.SLASH);
});

Deno.test("lexer: environment variables", () => {
  const lexer = new FhirPathLexer("%resource.id");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 4); // %resource, DOT, id, EOF
  assertEquals(tokens[0].type, TokenType.IDENTIFIER);
  assertEquals(tokens[0].value, "%resource");
});

Deno.test("lexer: special identifiers", () => {
  const specials = ["$this", "$index", "$total"];
  
  for (const special of specials) {
    const lexer = new FhirPathLexer(special);
    const tokens = lexer.tokenize();
    assertEquals(tokens[0].type, TokenType.IDENTIFIER);
    assertEquals(tokens[0].value, special);
  }
});

Deno.test("lexer: delimited identifier", () => {
  const lexer = new FhirPathLexer("`hello world`");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[0].type, TokenType.DELIMITED_IDENTIFIER);
  assertEquals(tokens[0].value, "hello world");
});

Deno.test("lexer: where clause", () => {
  const lexer = new FhirPathLexer("name.where(use = 'official')");
  const tokens = lexer.tokenize();
  
  // name . where ( use = 'official' ) EOF
  assertEquals(tokens.length, 9);
  assertEquals(tokens[2].value, "where");
  assertEquals(tokens[4].value, "use");
  assertEquals(tokens[5].type, TokenType.EQ);
  assertEquals(tokens[6].value, "official");
});

Deno.test("lexer: union operator", () => {
  const lexer = new FhirPathLexer("a | b");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[1].type, TokenType.UNION);
});

Deno.test("lexer: indexer", () => {
  const lexer = new FhirPathLexer("name[0]");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens.length, 5); // name, [, 0, ], EOF
  assertEquals(tokens[1].type, TokenType.LBRACKET);
  assertEquals(tokens[2].type, TokenType.NUMBER);
  assertEquals(tokens[3].type, TokenType.RBRACKET);
});

Deno.test("lexer: complex expression", () => {
  const lexer = new FhirPathLexer("Patient.name.where(use = 'official').given.first()");
  const tokens = lexer.tokenize();
  
  // Should tokenize without errors
  assertEquals(tokens[tokens.length - 1].type, TokenType.EOF);
  assertEquals(tokens[0].value, "Patient");
});

Deno.test("lexer: boolean literals", () => {
  const lexer = new FhirPathLexer("true and false");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[0].type, TokenType.TRUE);
  assertEquals(tokens[1].type, TokenType.AND);
  assertEquals(tokens[2].type, TokenType.FALSE);
});

Deno.test("lexer: whitespace is ignored", () => {
  const lexer1 = new FhirPathLexer("a.b");
  const lexer2 = new FhirPathLexer("a . b");
  const lexer3 = new FhirPathLexer("a  .  b");
  
  const tokens1 = lexer1.tokenize();
  const tokens2 = lexer2.tokenize();
  const tokens3 = lexer3.tokenize();
  
  assertEquals(tokens1.length, tokens2.length);
  assertEquals(tokens2.length, tokens3.length);
});

Deno.test("lexer: unterminated string throws error", () => {
  const lexer = new FhirPathLexer("'unterminated");
  assertThrows(() => lexer.tokenize(), LexerError);
});

Deno.test("lexer: position tracking", () => {
  const lexer = new FhirPathLexer("abc def");
  const tokens = lexer.tokenize();
  
  assertEquals(tokens[0].start, 0);
  assertEquals(tokens[0].end, 3);
  assertEquals(tokens[0].line, 1);
  assertEquals(tokens[0].column, 1);
  
  assertEquals(tokens[1].start, 4);
  assertEquals(tokens[1].line, 1);
  assertEquals(tokens[1].column, 5);
});
