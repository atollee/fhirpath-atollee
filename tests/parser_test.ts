/**
 * Tests for the native FHIRPath Parser
 */

import { assertEquals, assertExists } from "@std/assert";
import { FhirPathParser, parseFhirPath } from "../src/parser/parser.ts";
import type { 
  BinaryOpNode, 
  FunctionCallNode, 
  IdentifierNode, 
  LiteralNode,
  MemberAccessNode,
  MethodCallNode,
  TypeOpNode,
  UnaryOpNode,
  IndexerNode,
  EnvVariableNode,
  ThisNode,
} from "../src/parser/ast.ts";

Deno.test("parser: simple identifier", () => {
  const ast = parseFhirPath("name");
  
  assertEquals(ast.type, "Expression");
  const child = ast.child as IdentifierNode;
  assertEquals(child.type, "Identifier");
  assertEquals(child.name, "name");
});

Deno.test("parser: dotted path", () => {
  const ast = parseFhirPath("name.given");
  
  const child = ast.child as MemberAccessNode;
  assertEquals(child.type, "MemberAccess");
  assertEquals((child.object as IdentifierNode).name, "name");
  assertEquals(child.member.name, "given");
});

Deno.test("parser: deep dotted path", () => {
  const ast = parseFhirPath("a.b.c.d");
  
  // Should be nested: ((a.b).c).d
  const d = ast.child as MemberAccessNode;
  assertEquals(d.member.name, "d");
  
  const c = d.object as MemberAccessNode;
  assertEquals(c.member.name, "c");
  
  const b = c.object as MemberAccessNode;
  assertEquals(b.member.name, "b");
  
  const a = b.object as IdentifierNode;
  assertEquals(a.name, "a");
});

Deno.test("parser: function call", () => {
  const ast = parseFhirPath("count()");
  
  const child = ast.child as FunctionCallNode;
  assertEquals(child.type, "FunctionCall");
  assertEquals(child.function.name, "count");
  assertEquals(child.arguments.length, 0);
});

Deno.test("parser: function call with argument", () => {
  const ast = parseFhirPath("where(active = true)");
  
  const child = ast.child as FunctionCallNode;
  assertEquals(child.type, "FunctionCall");
  assertEquals(child.function.name, "where");
  assertEquals(child.arguments.length, 1);
  
  const arg = child.arguments[0] as BinaryOpNode;
  assertEquals(arg.type, "BinaryOp");
  assertEquals(arg.operator, "=");
});

Deno.test("parser: method call", () => {
  const ast = parseFhirPath("name.first()");
  
  const child = ast.child as MethodCallNode;
  assertEquals(child.type, "MethodCall");
  assertEquals(child.method.name, "first");
  assertEquals((child.object as IdentifierNode).name, "name");
});

Deno.test("parser: method call with argument", () => {
  const ast = parseFhirPath("name.where(use = 'official')");
  
  const child = ast.child as MethodCallNode;
  assertEquals(child.type, "MethodCall");
  assertEquals(child.method.name, "where");
  
  const arg = child.arguments[0] as BinaryOpNode;
  assertEquals(arg.operator, "=");
  assertEquals((arg.left as IdentifierNode).name, "use");
  assertEquals((arg.right as LiteralNode).value, "official");
});

Deno.test("parser: string literal", () => {
  const ast = parseFhirPath("'hello'");
  
  const child = ast.child as LiteralNode;
  assertEquals(child.type, "Literal");
  assertEquals(child.literalType, "string");
  assertEquals(child.value, "hello");
});

Deno.test("parser: number literal", () => {
  const ast = parseFhirPath("42");
  
  const child = ast.child as LiteralNode;
  assertEquals(child.type, "Literal");
  assertEquals(child.literalType, "number");
  assertEquals(child.value, 42);
});

Deno.test("parser: boolean literals", () => {
  const trueAst = parseFhirPath("true");
  assertEquals((trueAst.child as LiteralNode).value, true);
  
  const falseAst = parseFhirPath("false");
  assertEquals((falseAst.child as LiteralNode).value, false);
});

Deno.test("parser: quantity literal", () => {
  const ast = parseFhirPath("10 'kg'");
  
  const child = ast.child as LiteralNode;
  assertEquals(child.type, "Literal");
  assertEquals(child.literalType, "quantity");
  assertEquals(child.value, 10);
  assertEquals(child.unit, "kg");
});

Deno.test("parser: arithmetic operators", () => {
  const ast = parseFhirPath("1 + 2");
  
  const child = ast.child as BinaryOpNode;
  assertEquals(child.type, "BinaryOp");
  assertEquals(child.operator, "+");
  assertEquals((child.left as LiteralNode).value, 1);
  assertEquals((child.right as LiteralNode).value, 2);
});

Deno.test("parser: operator precedence (multiply before add)", () => {
  const ast = parseFhirPath("1 + 2 * 3");
  
  // Should be: 1 + (2 * 3)
  const child = ast.child as BinaryOpNode;
  assertEquals(child.operator, "+");
  assertEquals((child.left as LiteralNode).value, 1);
  
  const mult = child.right as BinaryOpNode;
  assertEquals(mult.operator, "*");
  assertEquals((mult.left as LiteralNode).value, 2);
  assertEquals((mult.right as LiteralNode).value, 3);
});

