/**
 * FHIRPath Inspect API
 * 
 * Provides debugging and introspection capabilities for FHIRPath expressions.
 * Inspired by @atomic-ehr/fhirpath's inspect() function.
 * 
 * @example
 * ```typescript
 * import { inspect } from "@atollee/fhirpath-atollee";
 * 
 * const result = inspect("name.trace('names').given.first()", {
 *   input: patient
 * });
 * 
 * console.log(result.result);        // ['John']
 * console.log(result.traces);        // [{ name: 'names', values: [...], timestamp: 0.5 }]
 * console.log(result.executionTime); // 1.23
 * console.log(result.ast);           // Parsed AST
 * ```
 */

import { FhirPathEngine, getGlobalEngine } from "./engine.ts";
import type { ASTNode, EvaluationContext, Model } from "./types.ts";
import { parseFhirPath } from "./parser/mod.ts";

/**
 * A single trace entry captured during evaluation
 */
export interface TraceEntry {
  /** Label passed to trace() */
  name: string;
  /** Values at the trace point (deep copy) */
  values: unknown[];
  /** Timestamp relative to evaluation start (ms) */
  timestamp: number;
  /** Nesting depth of trace calls */
  depth: number;
}

/**
 * Options for inspect()
 */
export interface InspectOptions {
  /** Input data to evaluate against */
  input: unknown;
  /** Environment variables (accessible via %name) */
  variables?: Record<string, unknown>;
  /** FHIR model for type-aware evaluation */
  model?: Model;
  /** Maximum number of traces to collect (default: 1000) */
  maxTraces?: number;
  /** Evaluation context */
  context?: EvaluationContext;
}

/**
 * Result of inspect()
 */
export interface InspectResult {
  /** The evaluation result (same as evaluate()) */
  result: unknown[];
  /** The original expression string */
  expression: string;
  /** Parsed Abstract Syntax Tree */
  ast: ASTNode;
  /** Total execution time in milliseconds */
  executionTime: number;
  /** All trace entries collected during evaluation */
  traces: TraceEntry[];
  /** Any errors encountered during evaluation */
  errors?: Error[];
  /** Any warnings */
  warnings?: string[];
}

/**
 * Inspect a FHIRPath expression with debugging information
 * 
 * This function evaluates a FHIRPath expression while capturing:
 * - All trace() calls with their values and timing
 * - Total execution time
 * - The parsed AST
 * 
 * @param expression - FHIRPath expression to evaluate
 * @param options - Input data and configuration
 * @returns InspectResult with result, traces, timing, and AST
 * 
 * @example
 * ```typescript
 * // Debug a complex expression
 * const result = inspect(
 *   "entry.resource.trace('resources').where(resourceType = 'Patient').trace('patients')",
 *   { input: bundle }
 * );
 * 
 * result.traces.forEach(trace => {
 *   console.log(`${trace.name}: ${trace.values.length} items at ${trace.timestamp}ms`);
 * });
 * ```
 */
export function inspect(
  expression: string,
  options: InspectOptions
): InspectResult {
  const traces: TraceEntry[] = [];
  const maxTraces = options.maxTraces ?? 1000;
  const startTime = performance.now();
  let traceDepth = 0;
  const errors: Error[] = [];
  
  // Parse AST first (outside of timing for pure expression evaluation)
  let ast: ASTNode;
  try {
    const parsed = parseFhirPath(expression);
    ast = parsed as unknown as ASTNode;
  } catch (error) {
    return {
      result: [],
      expression,
      ast: { type: "Empty" } as unknown as ASTNode,
      executionTime: performance.now() - startTime,
      traces: [],
      errors: [error instanceof Error ? error : new Error(String(error))],
    };
  }
  
  // Create trace function that collects entries
  const traceFn = (value: unknown, label: string) => {
    if (traces.length < maxTraces) {
      const valueArray = Array.isArray(value) ? value : [value];
      traces.push({
        name: label,
        values: deepCopy(valueArray) as unknown[],
        timestamp: performance.now() - startTime,
        depth: traceDepth,
      });
    }
  };
  
  // Get engine and evaluate with traceFn
  const engine = getGlobalEngine(options.model);
  
  // Build evaluation context
  const evalContext: EvaluationContext = {
    ...options.context,
    ...options.variables,
  };
  
  let result: unknown[] = [];
  
  try {
    result = engine.evaluate(
      options.input,
      expression,
      evalContext,
      options.model,
      { traceFn }
    );
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }
  
  const executionTime = performance.now() - startTime;
  
  return {
    result,
    expression,
    ast,
    executionTime,
    traces,
    ...(errors.length > 0 && { errors }),
  };
}

/**
 * Deep copy a value for trace storage
 * Ensures trace values are snapshots, not references
 */
function deepCopy(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value !== "object") {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(deepCopy);
  }
  
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  
  // Plain object
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = deepCopy(val);
  }
  return result;
}

/**
 * Format traces for console output
 */
export function formatTraces(traces: TraceEntry[]): string {
  if (traces.length === 0) {
    return "No traces captured";
  }
  
  const lines: string[] = ["Traces:"];
  
  for (const trace of traces) {
    const indent = "  ".repeat(trace.depth + 1);
    const valueStr = trace.values.length <= 3
      ? JSON.stringify(trace.values)
      : `[${trace.values.length} items]`;
    lines.push(
      `${indent}${trace.name}: ${valueStr} (${trace.timestamp.toFixed(2)}ms)`
    );
  }
  
  return lines.join("\n");
}

/**
 * Create an inspector with preset options
 * Useful for repeated inspections with the same configuration
 */
export function createInspector(defaultOptions: Partial<InspectOptions>) {
  return (expression: string, options?: Partial<InspectOptions>): InspectResult => {
    return inspect(expression, {
      input: options?.input ?? defaultOptions.input,
      variables: { ...defaultOptions.variables, ...options?.variables },
      model: options?.model ?? defaultOptions.model,
      maxTraces: options?.maxTraces ?? defaultOptions.maxTraces,
      context: { ...defaultOptions.context, ...options?.context },
    });
  };
}
