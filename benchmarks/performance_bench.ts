/**
 * Performance benchmarks for @atollee/fhirpath-atollee
 * 
 * Run with: deno bench --allow-read --allow-env
 * 
 * These benchmarks measure:
 * 1. First-time evaluation (cold cache)
 * 2. Repeated evaluation (warm cache)
 * 3. Compiled expression evaluation
 * 4. Multiple different expressions
 */

import fhirpathAtolee from "../mod.ts";

// Sample resources
const patient = {
  resourceType: "Patient",
  id: "bench-patient",
  name: [
    { use: "official", family: "Benchmark", given: ["Test", "User"] },
    { use: "nickname", given: ["Benchy"] },
  ],
  birthDate: "1985-03-20",
  gender: "female",
  address: [
    { city: "Munich", country: "Germany", postalCode: "80331" },
  ],
  telecom: [
    { system: "phone", value: "+49 89 12345678" },
    { system: "email", value: "test@benchmark.de" },
  ],
  identifier: [
    { system: "http://hospital.example/mrn", value: "MRN-12345" },
  ],
};

// Generate array of patients for bulk testing
const patients = Array.from({ length: 100 }, (_, i) => ({
  ...patient,
  id: `bench-patient-${i}`,
  name: [{ family: `Patient${i}`, given: [`First${i}`] }],
}));

// Expressions for benchmarking
const simpleExpression = "name.given";
const mediumExpression = "name.where(use = 'official').given.first()";
const complexExpression = "telecom.where(system = 'email').value | telecom.where(system = 'phone').value";

// ============================================================
// BENCHMARK: Simple expression - First evaluation (cold)
// ============================================================

Deno.bench({
  name: "atollee: simple expression (cold)",
  group: "simple-cold",
  baseline: true,
  fn() {
    fhirpathAtolee.clearCache();
    fhirpathAtolee.evaluate(patient, simpleExpression);
  },
});

// ============================================================
// BENCHMARK: Simple expression - Warm cache
// ============================================================

// Pre-warm the cache
fhirpathAtolee.evaluate(patient, simpleExpression);

Deno.bench({
  name: "atollee: simple expression (warm)",
  group: "simple-warm",
  baseline: true,
  fn() {
    fhirpathAtolee.evaluate(patient, simpleExpression);
  },
});

// ============================================================
// BENCHMARK: Medium complexity expression
// ============================================================

fhirpathAtolee.evaluate(patient, mediumExpression);

Deno.bench({
  name: "atollee: medium expression (warm)",
  group: "medium",
  baseline: true,
  fn() {
    fhirpathAtolee.evaluate(patient, mediumExpression);
  },
});

// ============================================================
// BENCHMARK: Complex expression
// ============================================================

fhirpathAtolee.evaluate(patient, complexExpression);

Deno.bench({
  name: "atollee: complex expression (warm)",
  group: "complex",
  baseline: true,
  fn() {
    fhirpathAtolee.evaluate(patient, complexExpression);
  },
});

// ============================================================
// BENCHMARK: Compiled expression - Multiple evaluations
// ============================================================

const atolleeCompiled = fhirpathAtolee.compile(simpleExpression);

Deno.bench({
  name: "atollee: compiled - 100 patients",
  group: "compiled-bulk",
  baseline: true,
  fn() {
    for (const p of patients) {
      atolleeCompiled(p);
    }
  },
});

// ============================================================
// BENCHMARK: Many different expressions (cache stress test)
// ============================================================

const manyExpressions = [
  "name.given",
  "name.family",
  "name.use",
  "birthDate",
  "gender",
  "address.city",
  "address.country",
  "address.postalCode",
  "telecom.system",
  "telecom.value",
  "identifier.system",
  "identifier.value",
  "name.given.first()",
  "name.given.last()",
  "name.given.count()",
  "telecom.where(system = 'phone')",
  "telecom.where(system = 'email')",
  "address.exists()",
  "name.exists()",
  "identifier.exists()",
];

// Pre-warm
for (const expr of manyExpressions) {
  fhirpathAtolee.evaluate(patient, expr);
}

Deno.bench({
  name: "atollee: 20 different expressions (warm)",
  group: "many-expressions",
  baseline: true,
  fn() {
    for (const expr of manyExpressions) {
      fhirpathAtolee.evaluate(patient, expr);
    }
  },
});

// ============================================================
// BENCHMARK: Cache statistics
// ============================================================

Deno.bench({
  name: "atollee: getCacheStats()",
  group: "cache-stats",
  fn() {
    fhirpathAtolee.getCacheStats();
  },
});