Deno.test("parser: comparison operators", () => {
  const operators = ["<", ">", "<=", ">="];
  
  for (const op of operators) {
    const ast = parseFhirPath(`1 ${op} 2`);
    const child = ast.child as BinaryOpNode;
    assertEquals(child.operator, op);
  }
});

Deno.test("parser: equality operators", () => {
  const operators = ["=", "!=", "~", "!~"];
  
  for (const op of operators) {
    const ast = parseFhirPath(`a ${op} b`);
    const child = ast.child as BinaryOpNode;
    assertEquals(child.operator, op);
  }
});

Deno.test("parser: logical operators", () => {
  const ast = parseFhirPath("a and b or c");
  
  // Should be: (a and b) or c  (and has higher precedence)
  const child = ast.child as BinaryOpNode;
  assertEquals(child.operator, "or");
  
  const andOp = child.left as BinaryOpNode;
  assertEquals(andOp.operator, "and");
});

Deno.test("parser: implies operator", () => {
  const ast = parseFhirPath("a implies b");
  
  const child = ast.child as BinaryOpNode;
  assertEquals(child.operator, "implies");
});

Deno.test("parser: union operator", () => {
  const ast = parseFhirPath("a | b");
  
  const child = ast.child as BinaryOpNode;
  assertEquals(child.operator, "|");
});

Deno.test("parser: unary minus", () => {
  const ast = parseFhirPath("-5");
  
  const child = ast.child as UnaryOpNode;
  assertEquals(child.type, "UnaryOp");
  assertEquals(child.operator, "-");
  assertEquals((child.operand as LiteralNode).value, 5);
});

Deno.test("parser: type operators (is, as)", () => {
  const isAst = parseFhirPath("value is Quantity");
  const isChild = isAst.child as TypeOpNode;
  assertEquals(isChild.type, "TypeOp");
  assertEquals(isChild.operator, "is");
  assertEquals(isChild.targetType.typeName, "Quantity");
  
  const asAst = parseFhirPath("value as Quantity");
  const asChild = asAst.child as TypeOpNode;
  assertEquals(asChild.operator, "as");
});

Deno.test("parser: type with namespace", () => {
  const ast = parseFhirPath("value is FHIR.Patient");
  
  const child = ast.child as TypeOpNode;
  assertEquals(child.targetType.namespace, "FHIR");
  assertEquals(child.targetType.typeName, "Patient");
});

Deno.test("parser: indexer", () => {
  const ast = parseFhirPath("name[0]");
  
  const child = ast.child as IndexerNode;
  assertEquals(child.type, "Indexer");
  assertEquals((child.object as IdentifierNode).name, "name");
  assertEquals((child.index as LiteralNode).value, 0);
});

Deno.test("parser: $this", () => {
  const ast = parseFhirPath("$this");
  
  const child = ast.child as ThisNode;
  assertEquals(child.type, "This");
});

Deno.test("parser: environment variable", () => {
  const ast = parseFhirPath("%resource");
  
  const child = ast.child as EnvVariableNode;
  assertEquals(child.type, "EnvVariable");
  assertEquals(child.name, "resource");
});

Deno.test("parser: parentheses", () => {
  const ast = parseFhirPath("(1 + 2) * 3");
  
  // Should be: (1 + 2) * 3
  const child = ast.child as BinaryOpNode;
  assertEquals(child.operator, "*");
  assertEquals((child.right as LiteralNode).value, 3);
  
  // Left should be the parenthesized expression
  const paren = child.left;
  assertEquals(paren.type, "Paren");
});

Deno.test("parser: empty set", () => {
  const ast = parseFhirPath("{ }");
  
  assertEquals(ast.child.type, "EmptySet");
});

Deno.test("parser: complex expression", () => {
  const ast = parseFhirPath("Patient.name.where(use = 'official').given.first()");
  
  // Should parse without errors
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

Deno.test("parser: membership operators", () => {
  const inAst = parseFhirPath("a in b");
  assertEquals((inAst.child as BinaryOpNode).operator, "in");
  
  const containsAst = parseFhirPath("a contains b");
  assertEquals((containsAst.child as BinaryOpNode).operator, "contains");
});

Deno.test("parser: multiple function arguments", () => {
  const ast = parseFhirPath("iif(condition, 'yes', 'no')");
  
  const child = ast.child as FunctionCallNode;
  assertEquals(child.function.name, "iif");
  assertEquals(child.arguments.length, 3);
});

Deno.test("parser: chained method calls", () => {
  const ast = parseFhirPath("name.first().toUpper()");
  
  const outer = ast.child as MethodCallNode;
  assertEquals(outer.method.name, "toUpper");
  
  const inner = outer.object as MethodCallNode;
  assertEquals(inner.method.name, "first");
});
