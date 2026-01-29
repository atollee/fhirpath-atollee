/**
 * FHIRPath Expression Optimizer
 * 
 * Provides analysis and optimization hints for FHIRPath expressions.
 * 
 * @example
 * ```typescript
 * import { analyzeExpression, formatHints } from "@atollee/fhirpath/optimizer";
 * 
 * const result = analyzeExpression("Patient.name.count() > 0");
 * console.log(formatHints(result.hints));
 * // 💡 [Performance] Use exists() instead of count() > 0
 * //    exists() is more efficient as it can short-circuit after finding the first element.
 * //    Suggestion: Patient.name.exists()
 * ```
 */

export {
  analyzeExpression,
  getOptimizationHints,
  isJitCompatible,
  getComplexityScore,
  formatHints,
  HintSeverity,
  type OptimizationHint,
  type AnalysisResult,
} from "./hints.ts";
