/**
 * FHIRPath Evaluate API Endpoint
 * 
 * Supports FHIR R4/R4B/R5/R6 type checking
 * No mocks, no simulation - real FHIRPath evaluation
 * 
 * @see https://hl7.org/fhir/fhirpath.html
 */
import { FhirPathEngine } from "../../../../src/engine.ts";
import { parseFhirPath } from "../../../../src/parser/mod.ts";
import { analyzeExpression } from "../../../../src/optimizer/mod.ts";
import { compileJIT, type CompiledFhirPath } from "../../../../src/jit/mod.ts";
import { loggers } from "../../../../src/logging.ts";

// Import FHIR models
import r4Model from "../../../../fhir-context/r4/mod.ts";
import r4bModel from "../../../../fhir-context/r4b/mod.ts";
import r5Model from "../../../../fhir-context/r5/mod.ts";
import r6Model from "../../../../fhir-context/r6/mod.ts";

const log = loggers.playground;

// FHIR model cache
const fhirModels = {
  r4: r4Model,
  r4b: r4bModel,
  r5: r5Model,
  r6: r6Model,
} as const;

type FhirVersion = keyof typeof fhirModels;

// Engine cache (one per FHIR version)
const engines = new Map<FhirVersion, FhirPathEngine>();

function getEngine(version: FhirVersion): FhirPathEngine {
  let engine = engines.get(version);
  if (!engine) {
    engine = new FhirPathEngine({ model: fhirModels[version] });
    engines.set(version, engine);
  }
  return engine;
}

// Default engine (no model, for basic evaluation)
const defaultEngine = new FhirPathEngine();

// JIT function cache
const jitCache = new Map<string, CompiledFhirPath<unknown[]>>();

export const handler = {
  async POST(req: Request): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const body = await req.json();
      const { expression, resource, context = {}, fhirVersion } = body;

      if (!expression || typeof expression !== "string") {
        log.warning("Invalid request: missing expression", {
          code: "invalid",
          details: { hasExpression: !!expression },
        });
        return Response.json(
          { error: "Missing or invalid 'expression' parameter" },
          { status: 400 }
        );
      }

      // Validate FHIR version if provided
      const validVersions: FhirVersion[] = ["r4", "r4b", "r5", "r6"];
      const version = fhirVersion && validVersions.includes(fhirVersion) 
        ? fhirVersion as FhirVersion 
        : null;

      // Parse AST
      let ast = null;
      try {
        ast = parseFhirPath(expression);
      } catch (parseError) {
        log.info("Parse error (expected for invalid expressions)", {
          code: "processing",
          location: expression,
          details: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Analyze expression for optimization hints
      const analysis = analyzeExpression(expression);

      // Evaluate - use JIT if compatible, otherwise interpreted
      let result = null;
      let error = null;
      let evalDuration = 0;
      let usedJit = false;

      try {
        const evalStart = performance.now();
        
        // Try JIT compiler if expression is compatible (much faster)
        if (analysis.jitCompatible) {
          try {
            let jitFn = jitCache.get(expression);
            if (!jitFn) {
              jitFn = compileJIT<unknown[]>(expression);
              jitCache.set(expression, jitFn);
            }
            result = jitFn(resource || {}, context);
            usedJit = true;
          } catch {
            // JIT failed, fall back to interpreted
            const engine = version ? getEngine(version) : defaultEngine;
            result = engine.evaluate(resource || {}, expression, context);
          }
        } else {
          // Use interpreted evaluation
          const engine = version ? getEngine(version) : defaultEngine;
          result = engine.evaluate(resource || {}, expression, context);
        }
        
        evalDuration = performance.now() - evalStart;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        log.warning("Evaluation error", {
          code: "processing",
          location: expression,
          details: error,
        });
      }

      const totalDuration = performance.now() - startTime;
      
      log.perf("Expression evaluated", evalDuration, {
        details: {
          expression: expression.length > 50 ? expression.slice(0, 50) + "..." : expression,
          resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
          jitCompatible: analysis.jitCompatible,
          fhirVersion: version || "none",
        },
      });

      return Response.json({
        result,
        error,
        analysis: {
          ...analysis,
          ast,
        },
        _meta: {
          evaluationMs: evalDuration,
          totalMs: totalDuration,
          usedJit,
          timestamp: new Date().toISOString(),
          fhirVersion: version || null,
        },
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Invalid request";
      log.error("Request processing failed", {
        code: "exception",
        details: errorMsg,
      });
      return Response.json(
        { error: errorMsg },
        { status: 400 }
      );
    }
  },
};
