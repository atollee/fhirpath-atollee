import { createDefaultAPI } from "../../../../src/api.ts";
import { parseFhirPath } from "../../../../src/parser/mod.ts";
import { analyzeExpression } from "../../../../src/optimizer/mod.ts";

const fhirpath = createDefaultAPI();

export const handler = {
  async POST(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const { expression, resource, context = {} } = body;

      if (!expression || typeof expression !== "string") {
        return Response.json(
          { error: "Missing or invalid 'expression' parameter" },
          { status: 400 }
        );
      }

      // Parse AST
      let ast = null;
      try {
        ast = parseFhirPath(expression);
      } catch {
        // Ignore parse errors for AST, will be caught in evaluate
      }

      // Analyze expression
      const analysis = analyzeExpression(expression);

      // Evaluate
      let result = null;
      let error = null;

      try {
        result = fhirpath.evaluate(resource || {}, expression, context);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      return Response.json({
        result,
        error,
        analysis: {
          ...analysis,
          ast,
        },
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Invalid request" },
        { status: 400 }
      );
    }
  },
};
