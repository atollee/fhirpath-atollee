/**
 * FHIRPath Evaluate API Endpoint
 * 
 * FHIR R6-compliant expression evaluation
 * No mocks, no simulation - real FHIRPath evaluation
 * 
 * @see https://hl7.org/fhir/6.0.0-ballot4/fhirpath.html
 */
import { createDefaultAPI } from "../../../../src/api.ts";
import { parseFhirPath } from "../../../../src/parser/mod.ts";
import { analyzeExpression } from "../../../../src/optimizer/mod.ts";
import { loggers } from "../../../../src/logging.ts";

const fhirpath = createDefaultAPI();
const log = loggers.playground;

export const handler = {
  async POST(req: Request): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const body = await req.json();
      const { expression, resource, context = {} } = body;

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

      // Evaluate - no mocks, real FHIRPath evaluation
      let result = null;
      let error = null;

      try {
        result = fhirpath.evaluate(resource || {}, expression, context);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        log.warning("Evaluation error", {
          code: "processing",
          location: expression,
          details: error,
        });
      }

      const duration = performance.now() - startTime;
      
      log.perf("Expression evaluated", duration, {
        details: {
          expression: expression.length > 50 ? expression.slice(0, 50) + "..." : expression,
          resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
          jitCompatible: analysis.jitCompatible,
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
          evaluationMs: duration,
          timestamp: new Date().toISOString(),
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
