/**
 * FHIRPath Parser Module
 * 
 * Native TypeScript implementation of the FHIRPath lexer and parser.
 * This replaces the ANTLR4-based parser with a faster, more maintainable solution.
 */

export { FhirPathLexer, LexerError } from "./lexer.ts";
export { FhirPathParser, ParserError, parseFhirPath } from "./parser.ts";
export { TokenType, type Token, KEYWORDS, isKeyword, getKeywordType } from "./tokens.ts";
export type * from "./ast.ts";
