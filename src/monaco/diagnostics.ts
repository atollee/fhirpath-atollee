/**
 * FHIRPath Diagnostics Provider for Monaco Editor
 * 
 * Provides syntax validation and error markers for FHIRPath expressions.
 */

import { parseFhirPath } from "../parser/mod.ts";
import { FHIRPATH_FUNCTIONS } from "./language.ts";

/**
 * Diagnostic severity levels (Monaco-compatible)
 */
export enum DiagnosticSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
}

/**
 * Diagnostic interface (Monaco-compatible)
 */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string;
  source?: string;
}

/**
 * Known function names for validation
 */
const KNOWN_FUNCTIONS = new Set(FHIRPATH_FUNCTIONS.map(f => f.name));

/**
 * Validate a FHIRPath expression and return diagnostics
 */
export function validateFhirPath(expression: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  if (!expression.trim()) {
    return diagnostics;
  }
  
  try {
    // Try to parse the expression
    parseFhirPath(expression);
    
    // If parsing succeeds, check for warnings
    diagnostics.push(...checkWarnings(expression));
    
  } catch (error) {
    // Parse error - extract position and message
    const diagnostic = createParseErrorDiagnostic(error, expression);
    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }
  
  return diagnostics;
}

/**
 * Create a diagnostic from a parse error
 */
function createParseErrorDiagnostic(error: unknown, expression: string): Diagnostic | null {
  if (!(error instanceof Error)) {
    return {
      severity: DiagnosticSeverity.Error,
      message: "Unknown parse error",
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: expression.length + 1,
      code: "PARSE_ERROR",
      source: "fhirpath",
    };
  }
  
  const message = error.message;
  
  // Try to extract position from error message
  // Common patterns: "at position X", "line X column Y", "at X:Y"
  let line = 1;
  let column = 1;
  let endColumn = expression.length + 1;
  
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    column = pos + 1;
    endColumn = column + 1;
  }
  
  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    line = parseInt(lineColMatch[1], 10);
    column = parseInt(lineColMatch[2], 10);
    endColumn = column + 1;
  }
  
  const atMatch = message.match(/at\s+(\d+):(\d+)/);
  if (atMatch) {
    line = parseInt(atMatch[1], 10);
    column = parseInt(atMatch[2], 10);
    endColumn = column + 1;
  }
  
  return {
    severity: DiagnosticSeverity.Error,
    message: message.replace(/at\s+(position\s+\d+|line\s+\d+\s+column\s+\d+|\d+:\d+)/gi, "").trim() || message,
    startLineNumber: line,
    startColumn: column,
    endLineNumber: line,
    endColumn,
    code: "SYNTAX_ERROR",
    source: "fhirpath",
  };
}

/**
 * Check for warnings in a valid expression
 */
function checkWarnings(expression: string): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  
  // Check for deprecated patterns
  warnings.push(...checkDeprecatedPatterns(expression));
  
  // Check for potential mistakes
  warnings.push(...checkPotentialMistakes(expression));
  
  // Check for unknown functions
  warnings.push(...checkUnknownFunctions(expression));
  
  return warnings;
}

/**
 * Check for deprecated patterns
 */
function checkDeprecatedPatterns(expression: string): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  
  // No deprecated patterns currently defined
  // This is a placeholder for future deprecations
  
  return warnings;
}

/**
 * Check for potential mistakes
 */
