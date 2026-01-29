/**
 * FHIRPath Completion Provider for Monaco Editor
 * 
 * Provides intelligent autocomplete suggestions for FHIRPath expressions.
 */

import {
  FHIRPATH_FUNCTIONS,
  FHIRPATH_OPERATORS,
  FHIRPATH_KEYWORDS,
  FHIR_RESOURCE_TYPES,
  COMMON_PATHS,
  type FunctionDefinition,
} from "./language.ts";

/**
 * Monaco completion item kind (subset)
 */
export enum CompletionItemKind {
  Method = 0,
  Function = 1,
  Constructor = 2,
  Field = 3,
  Variable = 4,
  Class = 5,
  Struct = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Event = 10,
  Operator = 11,
  Unit = 12,
  Value = 13,
  Constant = 14,
  Enum = 15,
  EnumMember = 16,
  Keyword = 17,
  Text = 18,
  Color = 19,
  File = 20,
  Reference = 21,
  Customcolor = 22,
  Folder = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
  Snippet = 27,
}

/**
 * Completion item interface (Monaco-compatible)
 */
export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string | { value: string };
  insertText: string;
  insertTextRules?: number;
  sortText?: string;
  filterText?: string;
  range?: unknown;
}

/**
 * Completion context
 */
export interface CompletionContext {
  /** Current text before cursor */
  textBefore: string;
  /** Current word being typed */
  currentWord: string;
  /** Detected resource type (if any) */
  resourceType?: string;
  /** Is after a dot? */
  afterDot: boolean;
  /** Is after opening parenthesis? */
  afterParen: boolean;
  /** Is inside a where() clause? */
  inWhereClause: boolean;
}

/**
 * Analyze the expression context at cursor position
 */
