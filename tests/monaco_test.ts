/**
 * Tests for Monaco Editor Integration
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  FHIRPATH_LANGUAGE_ID,
  FHIRPATH_FUNCTIONS,
  FHIRPATH_OPERATORS,
  FHIRPATH_KEYWORDS,
  FHIR_RESOURCE_TYPES,
  COMMON_PATHS,
  FHIRPATH_LANGUAGE_CONFIG,
  FHIRPATH_MONARCH_TOKENS,
  provideFhirPathCompletions,
  provideFhirPathHover,
  provideFhirPathDiagnostics,
  analyzeContext,
  getSnippetCompletions,
  CompletionItemKind,
  DiagnosticSeverity,
} from "../src/monaco/mod.ts";

// =============================================================================
// Language Definition Tests
// =============================================================================

Deno.test("monaco: language ID is defined", () => {
  assertEquals(FHIRPATH_LANGUAGE_ID, "fhirpath");
});

Deno.test("monaco: functions are defined", () => {
  assert(FHIRPATH_FUNCTIONS.length > 50, "Should have many functions");
  
  // Check some essential functions exist
  const functionNames = FHIRPATH_FUNCTIONS.map(f => f.name);
  assert(functionNames.includes("where"), "Should have where()");
  assert(functionNames.includes("select"), "Should have select()");
  assert(functionNames.includes("first"), "Should have first()");
  assert(functionNames.includes("exists"), "Should have exists()");
  assert(functionNames.includes("count"), "Should have count()");
});

Deno.test("monaco: functions have required properties", () => {
  for (const func of FHIRPATH_FUNCTIONS) {
    assertExists(func.name, "Function should have name");
    assertExists(func.signature, "Function should have signature");
    assertExists(func.description, "Function should have description");
    assertExists(func.category, "Function should have category");
  }
});

Deno.test("monaco: operators are defined", () => {
  assert(FHIRPATH_OPERATORS.length > 10, "Should have many operators");
  
  const opSymbols = FHIRPATH_OPERATORS.map(o => o.symbol);
  assert(opSymbols.includes("="), "Should have = operator");
  assert(opSymbols.includes("and"), "Should have and operator");
  assert(opSymbols.includes("or"), "Should have or operator");
  assert(opSymbols.includes("+"), "Should have + operator");
});

Deno.test("monaco: keywords are defined", () => {
  assert(FHIRPATH_KEYWORDS.includes("$this"));
  assert(FHIRPATH_KEYWORDS.includes("$index"));
  assert(FHIRPATH_KEYWORDS.includes("true"));
  assert(FHIRPATH_KEYWORDS.includes("false"));
});

Deno.test("monaco: FHIR resource types are defined", () => {
  assert(FHIR_RESOURCE_TYPES.includes("Patient"));
  assert(FHIR_RESOURCE_TYPES.includes("Observation"));
  assert(FHIR_RESOURCE_TYPES.includes("Bundle"));
});

Deno.test("monaco: common paths are defined for Patient", () => {
  const patientPaths = COMMON_PATHS["Patient"];
  assertExists(patientPaths);
  assert(patientPaths.includes("name"));
  assert(patientPaths.includes("identifier"));
  assert(patientPaths.includes("birthDate"));
});

Deno.test("monaco: language config has brackets", () => {
  assertExists(FHIRPATH_LANGUAGE_CONFIG.brackets);
  assert(FHIRPATH_LANGUAGE_CONFIG.brackets.length > 0);
});

Deno.test("monaco: monarch tokens has tokenizer", () => {
  assertExists(FHIRPATH_MONARCH_TOKENS.tokenizer);
  assertExists(FHIRPATH_MONARCH_TOKENS.tokenizer.root);
});

// =============================================================================
// Completion Provider Tests
// =============================================================================

Deno.test("monaco: analyzeContext detects after dot", () => {
  const ctx = analyzeContext("Patient.name.", 13);
  assert(ctx.afterDot, "Should detect after dot");
  assertEquals(ctx.currentWord, "");
});

Deno.test("monaco: analyzeContext detects current word", () => {
  const ctx = analyzeContext("Patient.whe", 11);
  assertEquals(ctx.currentWord, "whe");
});

Deno.test("monaco: analyzeContext detects in where clause", () => {
  const ctx = analyzeContext("Patient.name.where(use = ", 25);
  assert(ctx.inWhereClause, "Should detect in where clause");
});

Deno.test("monaco: completions after dot suggest functions", () => {
  const completions = provideFhirPathCompletions("Patient.name.", 13);
  assert(completions.length > 0, "Should have completions");
  
  const functionCompletions = completions.filter(c => c.kind === CompletionItemKind.Function);
  assert(functionCompletions.length > 0, "Should have function completions");
  
  // Check for common functions
  const labels = functionCompletions.map(c => c.label);
  assert(labels.includes("where"), "Should suggest where()");
  assert(labels.includes("first"), "Should suggest first()");
});

Deno.test("monaco: completions filter by prefix", () => {
  const completions = provideFhirPathCompletions("Patient.name.whe", 16);
  
  // Should include where but not first
  const labels = completions.map(c => c.label);
  assert(labels.includes("where"), "Should include where");
});

Deno.test("monaco: snippet completions exist", () => {
  const snippets = getSnippetCompletions();
  assert(snippets.length > 0, "Should have snippets");
  
  // Check for common snippets
  const labels = snippets.map(s => s.label);
  assert(labels.includes("where-exists"), "Should have where-exists snippet");
  assert(labels.includes("iif-condition"), "Should have iif-condition snippet");
});

// =============================================================================
// Hover Provider Tests
// =============================================================================

Deno.test("monaco: hover provides function documentation", () => {
  const hover = provideFhirPathHover("Patient.where(active)", 1, 9);
  assertExists(hover, "Should provide hover");
  assert(hover.contents.length > 0, "Should have contents");
  assert(hover.contents[0].value.includes("where"), "Should document where");
});

Deno.test("monaco: hover provides keyword documentation", () => {
  const hover = provideFhirPathHover("name.where($this.use = 'official')", 1, 13);
  assertExists(hover, "Should provide hover");
  assert(hover.contents[0].value.includes("$this"), "Should document $this");
});

Deno.test("monaco: hover returns null for unknown words", () => {
  const hover = provideFhirPathHover("Patient.unknownField", 1, 15);
  // unknownField is not a function or keyword, so no hover
  assertEquals(hover, null);
});

// =============================================================================
// Diagnostics Provider Tests
// =============================================================================

Deno.test("monaco: diagnostics reports valid expression", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.given");
  // Valid expression should have no errors
  const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
  assertEquals(errors.length, 0, "Should have no errors");
});

Deno.test("monaco: diagnostics reports syntax errors", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.where(");
  const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
  assert(errors.length > 0, "Should report syntax error");
});

Deno.test("monaco: diagnostics suggests empty() instead of count() = 0", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.count() = 0");
  const hints = diagnostics.filter(d => d.severity === DiagnosticSeverity.Hint);
  assert(hints.some(h => h.message.includes("empty()")), "Should suggest empty()");
});

Deno.test("monaco: diagnostics suggests exists() instead of count() > 0", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.count() > 0");
  const hints = diagnostics.filter(d => d.severity === DiagnosticSeverity.Hint);
  assert(hints.some(h => h.message.includes("exists()")), "Should suggest exists()");
});

Deno.test("monaco: diagnostics warns about empty where clause", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.where()");
  const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
  assert(warnings.some(w => w.message.includes("Empty where()")), "Should warn about empty where");
});

Deno.test("monaco: diagnostics warns about redundant first().first()", () => {
  const diagnostics = provideFhirPathDiagnostics("Patient.name.first().first()");
  const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
  assert(warnings.some(w => w.message.includes("Redundant")), "Should warn about redundant first()");
});

Deno.test("monaco: diagnostics returns empty for empty input", () => {
  const diagnostics = provideFhirPathDiagnostics("");
  assertEquals(diagnostics.length, 0);
});

Deno.test("monaco: diagnostics returns empty for whitespace", () => {
  const diagnostics = provideFhirPathDiagnostics("   ");
  assertEquals(diagnostics.length, 0);
});
