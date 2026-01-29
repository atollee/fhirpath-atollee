/**
 * FhirPath Atollee Plugin
 * 
 * Plugin wrapper that exposes fhirpath-atollee as a visible plugin
 * in the HealthRuntime plugin system.
 * 
 * This is a stateless plugin that provides:
 * - FHIRPath expression evaluation
 * - Native TypeScript implementation (no legacy fhirpath.js)
 * - AST caching for performance
 * - Worker pool for parallel evaluation
 */

import type {
    ILoggerContext,
    IPluginConfigureContext,
    IPluginEnvironment,
    IPluginStartContext,
} from "@atollee/core";
import {
    AbstractPlugin,
    Plugin,
    PluginMetadata,
    registerService,
} from "@atollee/core";
import fhirpath, { FhirPathEngine, version } from "./mod.ts";
import { compileJIT, type CompiledFhirPath } from "./src/jit/mod.ts";
import { parseFhirPath } from "./src/parser/mod.ts";

// deno-lint-ignore no-empty-interface
export interface FhirPathAtolleeConfiguration {
    // Future: cache size limits, worker pool settings, etc.
}

/**
 * FHIRPath evaluation service interface
 */
export interface IFhirPathService {
    /** Evaluate a FHIRPath expression */
    evaluate(resource: unknown, expression: string, context?: Record<string, unknown>): unknown[];
    
    /** Compile an expression for repeated use (interpreted) */
    compile(expression: string): (resource: unknown, context?: Record<string, unknown>) => unknown[];
    
    /** 
     * Compile an expression to native JavaScript for maximum performance (JIT)
     * Use for hot paths like SearchParameters evaluated thousands of times
     * @returns JIT-compiled function or null if expression is not JIT-compatible
     */
    compileJIT<T = unknown[]>(expression: string): CompiledFhirPath<T> | null;
    
    /** Get library version */
    getVersion(): string;
    
    /** Get cache statistics */
    getCacheStats(): { size: number; hits: number; misses: number; jitCacheSize: number };
}

@PluginMetadata({
    purpose:
        "Native TypeScript FHIRPath evaluation engine with AST caching and parallel processing support.",
    contributors: [
        "FHIRPath expression evaluation for SearchParameters, constraints, and subscriptions.",
        "High-performance native implementation replacing legacy fhirpath.js.",
    ],
    architecture:
        "Lexer → Parser → AST → Evaluator pipeline with LRU cache and optional Worker Pool parallelization.",
    dependencies: [],
    tags: ["FHIRPath", "Expression", "Evaluation", "Native", "TypeScript", "Performance", "stateless"],
})
@Plugin("fhirpath.atollee")
export class FhirPathAtolleePlugin
    extends AbstractPlugin<FhirPathAtolleeConfiguration>
    implements IFhirPathService {
    
    private engine: FhirPathEngine;
    private jitCache = new Map<string, CompiledFhirPath<unknown[]>>();
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor(environment: IPluginEnvironment) {
        super(environment);
        this.engine = new FhirPathEngine();
    }

    // deno-lint-ignore require-await
    async configure(context: IPluginConfigureContext) {
        // Register as service for direct access
        registerService("fhirpath.atollee", this);
        registerService("fhirpath", this); // Alias
    }

    async start(_context: IPluginStartContext): Promise<void> {
        // Stateless plugin: warm up cache with common expressions
        const commonExpressions = [
            "resourceType",
            "id",
            "meta.versionId",
            "meta.lastUpdated",
        ];
        for (const expr of commonExpressions) {
            try {
                this.engine.compile(expr);
            } catch {
                // Ignore compilation errors during warmup
            }
        }
    }

    async stop(): Promise<void> {
        // Clear caches on stop
        this.engine.clearCache();
        this.jitCache.clear();
    }

    /**
     * Evaluate a FHIRPath expression against a resource
     */
    evaluate(
        resource: unknown,
        expression: string,
        context?: Record<string, unknown>,
    ): unknown[] {
        return fhirpath.evaluate(resource, expression, context) as unknown[];
    }

    /**
     * Compile an expression for repeated evaluation (interpreted)
     */
    compile(expression: string): (resource: unknown, context?: Record<string, unknown>) => unknown[] {
        return this.engine.compile(expression);
    }

    /**
     * Compile an expression to native JavaScript for maximum performance (JIT)
     * 
     * Use for hot paths like SearchParameters that are evaluated thousands of times.
     * JIT-compiled functions are ~10-50x faster than interpreted evaluation.
     * 
     * @returns JIT-compiled function or null if expression is not JIT-compatible
     */
    compileJIT<T = unknown[]>(expression: string): CompiledFhirPath<T> | null {
        // Check cache first
        const cached = this.jitCache.get(expression);
        if (cached) {
            this.cacheHits++;
            return cached as CompiledFhirPath<T>;
        }
        
        this.cacheMisses++;
        
        try {
            // Parse to AST
            const ast = parseFhirPath(expression);
            
            // Compile to native JS
            const jitFn = compileJIT<T>(ast);
            
            // Cache it
            this.jitCache.set(expression, jitFn as CompiledFhirPath<unknown[]>);
            
            return jitFn;
        } catch {
            // JIT compilation failed - expression not supported
            return null;
        }
    }

    /**
     * Get library version
     */
    getVersion(): string {
        return version;
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hits: number; misses: number; jitCacheSize: number } {
        return {
            size: this.engine.getCache().size,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            jitCacheSize: this.jitCache.size,
        };
    }

    /**
     * Plugin metadata for workbench display
     */
    getMetadata() {
        return {
            purpose: "Native TypeScript FHIRPath evaluation engine with AST caching and parallel processing support.",
            contributors: [
                "FHIRPath expression evaluation for SearchParameters, constraints, and subscriptions.",
                "High-performance native implementation replacing legacy fhirpath.js.",
            ],
            architecture: "Lexer → Parser → AST → Evaluator pipeline with LRU cache and optional Worker Pool parallelization.",
            dependencies: [],
            tags: ["FHIRPath", "Expression", "Evaluation", "Native", "TypeScript", "Performance", "stateless"],
            version: version,
            features: [
                "Native TypeScript Lexer/Parser",
                "AST Caching (LRU)",
                "JIT Compiler (10-50x faster)",
                "Worker Pool Parallelization",
                "580+ Test Cases",
                "Official HL7 FHIRPath Test Suite Compatibility",
            ],
        };
    }
}
