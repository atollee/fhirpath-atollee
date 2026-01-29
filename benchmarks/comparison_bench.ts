/**
 * Performance Comparison Benchmark
 * 
 * Compares: fhirpath.js (original) vs fhirpath-atollee (TypeScript)
 */

// Import fhirpath-atollee (our implementation) - use API directly
import { createDefaultAPI } from "../src/api.ts";
const fhirpathAtolee = createDefaultAPI();

// Import original fhirpath.js from npm (latest version)
import fhirpathOriginal from "fhirpath";

// Test data
const patient = {
  resourceType: "Patient",
  id: "example",
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", family: "Doe", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-01-15",
  identifier: [
    { system: "http://example.org/mrn", value: "12345" },
    { system: "http://example.org/ssn", value: "999-99-9999" },
  ],
  address: [
    { city: "Boston", state: "MA", country: "USA" },
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

// Create 100 patients for batch tests
const patients = Array.from({ length: 100 }, (_, i) => ({
  ...patient,
  id: `patient-${i}`,
  name: [
    { use: "official", family: `Family${i}`, given: [`Given${i}`] },
  ],
}));

// Test expressions
const expressions: Record<string, string> = {
  simple: "name.given",
  dotted: "name.family",
  filter: "name.where(use = 'official').given",
  chained: "name.first().given.first()",
  count: "name.given.count()",
  exists: "name.exists()",
  complex: "name.where(use = 'official').given.first() | identifier.where(system = 'http://example.org/mrn').value",
};

console.log("=".repeat(70));
console.log("Performance Comparison: fhirpath.js vs fhirpath-atollee");
console.log("=".repeat(70));
console.log("");

// Verify both libraries work correctly
console.log("Verifying correctness...");
for (const [name, expr] of Object.entries(expressions)) {
  const resultOriginal = fhirpathOriginal.evaluate(patient, expr);
  const resultAtolee = fhirpathAtolee.evaluate(patient, expr);
  
  const match = JSON.stringify(resultOriginal) === JSON.stringify(resultAtolee);
  console.log(`  ${name}: ${match ? "✓ MATCH" : "✗ MISMATCH"}`);
  if (!match) {
    console.log(`    Original: ${JSON.stringify(resultOriginal)}`);
    console.log(`    Atollee:  ${JSON.stringify(resultAtolee)}`);
  }
}
console.log("");

// Benchmark function
function benchmark(fn: () => void, iterations: number = 10000): { avgNs: number; opsPerSec: number } {
  // Warmup
  for (let i = 0; i < 100; i++) fn();
  
  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  
  const totalMs = end - start;
  const avgNs = (totalMs * 1_000_000) / iterations;
  const opsPerSec = Math.round(iterations / (totalMs / 1000));
  
  return { avgNs, opsPerSec };
}

function formatNs(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)} ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(1)} µs`;
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

function formatOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(0)}K`;
  return `${ops}`;
}

// Run benchmarks
console.log("Running benchmarks (10,000 iterations each)...");
console.log("");

interface Result {
  expression: string;
  original: { avgNs: number; opsPerSec: number };
  atollee: { avgNs: number; opsPerSec: number };
  speedup: number;
}

const results: Result[] = [];

for (const [name, expr] of Object.entries(expressions)) {
  console.log(`  Benchmarking: ${name}...`);
  
  const originalResult = benchmark(
    () => fhirpathOriginal.evaluate(patient, expr),
    10000
  );
  
  const atolleeResult = benchmark(
    () => fhirpathAtolee.evaluate(patient, expr),
    10000
  );
  
  const speedup = originalResult.avgNs / atolleeResult.avgNs;
  
  results.push({
    expression: name,
    original: originalResult,
    atollee: atolleeResult,
    speedup,
  });
}

// Batch benchmark
console.log("");
console.log("  Benchmarking: batch (100 patients)...");

const batchOriginal = benchmark(
  () => {
    for (const p of patients) {
      fhirpathOriginal.evaluate(p, expressions.simple);
    }
  },
  1000
);

const batchAtolee = benchmark(
  () => {
    for (const p of patients) {
      fhirpathAtolee.evaluate(p, expressions.simple);
    }
  },
  1000
);

const batchSpeedup = batchOriginal.avgNs / batchAtolee.avgNs;

// Compiled expression benchmark
console.log("  Benchmarking: compiled (100 patients)...");

const compiledOriginal = fhirpathOriginal.compile(expressions.simple);
const compiledAtolee = fhirpathAtolee.compile(expressions.simple);

const compiledOriginalResult = benchmark(
  () => {
    for (const p of patients) {
      compiledOriginal(p);
    }
  },
  1000
);

const compiledAtolleeResult = benchmark(
  () => {
    for (const p of patients) {
      compiledAtolee(p);
    }
  },
  1000
);

const compiledSpeedup = compiledOriginalResult.avgNs / compiledAtolleeResult.avgNs;

// Print results table
console.log("");
console.log("=".repeat(75));
console.log("RESULTS");
console.log("=".repeat(75));
console.log("");

console.log("Single Expression Performance:");
console.log("-".repeat(75));
console.log(
  "| Expression     | fhirpath.js    | fhirpath-atollee | Speedup   |"
);
console.log("-".repeat(75));

for (const r of results) {
  const exprCol = r.expression.padEnd(13);
  const origCol = formatNs(r.original.avgNs).padEnd(13);
  const atolleeCol = formatNs(r.atollee.avgNs).padEnd(15);
  const speedupCol = `${r.speedup.toFixed(2)}x`.padEnd(8);
  console.log(`| ${exprCol} | ${origCol} | ${atolleeCol} | ${speedupCol} |`);
}
console.log("-".repeat(75));

console.log("");
console.log("Batch Processing (100 patients, simple expression):");
console.log("-".repeat(75));
console.log(`| fhirpath.js      | ${formatNs(batchOriginal.avgNs).padEnd(15)} | ${formatOps(batchOriginal.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| fhirpath-atollee | ${formatNs(batchAtolee.avgNs).padEnd(15)} | ${formatOps(batchAtolee.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| Speedup          | ${batchSpeedup.toFixed(2)}x faster`.padEnd(30) + "|");
console.log("-".repeat(75));

console.log("");
console.log("Compiled Expression (100 patients):");
console.log("-".repeat(75));
console.log(`| fhirpath.js      | ${formatNs(compiledOriginalResult.avgNs).padEnd(15)} | ${formatOps(compiledOriginalResult.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| fhirpath-atollee | ${formatNs(compiledAtolleeResult.avgNs).padEnd(15)} | ${formatOps(compiledAtolleeResult.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| Speedup          | ${compiledSpeedup.toFixed(2)}x faster`.padEnd(30) + "|");
console.log("-".repeat(75));

// Summary
console.log("");
console.log("=".repeat(75));
console.log("SUMMARY");
console.log("=".repeat(75));

const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;

console.log("");
console.log(`  Average Speedup (single):   ${avgSpeedup.toFixed(2)}x`);
console.log(`  Batch Speedup (100 items):  ${batchSpeedup.toFixed(2)}x`);
console.log(`  Compiled Speedup:           ${compiledSpeedup.toFixed(2)}x`);
console.log("");

if (avgSpeedup > 1) {
  console.log(`  ✓ fhirpath-atollee is ${avgSpeedup.toFixed(1)}x FASTER on average`);
} else {
  console.log(`  ✗ fhirpath.js is ${(1/avgSpeedup).toFixed(1)}x faster on average`);
}

console.log("");
console.log("=".repeat(75));
