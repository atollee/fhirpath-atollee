import { define } from "../utils.ts";
import PlaygroundIsland from "../islands/PlaygroundIsland.tsx";
import { PageHeader, FeatureCards } from "../islands/TranslatedContent.tsx";
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
      {/* Translated header (Island) */}
      <PageHeader />

      {/* Server-rendered preview for SEO */}
      <noscript>
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-4">
          <h2 class="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Expression: {initialExpression}</h2>
          {initialError ? (
            <div class="text-red-600 dark:text-red-400">Error: {initialError}</div>
          ) : (
            <div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mb-1">Result:</div>
              <pre class="bg-slate-100 dark:bg-slate-900 p-2 rounded text-sm text-slate-800 dark:text-slate-200">
                {JSON.stringify(initialResult, null, 2)}
              </pre>
            </div>
          )}
          <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
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

      {/* Translated feature cards (Island) */}
      <FeatureCards />
    </div>
  );
});
