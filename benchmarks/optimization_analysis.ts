/**
 * Optimization Analysis - Where is time spent?
 */

import { createDefaultAPI } from "../src/api.ts";
import { FhirPathEngine } from "../src/engine.ts";

const fhirpath = createDefaultAPI();

const patient = {
  resourceType: "Patient",
  id: "example",
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", family: "Doe", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-01-15",
};

const expression = "name.where(use = 'official').given.first()";

console.log("=".repeat(70));
console.log("OPTIMIZATION ANALYSIS: Where is time spent?");
console.log("=".repeat(70));
console.log("");

// Helper
function measure(name: string, fn: () => void, iterations: number = 10000): number {
  // Warmup
  for (let i = 0; i < 100; i++) fn();
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  
  const avgNs = ((end - start) * 1_000_000) / iterations;
  console.log(`  ${name.padEnd(35)}: ${avgNs.toFixed(0).padStart(6)} ns`);
  return avgNs;
}

// 1. Full evaluation (parse + evaluate)
console.log("1. FULL EVALUATION (parse + evaluate each time):");
console.log("-".repeat(70));
const fullTime = measure("fhirpath.evaluate()", () => {
  fhirpath.evaluate(patient, expression);
});

// 2. Compiled evaluation (pre-parsed)
console.log("");
console.log("2. COMPILED EVALUATION (parse once, evaluate many):");
console.log("-".repeat(70));
const compiled = fhirpath.compile(expression);
const compiledTime = measure("compiled(resource)", () => {
  compiled(patient);
});

// 3. Break down: Parse only
console.log("");
console.log("3. PARSE ONLY (no evaluation):");
console.log("-".repeat(70));
const engine = new FhirPathEngine();
const parseTime = measure("engine.parse()", () => {
  // Force fresh parse by using unique expression
  engine.parse(expression + " ");
});

// 4. With AST caching
console.log("");
console.log("4. WITH AST CACHING (same expression):");
console.log("-".repeat(70));
const cachedParseTime = measure("engine.parse() [cached]", () => {
  engine.parse(expression);
});

// 5. String operations
console.log("");
console.log("5. BASELINE OPERATIONS:");
console.log("-".repeat(70));
measure("JSON.stringify(patient)", () => {
  JSON.stringify(patient);
});
measure("JSON.parse(string)", () => {
  JSON.parse('{"resourceType":"Patient","id":"test"}');
});
measure("Object property access x1000", () => {
  let sum = 0;
  for (let i = 0; i < 1000; i++) {
    sum += patient.name.length;
  }
});

// Analysis
console.log("");
console.log("=".repeat(70));
console.log("ANALYSIS");
console.log("=".repeat(70));
console.log("");

const parsePercent = (parseTime / fullTime * 100).toFixed(1);
const evalPercent = ((fullTime - parseTime) / fullTime * 100).toFixed(1);
const cacheSpeedup = (parseTime / cachedParseTime).toFixed(1);

console.log(`  Full evaluation:     ${fullTime.toFixed(0)} ns`);
console.log(`  - Parse time:        ~${parseTime.toFixed(0)} ns (${parsePercent}%)`);
console.log(`  - Evaluation time:   ~${(fullTime - parseTime).toFixed(0)} ns (${evalPercent}%)`);
console.log("");
console.log(`  Compiled evaluation: ${compiledTime.toFixed(0)} ns`);
console.log(`  Cache speedup:       ${cacheSpeedup}x faster parse`);
console.log("");

console.log("=".repeat(70));
console.log("OPTIMIZATION OPPORTUNITIES");
console.log("=".repeat(70));
console.log("");

console.log("  1. WASM Parser");
console.log("     - Move parsing to WebAssembly for ~2-5x speedup");
console.log("     - Especially beneficial for complex expressions");
console.log("");

console.log("  2. JIT Compilation to JavaScript");
console.log("     - Compile FHIRPath AST to native JS functions");
console.log("     - Eliminates interpreter overhead completely");
console.log("     - Potential 5-10x speedup for evaluation");
console.log("");

console.log("  3. Object Pooling");
console.log("     - Reuse collection arrays instead of creating new ones");
console.log("     - Reduces GC pressure in hot paths");
console.log("");

console.log("  4. Specialized Fast Paths");
console.log("     - Detect common patterns (x.y.z) and use direct property access");
console.log("     - Skip full AST traversal for simple expressions");
console.log("");

console.log("  5. Batch SIMD Operations");
console.log("     - Use SIMD for filtering large collections");
console.log("     - Parallel evaluation of independent expressions");
console.log("");

// Demonstrate JIT potential
console.log("=".repeat(70));
console.log("JIT COMPILATION DEMO");
console.log("=".repeat(70));
console.log("");

// Simulated JIT-compiled function for "name.where(use = 'official').given.first()"
function jitCompiled(resource: any): any[] {
  const result: any[] = [];
  if (resource?.name) {
    for (const name of resource.name) {
      if (name?.use === 'official' && name?.given?.length > 0) {
        result.push(name.given[0]);
        break; // first() optimization
      }
    }
  }
  return result;
}

const jitTime = measure("JIT-compiled function", () => {
  jitCompiled(patient);
});

const jitSpeedup = (compiledTime / jitTime).toFixed(1);
console.log("");
console.log(`  JIT vs Compiled: ${jitSpeedup}x faster`);
console.log(`  JIT vs Full:     ${(fullTime / jitTime).toFixed(1)}x faster`);
console.log("");

console.log("=".repeat(70));
