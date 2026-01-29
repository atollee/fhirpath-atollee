/**
 * Client-side FHIRPath evaluation
 * 
 * Priority:
 * 1. Local Fresh API (http://localhost:11100) - for development
 * 2. JSR package via esm.sh - for GitHub Pages / static hosting
 * 3. Fallback message if neither available
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

// JSR package URL via esm.sh (for static hosting)
const JSR_PACKAGE_URL = 'https://esm.sh/jsr/@atollee/fhirpath-atollee';

// deno-lint-ignore no-explicit-any
let fhirpathModule: any = null;
let fhirpathLoadError: string | null = null;
let localDevAvailable: boolean | null = null;

// Check if we're in local development
async function isLocalDevAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: '1+1', resource: {} }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// Try to load fhirpath-atollee from JSR
async function loadFhirpathModule(): Promise<boolean> {
  if (fhirpathModule !== null || fhirpathLoadError !== null) {
    return fhirpathModule !== null;
  }

  try {
    console.log('[fhirpath] Loading from JSR via esm.sh...');
    const module = await import(/* @vite-ignore */ JSR_PACKAGE_URL);
    fhirpathModule = module;
    console.log('[fhirpath] Loaded successfully from JSR');
    return true;
  } catch (e) {
    fhirpathLoadError = e instanceof Error ? e.message : String(e);
    console.warn('[fhirpath] JSR load failed:', fhirpathLoadError);
    return false;
  }
}

// Evaluate using local API
async function evaluateViaApi(
  expression: string,
  resource: unknown,
  fhirVersion: string
): Promise<EvaluationResult> {
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
}

// Evaluate using loaded JSR module
async function evaluateViaModule(
  expression: string,
  resource: unknown
): Promise<EvaluationResult> {
  const start = performance.now();
  
  try {
    // Use the evaluate function from the module
    const evaluate = fhirpathModule.evaluate || fhirpathModule.default?.evaluate;
    
    if (!evaluate) {
      throw new Error('evaluate function not found in module');
    }

    const result = evaluate(resource, expression);
    const duration = performance.now() - start;

    return {
      result: Array.isArray(result) ? result : [result],
      error: null,
      analysis: {
        complexity: 1,
        hints: [],
        ast: null
      },
      meta: {
        evaluationMs: duration,
        usedJit: false // Module doesn't expose JIT info directly
      }
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return {
      result: null,
      error: errorMsg,
      analysis: null,
      meta: { evaluationMs: performance.now() - start, usedJit: false }
    };
  }
}

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

  // 1. Try local API first (best experience during development)
  if (localDevAvailable === null) {
    localDevAvailable = await isLocalDevAvailable();
  }

  if (localDevAvailable) {
    try {
      return await evaluateViaApi(expression, resource, fhirVersion);
    } catch (e) {
      console.warn('[fhirpath] API call failed, trying JSR module...');
      localDevAvailable = false;
    }
  }

  // 2. Try JSR module (for static hosting / GitHub Pages)
  const moduleLoaded = await loadFhirpathModule();
  
  if (moduleLoaded) {
    return await evaluateViaModule(expression, resource);
  }

  // 3. Neither available - show helpful message
  return {
    result: null,
    error: fhirpathLoadError 
      ? `FHIRPath library not available: ${fhirpathLoadError}` 
      : 'FHIRPath evaluation not available',
    analysis: {
      complexity: 1,
      hints: [{
        type: 'info',
        message: 'Waiting for @atollee/fhirpath-atollee to be published on JSR',
        suggestion: 'For now, run locally: cd playground/fresh && deno task dev'
      }],
      ast: null
    },
    meta: { evaluationMs: 0, usedJit: false }
  };
}
