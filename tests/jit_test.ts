/**
 * JIT Compiler Tests
 * 
 * Tests for the FHIRPath JIT compiler that generates native JavaScript functions.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { createDefaultAPI } from "../src/api.ts";
import { FhirPathJIT, compileJIT, clearJITCache } from "../src/jit/mod.ts";
import { FhirPathEngine } from "../src/engine.ts";

const fhirpath = createDefaultAPI();
const engine = new FhirPathEngine();

// Test patient resource
const patient = {
  resourceType: "Patient",
  id: "example",
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", family: "Doe", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-01-15",
  active: true,
  identifier: [
    { system: "http://example.org/mrn", value: "12345" },
    { system: "http://example.org/ssn", value: "999-99-9999" },
  ],
  address: [
    { city: "Boston", state: "MA", country: "USA", line: ["123 Main St"] },
  ],
  telecom: [
    { system: "phone", value: "555-1234" },
    { system: "email", value: "john@example.com" },
  ],
  extension: [
    {
      url: "http://example.org/fhir/StructureDefinition/birthPlace",
      valueString: "New York",
    },
  ],
};

// Helper to compare JIT vs interpreted results
function assertJitMatches(expression: string, resource: unknown = patient) {
  const interpreted = fhirpath.evaluate(resource, expression);
  const jitCompiled = fhirpath.compileJIT(expression);
  const jitResult = jitCompiled(resource);
  
  assertEquals(
    jitResult,
    interpreted,
    `JIT result doesn't match interpreted for: ${expression}`
  );
}

// ============================================================================
// Basic Property Access
// ============================================================================

Deno.test("jit: simple property access", () => {
  assertJitMatches("gender");
  assertJitMatches("birthDate");
  assertJitMatches("active");
});

Deno.test("jit: nested property access", () => {
  assertJitMatches("name.family");
  assertJitMatches("name.given");
  assertJitMatches("address.city");
});

Deno.test("jit: deep property access", () => {
  assertJitMatches("name.given");
  assertJitMatches("identifier.value");
  assertJitMatches("telecom.value");
});

// ============================================================================
// Collection Methods
// ============================================================================

Deno.test("jit: first()", () => {
  assertJitMatches("name.first()");
  assertJitMatches("name.first().family");
  assertJitMatches("name.given.first()");
});

Deno.test("jit: last()", () => {
  assertJitMatches("name.last()");
  assertJitMatches("name.given.last()");
});

Deno.test("jit: single()", () => {
  assertJitMatches("gender.single()");
});

Deno.test("jit: tail()", () => {
  assertJitMatches("name.tail()");
  assertJitMatches("name.given.tail()");
});

Deno.test("jit: skip()", () => {
  assertJitMatches("name.skip(1)");
  assertJitMatches("name.given.skip(2)");
});

Deno.test("jit: take()", () => {
  assertJitMatches("name.take(1)");
  assertJitMatches("name.given.take(2)");
});

Deno.test("jit: count()", () => {
  assertJitMatches("name.count()");
  assertJitMatches("name.given.count()");
  assertJitMatches("identifier.count()");
});

Deno.test("jit: empty()", () => {
  assertJitMatches("name.empty()");
  assertJitMatches("extension.empty()");
});

Deno.test("jit: exists()", () => {
  assertJitMatches("name.exists()");
  assertJitMatches("name.exists(use = 'official')");
  assertJitMatches("contact.exists()");
});

Deno.test("jit: distinct()", () => {
  const data = { values: [1, 2, 2, 3, 3, 3] };
  assertJitMatches("values.distinct()", data);
});

// ============================================================================
// where() Filter
// ============================================================================

Deno.test("jit: where() with equality", () => {
  assertJitMatches("name.where(use = 'official')");
  assertJitMatches("name.where(use = 'nickname')");
  assertJitMatches("identifier.where(system = 'http://example.org/mrn')");
});

Deno.test("jit: where() chained", () => {
  assertJitMatches("name.where(use = 'official').family");
  assertJitMatches("name.where(use = 'official').given");
  assertJitMatches("name.where(use = 'official').given.first()");
});

Deno.test("jit: where() with boolean", () => {
  const data = { items: [{ active: true, name: "A" }, { active: false, name: "B" }] };
  assertJitMatches("items.where(active = true).name", data);
});

// ============================================================================
// select() Projection
// ============================================================================

Deno.test("jit: select()", () => {
  assertJitMatches("name.select(family)");
  assertJitMatches("name.select(given)");
});

// ============================================================================
// all() and exists() with criteria
// ============================================================================

Deno.test("jit: all()", () => {
  assertJitMatches("name.all(family.exists())");
  const data = { numbers: [1, 2, 3] };
  assertJitMatches("numbers.all($this > 0)", data);
});

Deno.test("jit: exists() with criteria", () => {
  assertJitMatches("name.exists(family = 'Doe')");
  assertJitMatches("identifier.exists(system = 'http://example.org/mrn')");
});

// ============================================================================
// String Methods
// ============================================================================

Deno.test("jit: startsWith()", () => {
  assertJitMatches("birthDate.startsWith('1990')");
  assertJitMatches("gender.startsWith('m')");
});

Deno.test("jit: endsWith()", () => {
  assertJitMatches("birthDate.endsWith('15')");
  assertJitMatches("gender.endsWith('e')");
});

Deno.test("jit: contains()", () => {
  assertJitMatches("birthDate.contains('-01-')");
  assertJitMatches("gender.contains('al')");
});

Deno.test("jit: matches()", () => {
  assertJitMatches("birthDate.matches('^\\\\d{4}')");
  assertJitMatches("gender.matches('male')");
});

Deno.test("jit: replace()", () => {
  assertJitMatches("gender.replace('male', 'MALE')");
});

Deno.test("jit: length()", () => {
  assertJitMatches("gender.length()");
  assertJitMatches("birthDate.length()");
});

Deno.test("jit: substring()", () => {
  assertJitMatches("birthDate.substring(0, 4)");
  assertJitMatches("birthDate.substring(5)");
});

Deno.test("jit: upper() and lower()", () => {
  assertJitMatches("gender.upper()");
  assertJitMatches("gender.lower()");
});

Deno.test("jit: trim()", () => {
  const data = { text: "  hello  " };
  assertJitMatches("text.trim()", data);
});

Deno.test("jit: split()", () => {
  assertJitMatches("birthDate.split('-')");
});

Deno.test("jit: join()", () => {
  assertJitMatches("name.given.join(', ')");
  assertJitMatches("name.given.join('')");
});

Deno.test("jit: indexOf()", () => {
  assertJitMatches("birthDate.indexOf('-')");
});

// ============================================================================
// Type Conversions
// ============================================================================

Deno.test("jit: toString()", () => {
  const data = { num: 42 };
  assertJitMatches("num.toString()", data);
});

Deno.test("jit: toInteger()", () => {
  const data = { str: "42" };
  assertJitMatches("str.toInteger()", data);
});

Deno.test("jit: toDecimal()", () => {
  const data = { str: "3.14" };
  assertJitMatches("str.toDecimal()", data);
});

Deno.test("jit: toBoolean()", () => {
  const data = { str: "true" };
  assertJitMatches("str.toBoolean()", data);
});

// ============================================================================
// Boolean Logic
// ============================================================================

Deno.test("jit: not()", () => {
  assertJitMatches("active.not()");
  const data = { flag: false };
  assertJitMatches("flag.not()", data);
});

Deno.test("jit: hasValue()", () => {
  assertJitMatches("gender.hasValue()");
  assertJitMatches("name.first().hasValue()");
});

// ============================================================================
// Binary Operations
// ============================================================================

Deno.test("jit: equality operators", () => {
  assertJitMatches("gender = 'male'");
  assertJitMatches("gender != 'female'");
  assertJitMatches("active = true");
});

Deno.test("jit: comparison operators", () => {
  const data = { age: 30 };
  assertJitMatches("age > 20", data);
  assertJitMatches("age >= 30", data);
  assertJitMatches("age < 40", data);
  assertJitMatches("age <= 30", data);
});

Deno.test("jit: arithmetic operators", () => {
  const data = { a: 10, b: 3 };
  assertJitMatches("a + b", data);
  assertJitMatches("a - b", data);
  assertJitMatches("a * b", data);
  assertJitMatches("a / b", data);
});

Deno.test("jit: div and mod", () => {
  const data = { a: 10, b: 3 };
  assertJitMatches("a div b", data);
  assertJitMatches("a mod b", data);
});

Deno.test("jit: string concatenation", () => {
  assertJitMatches("name.first().family + ', ' + name.first().given.first()");
});

Deno.test("jit: boolean and/or", () => {
  assertJitMatches("active and (gender = 'male')");
  assertJitMatches("active or (gender = 'female')");
});

Deno.test("jit: union operator", () => {
  assertJitMatches("name.first().given | name.last().given");
});

Deno.test("jit: in operator", () => {
  const data = { value: 2, list: [1, 2, 3] };
  assertJitMatches("value in list", data);
});

Deno.test("jit: contains operator", () => {
  const data = { value: 2, list: [1, 2, 3] };
  assertJitMatches("list contains value", data);
});

// ============================================================================
// Unary Operations
// ============================================================================

Deno.test("jit: unary minus", () => {
  const data = { num: 5 };
  assertJitMatches("-num", data);
});

Deno.test("jit: unary plus", () => {
  const data = { num: 5 };
  assertJitMatches("+num", data);
});

// ============================================================================
// Type Operations
// ============================================================================

Deno.test("jit: is operator", () => {
  assertJitMatches("$this is Patient");
  assertJitMatches("gender is String");
});

Deno.test("jit: as operator", () => {
  assertJitMatches("$this as Patient");
});

Deno.test("jit: ofType()", () => {
  // Direct JIT test for FHIR resource filtering
  // Note: The interpreter has different behavior for ofType, so we test JIT directly
  const bundle = {
    resourceType: "Bundle",
    entry: [
      { resource: { resourceType: "Patient", id: "p1" } },
      { resource: { resourceType: "Observation", id: "o1" } },
    ],
  };
  
  // Test ofType(Patient)
  const jitPatient = fhirpath.compileJIT("entry.resource.ofType(Patient)");
  const patients = jitPatient(bundle);
  assertEquals(patients.length, 1);
  assertEquals((patients[0] as any).resourceType, "Patient");
  assertEquals((patients[0] as any).id, "p1");
  
  // Test ofType(Observation)
  const jitObs = fhirpath.compileJIT("entry.resource.ofType(Observation)");
  const observations = jitObs(bundle);
  assertEquals(observations.length, 1);
  assertEquals((observations[0] as any).resourceType, "Observation");
  assertEquals((observations[0] as any).id, "o1");
  
  // Test ofType with primitive types
  const data = { items: ["hello", 42, true, "world", 3.14] };
  const jitStrings = fhirpath.compileJIT("items.ofType(String)");
  const strings = jitStrings(data);
  assertEquals(strings.length, 2);
  assert(strings.includes("hello"));
  assert(strings.includes("world"));
});

// ============================================================================
// Collection Operations
// ============================================================================

Deno.test("jit: union()", () => {
  const data = { a: [1, 2], b: [2, 3] };
  assertJitMatches("a.union(b)", data);
});

Deno.test("jit: combine()", () => {
  const data = { a: [1, 2], b: [2, 3] };
  assertJitMatches("a.combine(b)", data);
});

Deno.test("jit: intersect()", () => {
  const data = { a: [1, 2, 3], b: [2, 3, 4] };
  assertJitMatches("a.intersect(b)", data);
});

Deno.test("jit: exclude()", () => {
  const data = { a: [1, 2, 3], b: [2] };
  assertJitMatches("a.exclude(b)", data);
});

// ============================================================================
// Tree Navigation
// ============================================================================

Deno.test("jit: children()", () => {
  const data = { a: 1, b: { c: 2 } };
  assertJitMatches("children()", data);
});

Deno.test("jit: descendants()", () => {
  const data = { a: { b: { c: 1 } } };
  assertJitMatches("descendants()", data);
});

// ============================================================================
// Indexer
// ============================================================================

Deno.test("jit: indexer", () => {
  assertJitMatches("name[0]");
  assertJitMatches("name[1]");
  assertJitMatches("name[0].given[0]");
});

// ============================================================================
// iif() Conditional
// ============================================================================

Deno.test("jit: iif()", () => {
  assertJitMatches("iif(gender = 'male', 'M', 'F')");
  assertJitMatches("iif(active, 'Active', 'Inactive')");
});

// ============================================================================
// Environment Variables
// ============================================================================

Deno.test("jit: environment variables", () => {
  const jitCompiled = fhirpath.compileJIT("name.given.first() = %expected");
  const result = jitCompiled(patient, { expected: "John" });
  assertEquals(result, [true]);
});

// ============================================================================
// Complex Expressions
// ============================================================================

Deno.test("jit: complex chained expression", () => {
  assertJitMatches("name.where(use = 'official').given.first()");
});

Deno.test("jit: complex with union and filter", () => {
  assertJitMatches(
    "name.where(use = 'official').given.first() | identifier.where(system = 'http://example.org/mrn').value"
  );
});

Deno.test("jit: multiple filters", () => {
  assertJitMatches("name.where(use = 'official').where(family = 'Doe').given");
});

// ============================================================================
// Caching
// ============================================================================

Deno.test("jit: caching works", () => {
  const jit = new FhirPathJIT();
  
  // First compilation
  const ast = engine.parse("name.given");
  const fn1 = jit.compile(ast);
  
  // Second compilation should return cached
  const fn2 = jit.compile(ast);
  
  // Should be the same function reference
  assertEquals(fn1, fn2);
  
  // Clear cache and compile again
  jit.clearCache();
  const fn3 = jit.compile(ast);
  
  // Should be different function reference but same result
  assertEquals(fn1(patient), fn3(patient));
});

// ============================================================================
// Debug Mode
// ============================================================================

Deno.test("jit: debug mode generates code", () => {
  const jit = new FhirPathJIT();
  const ast = engine.parse("name.given.first()");
  
  // With debug option (would log to console)
  const fn = jit.compile(ast, { debug: false }); // Set to true to see output
  assertExists(fn);
  
  const result = fn(patient);
  assertEquals(result, ["John"]);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("jit: empty input", () => {
  const jitCompiled = fhirpath.compileJIT("name.given");
  assertEquals(jitCompiled({}), []);
  assertEquals(jitCompiled(null), []);
});

Deno.test("jit: missing properties", () => {
  const jitCompiled = fhirpath.compileJIT("nonexistent.property");
  assertEquals(jitCompiled(patient), []);
});

Deno.test("jit: null handling", () => {
  const data = { a: null, b: undefined };
  assertJitMatches("a", data);
  assertJitMatches("b", data);
});

// ============================================================================
// Performance Verification
// ============================================================================

Deno.test("jit: performance is better than interpreted", () => {
  const expression = "name.where(use = 'official').given.first()";
  const iterations = 1000;
  
  // Warmup
  const jitCompiled = fhirpath.compileJIT(expression);
  for (let i = 0; i < 100; i++) {
    jitCompiled(patient);
    fhirpath.evaluate(patient, expression);
  }
  
  // Measure JIT
  const jitStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    jitCompiled(patient);
  }
  const jitTime = performance.now() - jitStart;
  
  // Measure interpreted
  const intStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    fhirpath.evaluate(patient, expression);
  }
  const intTime = performance.now() - intStart;
  
  // JIT should be faster
  console.log(`JIT: ${jitTime.toFixed(2)}ms, Interpreted: ${intTime.toFixed(2)}ms, Speedup: ${(intTime / jitTime).toFixed(1)}x`);
  
  assert(jitTime < intTime, `JIT (${jitTime}ms) should be faster than interpreted (${intTime}ms)`);
});
