/**
 * Tests for complex FHIRPath expressions
 * 
 * These tests cover edge cases and complex expressions from FHIR R6.
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseFhirPath } from "../src/parser/parser.ts";
import { evaluateFhirPath } from "../src/evaluator/evaluator.ts";
import fhirpath from "../mod.ts";

// ============================================================
// Tests for as(Type) and is(Type) as functions
// ============================================================

Deno.test("parser: as(type) function call", () => {
  const ast = parseFhirPath("value.as(uri)");
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

Deno.test("parser: is(type) function call", () => {
  const ast = parseFhirPath("value.is(string)");
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

Deno.test("parser: as(type) in union", () => {
  const ast = parseFhirPath("reference | as(uri)");
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

Deno.test("parser: complex expression with as(type) in union", () => {
  const ast = parseFhirPath("select(reference | as(uri))");
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

Deno.test("parser: RequestOrchestration constraint expression", () => {
  const expr = "contained.where((('#'+id.trace('id') in %resource.descendants().select(reference | as(uri))) or descendants().where(reference='#' | as(uri)='#').exists()).not()).trace('unmatched', id).empty()";
  const ast = parseFhirPath(expr);
  assertExists(ast);
  assertEquals(ast.type, "Expression");
});

// ============================================================
// Tests for evaluator with as(Type) function
// ============================================================

Deno.test("evaluator: as(type) function on string with String type", () => {
  const ast = parseFhirPath("value.as(String)");
  const result = evaluateFhirPath(ast, { value: "hello" });
  assertEquals(result, ["hello"]);
});

Deno.test("evaluator: as(type) function returns empty on mismatch", () => {
  const ast = parseFhirPath("value.as(Integer)");
  const result = evaluateFhirPath(ast, { value: "hello" });
  assertEquals(result, []);
});

Deno.test("evaluator: is(type) function returns boolean with String", () => {
  const ast = parseFhirPath("value.is(String)");
  const result = evaluateFhirPath(ast, { value: "hello" });
  assertEquals(result, [true]);
});

Deno.test("evaluator: is(type) function returns false on mismatch", () => {
  const ast = parseFhirPath("value.is(Integer)");
  const result = evaluateFhirPath(ast, { value: "hello" });
  assertEquals(result, [false]);
});

Deno.test("evaluator: as(Patient) on FHIR resource", () => {
  const ast = parseFhirPath("entry.resource.as(Patient)");
  const result = evaluateFhirPath(ast, { 
    entry: [{ resource: { resourceType: "Patient", id: "1" } }] 
  });
  assertEquals(result.length, 1);
  assertEquals((result[0] as Record<string, unknown>).resourceType, "Patient");
});

Deno.test("evaluator: as(Observation) returns empty on wrong type", () => {
  const ast = parseFhirPath("entry.resource.as(Observation)");
  const result = evaluateFhirPath(ast, { 
    entry: [{ resource: { resourceType: "Patient", id: "1" } }] 
  });
  assertEquals(result, []);
});

// ============================================================
// Tests for full API with complex expressions
// ============================================================

Deno.test("api: compile expression with as(type) in union", async () => {
  const compiled = fhirpath.compile("reference | as(uri)");
  assertExists(compiled);
  
  const result = compiled({ reference: "Patient/123" });
  assertExists(result);
});

Deno.test("api: complex constraint expression compiles", () => {
  const expr = "contained.where((('#'+id.trace('id') in %resource.descendants().select(reference | as(uri))) or descendants().where(reference='#' | as(uri)='#').exists()).not()).trace('unmatched', id).empty()";
  
  const compiled = fhirpath.compile({ base: "RequestOrchestration", expression: expr });
  assertExists(compiled);
  
  // Test with empty contained
  const result = compiled(
    { resourceType: "RequestOrchestration", contained: [] }, 
    { resource: { resourceType: "RequestOrchestration", contained: [] } }
  );
  assertEquals(result, [true]);
});