function checkPotentialMistakes(expression: string): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  
  // Check for = instead of ~ for string comparison (common mistake)
  const stringCompareMatch = expression.match(/=\s*['"][^'"]*['"]/g);
  // Not a warning, just valid syntax
  
  // Check for empty where clause
  const emptyWhereMatch = expression.match(/\.where\s*\(\s*\)/);
  if (emptyWhereMatch) {
    const pos = expression.indexOf(emptyWhereMatch[0]);
    warnings.push({
      severity: DiagnosticSeverity.Warning,
      message: "Empty where() clause has no effect",
      startLineNumber: 1,
      startColumn: pos + 1,
      endLineNumber: 1,
      endColumn: pos + emptyWhereMatch[0].length + 1,
      code: "EMPTY_WHERE",
      source: "fhirpath",
    });
  }
  
  // Check for .first().first() (redundant)
  const doubleFirstMatch = expression.match(/\.first\(\)\.first\(\)/);
  if (doubleFirstMatch) {
    const pos = expression.indexOf(doubleFirstMatch[0]);
    warnings.push({
      severity: DiagnosticSeverity.Warning,
      message: "Redundant .first().first() - second .first() has no effect",
      startLineNumber: 1,
      startColumn: pos + 1,
      endLineNumber: 1,
      endColumn: pos + doubleFirstMatch[0].length + 1,
      code: "REDUNDANT_FIRST",
      source: "fhirpath",
    });
  }
  
  // Check for count() = 0 instead of empty()
  const countZeroMatch = expression.match(/\.count\(\)\s*=\s*0/);
  if (countZeroMatch) {
    const pos = expression.indexOf(countZeroMatch[0]);
    warnings.push({
      severity: DiagnosticSeverity.Hint,
      message: "Consider using .empty() instead of .count() = 0",
      startLineNumber: 1,
      startColumn: pos + 1,
      endLineNumber: 1,
      endColumn: pos + countZeroMatch[0].length + 1,
      code: "USE_EMPTY",
      source: "fhirpath",
    });
  }
  
  // Check for count() > 0 instead of exists()
  const countGtZeroMatch = expression.match(/\.count\(\)\s*>\s*0/);
  if (countGtZeroMatch) {
    const pos = expression.indexOf(countGtZeroMatch[0]);
    warnings.push({
      severity: DiagnosticSeverity.Hint,
      message: "Consider using .exists() instead of .count() > 0",
      startLineNumber: 1,
      startColumn: pos + 1,
      endLineNumber: 1,
      endColumn: pos + countGtZeroMatch[0].length + 1,
      code: "USE_EXISTS",
      source: "fhirpath",
    });
  }
  
  // Check for .single() without error handling context
  // (This is informational, not necessarily wrong)
  
  return warnings;
}

/**
 * Check for unknown function names
 */
function checkUnknownFunctions(expression: string): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  
  // Find all function calls
  const funcCallRegex = /\.([a-zA-Z_]\w*)\s*\(/g;
  let match;
  
  while ((match = funcCallRegex.exec(expression)) !== null) {
    const funcName = match[1];
    
    // Skip known functions
    if (KNOWN_FUNCTIONS.has(funcName)) {
      continue;
    }
    
    // Skip common extension access patterns
    if (funcName === "extension" || funcName === "value") {
      continue;
    }
    
    // This might be a user-defined function or a typo
    const pos = match.index + 1; // +1 for the dot
    warnings.push({
      severity: DiagnosticSeverity.Info,
      message: `'${funcName}' is not a built-in FHIRPath function`,
      startLineNumber: 1,
      startColumn: pos + 1,
      endLineNumber: 1,
      endColumn: pos + funcName.length + 1,
      code: "UNKNOWN_FUNCTION",
      source: "fhirpath",
    });
  }
  
  return warnings;
}

/**
 * Provide diagnostics for Monaco Editor
 * 
 * Usage:
 * ```typescript
 * // In Monaco setup
 * const model = editor.getModel();
 * const expression = model.getValue();
 * const diagnostics = provideFhirPathDiagnostics(expression);
 * 
 * monaco.editor.setModelMarkers(model, 'fhirpath', diagnostics);
 * ```
 */
export function provideFhirPathDiagnostics(expression: string): Diagnostic[] {
  return validateFhirPath(expression);
}

/**
 * Quick validation - just check if expression is syntactically valid
 */
export function isValidFhirPath(expression: string): boolean {
  try {
    parseFhirPath(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get error message if expression is invalid
 */
export function getFhirPathError(expression: string): string | null {
  try {
    parseFhirPath(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
