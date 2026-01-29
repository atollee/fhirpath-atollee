# @atollee/fhirpath-atollee

A modern, high-performance FHIRPath implementation in TypeScript - designed as a drop-in replacement for `fhirpath.js` with significant performance improvements.

**Version:** 0.7.6  
**Tests:** 580+ test cases (including official HL7 FHIRPath test suite)  
**License:** MIT

---

## Table of Contents

1. [Motivation](#motivation)
2. [Comparison with fhirpath.js](#comparison-with-fhirpathjs)
3. [Installation](#installation)
4. [Usage](#usage)
5. [API Reference](#api-reference)
   - [FHIRPath Playground](#fhirpath-playground-v072)
   - [FHIRPath in the Frontend](#fhirpath-in-the-frontend--use-cases)
6. [Architecture](#architecture)
7. [Performance](#performance)
8. [Supported Functions](#supported-functions)
9. [Migration Guide](#migration-guide)
10. [Testing](#testing)
11. [Roadmap](#roadmap)

---

## Motivation

The standard `fhirpath.js` library (HL7/fhirpath.js) is the reference implementation for FHIRPath in JavaScript. While feature-complete, it has several architectural limitations that impact performance in high-throughput scenarios:

| Problem | Impact |
|---------|--------|
| No AST caching | Expressions are re-parsed on every evaluation |
| Global state | Prevents true parallel execution |
| ANTLR4 dependency | Heavy runtime overhead (~500KB) |
| CommonJS legacy | Complex module resolution in Deno/ESM |

**fhirpath-atollee** addresses these issues with a ground-up native TypeScript implementation.

---

## Comparison with fhirpath.js

### Feature Comparison (Stand: Januar 2026)

| Feature | fhirpath.js (v4.8.3) | fhirpath-atollee |
|---------|---------------------|------------------|
| **AST Caching** | ❌ None | ✅ Global LRU cache (configurable) |
| **Native TypeScript** | ❌ JavaScript + d.ts | ✅ Full TypeScript |
| **ESM Support** | ⚠️ Via wrapper | ✅ Native ESM |
| **Deno Support** | ⚠️ Requires --unstable-detect-cjs | ✅ Native |
| **Parser** | ANTLR4 (~500KB) | Native TypeScript (~50KB) |
| **Parallelization** | ❌ Global state | ✅ Worker Pool |
| **Cache Statistics** | ❌ None | ✅ Built-in |
| **Async Evaluation** | ✅ v3.15.0+ (signal) | ✅ Worker Pool |
| **Terminology Service** | ✅ %terminologies | ✅ Implemented |
| **Type Factory** | ✅ %factory | ✅ Implemented |
| **aggregate()** | ✅ | ✅ Full $total/$this support |
| **resolve()** | ✅ | ✅ Bundle + custom resolver |
| **htmlChecks()** | ✅ | ✅ XHTML security validation |

### API Compatibility

| Function | fhirpath.js | fhirpath-atollee | Notes |
|----------|-------------|------------------|-------|
| `evaluate()` | ✅ | ✅ | Fully compatible |
| `compile()` | ✅ | ✅ | Fully compatible |
| `parse()` | ✅ | ✅ | Returns native AST |
| `types()` | ✅ | ✅ | Native implementation |
| `resolveInternalTypes()` | ✅ | ✅ | Native implementation |
| `version` | ✅ | ✅ | Different version string |
| `getCacheStats()` | ❌ | ✅ | atollee extension |
| `clearCache()` | ❌ | ✅ | atollee extension |
| `inspect()` | ❌ | ✅ | atollee extension - debugging |
| `registry` | ❌ | ✅ | atollee extension - introspection |

### Performance Comparison

| Scenario | fhirpath.js 4.8.3 | fhirpath-atollee | Speedup |
|----------|-------------------|------------------|---------|
| Simple path (`name.given`) | ~6.6 µs | ~1.4 µs | **~5x** |
| Dotted path (`name.family`) | ~5.3 µs | ~1.7 µs | **~3x** |
| Where clause (filter) | ~18.9 µs | ~1.4 µs | **~13x** |
| Chained methods | ~9.5 µs | ~1.1 µs | **~8x** |
| Complex expression | ~31.5 µs | ~2.1 µs | **~15x** |
| Batch 100 patients | ~427 µs | ~111 µs | **~4x** |
| Compiled (100 patients) | ~57 µs | ~22 µs | **~2.5x** |

**Average Speedup: ~8x faster** than fhirpath.js

*Benchmarks on Apple M3 Max, Deno 2.6.7, single-threaded. Values vary ±20% between runs. Run `deno task bench` for current measurements.*

---

## Installation

### Deno (recommended)

```json
// deno.json
{
  "imports": {
    "@atollee/fhirpath-atollee": "./packages/fhirpath-atollee/mod.ts",
    "@atollee/fhirpath-atollee/fhir-context/r6": "./packages/fhirpath-atollee/fhir-context/r6/mod.ts"
  }
}
```

---

## Usage

### Basic Usage (API-compatible with fhirpath.js)

```typescript
import fhirpath from "@atollee/fhirpath-atollee";
import r6Model from "@atollee/fhirpath-atollee/fhir-context/r6";

const patient = {
  resourceType: "Patient",
  name: [{ family: "Müller", given: ["Hans", "Peter"] }],
  birthDate: "1974-12-25"
};

// Direct evaluation
const names = fhirpath.evaluate(patient, "name.given");
// => ["Hans", "Peter"]

// With FHIR model for type-aware evaluation
const result = fhirpath.evaluate(
  patient, 
  { base: "Patient", expression: "name.given" },
  undefined,
  r6Model
);
```

### Compiled Expressions (Recommended)

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// Compile once
const getFirstName = fhirpath.compile("name.given.first()");

// Evaluate many times (uses cached AST)
for (const patient of patients) {
  const firstName = getFirstName(patient);
  console.log(firstName);
}
```

### FhirPathEngine for Full Control

```typescript
import { FhirPathEngine } from "@atollee/fhirpath-atollee";
import r6Model from "@atollee/fhirpath-atollee/fhir-context/r6";

const engine = new FhirPathEngine({
  model: r6Model,
  cacheSize: 2000,  // Custom cache size (default: 1000)
});

// Evaluate
const result = engine.evaluate(patient, "name.given");

// Monitor cache performance
const stats = engine.getCacheStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
// => "Cache hit rate: 94.5%"
```

### Cache Management

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// View cache statistics
const stats = fhirpath.getCacheStats();
console.log(stats);
// => { hits: 150, misses: 20, size: 20, maxSize: 1000, hitRate: 0.88 }

// Clear cache if needed
fhirpath.clearCache();
```

### Terminology Service (%terminologies)

```typescript
import fhirpath, { createTerminologyService } from "@atollee/fhirpath-atollee";

const observation = {
  resourceType: "Observation",
  code: {
    coding: [{ system: "http://loinc.org", code: "8480-6" }]
  }
};

// Option 1: Using terminologyUrl (creates RemoteTerminologyService)
const result = await fhirpath.evaluate(
  observation,
  "code.coding.where(memberOf('http://hl7.org/fhir/ValueSet/observation-vitalsignresult'))",
  {},
  undefined,
  { 
    terminologyUrl: "https://tx.fhir.org/r4",
    async: true  // Required for terminology operations
  }
);

// Option 2: Using a custom terminology service
const customService = createTerminologyService("https://my-tx-server.org/fhir");

const result2 = await fhirpath.evaluate(
  observation,
  "code.coding.first()",
  { terminologies: customService },  // %terminologies available in expressions
  undefined,
  { terminologyService: customService, async: true }
);

// Supported %terminologies operations:
// - %terminologies.expand(valueSet)
// - %terminologies.lookup(coded)
// - %terminologies.validateVS(valueSet, coded)
// - %terminologies.validateCS(codeSystem, coded)
// - %terminologies.subsumes(system, codeA, codeB)
// - %terminologies.translate(conceptMap, coded)
```

### Type Factory (%factory)

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// %factory is automatically available in all expressions

// Create primitive types with extensions
const stringWithExt = fhirpath.evaluate({}, "%factory.string('hello')");
// => [{ value: "hello" }]

// Create Coding
const coding = fhirpath.evaluate(
  {},
  "%factory.Coding('http://loinc.org', '8480-6', 'Systolic BP')"
);
// => [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }]

// Create Extension
const ext = fhirpath.evaluate({}, "%factory.Extension('http://example.org/ext', 'value')");
// => [{ url: "http://example.org/ext", valueString: "value" }]

// Create complex types
const name = fhirpath.evaluate({}, "%factory.HumanName('Doe', 'John')");
// => [{ family: "Doe", given: ["John"] }]

const quantity = fhirpath.evaluate(
  {},
  "%factory.Quantity('http://unitsofmeasure.org', 'kg', 80, 'kilogram')"
);

// Chain with navigation
const familyName = fhirpath.evaluate(
  {},
  "%factory.HumanName('Smith', 'Jane').family"
);
// => ["Smith"]

// Supported %factory methods:
// Primitives: string, boolean, integer, decimal, date, dateTime, time, uri, url, code, id, etc.
// Complex: Extension, Identifier, HumanName, ContactPoint, Address, Quantity, Coding, CodeableConcept
// Utilities: create(type), withExtension(instance, url, value), withProperty(instance, name, value)
```

### aggregate() Function

The `aggregate()` function allows custom aggregation over collections using `$total` and `$this`.

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// Sum of values
const sum = fhirpath.evaluate({}, "(1 | 2 | 3 | 4 | 5).aggregate($total + $this, 0)");
// => [15]

// Product (factorial-style)
const product = fhirpath.evaluate({}, "(1 | 2 | 3 | 4).aggregate($total * $this, 1)");
// => [24]

// String concatenation
const joined = fhirpath.evaluate({}, "('a' | 'b' | 'c').aggregate($total & $this, '')");
// => ["abc"]

// Custom max function
const max = fhirpath.evaluate(
  {},
  "(3 | 1 | 4 | 1 | 5 | 9).aggregate(iif($this > $total, $this, $total), 0)"
);
// => [9]

// Sum ages from patient data
const data = { patients: [{ age: 30 }, { age: 25 }, { age: 35 }] };
const totalAge = fhirpath.evaluate(data, "patients.aggregate($total + age, 0)");
// => [90]
```

### resolve() Function

The `resolve()` function resolves FHIR references to actual resources.

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// Automatic resolution within Bundle context
const bundle = {
  resourceType: "Bundle",
  entry: [
    { 
      fullUrl: "urn:uuid:patient-1",
      resource: { resourceType: "Patient", id: "patient-1", name: [{ family: "Smith" }] }
    },
    {
      resource: { 
        resourceType: "Observation",
        subject: { reference: "Patient/patient-1" }
      }
    }
  ]
};

// Resolve references automatically within Bundle
const observation = bundle.entry[1].resource;
const patientName = fhirpath.evaluate(
  observation,
  "subject.resolve().name.family",
  { resource: bundle }  // Provide Bundle as %resource
);
// => ["Smith"]

// Custom Reference Resolver for external lookups
const customResolver = {
  resolve(reference: string) {
    // Fetch from database, API, etc.
    if (reference === "Patient/external-123") {
      return { resourceType: "Patient", name: [{ family: "External" }] };
    }
    return undefined;
  }
};

const result = fhirpath.evaluate(
  { subject: { reference: "Patient/external-123" } },
  "subject.resolve().name.family",
  undefined,
  undefined,
  { referenceResolver: customResolver }
);
// => ["External"]
```

### htmlChecks() Function

The `htmlChecks()` function validates XHTML content according to FHIR narrative rules.

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// Valid FHIR narrative
const validPatient = {
  resourceType: "Patient",
  text: {
    status: "generated",
    div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>John Smith</p></div>'
  }
};
fhirpath.evaluate(validPatient, "text.div.htmlChecks()");
// => [true]

// Invalid - contains script
const xssPatient = {
  text: { div: "<div><script>alert('xss')</script></div>" }
};
fhirpath.evaluate(xssPatient, "text.div.htmlChecks()");
// => [false]

// Validation checks include:
// - No <script> tags
// - No event handlers (onclick, onload, etc.)
// - No javascript: URLs
// - No data: URLs
// - No <style>, <form>, <input>, <iframe>, <object>, <embed>
// - Basic tag balance validation
```

### Parallel Evaluation with Worker Pool

```typescript
import { FhirPathWorkerPool } from "@atollee/fhirpath-atollee";

// Create a worker pool
const pool = new FhirPathWorkerPool({ poolSize: 4 });
await pool.initialize();

// Batch evaluation across many resources
const result = await pool.evaluateBatch({
  expression: "name.given.first()",
  resources: patients,  // Array of 1000+ patients
  chunkSize: 100,       // Process in chunks
});

console.log(`Evaluated ${result.resourceCount} patients in ${result.totalDurationMs}ms`);

// Cleanup
await pool.shutdown();
```

### Native Parser Access

```typescript
import { parseFhirPath, FhirPathLexer, FhirPathParser } from "@atollee/fhirpath-atollee";

// Parse expression to AST
const ast = parseFhirPath("name.given.where(length() > 3).first()");

// Direct lexer/parser access
const lexer = new FhirPathLexer("name.given");
const tokens = lexer.tokenize();

const parser = new FhirPathParser(tokens);
const astNode = parser.parse();
```

---

## API Reference

### Default Export

```typescript
interface FhirPathAPI {
  // Standard fhirpath.js API (fully compatible)
  compile(path: string | Path, model?: Model, options?: Options): CompiledExpression;
  evaluate(resource: any, path: string | Path, context?: Context, model?: Model, options?: Options): any[];
  parse(expression: string): ASTNode;
  types(value: any): string[];
  resolveInternalTypes(value: any): any;
  version: string;

  // atollee extensions
  getCacheStats(): CacheStats;
  clearCache(): void;
  createEngine(options?: EngineOptions): FhirPathEngine;
  compileJIT<T>(path: string, options?: JITOptions): CompiledFhirPath<T>;
  clearJITCache(): void;
  
  // v0.7.6: Debugging & Introspection
  inspect(expression: string, options: InspectOptions): InspectResult;
  registry: FunctionRegistry;
}
```

### FhirPathEngine

```typescript
class FhirPathEngine {
  constructor(options?: {
    model?: Model;
    cacheSize?: number;
    cache?: ExpressionCache;
    userInvocationTable?: UserInvocationTable;
  });

  parse(expression: string, base?: string): ASTNode;
  compile(path: string | Path): CompiledExpression;
  evaluate(resource: any, path: string | Path, context?: Context): any[];
  
  getCache(): ExpressionCache;
  getCacheStats(): CacheStats;
  clearCache(): void;
}
```

### ExpressionCache

```typescript
class ExpressionCache {
  constructor(maxSize?: number);  // Default: 1000
  
  get(key: string): ASTNode | undefined;
  set(key: string, ast: ASTNode): void;
  clear(): void;
  
  get size(): number;
  get hits(): number;
  get misses(): number;
  get hitRate(): number;
}
```

### FhirPathWorkerPool

```typescript
class FhirPathWorkerPool {
  constructor(config?: {
    poolSize?: number;      // Default: navigator.hardwareConcurrency
    workerUrl?: string;     // Custom worker script
  });

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  evaluate(task: WorkerTask): Promise<WorkerResult>;
  evaluateBatch(options: BatchEvaluationOptions): Promise<BatchEvaluationResult>;
  
  getStats(): WorkerPoolStats;
}
```

### Inspect API (v0.7.6) - Debugging

Evaluates expressions with debugging information including traces, timing, and AST.

```typescript
import { inspect, formatTraces } from "@atollee/fhirpath-atollee";

const patient = {
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John", "James"] }]
};

// Debug expression with trace() calls
const result = inspect(
  "name.trace('names').given.trace('given names').first()",
  { input: patient }
);

console.log(result.result);        // ["John"]
console.log(result.executionTime); // 0.52 (ms)
console.log(result.traces);        // Trace entries with timing

// Format traces for console
console.log(formatTraces(result.traces));
// Traces:
//   names: [1 items] (0.12ms)
//   given names: [2 items] (0.34ms)

// With variables
const result2 = inspect(
  "name.where(use = %targetUse).given",
  { 
    input: patient,
    variables: { targetUse: "official" }
  }
);

// Create reusable inspector
import { createInspector } from "@atollee/fhirpath-atollee";

const inspectPatient = createInspector({ input: patient });
const r1 = inspectPatient("name.family");
const r2 = inspectPatient("birthDate");
```

**InspectResult Interface:**

```typescript
interface InspectResult {
  result: unknown[];       // Evaluation result
  expression: string;      // Original expression
  ast: ASTNode;           // Parsed AST
  executionTime: number;  // Time in milliseconds
  traces: TraceEntry[];   // All trace() captures
  errors?: Error[];       // Any errors
}

interface TraceEntry {
  name: string;           // Label from trace('label')
  values: unknown[];      // Values at that point
  timestamp: number;      // Time since start (ms)
  depth: number;          // Nesting depth
}
```

### Registry API (v0.7.6) - Introspection

Provides introspection for available FHIRPath functions and operators.

```typescript
import { registry } from "@atollee/fhirpath-atollee";

// List all functions
const functions = registry.listFunctions();
console.log(functions.length); // 60+

// Get function details
const whereFunc = registry.getFunction("where");
// {
//   name: "where",
//   category: "Filtering",
//   description: "Filters the collection...",
//   signatures: [{ parameters: [...], returnType: "Collection" }]
// }

// Filter by category
const stringFuncs = registry.listFunctions({ category: "String" });
const v3Funcs = registry.listFunctions({ specVersion: "3.0.0-ballot" });

// List operators
const operators = registry.listOperators();
const plus = registry.getOperator("+");
// { symbol: "+", name: "addition", precedence: 4, ... }

// Search functions
const searchResults = registry.searchFunctions("string");

// Get statistics
const stats = registry.getStats();
// { functions: 64, operators: 23, categories: 12 }

// Group by category
const byCategory = registry.getFunctionsByCategory();
// { String: [...], Math: [...], Filtering: [...], ... }
```

**Use Cases:**
- Playground autocomplete
- Documentation generation
- IDE integration
- Expression validation hints

### JIT Compiler (v0.7.0)

Compiles FHIRPath AST to native JavaScript for maximum performance.

```typescript
import fhirpath from "@atollee/fhirpath-atollee";

// Compile to JIT function (up to 25x faster than fhirpath.js)
const getNames = fhirpath.compileJIT<string[]>("name.given");

// Execute with native JS performance
const patients = generatePatients(1000);
for (const patient of patients) {
  const names = getNames(patient);  // ~100ns per call
}

// Clear JIT cache if needed
fhirpath.clearJITCache();
```

### Monaco Editor Integration (v0.7.0)

Full language support for FHIRPath in Monaco Editor.

```typescript
import { registerFhirPathLanguage, setupFhirPathValidation } from "@atollee/fhirpath-atollee/monaco";
import * as monaco from "monaco-editor";

// Register language (syntax highlighting, autocomplete, hover)
registerFhirPathLanguage(monaco);

// Create editor
const editor = monaco.editor.create(container, {
  value: "Patient.name.given",
  language: "fhirpath"
});

// Setup real-time validation
const model = editor.getModel();
const disposable = setupFhirPathValidation(monaco, model, 500);

// Features included:
// - Syntax highlighting for all FHIRPath elements
// - Autocomplete for 67+ functions, operators, keywords
// - Hover documentation
// - Real-time validation and error markers
// - Optimization hints (count() > 0 → exists())
```

### Expression Optimizer (v0.7.0)

Analyze expressions for performance patterns and get optimization suggestions.

```typescript
import { analyzeExpression, formatHints } from "@atollee/fhirpath-atollee/optimizer";

const result = analyzeExpression("Patient.name.count() > 0");

console.log(result.valid);        // true
console.log(result.complexity);   // 15 (0-100 scale)
console.log(result.jitCompatible); // true

console.log(formatHints(result.hints));
// 💡 [Performance] Use exists() instead of count() > 0
//    exists() is more efficient as it can short-circuit...
//    Suggestion: Patient.name.exists()

// Detected patterns:
// - count() = 0 → empty()
// - count() > 0 → exists()
// - not().not() → remove both
// - first().first() → redundant
// - empty where() clauses
// - descendants() performance warnings
// - Multiple where() clauses (suggest combining)
```

### FHIR R6-compliant Logging (v0.7.2)

Professional logging system based on FHIR R6 OperationOutcome severity levels.
Designed for IDE/video-coding development, not terminal spam.

```typescript
import { 
  createLogger, 
  configureLogger, 
  addLogHandler, 
  ideHandler,
  jsonHandler,
  getLogBuffer,
  loggers 
} from "@atollee/fhirpath-atollee/logging";

// Use pre-configured module loggers
loggers.parser.info("Parsing expression", { location: "name.given" });
loggers.evaluator.warning("Slow evaluation detected", { duration: 150 });
loggers.jit.perf("JIT compilation", 2.5);

// Create custom logger for your plugin
const log = createLogger("my-fhir-plugin");
log.info("Plugin initialized");
log.warning("Deprecated function used", { code: "deprecated" });
log.error("Validation failed", { 
  code: "invariant", 
  location: "Patient.name",
  details: { constraint: "name-1" }
});

// Configure global logging
configureLogger({
  minLevel: "warning",  // fatal | error | warning | information
  enabled: true,
});

// Add handlers for different environments
addLogHandler(ideHandler);   // IDE-friendly: ℹ️ [source] message (duration)
addLogHandler(jsonHandler);  // Serverless: JSON lines

// Access log buffer (for debugging tools)
const recentLogs = getLogBuffer();
const parserLogs = getLogsBySource("fhirpath-atollee/parser");
const errors = getLogsByLevel("error");

// Time async operations
await log.time("Database query", async () => {
  return await db.query(...);
});
```

**Log Levels (FHIR R6 OperationOutcome.issue.severity):**

| Level | Icon | Use Case |
|-------|------|----------|
| `fatal` | 💀 | Unrecoverable errors, system failure |
| `error` | ❌ | Operation failed, invalid input |
| `warning` | ⚠️ | Deprecation, performance issues |
| `information` | ℹ️ | Progress, performance metrics |

**Design Principles:**
- No console spam - logs go to memory buffer by default
- Plugin source identification in every message
- Edge-first, serverless-compatible (no file I/O)
- Zero external dependencies
- Minimal overhead when disabled

### FHIRPath Playground (v0.7.2)

Interactive playground for testing FHIRPath expressions with **three deployment options**:

#### Option 1: Server-Side Rendered (Deno Fresh 2.2.0) — Recommended

```bash
# Start the SSR playground (default port: 11100)
cd packages/fhirpath-atollee/playground/fresh
deno task dev

# Open http://localhost:11100

# Use custom port with PLAYGROUND_PORT environment variable
PLAYGROUND_PORT=8080 deno task dev
```

**SSR Features:**
- Server-rendered initial content (SEO-friendly)
- Island architecture with Preact for interactivity
- Tailwind CSS (no Vite, pure Fresh)
- Full FHIRPath evaluation server-side
- Dark/Light mode with system preference detection
- English/German language support

#### Option 2: Client-Side Only (Static Hosting / GitHub Pages)

For deployments without a server (GitHub Pages, CDN, S3):

```bash
# Development (requires Fresh Playground running on port 11100)
cd packages/fhirpath-atollee/playground/client-side-only
deno task dev

# Build for production
deno task build

# Deploy the `dist/` folder to any static host
```

**Client-Side Architecture:**
The client-side playground loads `fhirpath-atollee` directly in the browser via ESM:

```typescript
// Browser loads fhirpath-atollee from JSR via esm.sh
import { evaluate } from 'https://esm.sh/jsr/@atollee/fhirpath-atollee';

const result = evaluate(patient, 'name.given');
```

**Note:** Full client-side evaluation requires `fhirpath-atollee` to be published on JSR or npm. 
Until then, the playground uses the Fresh API for evaluation when running locally.

**Client-Side Features:**
- Pure static deployment (no server required)
- Vite + Preact build (~46KB JS, ~18KB CSS gzipped)
- Can be deployed to any static hosting (CDN, S3, Vercel, Netlify)

#### Option 3: Web Component (Embeddable)

```html
<script type="module">
  import { FhirPathPlayground } from '@atollee/fhirpath-atollee/playground';
  customElements.define('fhirpath-playground', FhirPathPlayground);
</script>

<fhirpath-playground></fhirpath-playground>

<script>
  const playground = document.querySelector('fhirpath-playground');
  
  // Set custom resource
  playground.setResource({
    resourceType: "Patient",
    name: [{ given: ["John"], family: "Doe" }]
  });
  
  // Set expression
  playground.setExpression("name.given.first()");
  
  // Listen to evaluation events
  playground.addEventListener('evaluate', (e) => {
    console.log('Result:', e.detail.result);
    console.log('Execution time:', e.detail.executionTime, 'ms');
  });
</script>
```

**Common Features (all versions):**
- Live expression evaluation
- AST visualization (toggle view)
- Optimization hints display
- Performance metrics (execution time, complexity)
- JIT compatibility indicator
- 13 function categories with 80+ sample expressions
- Expression history (localStorage)
- Favorites management
- FHIR Release selector (R4/R4B/R5/R6) for type-aware evaluation

---

### FHIRPath in the Frontend — Use Cases

Unlike `fhirpath.js` (which relies on ANTLR4 and has browser compatibility issues), **fhirpath-atollee** is designed to run natively in the browser. This enables powerful client-side FHIR data processing:

#### Ideal Use Cases

| Use Case | Description | Benefit |
|----------|-------------|---------|
| **Patient Portals** | Extract and display patient data without server roundtrips | Faster UI, reduced server load |
| **SMART on FHIR Apps** | Process FHIR data in-browser after OAuth flow | Privacy (data stays local), offline-capable |
| **Mobile Health Apps** | Real-time data extraction in PWAs/hybrid apps | Low latency, works offline |
| **Clinical Decision Support** | Evaluate CDS rules client-side before server validation | Instant feedback, reduced API calls |
| **Form Pre-population** | Extract values from FHIR resources to prefill forms | Seamless UX, no loading states |
| **Data Visualization** | Transform FHIR data for charts/dashboards in-browser | Real-time updates, no backend needed |
| **Questionnaire Rendering** | Evaluate `enableWhen` and `calculatedExpression` | FHIR Questionnaire R5/R6 compliant |
| **Resource Validation** | Client-side FHIRPath constraint checking | Instant validation feedback |
| **Search/Filter UI** | Filter large FHIR Bundles client-side | Fast filtering without API calls |
| **Educational Tools** | Interactive FHIRPath learning environments | No server setup required |

#### Browser Integration Example

```typescript
// Import from CDN or bundled
import { evaluate } from '@atollee/fhirpath-atollee';

// Extract patient display name
const patient = await fetch('/fhir/Patient/123').then(r => r.json());
const displayName = evaluate(patient, "name.where(use='official').text | name.first().given.join(' ')");

// Evaluate Questionnaire enableWhen
const item = questionnaireItem;
const answers = userAnswers;
const isEnabled = evaluate(answers, item.enableWhen[0].expression);

// Filter Bundle client-side
const bundle = await fetch('/fhir/Observation?patient=123').then(r => r.json());
const abnormalLabs = evaluate(bundle, 
  "entry.resource.where(interpretation.coding.code = 'H' or interpretation.coding.code = 'L')"
);
```

#### Why Client-Side FHIRPath?

| Aspect | Server-Side | Client-Side (fhirpath-atollee) |
|--------|-------------|-------------------------------|
| **Latency** | Network roundtrip required | Instant (< 1ms typical) |
| **Privacy** | Data leaves browser | Data stays local |
| **Offline** | Not possible | Fully supported |
| **Server Load** | Every evaluation = API call | Zero server involvement |
| **Bundle Size** | N/A | ~57KB (ESM, minified) |
| **Scalability** | Limited by server capacity | Scales with user devices |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Public API                                 │
│  evaluate() / compile() / parse() / types() / version            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      FhirPathEngine                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  LRU Cache      │  │  Native Parser   │  │  Evaluator      │  │
│  │  (AST storage)  │  │  (TypeScript)    │  │  (65+ functions)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      Worker Pool (optional)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  │ Worker N │        │
│  │ (Parser) │  │ (Parser) │  │ (Parser) │  │ (Parser) │        │
│  │ (Cache)  │  │ (Cache)  │  │ (Cache)  │  │ (Cache)  │        │
│  │ (Eval)   │  │ (Eval)   │  │ (Eval)   │  │ (Eval)   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### Source Structure

```
packages/fhirpath-atollee/
├── mod.ts                    # Main entry point (default export)
├── FhirPathAtolleePlugin.ts  # HealthRuntime plugin integration
├── src/
│   ├── api.ts                # Public API (fhirpath.js compatible)
│   ├── engine.ts             # FhirPathEngine class
│   ├── cache.ts              # LRU ExpressionCache
│   ├── types.ts              # Shared type definitions
│   ├── parser/
│   │   ├── lexer.ts          # FHIRPath tokenizer
│   │   ├── parser.ts         # Recursive descent parser
│   │   ├── ast.ts            # AST node definitions
│   │   └── tokens.ts         # Token type definitions
│   ├── evaluator/
│   │   ├── evaluator.ts      # Expression evaluator
│   │   ├── functions.ts      # Built-in FHIRPath functions
│   │   └── types.ts          # Evaluator types
│   └── worker/
│       ├── pool.ts           # Worker pool management
│       ├── worker.ts         # Worker thread implementation
│       └── types.ts          # Worker types
├── fhir-context/
│   ├── r4/                   # FHIR R4 model
│   ├── r4b/                  # FHIR R4B model
│   ├── r5/                   # FHIR R5 model
│   └── r6/                   # FHIR R6 model
├── tests/
│   ├── basic_test.ts         # Core functionality tests
│   ├── parser_test.ts        # Parser tests
│   ├── evaluator_test.ts     # Evaluator tests
│   ├── complex_expressions_test.ts
│   ├── official_fhirpath_test.ts  # HL7 test suite
│   └── worker_pool_test.ts   # Parallelization tests
└── benchmarks/
    ├── performance_bench.ts   # Overall performance
    ├── native_evaluator_bench.ts
    └── cache_benefit_bench.ts
```

---

## Performance

### Why is fhirpath-atollee faster?

1. **AST Caching**: Expressions are parsed once and cached. Repeated evaluations skip parsing entirely.

2. **Native Parser**: No ANTLR4 runtime overhead. The parser is ~10x smaller.

3. **Optimized Evaluator**: Direct evaluation without intermediate representations.

4. **Shared-Nothing Workers**: True parallel execution without lock contention.

### Benchmarks

Run benchmarks:
```bash
deno bench --allow-read --allow-env packages/fhirpath-atollee/benchmarks/
```

### Cache Benefit Analysis

| Cache State | Time per Evaluation | Notes |
|-------------|---------------------|-------|
| Cold (first parse) | ~50 µs | Parse + evaluate |
| Warm (cached AST) | ~0.3 µs | Evaluate only |
| **Speedup** | **166x** | For repeated expressions |

---

## Supported Functions

### Existence Functions
- `empty()`, `exists()`, `all()`, `allTrue()`, `anyTrue()`, `allFalse()`, `anyFalse()`

### Filtering Functions
- `where()`, `select()`, `repeat()`, `ofType()`, `as()`, `is()`

### Subsetting Functions
- `single()`, `first()`, `last()`, `tail()`, `skip()`, `take()`, `intersect()`, `exclude()`

### Combining Functions
- `union()`, `combine()`, `distinct()`, `isDistinct()`

### Conversion Functions
- `iif()`, `toBoolean()`, `convertsToBoolean()`, `toInteger()`, `convertsToInteger()`
- `toDecimal()`, `convertsToDecimal()`, `toString()`, `convertsToString()`
- `toDate()`, `convertsToDate()`, `toDateTime()`, `convertsToDateTime()`
- `toTime()`, `convertsToTime()`, `toQuantity()`, `convertsToQuantity()`

### String Functions
- `indexOf()`, `substring()`, `startsWith()`, `endsWith()`, `contains()`, `upper()`, `lower()`
- `replace()`, `matches()`, `replaceMatches()`, `length()`, `split()`, `trim()`, `toChars()`
- `encode()`, `decode()`

### Math Functions
- `abs()`, `ceiling()`, `exp()`, `floor()`, `ln()`, `log()`, `power()`, `round()`
- `sqrt()`, `truncate()`

### Tree Navigation Functions
- `children()`, `descendants()`

### Aggregate Functions
- `count()`, `sum()`, `min()`, `max()`, `avg()`

### Utility Functions
- `now()`, `today()`, `timeOfDay()`, `trace()`, `defineVariable()`

### Type Functions
- `type()`, `is()`, `as()`, `ofType()`

### FHIR-Specific Functions
- `extension()`, `hasExtension()`, `getValue()`, `resolve()`, `memberOf()`, `htmlChecks()`

### Boolean Logic
- `not()`, `and`, `or`, `xor`, `implies`

### Comparison
- `=`, `!=`, `~`, `!~`, `<`, `>`, `<=`, `>=`

---

## Migration Guide

### From fhirpath.js

The API is designed as a drop-in replacement:

```typescript
// Before (fhirpath.js)
import fhirpath from "fhirpath";

// After (fhirpath-atollee)
import fhirpath from "@atollee/fhirpath-atollee";

// All existing code works unchanged!
const result = fhirpath.evaluate(patient, "name.given");
```

### Differences to Note

1. **AST Format**: The native parser returns a different AST structure than ANTLR4. Use `parse()` only for inspection, not serialization.

2. **Error Messages**: Parser errors have slightly different formatting but contain the same information.

3. **Extensions**: New methods `getCacheStats()` and `clearCache()` are available.

---

## Streaming API

For processing large datasets (1000+ resources) without memory overflow, use the Streaming API:

### Basic Streaming

```typescript
import { evaluateStream } from "@atollee/fhirpath";

// Stream through a large Bundle
const bundle = await fetch("/fhir/Patient?_count=10000").then(r => r.json());

for await (const patient of evaluateStream(bundle, "entry.resource")) {
  console.log("Processing:", patient.id);
  // Process one at a time - no memory buildup
}
```

### Stream Methods

```typescript
const stream = evaluateStream(bundle, "entry.resource");

// Collect all (loads into memory)
const all = await stream.toArray();

// Get first result only
const first = await stream.first();

// Count without collecting
const count = await stream.count();

// Check if any results
const exists = await stream.exists();
```

### Chained Operations

```typescript
const names = await evaluateStream<Patient>(bundle, "entry.resource")
  .filter(p => p.resourceType === "Patient")
  .map(p => p.name?.[0]?.given?.[0])
  .take(100)
  .toArray();
```

### Batch Processing

```typescript
const stream = evaluateStream(bundle, "entry.resource");

for await (const batch of stream.batches(100)) {
  await processBatch(batch); // Process 100 items at a time
}
```

### Options

```typescript
const stream = evaluateStream(bundle, "entry.resource", {}, undefined, {
  limit: 1000,           // Max results
  offset: 100,           // Skip first N
  onProgress: (n, total) => console.log(`${n}/${total}`),
  signal: abortController.signal,  // Abort support
});
```

### Web Streams API

```typescript
import { toReadableStream } from "@atollee/fhirpath";

const readable = toReadableStream(bundle, "entry.resource");
const reader = readable.getReader();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  process(value);
}
```

---

## Visual Expression Builder

A Web Component for building FHIRPath expressions visually.

### Basic Usage

```html
<!-- Import the component -->
<script type="module">
  import "@atollee/fhirpath/visual-builder";
</script>

<!-- Use the component -->
<fhirpath-builder
  resource-type="Patient"
  value="name.given"
></fhirpath-builder>
```

### With Event Handling

```html
<fhirpath-builder id="builder" resource-type="Observation"></fhirpath-builder>

<script>
  const builder = document.getElementById('builder');
  
  // Listen for changes
  builder.addEventListener('change', (e) => {
    console.log('Expression:', e.detail.value);
  });
  
  // Get current value
  console.log(builder.value);
  
  // Set a test resource
  builder.setTestResource({
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [{ code: '12345', display: 'Blood Pressure' }] },
    valueQuantity: { value: 120, unit: 'mmHg' }
  });
</script>
```

### In React

```tsx
import { useEffect, useRef } from 'react';
import '@atollee/fhirpath/visual-builder';

function FhirPathEditor({ value, onChange }) {
  const ref = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const handler = (e: CustomEvent) => onChange(e.detail.value);
    ref.current?.addEventListener('change', handler);
    return () => ref.current?.removeEventListener('change', handler);
  }, [onChange]);
  
  return <fhirpath-builder ref={ref} value={value} resource-type="Patient" />;
}
```

### Features

- **Common Paths**: Pre-populated paths for Patient, Observation, Condition, etc.
- **Function Palette**: All FHIRPath functions organized by category
- **Operator Grid**: Quick access to comparison and logical operators
- **Live Testing**: Test expressions against sample or custom resources
- **Syntax Validation**: Real-time parse error highlighting

---

## Testing

```bash
# Run all tests
deno task test:fhirpath-atollee

# Run specific test file
deno test -A packages/fhirpath-atollee/tests/basic_test.ts

# Run with coverage
deno test -A --coverage packages/fhirpath-atollee/tests/
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Basic | 43 | Core API tests |
| Parser | 35 | Lexer/Parser tests |
| Evaluator | 45 | Function evaluation |
| Complex | 15 | Complex expressions |
| Official | 68 | HL7 FHIRPath test suite |
| Worker Pool | 27 | Parallelization |
| **Total** | **233** | |

---

## Roadmap

### Completed (v0.2.0)
- [x] Global AST cache with LRU eviction
- [x] API compatibility with fhirpath.js
- [x] Native TypeScript Lexer
- [x] Native TypeScript Parser
- [x] Native TypeScript Evaluator (80+ functions)
- [x] Worker pool for parallel evaluation
- [x] HealthRuntime Plugin integration
- [x] Official HL7 test suite integration

### Completed (v0.3.0) - Januar 2026
- [x] %terminologies support (Terminology Service API)
- [x] %factory support (Type Factory API)
- [x] aggregate() with full $total/$this support
- [x] resolve() with Bundle context and custom IReferenceResolver
- [x] htmlChecks() XHTML security validation
- [x] 425+ comprehensive tests

### Completed (v0.4.0) - Januar 2026
- [x] Native FHIR R4/R4B/R5/R6 models (8,238 / 7,323 / 10,344 / 9,543 paths)
- [x] JSR/npm build configuration (`deno.json`, `scripts/build-npm.ts`)
- [x] Browser bundle build script (ESM + UMD via esbuild)
- [x] Inline FHIR type definitions (no external `fhir/r6` dependency)
- [x] npm package ready (`dist/npm/` - ~1.2MB)
- [x] Browser bundles ready:
  - ESM: `dist/browser/fhirpath.esm.js` (~57KB minified)
  - UMD: `dist/browser/fhirpath.umd.js` (~57KB minified)

### Planned (v0.5.0)
- [ ] JSR publication (complete type-safety for strict mode)
- [ ] npm publication to registry
- [ ] CDN distribution (unpkg, jsdelivr)

### Completed (v0.5.0) - Januar 2026
- [x] Streaming Evaluation API for large datasets
  - `evaluateStream()` - AsyncIterator-basierte Auswertung
  - `evaluateEach()` - Callback-basierte Verarbeitung
  - `toReadableStream()` - Web Streams API Unterstützung
  - Filter, Map, Take, Skip Operatoren
  - Abort Signal Unterstützung
  - 448+ Tests

### Completed (v0.6.0) - Januar 2026
- [x] Visual Expression Builder (Web Component)
  - Framework-agnostic `<fhirpath-builder>` element
  - Function palette with all categories
  - Common paths by resource type
  - Operator grid
  - Live expression testing

### Completed (v0.7.0) - Januar 2026
- [x] JIT Compiler for Maximum Performance
  - Compiles FHIRPath AST to native JavaScript
  - **Up to 25x faster** than fhirpath.js (12x average)
  - **2x faster** than interpreted atollee
  - Cached compilation for repeated use
- [x] Monaco Editor Extension
  - Syntax highlighting with Monarch tokenizer
  - Intelligent autocomplete for functions, operators, paths
  - Hover documentation for all FHIRPath elements
  - Real-time validation and diagnostics
  - Custom theme support
- [x] Expression Optimization Hints
  - AST analysis for performance patterns
  - Suggestions like "Use exists() instead of count() > 0"
  - Complexity scoring (0-100)
  - JIT compatibility checking
- [x] FHIRPath Playground/Debugger
  - Interactive `<fhirpath-playground>` Web Component
  - Live expression evaluation
  - AST visualization
  - Optimization hints display
  - Performance metrics
  - Sample expressions

### Completed (v0.7.1)
- [x] Expression History
  - localStorage persistence
  - Recent expressions list (max 50)
  - Relative timestamps
- [x] Favorites Management
  - Star/unstar expressions
  - Custom labels
  - Persistent storage
- [x] Collaborative Sharing
  - Shareable URLs with encoded state
  - One-click copy to clipboard
  - Load expression from URL parameters
  - Share expression + resource together

### Completed (v0.7.2)
- [x] Server-side Rendering with Deno Fresh 2.2.0
  - SSR for SEO and instant display
  - Island architecture for interactivity
  - Tailwind CSS (no Vite)
  - Meta tags for social sharing

### Completed (v0.7.3)
- [x] Monaco Editor integration in Playground
  - Syntax highlighting for FHIRPath
  - Intelligent autocomplete for functions
  - Dark/Light theme support
  - Ctrl+Enter to evaluate

### Completed (v0.7.4)
- [x] Internationalization (i18n)
  - English/German language support
  - Language switcher in navigation
  - localStorage persistence
- [x] UI/UX Improvements
  - Dark/Light mode toggle
  - Auto-resize Monaco Editor (grows with content)
  - Consistent focus ring styling
  - Mobile-responsive layout

### Completed (v0.7.5)
- [x] FHIR Release Selector
  - Dropdown for R4/R4B/R5/R6 selection
  - Type-aware evaluation with selected model
  - Cached FhirPathEngine instances per version
  - Affects `is`, `as`, `ofType` type checking

---

## Contributing

This library is designed to be contributed back to the FHIR community.
Contributions are welcome!

```bash
# Clone and setup
git clone https://github.com/atollee/fhirpath-atollee
cd fhirpath-atollee

# Run tests
deno task test:fhirpath-atollee

# Run benchmarks
deno bench --allow-read --allow-env
```

---

## License

MIT License - Compatible with fhirpath.js

---

## Acknowledgments

- [HL7/fhirpath.js](https://github.com/HL7/fhirpath.js) - The reference implementation
- [FHIRPath Specification](https://hl7.org/fhirpath/) - Official specification
- [HL7 FHIR](https://hl7.org/fhir/) - FHIR Standard
