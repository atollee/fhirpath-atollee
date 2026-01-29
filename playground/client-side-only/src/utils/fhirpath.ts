/**
 * Client-side FHIRPath evaluation
 * 
 * For local development: Uses the Fresh Playground API on port 11100
 * For production (GitHub Pages): Shows info message to use the hosted playground
 */

export interface EvaluationResult {
  result: unknown[] | null;
  error: string | null;
  analysis: {
    complexity: number;
    hints: Array<{ type: string; message: string; suggestion?: string }>;
    ast?: unknown;
  } | null;
  meta: {
    evaluationMs: number;
    usedJit: boolean;
  };
}

// API endpoint for local development (Fresh Playground)
const LOCAL_API_URL = 'http://localhost:11100/api/evaluate';

// Check if we're in local development
async function isLocalDevAvailable(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: '1+1', resource: {} }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

let localDevAvailable: boolean | null = null;

export async function evaluateFhirpath(
  expression: string,
  resource: unknown,
  fhirVersion: string = 'r6'
): Promise<EvaluationResult> {
  if (!expression.trim()) {
    return {
      result: null,
      error: null,
      analysis: null,
      meta: { evaluationMs: 0, usedJit: false }
    };
  }

  // Check if local dev is available (only once)
  if (localDevAvailable === null) {
    localDevAvailable = await isLocalDevAvailable();
  }

  if (localDevAvailable) {
    // Use Fresh Playground API for local development
    try {
      const response = await fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, resource, fhirVersion }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        result: data.result,
        error: data.error,
        analysis: data.analysis ? {
          complexity: data.analysis.complexity || 1,
          hints: (data.analysis.hints || []).map((h: { severity?: string; message: string; suggestion?: string }) => ({
            type: h.severity || 'info',
            message: h.message,
            suggestion: h.suggestion
          })),
          ast: data.analysis.ast
        } : null,
        meta: {
          evaluationMs: data._meta?.evaluationMs || 0,
          usedJit: data._meta?.usedJit || false
        }
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[fhirpath] API error:', errorMsg);

      return {
        result: null,
        error: `API error: ${errorMsg}`,
        analysis: null,
        meta: { evaluationMs: 0, usedJit: false }
      };
    }
  } else {
    // For GitHub Pages deployment or when Fresh server is not running
    return {
      result: null,
      error: 'FHIRPath evaluation requires the development server. Start with: cd playground/fresh && deno task dev',
      analysis: {
        complexity: 1,
        hints: [{
          type: 'info',
          message: 'This is a static preview. For full functionality, use the hosted playground at http://localhost:11100',
          suggestion: 'Run: deno task dev:playground'
        }],
        ast: null
      },
      meta: { evaluationMs: 0, usedJit: false }
    };
  }
}
