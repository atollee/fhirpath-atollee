/**
 * FHIRPath Engine - Core evaluation engine
 * 
 * This is the main class for FHIRPath evaluation. It provides:
 * - Parsing with AST caching (native TypeScript parser)
 * - Compilation of expressions
 * - Evaluation against FHIR resources (native evaluator)
 * 
 * Design goals:
 * - Stateless evaluation (thread-safe for parallel execution)
 * - Cached parsing (parse once, evaluate many)
 * - API compatibility with fhirpath.js
 * - High performance native TypeScript implementation
 */

import { ExpressionCache, globalCache } from "./cache.ts";
import type {
  ASTNode,
  CompiledExpression,
  EvaluationContext,
  Model,
  Options,
  Path,
  UserInvocationTable,
} from "./types.ts";

// Native parser and evaluator
import { parseFhirPath } from "./parser/mod.ts";
import { evaluateFhirPath } from "./evaluator/mod.ts";
import type { ExpressionNode } from "./parser/ast.ts";

/**
 * Configuration options for FhirPathEngine
 */
export interface FhirPathEngineOptions {
  /** FHIR model for type information */
  model?: Model;
  /** Maximum cache size (default: 500) */
  cacheSize?: number;
  /** Use a custom cache instance */
  cache?: ExpressionCache;
  /** Default user-defined functions */
  userInvocationTable?: UserInvocationTable;
  /** Default trace function */
  traceFn?: (value: unknown, label: string) => void;
  /** Function to check type derivation */
  isDerivedResourceFn?: (resourceType: string, expectedType: string) => boolean;
}

/**
 * FHIRPath evaluation engine
 * 
 * @example
 * ```typescript
 * const engine = new FhirPathEngine({ model: r6Model });
 * 
 * // Direct evaluation
 * const names = engine.evaluate(patient, "name.given");
 * 
 * // Compile for repeated use
 * const getNames = engine.compile("name.given");
 * patients.forEach(p => console.log(getNames(p)));
 * ```
 */
export class FhirPathEngine {
  private readonly cache: ExpressionCache;
  private readonly nativeAstCache = new Map<string, ExpressionNode>();
  private readonly model?: Model;
  private readonly defaultOptions: Options;

  constructor(options: FhirPathEngineOptions = {}) {
    this.cache = options.cache ?? new ExpressionCache(options.cacheSize ?? 500);
    this.model = options.model;
    this.defaultOptions = {
      userInvocationTable: options.userInvocationTable,
      traceFn: options.traceFn,
      isDerivedResourceFn: options.isDerivedResourceFn,
    };
  }

  /**
   * Parse a FHIRPath expression into an AST
   * 
   * This method uses the cache to avoid re-parsing the same expression.
   * 
   * @param expression The FHIRPath expression string
   * @param _base Optional base resource type (for API compatibility)
   * @returns The parsed AST
   */
  parse(expression: string, _base?: string): ASTNode {
    // Use native parser and return native AST
    const nativeAst = this.parseNative(expression);
    return nativeAst as unknown as ASTNode;
  }

  /**
   * Parse a FHIRPath expression into a native AST
   * 
   * Uses the native TypeScript parser for fast parsing.
   * 
   * @param expression The FHIRPath expression string
   * @returns The parsed native AST
   */
  parseNative(expression: string): ExpressionNode {
    // Check native cache
    let ast = this.nativeAstCache.get(expression);
    if (ast) {
      return ast;
    }

    // Parse using native parser
    ast = parseFhirPath(expression);

    // Cache the result
    this.nativeAstCache.set(expression, ast);

    return ast;
  }

  /**
   * Compile a FHIRPath expression for repeated evaluation
   * 
   * This is the recommended way to use FHIRPath when evaluating
   * the same expression against multiple resources.
   * 
   * @param path Expression string or Path object with base type
   * @param model Optional FHIR model (overrides engine default)
   * @param options Compilation options
   * @returns A compiled expression function
   */
  compile(
    path: string | Path,
    model?: Model,
    options?: Options,
  ): CompiledExpression {
    const expression = typeof path === "string" ? path : path.expression;
    const base = typeof path === "string" ? undefined : path.base;
    const effectiveModel = model ?? this.model;

    // Merge options
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Parse with native parser
    const nativeAst = this.parseNative(expression);

    // Create compiled function using native evaluator
    const compiled = ((
      resource: unknown,
      context?: EvaluationContext,
      additionalOptions?: Options,
    ) => {
      const evalOptions = additionalOptions 
        ? { ...mergedOptions, ...additionalOptions }
        : mergedOptions;
      
      // Cast context to evaluator's EvaluationContext (compatible structure)
      return evaluateFhirPath(nativeAst, resource, (context ?? {}) as Record<string, unknown>, {
        model: effectiveModel,
        userInvocationTable: evalOptions.userInvocationTable,
        traceFn: evalOptions.traceFn,
        isDerivedResourceFn: evalOptions.isDerivedResourceFn,
        terminologyService: evalOptions.terminologyService as unknown,
        referenceResolver: evalOptions.referenceResolver as unknown,
        async: evalOptions.async,
      } as Parameters<typeof evaluateFhirPath>[3]);
    }) as CompiledExpression;

    // Add metadata
    Object.defineProperties(compiled, {
      expression: { value: expression, writable: false },
      base: { value: base, writable: false },
      ast: { value: nativeAst, writable: false },
      native: { value: true, writable: false },
    });

    return compiled;
  }

  /**
   * Evaluate a FHIRPath expression against a FHIR resource
   * 
   * For one-off evaluations. For repeated evaluations of the same
   * expression, use compile() instead.
   * 
   * @param resource The FHIR resource to evaluate against
   * @param path Expression string or Path object
   * @param context Environment variables for evaluation
   * @param model Optional FHIR model
   * @param options Evaluation options
   * @returns Array of results
   */
  evaluate(
    resource: unknown,
    path: string | Path,
    context?: EvaluationContext,
    model?: Model,
    options?: Options,
  ): unknown[] {
    const compiled = this.compile(path, model, options);
    return compiled(resource, context);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear the expression cache
   */
  clearCache() {
    this.cache.clear();
    this.nativeAstCache.clear();
  }

  /**
   * Get the underlying cache instance
   */
  getCache(): ExpressionCache {
    return this.cache;
  }
}

/**
 * Default global engine instance
 * 
 * Used by the default API functions. Applications can create
 * their own engine instances for isolation.
 */
let globalEngine: FhirPathEngine | null = null;

/**
 * Get or create the global engine instance
 */
export function getGlobalEngine(model?: Model): FhirPathEngine {
  if (!globalEngine) {
    globalEngine = new FhirPathEngine({ cache: globalCache, model });
  } else if (model && !globalEngine["model"]) {
    // Update model if not set
    (globalEngine as unknown as { model: Model }).model = model;
  }
  return globalEngine;
}

/**
 * Reset the global engine (for testing)
 */
export function resetGlobalEngine(): void {
  globalEngine = null;
  globalCache.clear();
}
