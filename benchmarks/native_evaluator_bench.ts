/**
 * Benchmark for native evaluator performance
 */

import { parseFhirPath } from "../src/parser/parser.ts";
import { evaluateFhirPath } from "../src/evaluator/evaluator.ts";

const patient = {
  resourceType: "Patient",
  id: "bench-patient",
  name: [
    { use: "official", family: "Benchmark", given: ["Test", "User"] },
    { use: "nickname", given: ["Benchy"] },
  ],
  birthDate: "1985-03-20",
  gender: "female",
  active: true,
  address: [
    { city: "Munich", country: "Germany", postalCode: "80331" },
  ],
  telecom: [
    { system: "phone", value: "+49 89 12345678" },
    { system: "email", value: "test@benchmark.de" },
  ],
};

// Pre-parse expressions
const simpleExpr = parseFhirPath("name.given");
const whereExpr = parseFhirPath("name.where(use = 'official').given");
const chainedExpr = parseFhirPath("name.given.first().upper()");
const complexExpr = parseFhirPath("telecom.where(system = 'email').value | telecom.where(system = 'phone').value");

// ============================================================
// Simple expression
// ============================================================

Deno.bench({
  name: "native: simple expression",
  group: "simple",
  baseline: true,
  fn() {
    evaluateFhirPath(simpleExpr, patient);
  },
});

// ============================================================
// Where expression
// ============================================================

Deno.bench({
  name: "native: where expression",
  group: "where",
  baseline: true,
  fn() {
    evaluateFhirPath(whereExpr, patient);
  },
});

// ============================================================
// Chained expression
// ============================================================

Deno.bench({
  name: "native: chained expression",
  group: "chained",
  baseline: true,
  fn() {
    evaluateFhirPath(chainedExpr, patient);
  },
});

// ============================================================
// Complex expression
// ============================================================

Deno.bench({
  name: "native: complex expression",
  group: "complex",
  baseline: true,
  fn() {
    evaluateFhirPath(complexExpr, patient);
  },
});

// ============================================================
// Full pipeline: parse + evaluate
// ============================================================

Deno.bench({
  name: "native: parse + evaluate (no cache)",
  group: "full-pipeline",
  baseline: true,
  fn() {
    const ast = parseFhirPath("name.given.first()");
    evaluateFhirPath(ast, patient);
  },
});

// ============================================================
// Batch evaluation
// ============================================================

const patients = Array.from({ length: 100 }, (_, i) => ({
  ...patient,
  id: `patient-${i}`,
}));

Deno.bench({
  name: "native: 100 patients simple expression",
  group: "batch",
  fn() {
    for (const p of patients) {
      evaluateFhirPath(simpleExpr, p);
    }
  },
});

Deno.bench({
  name: "native: 100 patients complex expression",
  group: "batch-complex",
  fn() {
    for (const p of patients) {
      evaluateFhirPath(complexExpr, p);
    }
  },
});
