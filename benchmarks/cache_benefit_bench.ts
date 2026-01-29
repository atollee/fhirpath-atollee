/**
 * Benchmark showing the cache benefit for repeated parse operations
 * 
 * This benchmark demonstrates the AST caching capabilities:
 * when the same expressions are parsed multiple times.
 */

import fhirpathAtolee from "../mod.ts";
import { parseFhirPath } from "../src/parser/parser.ts";

const expressions = [
  "name.given",
  "name.family",
  "birthDate",
  "gender",
  "address.city",
];

// Pre-warm atollee cache
for (const expr of expressions) {
  fhirpathAtolee.parse(expr);
}

// ============================================================
// BENCHMARK: Parse the same expression 1000 times (cached via engine)
// ============================================================

Deno.bench({
  name: "atollee engine: parse same expr 1000x (cached)",
  group: "parse-same-1000",
  baseline: true,
  fn() {
    for (let i = 0; i < 1000; i++) {
      fhirpathAtolee.parse("name.given");
    }
  },
});

// ============================================================
// BENCHMARK: Parse without cache (raw parser)
// ============================================================

Deno.bench({
  name: "raw parser: parse same expr 1000x (no cache)",
  group: "parse-same-1000",
  fn() {
    for (let i = 0; i < 1000; i++) {
      parseFhirPath("name.given");
    }
  },
});

// ============================================================
// BENCHMARK: Parse 5 expressions 200 times each
// ============================================================

Deno.bench({
  name: "atollee engine: parse 5 exprs x 200 (cached)",
  group: "parse-5x200",
  baseline: true,
  fn() {
    for (let i = 0; i < 200; i++) {
      for (const expr of expressions) {
        fhirpathAtolee.parse(expr);
      }
    }
  },
});

Deno.bench({
  name: "raw parser: parse 5 exprs x 200 (no cache)",
  group: "parse-5x200",
  fn() {
    for (let i = 0; i < 200; i++) {
      for (const expr of expressions) {
        parseFhirPath(expr);
      }
    }
  },
});

// ============================================================
// BENCHMARK: Simulate search parameter extraction scenario
// 100 resources, 10 search parameters each
// ============================================================

const patient = {
  resourceType: "Patient",
  name: [{ family: "Test", given: ["User"] }],
  birthDate: "1990-01-01",
  gender: "male",
  address: [{ city: "Berlin" }],
  telecom: [{ system: "phone", value: "123" }],
};

const searchParams = [
  "name.given",
  "name.family",
  "birthDate",
  "gender",
  "address.city",
  "address.country",
  "telecom.value",
  "identifier.value",
  "active",
  "resourceType",
];

// Pre-compile
const atolleeCompiled = searchParams.map(expr => fhirpathAtolee.compile(expr));
const patients = Array.from({ length: 100 }, () => ({ ...patient }));

Deno.bench({
  name: "atollee: 100 patients x 10 search params (compiled)",
  group: "search-params",
  baseline: true,
  fn() {
    for (const p of patients) {
      for (const compiled of atolleeCompiled) {
        compiled(p);
      }
    }
  },
});

// ============================================================
// BENCHMARK: Cache hit rate statistics
// ============================================================

Deno.bench({
  name: "atollee: cache stats overhead",
  group: "stats",
  fn() {
    const stats = fhirpathAtolee.getCacheStats();
    if (stats.hitRate < 0) throw new Error("Invalid"); // Prevent optimization
  },
});
