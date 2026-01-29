/**
 * Public API - Compatible with fhirpath.js
 * 
 * This module provides a drop-in replacement API for fhirpath.js.
 * Import the default export and use the same functions.
 * 
 * @example
 * ```typescript
 * // Drop-in replacement
 * import fhirpath from "@atollee/fhirpath-atollee";
 * 
 * // Same API as fhirpath.js
 * const result = fhirpath.evaluate(patient, "name.given");
 * const compiled = fhirpath.compile("name.given", model);
 * ```
 */

import { FhirPathEngine, getGlobalEngine } from "./engine.ts";
import { globalCache } from "./cache.ts";
import type {
  ASTNode,
  CompiledExpression,
  EvaluationContext,
  Model,
  Options,
  OptionVariants,
  Path,
} from "./types.ts";
import { 
  createTerminologyService, 
  createTerminologiesProxy,
  type ITerminologyService,
} from "./terminology/mod.ts";
import { globalFactory } from "./factory/mod.ts";
import { FhirPathJIT, compileJIT, clearJITCache, type CompiledFhirPath, type JITOptions } from "./jit/mod.ts";
import { inspect, type InspectOptions, type InspectResult } from "./inspect.ts";
import { registry } from "./registry.ts";

/**
 * API interface matching fhirpath.js
 */
export interface FhirPathAPI {
  /**
   * Version string
   */
  version: string;

  /**
   * Compile a FHIRPath expression for repeated evaluation
   */
  compile<T extends OptionVariants>(
    path: string | Path,
    model?: Model,
    options?: T,
  ): CompiledExpression;

  /**
   * Evaluate a FHIRPath expression against a resource
   */
  evaluate<T extends OptionVariants>(
    fhirData: unknown,
    path: string | Path,
    context?: EvaluationContext,
    model?: Model,
    options?: T,
  ): unknown[] | Promise<unknown[]>;

  /**
   * Parse a FHIRPath expression into an AST
   */
  parse(expression: string): ASTNode;

  /**
   * Get the FHIRPath types of a value
   */
  types(value: unknown): string[];

  /**
   * Resolve internal FHIRPath types to plain JSON
   */
  resolveInternalTypes(value: unknown): unknown;

  /**
   * Get cache statistics (atollee extension)
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
  };

  /**
   * Clear the expression cache (atollee extension)
   */
  clearCache(): void;

  /**
   * Create a new engine instance (atollee extension)
   */
  createEngine(options?: {
    model?: Model;
    cacheSize?: number;
  }): FhirPathEngine;

  /**
   * Compile a FHIRPath expression using JIT compilation (atollee extension)
   * 
   * JIT compilation generates native JavaScript code for maximum performance.
   * ~10-15x faster than interpreted evaluation.
   * 
   * @example
   * ```typescript
   * const jitCompiled = fhirpath.compileJIT("name.where(use = 'official').given.first()");
   * const result = jitCompiled(patient); // ~10x faster than fhirpath.evaluate()
   * ```
   */
  compileJIT<T = unknown>(
    path: string,
    options?: JITOptions,
  ): CompiledFhirPath<T>;

  /**
   * Clear the JIT compilation cache (atollee extension)
   */
  clearJITCache(): void;

  /**
   * Inspect a FHIRPath expression with debugging information (atollee extension)
   * 
   * Evaluates an expression while capturing traces, timing, and AST.
   * 
   * @example
   * ```typescript
   * const result = fhirpath.inspect("name.trace('names').given.first()", {
   *   input: patient
   * });
   * console.log(result.traces);        // Trace entries
   * console.log(result.executionTime); // Execution time in ms
   * ```
   */
  inspect(
    expression: string,
    options: InspectOptions,
  ): InspectResult;

  /**
   * Registry for introspecting available functions and operators (atollee extension)
   * 
   * @example
   * ```typescript
   * const functions = fhirpath.registry.listFunctions();
   * const whereFunc = fhirpath.registry.getFunction('where');
   * ```
   */
  registry: typeof registry;
}

/**
 * Determine FHIRPath type of a value
 */
function getFhirPathType(value: unknown): string {
  if (value === null || value === undefined) {
    return "empty";
  }

  if (typeof value === "string") {
    // Check for date/time patterns
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
      return "date";
    }
    if (/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) {
      return "time";
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) {
      return "dateTime";
    }
    return "string";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "decimal";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (Array.isArray(value)) {
    return "collection";
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    
    // Check for quantity
    if ("value" in obj && typeof obj.value === "number") {
      if ("unit" in obj || "code" in obj || "system" in obj) {
        return "Quantity";
      }
    }

    // Check for FHIR resource
    if ("resourceType" in obj && typeof obj.resourceType === "string") {
      return obj.resourceType as string;
    }

    // Check for FHIR element types by looking at common patterns
    if ("coding" in obj) {
      return "CodeableConcept";
    }
    if ("reference" in obj && typeof obj.reference === "string") {
      return "Reference";
    }
    if ("use" in obj && "family" in obj) {
      return "HumanName";
    }
    if ("system" in obj && "value" in obj && !("unit" in obj)) {
      return "Identifier";
    }

    return "object";
  }

  return "unknown";
}

