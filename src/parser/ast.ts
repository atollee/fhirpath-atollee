/**
 * FHIRPath AST Node Types
 * 
 * These types represent the Abstract Syntax Tree for FHIRPath expressions.
 * The AST is produced by the parser and consumed by the evaluator.
 */

/**
 * Base interface for all AST nodes
 */
export interface ASTNode {
  type: string;
  /** Starting position in source */
  start?: number;
  /** Ending position in source */
  end?: number;
}

/**
 * Root node for a complete FHIRPath expression
 */
export interface ExpressionNode extends ASTNode {
  type: "Expression";
  child: ASTNode;
}

/**
 * Literal values: strings, numbers, booleans, dates, etc.
 */
export interface LiteralNode extends ASTNode {
  type: "Literal";
  literalType: "string" | "number" | "boolean" | "date" | "time" | "datetime" | "quantity" | "null";
  value: unknown;
  unit?: string;  // For quantities
}

/**
 * Identifier: property names, function names, type names
 */
export interface IdentifierNode extends ASTNode {
  type: "Identifier";
  name: string;
}

/**
 * Member access: a.b
 */
export interface MemberAccessNode extends ASTNode {
  type: "MemberAccess";
  object: ASTNode;
  member: IdentifierNode;
}

/**
 * Function invocation: func(arg1, arg2)
 */
export interface FunctionCallNode extends ASTNode {
  type: "FunctionCall";
  function: IdentifierNode;
  arguments: ASTNode[];
}

/**
 * Method call: expr.method(args)
 */
export interface MethodCallNode extends ASTNode {
  type: "MethodCall";
  object: ASTNode;
  method: IdentifierNode;
  arguments: ASTNode[];
}

/**
 * Indexer: expr[index]
 */
export interface IndexerNode extends ASTNode {
  type: "Indexer";
  object: ASTNode;
  index: ASTNode;
}

/**
 * Binary operation: a + b, a and b, etc.
 */
export interface BinaryOpNode extends ASTNode {
  type: "BinaryOp";
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

/**
 * Unary operation: -a, +a
 */
export interface UnaryOpNode extends ASTNode {
  type: "UnaryOp";
  operator: string;
  operand: ASTNode;
}

/**
 * Type specifier: is Type, as Type, ofType(Type)
 */
export interface TypeSpecifierNode extends ASTNode {
  type: "TypeSpecifier";
  namespace?: string;
  typeName: string;
}

/**
 * Type operation: expr is Type, expr as Type
 */
export interface TypeOpNode extends ASTNode {
  type: "TypeOp";
  operator: "is" | "as";
  expression: ASTNode;
  targetType: TypeSpecifierNode;
}

/**
 * This literal: $this
 */
export interface ThisNode extends ASTNode {
  type: "This";
}

/**
 * Index literal: $index
 */
export interface IndexNode extends ASTNode {
  type: "Index";
}

/**
 * Total literal: $total
 */
export interface TotalNode extends ASTNode {
  type: "Total";
}

/**
 * Environment variable: %resource, %context, etc.
 */
export interface EnvVariableNode extends ASTNode {
  type: "EnvVariable";
  name: string;
}

/**
 * Empty collection: { }
 */
export interface EmptySetNode extends ASTNode {
  type: "EmptySet";
}

/**
 * Parenthesized expression: (expr)
 */
export interface ParenNode extends ASTNode {
  type: "Paren";
  expression: ASTNode;
}

/**
 * Union of all AST node types
 */
export type FhirPathASTNode =
  | ExpressionNode
  | LiteralNode
  | IdentifierNode
  | MemberAccessNode
  | FunctionCallNode
  | MethodCallNode
  | IndexerNode
  | BinaryOpNode
  | UnaryOpNode
  | TypeSpecifierNode
  | TypeOpNode
  | ThisNode
  | IndexNode
  | TotalNode
  | EnvVariableNode
  | EmptySetNode
  | ParenNode;
