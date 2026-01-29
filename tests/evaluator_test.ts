/**
 * Tests for the native FHIRPath Evaluator
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseFhirPath } from "../src/parser/parser.ts";
import { FhirPathEvaluator, evaluateFhirPath } from "../src/evaluator/evaluator.ts";

// Sample FHIR resources
const patient = {
  resourceType: "Patient",
  id: "example",
  name: [
    { use: "official", family: "Müller", given: ["Hans", "Peter"] },
    { use: "nickname", given: ["Hansi"] },
  ],
  birthDate: "1980-05-15",
  gender: "male",
  active: true,
  address: [
    { city: "Berlin", country: "Germany" },
    { city: "Munich", country: "Germany" },
  ],
  telecom: [
    { system: "phone", value: "+49 30 12345678" },
    { system: "email", value: "hans@example.de" },
  ],
};

const observation = {
  resourceType: "Observation",
  id: "obs1",
  status: "final",
  code: {
    coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }],
  },
  valueQuantity: {
    value: 72,
    unit: "beats/minute",
    system: "http://unitsofmeasure.org",
    code: "/min",
  },
  subject: {
    reference: "Patient/example",
  },
};

// Helper function
function evaluate(expression: string, resource: unknown = patient): unknown[] {
  const ast = parseFhirPath(expression);
  return evaluateFhirPath(ast, resource);
}

// ============================================================
// Basic navigation tests
// ============================================================

Deno.test("evaluator: simple property access", () => {
  assertEquals(evaluate("id"), ["example"]);
  assertEquals(evaluate("gender"), ["male"]);
  assertEquals(evaluate("active"), [true]);
});

Deno.test("evaluator: nested property access", () => {
  assertEquals(evaluate("name.family"), ["Müller"]);
  assertEquals(evaluate("name.use"), ["official", "nickname"]);
});

Deno.test("evaluator: array flattening", () => {
  const result = evaluate("name.given");
  assertEquals(result, ["Hans", "Peter", "Hansi"]);
});

Deno.test("evaluator: deep navigation", () => {
  const result = evaluate("code.coding.code", observation);
  assertEquals(result, ["8867-4"]);
});

// ============================================================
// Literal tests
// ============================================================

Deno.test("evaluator: string literal", () => {
  assertEquals(evaluate("'hello'"), ["hello"]);
});

Deno.test("evaluator: number literal", () => {
  assertEquals(evaluate("42"), [42]);
  assertEquals(evaluate("3.14"), [3.14]);
});

Deno.test("evaluator: boolean literal", () => {
  assertEquals(evaluate("true"), [true]);
  assertEquals(evaluate("false"), [false]);
});

// ============================================================
// Existence function tests
// ============================================================

Deno.test("evaluator: empty()", () => {
  assertEquals(evaluate("name.empty()"), [false]);
  assertEquals(evaluate("deceased.empty()"), [true]);
});

Deno.test("evaluator: exists()", () => {
  assertEquals(evaluate("name.exists()"), [true]);
  assertEquals(evaluate("deceased.exists()"), [false]);
});

Deno.test("evaluator: count()", () => {
  assertEquals(evaluate("name.count()"), [2]);
  assertEquals(evaluate("name.given.count()"), [3]);
});

Deno.test("evaluator: hasValue()", () => {
  assertEquals(evaluate("gender.hasValue()"), [true]);
});

// ============================================================
// Filtering function tests
// ============================================================

Deno.test("evaluator: where()", () => {
  const result = evaluate("name.where(use = 'official').family");
  assertEquals(result, ["Müller"]);
});

Deno.test("evaluator: select()", () => {
  const result = evaluate("name.select(given)");
  assertEquals(result, ["Hans", "Peter", "Hansi"]);
});

Deno.test("evaluator: first()", () => {
  assertEquals(evaluate("name.given.first()"), ["Hans"]);
});

Deno.test("evaluator: last()", () => {
  assertEquals(evaluate("name.given.last()"), ["Hansi"]);
});

Deno.test("evaluator: tail()", () => {
  assertEquals(evaluate("name.given.tail()"), ["Peter", "Hansi"]);
});

Deno.test("evaluator: take()", () => {
  assertEquals(evaluate("name.given.take(2)"), ["Hans", "Peter"]);
});

Deno.test("evaluator: skip()", () => {
  assertEquals(evaluate("name.given.skip(1)"), ["Peter", "Hansi"]);
});

Deno.test("evaluator: distinct()", () => {
  // Add duplicate for testing
  assertEquals(evaluate("(1 | 2 | 2 | 3).distinct()"), [1, 2, 3]);
});

// ============================================================
// Aggregate function tests
// ============================================================

Deno.test("evaluator: sum()", () => {
  assertEquals(evaluate("(1 | 2 | 3).sum()"), [6]);
});

Deno.test("evaluator: min()", () => {
  assertEquals(evaluate("(3 | 1 | 2).min()"), [1]);
});

Deno.test("evaluator: max()", () => {
  assertEquals(evaluate("(3 | 1 | 2).max()"), [3]);
});

Deno.test("evaluator: avg()", () => {
  assertEquals(evaluate("(2 | 4 | 6).avg()"), [4]);
});

// ============================================================
// String function tests
// ============================================================

Deno.test("evaluator: upper()", () => {
  assertEquals(evaluate("gender.upper()"), ["MALE"]);
});

Deno.test("evaluator: lower()", () => {
  assertEquals(evaluate("'HELLO'.lower()"), ["hello"]);
});

Deno.test("evaluator: startsWith()", () => {
  assertEquals(evaluate("gender.startsWith('ma')"), [true]);
  assertEquals(evaluate("gender.startsWith('fe')"), [false]);
});

Deno.test("evaluator: endsWith()", () => {
  assertEquals(evaluate("gender.endsWith('le')"), [true]);
});

Deno.test("evaluator: contains() string", () => {
  assertEquals(evaluate("gender.contains('al')"), [true]);
});

Deno.test("evaluator: length()", () => {
  assertEquals(evaluate("gender.length()"), [4]);
});

Deno.test("evaluator: substring()", () => {
  assertEquals(evaluate("gender.substring(0, 2)"), ["ma"]);
});

// ============================================================
// Arithmetic tests
// ============================================================

Deno.test("evaluator: addition", () => {
  assertEquals(evaluate("1 + 2"), [3]);
});

Deno.test("evaluator: subtraction", () => {
  assertEquals(evaluate("5 - 3"), [2]);
});

Deno.test("evaluator: multiplication", () => {
  assertEquals(evaluate("3 * 4"), [12]);
});

Deno.test("evaluator: division", () => {
  assertEquals(evaluate("10 / 4"), [2.5]);
});

Deno.test("evaluator: integer division", () => {
  assertEquals(evaluate("10 div 3"), [3]);
});

Deno.test("evaluator: modulo", () => {
  assertEquals(evaluate("10 mod 3"), [1]);
});

Deno.test("evaluator: string concatenation", () => {
  assertEquals(evaluate("'hello' + ' ' + 'world'"), ["hello world"]);
});

Deno.test("evaluator: unary minus", () => {
  assertEquals(evaluate("-5"), [-5]);
});

// ============================================================
// Comparison tests
// ============================================================

Deno.test("evaluator: equality", () => {
  assertEquals(evaluate("gender = 'male'"), [true]);
  assertEquals(evaluate("gender = 'female'"), [false]);
});

Deno.test("evaluator: inequality", () => {
  assertEquals(evaluate("gender != 'female'"), [true]);
});

Deno.test("evaluator: less than", () => {
  assertEquals(evaluate("1 < 2"), [true]);
  assertEquals(evaluate("2 < 1"), [false]);
});

Deno.test("evaluator: greater than", () => {
  assertEquals(evaluate("2 > 1"), [true]);
});

Deno.test("evaluator: less than or equal", () => {
  assertEquals(evaluate("1 <= 1"), [true]);
  assertEquals(evaluate("1 <= 2"), [true]);
});

Deno.test("evaluator: greater than or equal", () => {
  assertEquals(evaluate("2 >= 2"), [true]);
});

// ============================================================
// Logical tests
// ============================================================

Deno.test("evaluator: and", () => {
  assertEquals(evaluate("true and true"), [true]);
  assertEquals(evaluate("true and false"), [false]);
  assertEquals(evaluate("false and true"), [false]);
});

Deno.test("evaluator: or", () => {
  assertEquals(evaluate("true or false"), [true]);
  assertEquals(evaluate("false or false"), [false]);
});

Deno.test("evaluator: not", () => {
  assertEquals(evaluate("true.not()"), [false]);
  assertEquals(evaluate("false.not()"), [true]);
});

Deno.test("evaluator: implies", () => {
  assertEquals(evaluate("true implies true"), [true]);
  assertEquals(evaluate("true implies false"), [false]);
  assertEquals(evaluate("false implies true"), [true]);
  assertEquals(evaluate("false implies false"), [true]);
});

// ============================================================
// Union tests
// ============================================================

Deno.test("evaluator: union", () => {
  assertEquals(evaluate("(1 | 2) | (2 | 3)"), [1, 2, 3]);
});

Deno.test("evaluator: combine", () => {
  const result = evaluate("(1 | 2).combine(2 | 3)");
  assertEquals(result, [1, 2, 2, 3]);
});

// ============================================================
// Indexer tests
// ============================================================

Deno.test("evaluator: indexer", () => {
  assertEquals(evaluate("name[0].family"), ["Müller"]);
  assertEquals(evaluate("name[1].use"), ["nickname"]);
});

Deno.test("evaluator: indexer out of bounds", () => {
  assertEquals(evaluate("name[99]"), []);
});

// ============================================================
// Type tests
// ============================================================

Deno.test("evaluator: is operator", () => {
  assertEquals(evaluate("active is Boolean"), [true]);
  assertEquals(evaluate("gender is String"), [true]);
});

Deno.test("evaluator: as operator", () => {
  assertEquals(evaluate("active as Boolean"), [true]);
  assertEquals(evaluate("active as String"), []);
});

// ============================================================
// Math function tests
// ============================================================

Deno.test("evaluator: abs()", () => {
  assertEquals(evaluate("(-5).abs()"), [5]);
});

Deno.test("evaluator: ceiling()", () => {
  assertEquals(evaluate("(1.5).ceiling()"), [2]);
});

Deno.test("evaluator: floor()", () => {
  assertEquals(evaluate("(1.9).floor()"), [1]);
});

Deno.test("evaluator: round()", () => {
  assertEquals(evaluate("(1.567).round(2)"), [1.57]);
});

// ============================================================
// Special variables tests
// ============================================================

Deno.test("evaluator: $this", () => {
  const result = evaluate("name.where($this.use = 'official')");
  assertEquals(result.length, 1);
});

// ============================================================
// Complex expressions
// ============================================================

Deno.test("evaluator: complex where clause", () => {
  const result = evaluate("telecom.where(system = 'email').value");
  assertEquals(result, ["hans@example.de"]);
});

Deno.test("evaluator: chained methods", () => {
  const result = evaluate("name.given.first().upper()");
  assertEquals(result, ["HANS"]);
});

Deno.test("evaluator: nested where", () => {
  const result = evaluate("name.where(use = 'official').given.first()");
  assertEquals(result, ["Hans"]);
});

Deno.test("evaluator: iif()", () => {
  assertEquals(evaluate("iif(active, 'yes', 'no')"), ["yes"]);
  assertEquals(evaluate("iif(false, 'yes', 'no')"), ["no"]);
});

// ============================================================
// Empty collection propagation
// ============================================================

Deno.test("evaluator: empty propagation in equality", () => {
  assertEquals(evaluate("deceased = true"), []);
});

Deno.test("evaluator: empty propagation in arithmetic", () => {
  assertEquals(evaluate("deceased + 1"), []);
});
