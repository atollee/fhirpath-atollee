/**
 * Basic functionality tests for @atollee/fhirpath-atollee
 * 
 * These tests verify the native FHIRPath implementation works correctly.
 */

import { assertEquals, assertExists } from "@std/assert";
import fhirpath from "../mod.ts";
import r6Model from "../fhir-context/r6/mod.ts";

// Sample FHIR resources for testing
const samplePatient = {
  resourceType: "Patient",
  id: "test-patient-1",
  name: [
    {
      use: "official",
      family: "Müller",
      given: ["Hans", "Peter"],
    },
    {
      use: "nickname",
      given: ["Hansi"],
    },
  ],
  birthDate: "1980-05-15",
  gender: "male",
  address: [
    {
      city: "Berlin",
      country: "Germany",
    },
  ],
  telecom: [
    { system: "phone", value: "+49 30 12345678" },
    { system: "email", value: "hans.mueller@example.de" },
  ],
};

const sampleObservation = {
  resourceType: "Observation",
  id: "test-obs-1",
  status: "final",
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "8867-4",
        display: "Heart rate",
      },
    ],
  },
  valueQuantity: {
    value: 72,
    unit: "beats/minute",
    system: "http://unitsofmeasure.org",
    code: "/min",
  },
  subject: {
    reference: "Patient/test-patient-1",
  },
};

// Test expressions with expected results
const testExpressions = [
  // Simple navigation
  { expr: "name.given", resource: samplePatient, expected: ["Hans", "Peter", "Hansi"] },
  { expr: "name.family", resource: samplePatient, expected: ["Müller"] },
  { expr: "name.where(use = 'official').given", resource: samplePatient, expected: ["Hans", "Peter"] },
  
  // Functions
  { expr: "name.given.first()", resource: samplePatient, expected: ["Hans"] },
  { expr: "name.given.count()", resource: samplePatient, expected: [3] },
  { expr: "name.exists()", resource: samplePatient, expected: [true] },
  { expr: "name.given.distinct()", resource: samplePatient, expected: ["Hans", "Peter", "Hansi"] },
  
  // Filtering
  { expr: "telecom.where(system = 'email').value", resource: samplePatient, expected: ["hans.mueller@example.de"] },
  { expr: "name.select(given)", resource: samplePatient, expected: ["Hans", "Peter", "Hansi"] },
  
  // Type operations
  { expr: "resourceType", resource: samplePatient, expected: ["Patient"] },
  
  // Observation
  { expr: "valueQuantity.value", resource: sampleObservation, expected: [72] },
  { expr: "code.coding.code", resource: sampleObservation, expected: ["8867-4"] },
];

Deno.test("fhirpath-atollee: basic evaluation", async (t) => {
  for (const { expr, resource, expected } of testExpressions) {
    await t.step(`evaluate: ${expr}`, () => {
      const result = fhirpath.evaluate(resource, expr);
      assertEquals(
        JSON.stringify(result),
        JSON.stringify(expected),
        `Expression "${expr}" should produce expected result`,
      );
    });
  }
});

Deno.test("fhirpath-atollee: compile and evaluate", async (t) => {
  for (const { expr, resource, expected } of testExpressions) {
    await t.step(`compile: ${expr}`, () => {
      const compiled = fhirpath.compile(expr);
      const result = compiled(resource);
      assertEquals(
        JSON.stringify(result),
        JSON.stringify(expected),
        `Compiled expression "${expr}" should produce expected result`,
      );
    });
  }
});

Deno.test("fhirpath-atollee: with R6 model", async (t) => {
  const expressionsWithModel = [
    { expr: "name.given", base: "Patient", resource: samplePatient, expected: ["Hans", "Peter", "Hansi"] },
    { expr: "valueQuantity.value", base: "Observation", resource: sampleObservation, expected: [72] },
  ];

  for (const { expr, base, resource, expected } of expressionsWithModel) {
    await t.step(`with model: ${expr}`, () => {
      const result = fhirpath.evaluate(
        resource,
        { base, expression: expr },
        undefined,
        r6Model,
      );
      assertEquals(
        JSON.stringify(result),
        JSON.stringify(expected),
        `Expression "${expr}" with model should produce expected result`,
      );
    });
  }
});

Deno.test("fhirpath-atollee: cache functionality", () => {
  // Create a new engine to test cache
  const engine = fhirpath.createEngine({ cacheSize: 100 });
  
  // Parse some expressions - cache is internal to engine
  const ast1 = engine.parseNative("name.given");
  const ast2 = engine.parseNative("name.family");
  const ast3 = engine.parseNative("name.given"); // Should return cached
  
  // Verify that the same AST is returned for repeated parses
  assertEquals(ast1, ast3, "Should return cached AST for same expression");
  
  // Verify clearCache works
  engine.clearCache();
  const ast4 = engine.parseNative("name.given");
  // After clear, it should be a new parse (different object reference)
  // but structurally the same
  assertEquals(ast1.type, ast4.type, "Cleared cache should still return valid AST");
});

Deno.test("fhirpath-atollee: parse function", () => {
  const ast = fhirpath.parse("name.given.first()");
  assertExists(ast, "parse should return an AST");
  assertEquals(typeof ast, "object", "AST should be an object");
});

Deno.test("fhirpath-atollee: version string", () => {
  assertExists(fhirpath.version, "Should have version string");
  assertEquals(
    fhirpath.version.includes("atollee"),
    true,
    "Version should indicate atollee",
  );
});

Deno.test("fhirpath-atollee: types function", () => {
  assertEquals(fhirpath.types("hello"), ["string"]);
  assertEquals(fhirpath.types(42), ["integer", "decimal", "number"]);
  assertEquals(fhirpath.types(3.14), ["decimal", "number"]);
  assertEquals(fhirpath.types(true), ["boolean"]);
  assertEquals(fhirpath.types(null), []);
  assertEquals(fhirpath.types(undefined), []);
});

Deno.test("fhirpath-atollee: resolveInternalTypes function", () => {
  assertEquals(fhirpath.resolveInternalTypes("hello"), "hello");
  assertEquals(fhirpath.resolveInternalTypes(42), 42);
  assertEquals(fhirpath.resolveInternalTypes([1, 2, 3]), [1, 2, 3]);
  assertEquals(
    fhirpath.resolveInternalTypes({ a: 1, b: 2 }),
    { a: 1, b: 2 }
  );
});
