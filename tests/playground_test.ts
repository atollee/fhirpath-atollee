/**
 * Tests for FHIRPath Playground
 * 
 * Note: Full UI testing requires a browser environment.
 * The FhirPathPlayground Web Component extends HTMLElement which is only
 * available in browser environments. These tests verify the module file exists.
 */

import { assert } from "https://deno.land/std@0.208.0/assert/mod.ts";

// =============================================================================
// Module Structure Tests (Browser-independent)
// =============================================================================

Deno.test("playground: module file exists and can be checked", async () => {
  // Verify the file exists by checking its stat
  const stat = await Deno.stat(
    new URL("../playground/mod.ts", import.meta.url)
  );
  assert(stat.isFile, "mod.ts should exist");
});

Deno.test("playground: main component file exists", async () => {
  const stat = await Deno.stat(
    new URL("../playground/FhirPathPlayground.ts", import.meta.url)
  );
  assert(stat.isFile, "FhirPathPlayground.ts should exist");
});

// Note: Full component testing (rendering, events, etc.) requires a browser 
// environment with DOM support. The FhirPathPlayground extends HTMLElement
// which is not available in Deno's runtime.
