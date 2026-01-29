import { define } from "../utils.ts";
import PlaygroundIsland from "../islands/PlaygroundIsland.tsx";
import { createDefaultAPI } from "../../../src/api.ts";
import { analyzeExpression } from "../../../src/optimizer/mod.ts";

const fhirpath = createDefaultAPI();

const DEFAULT_PATIENT = {
  resourceType: "Patient",
  id: "example",
  meta: { versionId: "1", lastUpdated: "2024-01-15T10:30:00Z" },
  identifier: [{ system: "http://example.org/mrn", value: "12345" }],
  active: true,
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-05-15",
  address: [{ city: "Boston", state: "MA", country: "USA" }],
  telecom: [
    { system: "phone", value: "555-1234" },
    { system: "email", value: "john@example.com" },
  ],
};

export default define.page(function PlaygroundPage({ url }) {
  // Parse URL parameters for sharing
  const params = url.searchParams;
  const expr = params.get("expr");
  const resourceParam = params.get("resource");

  let initialExpression = "name.given";
  let initialResource = DEFAULT_PATIENT;
  let initialResult: unknown[] | undefined;
  let initialError: string | undefined;

  // Load from URL params
  if (expr) {
    try {
      initialExpression = decodeURIComponent(expr);
    } catch { /* ignore */ }
  }

  if (resourceParam) {
    try {
      initialResource = JSON.parse(decodeURIComponent(resourceParam));
    } catch { /* ignore */ }
  }

  // Server-side evaluation for initial render (SEO + instant display)
  try {
    initialResult = fhirpath.evaluate(initialResource, initialExpression) as unknown[];
  } catch (e) {
    initialError = e instanceof Error ? e.message : String(e);
  }

  // Get analysis for meta description
  const analysis = analyzeExpression(initialExpression);
  const resultPreview = initialResult 
    ? JSON.stringify(initialResult).slice(0, 100) 
    : initialError || "";

  return (
    <div>
      {/* SEO-optimized header with server-rendered content */}
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          FHIRPath Playground
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Interactive FHIRPath expression tester with live evaluation, AST visualization, 
          optimization hints, and JIT compiler support. Powered by{" "}
          <a 
            href="https://gitlab.atollee.com/fhir/fhirpath-atollee" 
            class="text-blue-600 dark:text-blue-400 hover:underline"
          >
            fhirpath-atollee
          </a>
          {" "}— up to 75x faster than fhirpath.js.
        </p>
      </div>

      {/* Server-rendered preview for SEO */}
      <noscript>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <h2 class="text-lg font-semibold mb-2">Expression: {initialExpression}</h2>
          {initialError ? (
            <div class="text-red-600">Error: {initialError}</div>
          ) : (
            <div>
              <div class="text-sm text-gray-500 mb-1">Result:</div>
              <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm">
                {JSON.stringify(initialResult, null, 2)}
              </pre>
            </div>
          )}
          <p class="mt-4 text-sm text-gray-500">
            Enable JavaScript for the full interactive experience.
          </p>
        </div>
      </noscript>

      {/* Interactive Island */}
      <PlaygroundIsland
        initialExpression={initialExpression}
        initialResource={initialResource}
        initialResult={initialResult}
        initialError={initialError}
      />

      {/* Info Section (server-rendered for SEO) */}
      <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
            🚀 High Performance
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            JIT compiler delivers 50-75x faster execution than fhirpath.js. 
            Native TypeScript parser with zero external dependencies.
          </p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
            💡 Smart Optimization
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Real-time hints suggest improvements like using exists() instead of count() {">"} 0. 
            Complexity scoring helps identify expensive expressions.
          </p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
            📋 History & Favorites
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Copy expressions to clipboard. History and favorites persist locally. 
            Perfect for documentation and debugging.
          </p>
        </div>
      </div>
    </div>
  );
});
