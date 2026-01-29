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
    
    /** Compile an expression for repeated use */
    compile(expression: string): (resource: unknown, context?: Record<string, unknown>) => unknown[];
    
    /** Get library version */
    getVersion(): string;
    
    /** Get cache statistics */
    getCacheStats(): { size: number; hits: number; misses: number };
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
        // Clear cache on stop
        this.engine.clearCache();
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
     * Compile an expression for repeated evaluation
     */
    compile(expression: string): (resource: unknown, context?: Record<string, unknown>) => unknown[] {
        return this.engine.compile(expression);
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
    getCacheStats(): { size: number; hits: number; misses: number } {
        return {
            size: this.engine.getCache().size,
            hits: this.cacheHits,
            misses: this.cacheMisses,
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
                "Worker Pool Parallelization",
                "233+ Test Cases",
                "Official HL7 FHIRPath Test Suite Compatibility",
            ],
        };
    }
}