export function analyzeContext(text: string, position: number): CompletionContext {
  const textBefore = text.substring(0, position);
  
  // Find current word
  const wordMatch = textBefore.match(/[\w$%]+$/);
  const currentWord = wordMatch ? wordMatch[0] : "";
  
  // Check if after dot
  const afterDot = /\.\s*[\w$%]*$/.test(textBefore);
  
  // Check if after opening paren
  const afterParen = /\(\s*[\w$%]*$/.test(textBefore);
  
  // Check if in where clause
  const inWhereClause = /\.where\s*\([^)]*$/.test(textBefore);
  
  // Try to detect resource type from %resource or context
  let resourceType: string | undefined;
  const resourceMatch = textBefore.match(/resourceType\s*=\s*['"](\w+)['"]/);
  if (resourceMatch) {
    resourceType = resourceMatch[1];
  }
  
  return {
    textBefore,
    currentWord,
    resourceType,
    afterDot,
    afterParen,
    inWhereClause,
  };
}

/**
 * Generate completion items for the given context
 */
export function getCompletions(context: CompletionContext): CompletionItem[] {
  const items: CompletionItem[] = [];
  const prefix = context.currentWord.toLowerCase();
  
  // After a dot - suggest functions and paths
  if (context.afterDot) {
    // Add functions
    items.push(...getFunctionCompletions(prefix));
    
    // Add common paths if resource type is known
    if (context.resourceType && COMMON_PATHS[context.resourceType]) {
      items.push(...getPathCompletions(context.resourceType, prefix));
    }
  } 
  // Inside where clause - suggest comparison operators and boolean logic
  else if (context.inWhereClause) {
    items.push(...getOperatorCompletions(prefix));
    items.push(...getKeywordCompletions(prefix));
    items.push(...getFunctionCompletions(prefix, ["Boolean", "Comparison"]));
  }
  // General context
  else {
    // Add keywords
    items.push(...getKeywordCompletions(prefix));
    
    // Add resource types
    items.push(...getResourceTypeCompletions(prefix));
    
    // Add functions
    items.push(...getFunctionCompletions(prefix));
    
    // Add common paths
    if (context.resourceType && COMMON_PATHS[context.resourceType]) {
      items.push(...getPathCompletions(context.resourceType, prefix));
    }
  }
  
  return items;
}

/**
 * Get function completions
 */
function getFunctionCompletions(prefix: string, categories?: string[]): CompletionItem[] {
  let functions = FHIRPATH_FUNCTIONS;
  
  if (categories) {
    functions = functions.filter(f => categories.includes(f.category));
  }
  
  return functions
    .filter(f => f.name.toLowerCase().startsWith(prefix))
    .map(f => createFunctionCompletion(f));
}

/**
 * Create a completion item for a function
 */
function createFunctionCompletion(func: FunctionDefinition): CompletionItem {
  // Determine insert text based on whether function takes arguments
  const hasArgs = func.signature.includes("(") && !func.signature.includes("()");
  const insertText = hasArgs ? `${func.name}($1)` : `${func.name}()`;
  
  return {
    label: func.name,
    kind: CompletionItemKind.Function,
    detail: func.signature,
    documentation: {
      value: `**${func.category}**\n\n${func.description}\n\n\`${func.signature}\``,
    },
    insertText,
    insertTextRules: hasArgs ? 4 : 0, // InsertAsSnippet = 4
    sortText: `0_${func.name}`, // Functions first
  };
}

/**
 * Get operator completions
 */
function getOperatorCompletions(prefix: string): CompletionItem[] {
  return FHIRPATH_OPERATORS
    .filter(op => op.symbol.toLowerCase().startsWith(prefix) || op.symbol.startsWith(prefix))
    .map(op => ({
      label: op.symbol,
      kind: CompletionItemKind.Operator,
      detail: op.description,
      documentation: `**${op.category}**\n\n${op.description}`,
      insertText: op.symbol.length > 1 ? ` ${op.symbol} ` : op.symbol,
      sortText: `1_${op.symbol}`,
    }));
}

/**
 * Get keyword completions
 */
function getKeywordCompletions(prefix: string): CompletionItem[] {
  return FHIRPATH_KEYWORDS
    .filter(kw => kw.toLowerCase().startsWith(prefix))
    .map(kw => ({
      label: kw,
      kind: CompletionItemKind.Keyword,
      detail: "FHIRPath keyword",
      documentation: getKeywordDocumentation(kw),
      insertText: kw,
      sortText: `2_${kw}`,
    }));
}

/**
 * Get keyword documentation
 */
function getKeywordDocumentation(keyword: string): string {
  switch (keyword) {
    case "$this":
      return "Reference to the current item in iteration";
    case "$index":
      return "Zero-based index of the current item";
    case "$total":
      return "Running total in aggregate operations";
    case "true":
      return "Boolean true literal";
    case "false":
      return "Boolean false literal";
    case "{}":
      return "Empty collection literal";
    default:
      return "";
  }
}

/**
 * Get resource type completions
 */
function getResourceTypeCompletions(prefix: string): CompletionItem[] {
  return FHIR_RESOURCE_TYPES
    .filter(rt => rt.toLowerCase().startsWith(prefix))
    .map(rt => ({
      label: rt,
      kind: CompletionItemKind.Class,
      detail: "FHIR Resource Type",
      documentation: `FHIR ${rt} resource`,
      insertText: rt,
      sortText: `3_${rt}`,
    }));
}

/**
 * Get path completions for a resource type
 */
function getPathCompletions(resourceType: string, prefix: string): CompletionItem[] {
  const paths = COMMON_PATHS[resourceType] || [];
  
  return paths
    .filter(p => p.toLowerCase().startsWith(prefix))
    .map(p => ({
      label: p,
      kind: CompletionItemKind.Property,
      detail: `${resourceType}.${p}`,
      documentation: `Element path on ${resourceType}`,
      insertText: p,
      sortText: `4_${p}`,
    }));
}

/**
 * FHIRPath completion provider for Monaco Editor
 * 
 * Usage:
 * ```typescript
 * monaco.languages.registerCompletionItemProvider('fhirpath', {
 *   provideCompletionItems: (model, position) => {
 *     const text = model.getValue();
 *     const offset = model.getOffsetAt(position);
 *     return { suggestions: provideFhirPathCompletions(text, offset) };
 *   }
 * });
 * ```
 */
export function provideFhirPathCompletions(text: string, offset: number): CompletionItem[] {
  const context = analyzeContext(text, offset);
  return getCompletions(context);
}

/**
 * Create snippet completions for common patterns
 */
export function getSnippetCompletions(): CompletionItem[] {
  return [
    {
      label: "where-exists",
      kind: CompletionItemKind.Snippet,
      detail: "Filter where element exists",
      documentation: "Filter collection where a specific element exists",
      insertText: "where(${1:element}.exists())",
      insertTextRules: 4,
      sortText: "5_where_exists",
    },
    {
      label: "where-equals",
      kind: CompletionItemKind.Snippet,
      detail: "Filter where element equals value",
      documentation: "Filter collection where element equals a specific value",
      insertText: "where(${1:element} = '${2:value}')",
      insertTextRules: 4,
      sortText: "5_where_equals",
    },
    {
      label: "first-or-empty",
      kind: CompletionItemKind.Snippet,
      detail: "Get first element or empty",
      documentation: "Safely get the first element, returning empty if none",
      insertText: "first()",
      insertTextRules: 0,
      sortText: "5_first",
    },
    {
      label: "count-check",
      kind: CompletionItemKind.Snippet,
      detail: "Check collection count",
      documentation: "Check if collection has expected number of elements",
      insertText: "count() ${1|=,>,<,>=,<=|} ${2:1}",
      insertTextRules: 4,
      sortText: "5_count",
    },
    {
      label: "extension-value",
      kind: CompletionItemKind.Snippet,
      detail: "Get extension value",
      documentation: "Get value from an extension by URL",
      insertText: "extension('${1:url}').value${2|String,Boolean,Integer,Decimal,Code,Coding,CodeableConcept|}",
      insertTextRules: 4,
      sortText: "5_extension",
    },
    {
      label: "resolve-reference",
      kind: CompletionItemKind.Snippet,
      detail: "Resolve a reference",
      documentation: "Resolve a FHIR reference to its target resource",
      insertText: "${1:reference}.resolve()",
      insertTextRules: 4,
      sortText: "5_resolve",
    },
    {
      label: "iif-condition",
      kind: CompletionItemKind.Snippet,
      detail: "Conditional expression",
      documentation: "Return different values based on condition",
      insertText: "iif(${1:condition}, ${2:trueResult}, ${3:falseResult})",
      insertTextRules: 4,
      sortText: "5_iif",
    },
    {
      label: "memberOf-check",
      kind: CompletionItemKind.Snippet,
      detail: "Check value set membership",
      documentation: "Check if code is member of a value set",
      insertText: "memberOf('${1:valueSetUrl}')",
      insertTextRules: 4,
      sortText: "5_memberOf",
    },
  ];
}
