/**
 * FHIRPath Hover Provider for Monaco Editor
 * 
 * Provides hover documentation for FHIRPath functions, operators, and keywords.
 */

import {
  FHIRPATH_FUNCTIONS,
  FHIRPATH_OPERATORS,
  type FunctionDefinition,
  type OperatorDefinition,
} from "./language.ts";

/**
 * Hover result interface (Monaco-compatible)
 */
export interface HoverResult {
  contents: Array<{ value: string }>;
  range?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

/**
 * Get word at position in text
 */
function getWordAtPosition(text: string, line: number, column: number): { word: string; startColumn: number; endColumn: number } | null {
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return null;
  
  const lineText = lines[line - 1];
  if (column < 1 || column > lineText.length + 1) return null;
  
  // Find word boundaries
  let start = column - 1;
  let end = column - 1;
  
  // Expand left
  while (start > 0 && /[\w$%]/.test(lineText[start - 1])) {
    start--;
  }
  
  // Expand right
  while (end < lineText.length && /[\w$%]/.test(lineText[end])) {
    end++;
  }
  
  if (start === end) return null;
  
  return {
    word: lineText.substring(start, end),
    startColumn: start + 1,
    endColumn: end + 1,
  };
}

/**
 * Get operator at position
 */
function getOperatorAtPosition(text: string, line: number, column: number): { operator: string; startColumn: number; endColumn: number } | null {
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return null;
  
  const lineText = lines[line - 1];
  const col = column - 1;
  
  // Check for multi-character operators
  const multiCharOps = ["!=", "!~", "<=", ">=", "and", "or", "xor", "implies", "div", "mod", "in", "contains"];
  
  for (const op of multiCharOps) {
    for (let i = 0; i < op.length; i++) {
      const start = col - i;
      if (start >= 0 && lineText.substring(start, start + op.length) === op) {
        return {
          operator: op,
          startColumn: start + 1,
          endColumn: start + op.length + 1,
        };
      }
    }
  }
  
  // Check for single-character operators
  const singleCharOps = ["=", "~", "<", ">", "+", "-", "*", "/", "|", "&"];
  if (col >= 0 && col < lineText.length && singleCharOps.includes(lineText[col])) {
    return {
      operator: lineText[col],
      startColumn: col + 1,
      endColumn: col + 2,
    };
  }
  
  return null;
}

/**
 * Create hover content for a function
 */
function createFunctionHover(func: FunctionDefinition, range?: HoverResult["range"]): HoverResult {
  const markdown = [
    `## ${func.name}`,
    "",
    `**Category:** ${func.category}`,
    "",
    "```fhirpath",
    func.signature,
    "```",
    "",
    func.description,
  ].join("\n");

  return {
    contents: [{ value: markdown }],
    range,
  };
}

/**
 * Create hover content for an operator
 */
function createOperatorHover(op: OperatorDefinition, range?: HoverResult["range"]): HoverResult {
  const markdown = [
    `## Operator: \`${op.symbol}\``,
    "",
    `**Category:** ${op.category}`,
    "",
    op.description,
  ].join("\n");

  return {
    contents: [{ value: markdown }],
    range,
  };
}

/**
 * Create hover content for keywords
 */
function createKeywordHover(keyword: string, range?: HoverResult["range"]): HoverResult | null {
  let markdown = "";
  
  switch (keyword) {
    case "$this":
      markdown = [
        "## $this",
        "",
        "**Special Variable**",
        "",
        "Reference to the current item during iteration.",
        "",
        "Used in functions like `where()`, `select()`, `all()`, `exists()`, etc.",
        "",
        "```fhirpath",
        "name.where($this.use = 'official')",
        "```",
      ].join("\n");
      break;
      
    case "$index":
      markdown = [
        "## $index",
        "",
        "**Special Variable**",
        "",
        "Zero-based index of the current item during iteration.",
        "",
        "```fhirpath",
        "name.where($index = 0)  // First element",
        "```",
      ].join("\n");
      break;
      
    case "$total":
      markdown = [
        "## $total",
        "",
        "**Special Variable**",
        "",
        "Running total during `aggregate()` operations.",
        "",
        "```fhirpath",
        "values.aggregate($this + $total, 0)",
        "```",
      ].join("\n");
      break;
      
    case "true":
    case "false":
      markdown = [
        `## ${keyword}`,
        "",
        "**Boolean Literal**",
        "",
        `The boolean value \`${keyword}\`.`,
      ].join("\n");
      break;
      
    default:
      return null;
  }
  
  return {
    contents: [{ value: markdown }],
    range,
  };
}

/**
 * Provide hover information for FHIRPath expressions
 * 
 * Usage:
 * ```typescript
 * monaco.languages.registerHoverProvider('fhirpath', {
 *   provideHover: (model, position) => {
 *     const text = model.getValue();
 *     return provideFhirPathHover(text, position.lineNumber, position.column);
 *   }
 * });
 * ```
 */
export function provideFhirPathHover(text: string, line: number, column: number): HoverResult | null {
  // Try to find a word at position
  const wordInfo = getWordAtPosition(text, line, column);
  
  if (wordInfo) {
    const word = wordInfo.word;
    const range = {
      startLineNumber: line,
      startColumn: wordInfo.startColumn,
      endLineNumber: line,
      endColumn: wordInfo.endColumn,
    };
    
    // Check if it's a function
    const func = FHIRPATH_FUNCTIONS.find(f => f.name === word);
    if (func) {
      return createFunctionHover(func, range);
    }
    
    // Check if it's a keyword
    const keywordHover = createKeywordHover(word, range);
    if (keywordHover) {
      return keywordHover;
    }
    
    // Check if it's a word-based operator
    const wordOp = FHIRPATH_OPERATORS.find(o => o.symbol === word);
    if (wordOp) {
      return createOperatorHover(wordOp, range);
    }
  }
  
  // Try to find an operator at position
  const opInfo = getOperatorAtPosition(text, line, column);
  if (opInfo) {
    const op = FHIRPATH_OPERATORS.find(o => o.symbol === opInfo.operator);
    if (op) {
      return createOperatorHover(op, {
        startLineNumber: line,
        startColumn: opInfo.startColumn,
        endLineNumber: line,
        endColumn: opInfo.endColumn,
      });
    }
  }
  
  return null;
}

/**
 * Get all functions grouped by category (for documentation)
 */
export function getFunctionsByCategory(): Map<string, FunctionDefinition[]> {
  const byCategory = new Map<string, FunctionDefinition[]>();
  
  for (const func of FHIRPATH_FUNCTIONS) {
    const list = byCategory.get(func.category) || [];
    list.push(func);
    byCategory.set(func.category, list);
  }
  
  return byCategory;
}

/**
 * Get function documentation as markdown
 */
export function getFunctionDocumentation(): string {
  const byCategory = getFunctionsByCategory();
  const lines: string[] = ["# FHIRPath Functions", ""];
  
  for (const [category, functions] of byCategory) {
    lines.push(`## ${category}`, "");
    lines.push("| Function | Description |");
    lines.push("|----------|-------------|");
    
    for (const func of functions) {
      lines.push(`| \`${func.signature}\` | ${func.description} |`);
    }
    
    lines.push("");
  }
  
  return lines.join("\n");
}
