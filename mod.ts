/**
 * @atollee/fhirpath-atollee
 * 
 * A modern, high-performance FHIRPath implementation in TypeScript.
 * 
 * Key improvements over fhirpath.js:
 * - Global AST cache (LRU) - expressions are parsed once
 * - Native TypeScript lexer and parser (no ANTLR4 dependency)
 * - Stateless evaluation - prepared for parallelization
 * - API-compatible with fhirpath.js for easy migration
 * 
 * @example
 * ```typescript
 * import fhirpath from "@atollee/fhirpath-atollee";
 * import r6Model from "@atollee/fhirpath-atollee/fhir-context/r6";
 * 
 * // Option 1: Direct evaluation (uses internal cache)
 * const result = fhirpath.evaluate(patient, "name.given");
 * 
 * // Option 2: Compile once, evaluate many (recommended)
 * const compiled = fhirpath.compile("name.given", r6Model);
 * const result1 = compiled(patient1);
 * const result2 = compiled(patient2);
 * 
 * // Option 3: Use the FhirPathEngine for full control
 * const engine = new FhirPathEngine({ model: r6Model, cacheSize: 1000 });
 * const result = engine.evaluate(patient, "name.given");
 * 
 * // Option 4: Use the native parser directly
 * import { parseFhirPath } from "@atollee/fhirpath-atollee";
 * const ast = parseFhirPath("name.given.first()");
 * ```
 */

export { FhirPathEngine, type FhirPathEngineOptions } from "./src/engine.ts";
export { ExpressionCache } from "./src/cache.ts";
export { 
  type CompiledExpression, 
  type EvaluationContext,
  type UserInvocationTable,
  type Model,
  type Options,
  type Path,
  type IReferenceResolverBase
} from "./src/types.ts";

// Export IReferenceResolver from evaluator (full interface)
export { type IReferenceResolver } from "./src/evaluator/types.ts";

// Export native parser components
export { 
  FhirPathLexer, 
  LexerError,
  FhirPathParser, 
  ParserError, 
  parseFhirPath,
  TokenType,
  type Token,
} from "./src/parser/mod.ts";
export type * from "./src/parser/ast.ts";

// Export native evaluator
export {
  FhirPathEvaluator,
  EvaluatorError,
  evaluateFhirPath,
} from "./src/evaluator/mod.ts";
export { functions as fhirPathFunctions } from "./src/evaluator/mod.ts";

// Export worker pool for parallel evaluation
export {
  FhirPathWorkerPool,
  getGlobalWorkerPool,
  shutdownGlobalPool,
} from "./src/worker/mod.ts";
export type {
  WorkerTask,
  WorkerResult,
  WorkerPoolConfig,
  WorkerPoolStats,
  BatchEvaluationOptions,
  BatchEvaluationResult,
} from "./src/worker/mod.ts";

// Export terminology service
export {
  type ITerminologyService,
  type CodedValue,
  type TerminologyParams,
  type SubsumesResult,
  type RemoteTerminologyServiceConfig,
  type TerminologyOptions,
  RemoteTerminologyService,
  createTerminologyService,
  TerminologiesProxy,
  createTerminologiesProxy,
} from "./src/terminology/mod.ts";

// Export type factory
export {
  type ITypeFactory,
  type PrimitiveWithExtension,
  type FhirPrimitiveType,
  TypeFactory,
  createTypeFactory,
  globalFactory,
} from "./src/factory/mod.ts";

// Re-export the default API (compatible with fhirpath.js)
import { createDefaultAPI } from "./src/api.ts";
const fhirpath = createDefaultAPI();

export default fhirpath;
export const { compile, evaluate, parse, types, version } = fhirpath;

// Export Streaming API for large datasets
export {
  evaluateStream,
  evaluateEach,
  toReadableStream,
  FhirPathStream,
  type StreamingOptions,
  type StreamResult,
} from "./src/streaming.ts";

// Export JIT Compiler for maximum performance
export {
  FhirPathJIT,
  compileJIT,
  clearJITCache,
  jitCompiler,
  type CompiledFhirPath,
  type JITOptions,
} from "./src/jit/mod.ts";

// Export Monaco Editor integration
export {
  registerFhirPathLanguage,
  setupFhirPathValidation,
  provideFhirPathCompletions,
  provideFhirPathHover,
  provideFhirPathDiagnostics,
  FHIRPATH_LANGUAGE_ID,
  FHIRPATH_FUNCTIONS,
  FHIRPATH_OPERATORS,
} from "./src/monaco/mod.ts";

// Export Expression Optimizer
export {
  analyzeExpression,
  getOptimizationHints,
  isJitCompatible,
  getComplexityScore,
  formatHints,
  HintSeverity,
  type OptimizationHint,
  type AnalysisResult,
} from "./src/optimizer/mod.ts";

// Note: FhirPathAtolleePlugin must be imported directly for HealthRuntime integration:
// import { FhirPathAtolleePlugin } from "@atollee/fhirpath/FhirPathAtolleePlugin.ts";
