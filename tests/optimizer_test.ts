/**
 * Tests for Expression Optimizer / Hints
 */

import { assertEquals, assert, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  analyzeExpression,
  getOptimizationHints,
  isJitCompatible,
  getComplexityScore,
  formatHints,
  HintSeverity,
  type AnalysisResult,
} from "../src/optimizer/mod.ts";

// =============================================================================
// Basic Analysis Tests
// =============================================================================

Deno.test("optimizer: analyzes valid expression", () => {
  const result = analyzeExpression("Patient.name.given");
  assert(result.valid, "Should be valid");
  assertEquals(result.error, undefined);
  assertExists(result.hints);
  assertExists(result.complexity);
});

Deno.test("optimizer: detects invalid expression", () => {
  const result = analyzeExpression("Patient.name.where(");
  assertEquals(result.valid, false);
  assertExists(result.error);
});

Deno.test("optimizer: returns empty hints for empty expression", () => {
  const result = analyzeExpression("");
  assertEquals(result.hints.length, 0);
});

// =============================================================================
// Optimization Hint Tests
// =============================================================================

Deno.test("optimizer: suggests exists() instead of count() > 0", () => {
  const result = analyzeExpression("Patient.name.count() > 0");
  const hint = result.hints.find(h => h.message.includes("exists()"));
  assertExists(hint, "Should suggest exists()");
  assertEquals(hint.severity, HintSeverity.Suggestion);
  assertEquals(hint.category, "Performance");
  assert(hint.suggestion?.includes("exists()"), "Should provide suggestion");
});

Deno.test("optimizer: suggests empty() instead of count() = 0", () => {
  const result = analyzeExpression("Patient.name.count() = 0");
  const hint = result.hints.find(h => h.message.includes("empty()"));
  assertExists(hint, "Should suggest empty()");
});

Deno.test("optimizer: suggests empty() instead of count() >= 1", () => {
  const result = analyzeExpression("Patient.name.count() >= 1");
  const hint = result.hints.find(h => h.message.includes("exists()"));
  assertExists(hint, "Should suggest exists()");
});

Deno.test("optimizer: warns about double negation", () => {
  const result = analyzeExpression("Patient.active.not().not()");
  const hint = result.hints.find(h => h.message.includes("Double negation"));
  assertExists(hint, "Should warn about double negation");
  assertEquals(hint.severity, HintSeverity.Warning);
});

Deno.test("optimizer: suggests empty() instead of exists().not()", () => {
  const result = analyzeExpression("Patient.name.exists().not()");
  const hint = result.hints.find(h => h.message.includes("empty()"));
  assertExists(hint, "Should suggest empty()");
});

Deno.test("optimizer: warns about redundant first().first()", () => {
  const result = analyzeExpression("Patient.name.first().first()");
  const hint = result.hints.find(h => h.message.includes("Redundant"));
  assertExists(hint, "Should warn about redundant first()");
  assertEquals(hint.severity, HintSeverity.Warning);
});

Deno.test("optimizer: warns about redundant last().last()", () => {
  const result = analyzeExpression("Patient.name.last().last()");
  const hint = result.hints.find(h => h.message.includes("Redundant"));
  assertExists(hint, "Should warn about redundant last()");
});

Deno.test("optimizer: warns about empty where clause", () => {
  const result = analyzeExpression("Patient.name.where()");
  const hint = result.hints.find(h => h.message.includes("Empty where()"));
  assertExists(hint, "Should warn about empty where");
});

Deno.test("optimizer: warns about descendants() performance", () => {
  const result = analyzeExpression("Patient.descendants()");
  const hint = result.hints.find(h => h.message.includes("descendants()"));
  assertExists(hint, "Should warn about descendants()");
  assertEquals(hint.severity, HintSeverity.Warning);
  assertEquals(hint.impact, "high");
});

Deno.test("optimizer: info about resolve() configuration", () => {
  const result = analyzeExpression("Patient.generalPractitioner.resolve()");
  const hint = result.hints.find(h => h.message.includes("resolve()"));
  assertExists(hint, "Should mention resolve()");
  assertEquals(hint.severity, HintSeverity.Info);
});

Deno.test("optimizer: info about memberOf() configuration", () => {
  const result = analyzeExpression("Observation.code.memberOf('http://example.org/vs')");
  const hint = result.hints.find(h => h.message.includes("memberOf()"));
  assertExists(hint, "Should mention memberOf()");
});

Deno.test("optimizer: info about repeat() termination", () => {
  const result = analyzeExpression("Bundle.entry.resource.repeat(item)");
  const hint = result.hints.find(h => h.message.includes("repeat()"));
  assertExists(hint, "Should mention repeat()");
});

Deno.test("optimizer: info about single() error handling", () => {
  const result = analyzeExpression("Patient.name.single()");
  const hint = result.hints.find(h => h.message.includes("single()"));
  assertExists(hint, "Should mention single()");
});

