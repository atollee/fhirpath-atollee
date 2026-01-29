/**
 * Full Performance Comparison Benchmark
 * 
 * Compares: fhirpath.js (original) vs fhirpath-atollee (interpreted) vs fhirpath-atollee-JIT
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
};

// Create patients for batch tests
const patients100 = Array.from({ length: 100 }, (_, i) => ({
  ...patient,
  id: `patient-${i}`,
}));

const patients1000 = Array.from({ length: 1000 }, (_, i) => ({
  ...patient,
  id: `patient-${i}`,
}));

// Test expressions
const expressions: Record<string, string> = {
  simple: "name.given",
  filter: "name.where(use = 'official').given",
  chained: "name.first().given.first()",
  complex: "name.where(use = 'official').given.first() | identifier.where(system = 'http://example.org/mrn').value",
};

console.log("=".repeat(80));
console.log("FULL PERFORMANCE COMPARISON");
console.log("fhirpath.js vs fhirpath-atollee (Interpreted) vs fhirpath-atollee (JIT)");
console.log("=".repeat(80));
console.log("");

// Benchmark function
function benchmark(fn: () => void, iterations: number = 10000): { avgNs: number; opsPerSec: number } {
  // Warmup
  for (let i = 0; i < 100; i++) fn();
  
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

// Verify correctness
console.log("Verifying correctness...");
for (const [name, expr] of Object.entries(expressions)) {
  const resultOriginal = fhirpathOriginal.evaluate(patient, expr);
  const resultAtolee = fhirpathAtolee.evaluate(patient, expr);
  const jitCompiled = fhirpathAtolee.compileJIT(expr);
  const resultJIT = jitCompiled(patient);
  
  const match1 = JSON.stringify(resultOriginal) === JSON.stringify(resultAtolee);
  const match2 = JSON.stringify(resultAtolee) === JSON.stringify(resultJIT);
  
  console.log(`  ${name}: Original↔Atollee ${match1 ? "✓" : "✗"} | Atollee↔JIT ${match2 ? "✓" : "✗"}`);
}
console.log("");

// Run benchmarks
console.log("Running benchmarks...");
console.log("");

interface Result {
  expression: string;
  original: { avgNs: number; opsPerSec: number };
  atollee: { avgNs: number; opsPerSec: number };
  jit: { avgNs: number; opsPerSec: number };
  speedupVsOriginal: number;
  speedupVsAtolee: number;
}

const results: Result[] = [];

for (const [name, expr] of Object.entries(expressions)) {
  console.log(`  Benchmarking: ${name}...`);
  
  // Pre-compile JIT
  const jitCompiled = fhirpathAtolee.compileJIT(expr);
  
  const originalResult = benchmark(
    () => fhirpathOriginal.evaluate(patient, expr),
    10000
  );
  
  const atolleeResult = benchmark(
    () => fhirpathAtolee.evaluate(patient, expr),
    10000
  );
  
  const jitResult = benchmark(
    () => jitCompiled(patient),
    10000
  );
  
  results.push({
    expression: name,
    original: originalResult,
    atollee: atolleeResult,
    jit: jitResult,
    speedupVsOriginal: originalResult.avgNs / jitResult.avgNs,
    speedupVsAtolee: atolleeResult.avgNs / jitResult.avgNs,
  });
}

// Batch benchmark
console.log("");
console.log("  Benchmarking: batch (100 patients)...");

const jitBatch = fhirpathAtolee.compileJIT(expressions.simple);

const batchOriginal = benchmark(
  () => { for (const p of patients100) fhirpathOriginal.evaluate(p, expressions.simple); },
  1000
);

const batchAtolee = benchmark(
  () => { for (const p of patients100) fhirpathAtolee.evaluate(p, expressions.simple); },
  1000
);

const batchJIT = benchmark(
  () => { for (const p of patients100) jitBatch(p); },
  1000
);

// Large batch
console.log("  Benchmarking: large batch (1000 patients)...");

const largeBatchOriginal = benchmark(
  () => { for (const p of patients1000) fhirpathOriginal.evaluate(p, expressions.simple); },
  100
);

const largeBatchAtolee = benchmark(
  () => { for (const p of patients1000) fhirpathAtolee.evaluate(p, expressions.simple); },
  100
);

const largeBatchJIT = benchmark(
  () => { for (const p of patients1000) jitBatch(p); },
  100
);

// Print results
console.log("");
console.log("=".repeat(80));
console.log("RESULTS");
console.log("=".repeat(80));
console.log("");

console.log("Single Expression Performance:");
console.log("-".repeat(80));
console.log(
  "| Expression".padEnd(12) +
  "| fhirpath.js".padEnd(14) +
  "| atollee".padEnd(14) +
  "| atollee-JIT".padEnd(14) +
  "| vs Original".padEnd(13) +
  "| vs Atollee  |"
);
console.log("-".repeat(80));

for (const r of results) {
  console.log(
    `| ${r.expression}`.padEnd(12) +
    `| ${formatNs(r.original.avgNs)}`.padEnd(14) +
    `| ${formatNs(r.atollee.avgNs)}`.padEnd(14) +
    `| ${formatNs(r.jit.avgNs)}`.padEnd(14) +
    `| ${r.speedupVsOriginal.toFixed(0)}x`.padEnd(13) +
    `| ${r.speedupVsAtolee.toFixed(1)}x`.padEnd(12) + "|"
  );
}
console.log("-".repeat(80));

console.log("");
console.log("Batch Processing (100 patients):");
console.log("-".repeat(80));
console.log(`| fhirpath.js    | ${formatNs(batchOriginal.avgNs).padEnd(12)} | ${formatOps(batchOriginal.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| atollee        | ${formatNs(batchAtolee.avgNs).padEnd(12)} | ${formatOps(batchAtolee.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| atollee-JIT    | ${formatNs(batchJIT.avgNs).padEnd(12)} | ${formatOps(batchJIT.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| JIT vs Original| ${(batchOriginal.avgNs / batchJIT.avgNs).toFixed(0)}x faster`.padEnd(30) + "|");
console.log(`| JIT vs Atollee | ${(batchAtolee.avgNs / batchJIT.avgNs).toFixed(1)}x faster`.padEnd(30) + "|");
console.log("-".repeat(80));

console.log("");
console.log("Large Batch Processing (1000 patients):");
console.log("-".repeat(80));
console.log(`| fhirpath.js    | ${formatNs(largeBatchOriginal.avgNs).padEnd(12)} | ${formatOps(largeBatchOriginal.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| atollee        | ${formatNs(largeBatchAtolee.avgNs).padEnd(12)} | ${formatOps(largeBatchAtolee.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| atollee-JIT    | ${formatNs(largeBatchJIT.avgNs).padEnd(12)} | ${formatOps(largeBatchJIT.opsPerSec).padEnd(10)} ops/s |`);
console.log(`| JIT vs Original| ${(largeBatchOriginal.avgNs / largeBatchJIT.avgNs).toFixed(0)}x faster`.padEnd(30) + "|");
console.log(`| JIT vs Atollee | ${(largeBatchAtolee.avgNs / largeBatchJIT.avgNs).toFixed(1)}x faster`.padEnd(30) + "|");
console.log("-".repeat(80));

// Summary
console.log("");
console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));

const avgSpeedupVsOriginal = results.reduce((sum, r) => sum + r.speedupVsOriginal, 0) / results.length;
const avgSpeedupVsAtolee = results.reduce((sum, r) => sum + r.speedupVsAtolee, 0) / results.length;

console.log("");
console.log("  Single Expression (average):");
console.log(`    JIT vs fhirpath.js:   ${avgSpeedupVsOriginal.toFixed(0)}x faster`);
console.log(`    JIT vs atollee:       ${avgSpeedupVsAtolee.toFixed(1)}x faster`);
console.log("");
console.log("  Batch Processing (100 patients):");
console.log(`    JIT vs fhirpath.js:   ${(batchOriginal.avgNs / batchJIT.avgNs).toFixed(0)}x faster`);
console.log(`    JIT vs atollee:       ${(batchAtolee.avgNs / batchJIT.avgNs).toFixed(1)}x faster`);
console.log("");
console.log("  Large Batch (1000 patients):");
console.log(`    JIT vs fhirpath.js:   ${(largeBatchOriginal.avgNs / largeBatchJIT.avgNs).toFixed(0)}x faster`);
console.log(`    JIT vs atollee:       ${(largeBatchAtolee.avgNs / largeBatchJIT.avgNs).toFixed(1)}x faster`);
console.log("");

console.log("  ╔═══════════════════════════════════════════════════════════════════╗");
console.log("  ║  fhirpath-atollee JIT: Up to " + Math.round(avgSpeedupVsOriginal) + "x faster than original fhirpath.js  ║");
console.log("  ╚═══════════════════════════════════════════════════════════════════╝");
console.log("");
console.log("=".repeat(80));