/**
 * Get all possible FHIRPath types for a value
 */
function getTypes(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  const type = getFhirPathType(value);
  
  // Return type hierarchy for primitives
  switch (type) {
    case "integer":
      return ["integer", "decimal", "number"];
    case "decimal":
      return ["decimal", "number"];
    case "date":
    case "dateTime":
    case "time":
      return [type, "string"];
    default:
      return [type];
  }
}

/**
 * Resolve internal types (e.g., FhirPathQuantity) to plain JSON
 * For native implementation, values are already plain JSON
 */
function resolveTypes(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(resolveTypes);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    
    // Check if it's an internal quantity representation
    if ("_type" in obj && obj._type === "FhirPathQuantity") {
      return {
        value: obj.value,
        unit: obj.unit,
      };
    }

    // Recursively resolve nested objects
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = resolveTypes(val);
    }
    return result;
  }

  return value;
}

/**
 * Create the default API object
 */
export function createDefaultAPI(): FhirPathAPI {
  return {
    version: "0.2.0-atollee-native",

    compile<T extends OptionVariants>(
      path: string | Path,
      model?: Model,
      options?: T,
    ): CompiledExpression {
      const engine = getGlobalEngine(model);
      return engine.compile(path, model, options as Options);
    },

    evaluate<T extends OptionVariants>(
      fhirData: unknown,
      path: string | Path,
      context?: EvaluationContext,
      model?: Model,
      options?: T,
    ): unknown[] | Promise<unknown[]> {
      const engine = getGlobalEngine(model);
      
      // Handle options
      const opts = options as Options | undefined;
      const isAsync = opts && 'async' in opts && opts.async;
      
      // Setup context with standard environment variables
      let terminologyService: ITerminologyService | undefined;
      let evaluationContext = {
        ...context,
        // %factory is always available
        factory: globalFactory,
      };
      
      // Setup terminology service if terminologyUrl is provided
      if (opts?.terminologyUrl) {
        terminologyService = createTerminologyService(
          opts.terminologyUrl,
          opts.httpHeaders?.[opts.terminologyUrl]
        );
        
        // Add %terminologies to context
        const terminologiesProxy = createTerminologiesProxy(terminologyService);
        evaluationContext = {
          ...evaluationContext,
          terminologies: terminologiesProxy,
        };
      } else if (opts?.terminologyService) {
        // Cast to ITerminologyService - user-provided service should implement full interface
        terminologyService = opts.terminologyService as ITerminologyService;
        const terminologiesProxy = createTerminologiesProxy(terminologyService);
        evaluationContext = {
          ...evaluationContext,
          terminologies: terminologiesProxy,
        };
      }
      
      // Pass terminologyService and referenceResolver to options for evaluator
      const evalOpts = {
        ...opts,
        ...(terminologyService && { terminologyService }),
        ...(opts?.referenceResolver && { referenceResolver: opts.referenceResolver }),
      };
      
      const result = engine.evaluate(fhirData, path, evaluationContext, model, evalOpts);
      
      if (isAsync === true || isAsync === 'always') {
        return Promise.resolve(result);
      }
      
      return result;
    },

    parse(expression: string): ASTNode {
      const engine = getGlobalEngine();
      return engine.parse(expression);
    },

    types(value: unknown): string[] {
      return getTypes(value);
    },

    resolveInternalTypes(value: unknown): unknown {
      return resolveTypes(value);
    },

    // atollee extensions
    getCacheStats() {
      return globalCache.getStats();
    },

    clearCache() {
      globalCache.clear();
    },

    createEngine(options?: { model?: Model; cacheSize?: number }) {
      return new FhirPathEngine(options);
    },

    // JIT compilation (atollee extension)
    compileJIT<T = unknown>(
      path: string,
      options?: JITOptions,
    ): CompiledFhirPath<T> {
      const engine = getGlobalEngine();
      const ast = engine.parse(path);
      return compileJIT<T>(ast, options);
    },

    clearJITCache() {
      clearJITCache();
    },

    // Inspect API (atollee extension)
    inspect(
      expression: string,
      options: InspectOptions,
    ): InspectResult {
      return inspect(expression, options);
    },

    // Registry (atollee extension)
    registry,
  };
}