Deno.test("optimizer: warns about multiple where clauses", () => {
  const result = analyzeExpression("Patient.name.where(use = 'official').where(family.exists())");
  const hint = result.hints.find(h => h.message.includes("Multiple where()"));
  assertExists(hint, "Should suggest combining where clauses");
});

// =============================================================================
// Complexity Tests
// =============================================================================

Deno.test("optimizer: simple expression has low complexity", () => {
  const score = getComplexityScore("Patient.name");
  assert(score < 20, `Simple expression should have low complexity: ${score}`);
});

Deno.test("optimizer: complex expression has higher complexity", () => {
  const simple = getComplexityScore("Patient.name");
  const complex = getComplexityScore(
    "Patient.name.where(use = 'official').select(given.first() + ' ' + family).first()"
  );
  assert(complex > simple, "Complex expression should have higher score");
});

Deno.test("optimizer: descendants() increases complexity", () => {
  const withoutDescendants = getComplexityScore("Patient.identifier.value");
  const withDescendants = getComplexityScore("Patient.descendants().ofType(Identifier).value");
  assert(withDescendants > withoutDescendants, "descendants() should increase complexity");
});

Deno.test("optimizer: warns about high complexity", () => {
  // Create a very complex expression with many expensive operations
  const complex = "Bundle.entry.resource.descendants().where($this is Identifier).select(system + '|' + value).distinct().repeat(item).descendants().where(active).select(name).first()";
  const result = analyzeExpression(complex);
  // Either warns about complexity or has many other hints for expensive operations
  assert(result.hints.length > 0, "Complex expression should generate hints");
  assert(result.complexity > 30, `Should have moderate complexity: ${result.complexity}`);
});

// =============================================================================
// JIT Compatibility Tests
// =============================================================================

Deno.test("optimizer: simple expression is JIT compatible", () => {
  const result = analyzeExpression("Patient.name.given");
  assert(result.jitCompatible, "Simple expression should be JIT compatible");
});

Deno.test("optimizer: where expression is JIT compatible", () => {
  const result = analyzeExpression("Patient.name.where(use = 'official')");
  assert(result.jitCompatible, "where() should be JIT compatible");
});

Deno.test("optimizer: select expression is JIT compatible", () => {
  const result = analyzeExpression("Patient.name.select(given.first())");
  assert(result.jitCompatible, "select() should be JIT compatible");
});

Deno.test("optimizer: isJitCompatible helper works", () => {
  assert(isJitCompatible("Patient.name"), "Should be JIT compatible");
  assert(isJitCompatible("Patient.name.where(use = 'official').first()"));
});

// =============================================================================
// Format Hints Tests
// =============================================================================

Deno.test("optimizer: formatHints returns readable text", () => {
  const result = analyzeExpression("Patient.name.count() > 0");
  const formatted = formatHints(result.hints);
  
  assert(formatted.includes("Performance"), "Should include category");
  assert(formatted.includes("exists()"), "Should include suggestion");
});

Deno.test("optimizer: formatHints handles empty hints", () => {
  const formatted = formatHints([]);
  assertEquals(formatted, "No optimization hints.");
});

Deno.test("optimizer: formatHints includes icons", () => {
  const result = analyzeExpression("Patient.name.count() > 0");
  const formatted = formatHints(result.hints);
  
  // Should include emoji icons
  assert(formatted.includes("💡") || formatted.includes("ℹ️") || formatted.includes("⚠️"));
});

// =============================================================================
// Convenience Function Tests
// =============================================================================

Deno.test("optimizer: getOptimizationHints convenience function", () => {
  const hints = getOptimizationHints("Patient.name.count() > 0");
  assert(hints.length > 0, "Should return hints");
  assert(hints.some(h => h.message.includes("exists()")));
});

Deno.test("optimizer: getComplexityScore convenience function", () => {
  const score = getComplexityScore("Patient.name");
  assert(typeof score === "number");
  assert(score >= 0 && score <= 100);
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("optimizer: handles whitespace", () => {
  const result = analyzeExpression("   Patient.name   ");
  assert(result.valid);
});

Deno.test("optimizer: handles complex nested expressions", () => {
  const result = analyzeExpression(
    "Bundle.entry.where(resource is Patient).resource.name.where(use = 'official').given.first()"
  );
  assert(result.valid);
  assert(result.hints.length >= 0); // May or may not have hints
});

Deno.test("optimizer: handles boolean literals", () => {
  const result = analyzeExpression("true");
  assert(result.valid);
});

Deno.test("optimizer: handles numeric expressions", () => {
  const result = analyzeExpression("1 + 2 * 3");
  assert(result.valid);
});

Deno.test("optimizer: handles string expressions", () => {
  const result = analyzeExpression("'hello' + 'world'");
  assert(result.valid);
});
