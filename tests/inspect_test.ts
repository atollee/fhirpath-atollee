/**
 * Tests for inspect() and registry APIs
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { inspect, formatTraces, createInspector, registry } from "../mod.ts";

const patient = {
  resourceType: "Patient",
  id: "123",
  name: [
    { use: "official", family: "Müller", given: ["Hans", "Peter"] },
    { use: "nickname", family: "M", given: ["Hansi"] },
  ],
  birthDate: "1980-05-15",
};

// ============================================================
// INSPECT TESTS
// ============================================================

Deno.test("inspect - basic evaluation", () => {
  const result = inspect("name.given", { input: patient });
  
  assertEquals(result.result, ["Hans", "Peter", "Hansi"]);
  assertEquals(result.expression, "name.given");
  assertExists(result.ast);
  assert(result.executionTime >= 0);
  assertEquals(result.traces.length, 0);
});

Deno.test("inspect - captures trace() calls", () => {
  const result = inspect(
    "name.trace('all names').where(use = 'official').trace('official').given.first()",
    { input: patient }
  );
  
  assertEquals(result.result, ["Hans"]);
  assertEquals(result.traces.length, 2);
  
  // First trace
  assertEquals(result.traces[0].name, "all names");
  assertEquals(result.traces[0].values.length, 2);
  assert(result.traces[0].timestamp >= 0);
  
  // Second trace
  assertEquals(result.traces[1].name, "official");
  assertEquals(result.traces[1].values.length, 1);
  assert(result.traces[1].timestamp >= result.traces[0].timestamp);
});

Deno.test("inspect - handles errors gracefully", () => {
  const result = inspect("invalid..expression", { input: patient });
  
  assertEquals(result.result, []);
  assertExists(result.errors);
  assert(result.errors!.length > 0);
});

Deno.test("inspect - with variables", () => {
  const result = inspect(
    "name.where(use = %targetUse).given.first()",
    { 
      input: patient,
      variables: { targetUse: "nickname" }
    }
  );
  
  assertEquals(result.result, ["Hansi"]);
});

Deno.test("inspect - respects maxTraces", () => {
  // Create an expression that would generate many traces
  const result = inspect(
    "name.trace('1').trace('2').trace('3').trace('4').trace('5').given",
    { 
      input: patient,
      maxTraces: 3
    }
  );
  
  assertEquals(result.traces.length, 3);
});

Deno.test("formatTraces - formats traces nicely", () => {
  const result = inspect(
    "name.trace('names').given.trace('given')",
    { input: patient }
  );
  
  const formatted = formatTraces(result.traces);
  
  assert(formatted.includes("names:"));
  assert(formatted.includes("given:"));
  assert(formatted.includes("ms"));
});

Deno.test("formatTraces - handles empty traces", () => {
  const formatted = formatTraces([]);
  assertEquals(formatted, "No traces captured");
});

Deno.test("createInspector - preset options", () => {
  const inspectPatient = createInspector({
    input: patient,
  });
  
  const result = inspectPatient("name.family");
  assertEquals(result.result, ["Müller", "M"]);
});

// ============================================================
// REGISTRY TESTS
// ============================================================

Deno.test("registry - listFunctions returns all functions", () => {
  const functions = registry.listFunctions();
  
  assert(functions.length > 50);
  assert(functions.some(f => f.name === "where"));
  assert(functions.some(f => f.name === "select"));
  assert(functions.some(f => f.name === "first"));
});

Deno.test("registry - getFunction returns function details", () => {
  const whereFunc = registry.getFunction("where");
  
  assertExists(whereFunc);
  assertEquals(whereFunc.name, "where");
  assertEquals(whereFunc.category, "Filtering");
  assert(whereFunc.signatures.length > 0);
  assert(whereFunc.description.includes("Filters"));
});

Deno.test("registry - getFunction returns undefined for unknown", () => {
  const unknown = registry.getFunction("nonexistent");
  assertEquals(unknown, undefined);
});

Deno.test("registry - listFunctions by category", () => {
  const stringFuncs = registry.listFunctions({ category: "String" });
  
  assert(stringFuncs.length > 5);
  assert(stringFuncs.every(f => f.category === "String"));
  assert(stringFuncs.some(f => f.name === "substring"));
  assert(stringFuncs.some(f => f.name === "upper"));
});

Deno.test("registry - listFunctions by specVersion", () => {
  const v3Funcs = registry.listFunctions({ specVersion: "3.0.0-ballot" });
  
  assert(v3Funcs.length > 0);
  assert(v3Funcs.some(f => f.name === "split"));
  assert(v3Funcs.some(f => f.name === "join"));
  assert(v3Funcs.some(f => f.name === "defineVariable"));
});

Deno.test("registry - listOperators returns all operators", () => {
  const operators = registry.listOperators();
  
  assert(operators.length > 10);
  assert(operators.some(o => o.symbol === "+"));
  assert(operators.some(o => o.symbol === "and"));
  assert(operators.some(o => o.symbol === "="));
});

Deno.test("registry - getOperator returns operator details", () => {
  const plus = registry.getOperator("+");
  
  assertExists(plus);
  assertEquals(plus.symbol, "+");
  assertEquals(plus.category, "Arithmetic");
  assert(plus.precedence > 0);
});

Deno.test("registry - listOperators by category", () => {
  const boolOps = registry.listOperators({ category: "Boolean" });
  
  assert(boolOps.every(o => o.category === "Boolean"));
  assert(boolOps.some(o => o.symbol === "and"));
  assert(boolOps.some(o => o.symbol === "or"));
});

Deno.test("registry - getFunctionCategories", () => {
  const categories = registry.getFunctionCategories();
  
  assert(categories.includes("String"));
  assert(categories.includes("Math"));
  assert(categories.includes("Filtering"));
  assert(categories.includes("Existence"));
});

Deno.test("registry - getFunctionsByCategory", () => {
  const byCategory = registry.getFunctionsByCategory();
  
  assertExists(byCategory.String);
  assertExists(byCategory.Math);
  assert(byCategory.String.length > 0);
  assert(byCategory.Math.length > 0);
});

Deno.test("registry - searchFunctions", () => {
  const results = registry.searchFunctions("string");
  
  assert(results.length > 0);
  assert(results.some(f => 
    f.name.toLowerCase().includes("string") || 
    f.description.toLowerCase().includes("string")
  ));
});

Deno.test("registry - getStats", () => {
  const stats = registry.getStats();
  
  assert(stats.functions > 50);
  assert(stats.operators > 10);
  assert(stats.categories > 5);
});

// ============================================================
// API INTEGRATION TESTS
// ============================================================

Deno.test("fhirpath API - inspect is accessible", async () => {
  const fhirpath = (await import("../mod.ts")).default;
  
  const result = fhirpath.inspect("name.given", { input: patient });
  assertEquals(result.result, ["Hans", "Peter", "Hansi"]);
});

Deno.test("fhirpath API - registry is accessible", async () => {
  const fhirpath = (await import("../mod.ts")).default;
  
  const functions = fhirpath.registry.listFunctions();
  assert(functions.length > 0);
});
