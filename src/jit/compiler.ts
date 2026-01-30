/**
 * FHIRPath JIT Compiler
 * 
 * Compiles FHIRPath AST directly to native JavaScript functions for maximum performance.
 * This eliminates the interpreter overhead by generating optimized code.
 * 
 * Performance: ~10-15x faster than interpreted evaluation
 */

import type {
  ASTNode,
  ExpressionNode,
  LiteralNode,
  IdentifierNode,
  MemberAccessNode,
  FunctionCallNode,
  MethodCallNode,
  IndexerNode,
  BinaryOpNode,
  UnaryOpNode,
  TypeOpNode,
  ThisNode,
  IndexNode,
  TotalNode,
  EnvVariableNode,
  EmptySetNode,
  ParenNode,
} from "../parser/ast.ts";

/**
 * Compiled FHIRPath function type
 */
export type CompiledFhirPath<T = unknown> = (
  resource: unknown,
  context?: Record<string, unknown>,
  options?: JITOptions
) => T[];

/**
 * JIT compilation options
 */
export interface JITOptions {
  /** Enable debug mode with generated code output */
  debug?: boolean;
  /** Strict type checking (slower but safer) */
  strict?: boolean;
  /** Enable optimizations for known patterns */
  optimize?: boolean;
}

/**
 * Fast structural hash for AST nodes - O(n) but much faster than JSON.stringify
 * Uses a simple DJB2-like hash algorithm
 */
function hashAST(node: ASTNode): string {
  let hash = 5381;
  const stack: unknown[] = [node];
  
  while (stack.length > 0) {
    const item = stack.pop();
    
    if (item === null || item === undefined) {
      hash = ((hash << 5) + hash) ^ 0;
      continue;
    }
    
    if (typeof item === "string") {
      for (let i = 0; i < item.length; i++) {
        hash = ((hash << 5) + hash) ^ item.charCodeAt(i);
      }
      continue;
    }
    
    if (typeof item === "number") {
      hash = ((hash << 5) + hash) ^ (item | 0);
      continue;
    }
    
    if (typeof item === "boolean") {
      hash = ((hash << 5) + hash) ^ (item ? 1 : 0);
      continue;
    }
    
    if (Array.isArray(item)) {
      hash = ((hash << 5) + hash) ^ 91; // '['
      for (let i = item.length - 1; i >= 0; i--) {
        stack.push(item[i]);
      }
      continue;
    }
    
    if (typeof item === "object") {
      hash = ((hash << 5) + hash) ^ 123; // '{'
      const keys = Object.keys(item as Record<string, unknown>).sort();
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        stack.push((item as Record<string, unknown>)[key]);
        stack.push(key);
      }
    }
  }
  
  // Convert to hex string for Map key
  return (hash >>> 0).toString(16);
}

/**
 * Shared runtime helpers - created once, passed to all JIT functions
 * This avoids re-creating helper functions in every generated function body
 */
const RUNTIME_HELPERS = {
  /** Convert value to array */
  toArray: (v: unknown): unknown[] => v == null ? [] : Array.isArray(v) ? v : [v],
  
  /** Flatten nested arrays */
  flatten: (arr: unknown[][]): unknown[] => arr.flat(),
  
  /** Deep equality check without JSON.stringify */
  equals: (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!RUNTIME_HELPERS.equals(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (Array.isArray(b)) return false;
    
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!(key in (b as object))) return false;
      if (!RUNTIME_HELPERS.equals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    return true;
  },
  
  /** Compare two values */
  compare: (a: unknown, b: unknown): number => {
    if (a === b) return 0;
    if ((a as number) < (b as number)) return -1;
    return 1;
  },
};

/**
 * JIT Compiler for FHIRPath expressions
 */
export class FhirPathJIT {
  private cache = new Map<string, CompiledFhirPath>();
  private varCounter = 0;

  /**
   * Compile a FHIRPath AST to a native JavaScript function
   */
  compile<T = unknown>(ast: ASTNode, options: JITOptions = {}): CompiledFhirPath<T> {
    // Use fast hash instead of JSON.stringify
    const cacheKey = hashAST(ast);
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as CompiledFhirPath<T>;
    }

    this.varCounter = 0;
    const code = this.generateFunction(ast, options);
    
    if (options.debug) {
      // Debug output for generated JIT code - only when explicitly requested
      // deno-lint-ignore no-console
      console.log("Generated JIT code:\n", code);
    }

    // Create the function with shared runtime helpers
    const innerFn = new Function("resource", "context", "options", "$rt", code);
    
    // Wrap to inject runtime helpers
    const fn = ((resource: unknown, context?: Record<string, unknown>, opts?: JITOptions) => 
      innerFn(resource, context, opts, RUNTIME_HELPERS)
    ) as CompiledFhirPath<T>;
    
    this.cache.set(cacheKey, fn);
    return fn;
  }

  /**
   * Clear the compilation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate the complete function body
   */
  private generateFunction(ast: ASTNode, options: JITOptions): string {
    const lines: string[] = [];
    
    // Use shared runtime helpers via $rt parameter (passed at call time)
    lines.push(`
// Destructure shared runtime helpers (faster access)
const {toArray, flatten, equals, compare} = $rt;
`);

    // Generate the expression code
    const resultVar = this.generateNode(ast, "resource", lines, options);
    
    // Return as array
    lines.push(`return toArray(${resultVar});`);

    return lines.join("\n");
  }

  /**
   * Generate a unique variable name
   */
  private newVar(prefix = "v"): string {
    return `${prefix}${this.varCounter++}`;
  }

  /**
   * Generate code for an AST node
   */
  private generateNode(
    node: ASTNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    switch (node.type) {
      case "Expression":
        return this.generateNode((node as ExpressionNode).child, inputVar, lines, options);

      case "Literal":
        return this.generateLiteral(node as LiteralNode);

      case "Identifier":
        return this.generateIdentifier(node as IdentifierNode, inputVar, lines);

      case "MemberAccess":
        return this.generateMemberAccess(node as MemberAccessNode, inputVar, lines, options);

      case "MethodCall":
        return this.generateMethodCall(node as MethodCallNode, inputVar, lines, options);

      case "FunctionCall":
        return this.generateFunctionCall(node as FunctionCallNode, inputVar, lines, options);

      case "Indexer":
        return this.generateIndexer(node as IndexerNode, inputVar, lines, options);

      case "BinaryOp":
        return this.generateBinaryOp(node as BinaryOpNode, inputVar, lines, options);

      case "UnaryOp":
        return this.generateUnaryOp(node as UnaryOpNode, inputVar, lines, options);

      case "TypeOp":
        return this.generateTypeOp(node as TypeOpNode, inputVar, lines, options);

      case "This":
        return inputVar;

      case "Index":
        return "$$index";

      case "Total":
        return "$$total";

      case "EnvVariable":
        return this.generateEnvVariable(node as EnvVariableNode);

      case "EmptySet":
        return "[]";

      case "Paren":
        return this.generateNode((node as ParenNode).expression, inputVar, lines, options);

      default:
        throw new Error(`JIT: Unsupported node type: ${node.type}`);
    }
  }

  /**
   * Generate literal value
   */
  private generateLiteral(node: LiteralNode): string {
    switch (node.literalType) {
      case "string":
        return JSON.stringify(node.value);
      case "number":
        return String(node.value);
      case "boolean":
        return String(node.value);
      case "null":
        return "null";
      case "quantity":
        return `{ value: ${node.value}, unit: ${JSON.stringify(node.unit)} }`;
      case "date":
      case "time":
      case "datetime":
        return JSON.stringify(node.value);
      default:
        return JSON.stringify(node.value);
    }
  }

  /**
   * Generate identifier (property access on input)
   */
  private generateIdentifier(node: IdentifierNode, inputVar: string, lines: string[]): string {
    const resultVar = this.newVar("id");
    
    // Handle special identifiers
    if (node.name === "resourceType") {
      lines.push(`const ${resultVar} = ${inputVar}?.resourceType;`);
      return resultVar;
    }

    // General property access with collection handling
    lines.push(`
const ${resultVar} = (() => {
  const input = toArray(${inputVar});
  const results = [];
  for (const item of input) {
    if (item != null && typeof item === 'object') {
      const val = item[${JSON.stringify(node.name)}];
      if (val != null) {
        if (Array.isArray(val)) {
          results.push(...val);
        } else {
          results.push(val);
        }
      }
    }
  }
  return results;
})();`);
    
    return resultVar;
  }

  /**
   * Generate member access: a.b
   */
  private generateMemberAccess(
    node: MemberAccessNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const objectVar = this.generateNode(node.object, inputVar, lines, options);
    return this.generateIdentifier(node.member, objectVar, lines);
  }

  /**
   * Generate method call: expr.method(args)
   */
  private generateMethodCall(
    node: MethodCallNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const objectVar = this.generateNode(node.object, inputVar, lines, options);
    const methodName = node.method.name;

    switch (methodName) {
      case "where":
        return this.generateWhere(node, objectVar, inputVar, lines, options);
      case "first":
        return this.generateFirst(objectVar, lines);
      case "last":
        return this.generateLast(objectVar, lines);
      case "single":
        return this.generateSingle(objectVar, lines);
      case "skip":
        return this.generateSkip(node, objectVar, inputVar, lines, options);
      case "take":
        return this.generateTake(node, objectVar, inputVar, lines, options);
      case "tail":
        return this.generateTail(objectVar, lines);
      case "count":
        return this.generateCount(objectVar, lines);
      case "empty":
        return this.generateEmpty(objectVar, lines);
      case "exists":
        return this.generateExists(node, objectVar, inputVar, lines, options);
      case "all":
        return this.generateAll(node, objectVar, inputVar, lines, options);
      case "select":
        return this.generateSelect(node, objectVar, inputVar, lines, options);
      case "distinct":
        return this.generateDistinct(objectVar, lines);
      case "not":
        return this.generateNot(objectVar, lines);
      case "hasValue":
        return this.generateHasValue(objectVar, lines);
      case "iif":
        return this.generateIif(node, objectVar, inputVar, lines, options);
      case "ofType":
        return this.generateOfType(node, objectVar, lines);
      case "toString":
        return this.generateToString(objectVar, lines);
      case "toInteger":
        return this.generateToInteger(objectVar, lines);
      case "toDecimal":
        return this.generateToDecimal(objectVar, lines);
      case "toBoolean":
        return this.generateToBoolean(objectVar, lines);
      case "startsWith":
        return this.generateStringMethod(node, objectVar, inputVar, lines, options, "startsWith");
      case "endsWith":
        return this.generateStringMethod(node, objectVar, inputVar, lines, options, "endsWith");
      case "contains":
        return this.generateStringMethod(node, objectVar, inputVar, lines, options, "includes");
      case "matches":
        return this.generateMatches(node, objectVar, inputVar, lines, options);
      case "replace":
        return this.generateReplace(node, objectVar, inputVar, lines, options);
      case "length":
        return this.generateLength(objectVar, lines);
      case "substring":
        return this.generateSubstring(node, objectVar, inputVar, lines, options);
      case "upper":
        return this.generateUpper(objectVar, lines);
      case "lower":
        return this.generateLower(objectVar, lines);
      case "trim":
        return this.generateTrim(objectVar, lines);
      case "split":
        return this.generateSplit(node, objectVar, inputVar, lines, options);
      case "join":
        return this.generateJoin(node, objectVar, inputVar, lines, options);
      case "indexOf":
        return this.generateIndexOf(node, objectVar, inputVar, lines, options);
      case "union":
        return this.generateUnion(node, objectVar, inputVar, lines, options);
      case "combine":
        return this.generateCombine(node, objectVar, inputVar, lines, options);
      case "intersect":
        return this.generateIntersect(node, objectVar, inputVar, lines, options);
      case "exclude":
        return this.generateExclude(node, objectVar, inputVar, lines, options);
      case "repeat":
        return this.generateRepeat(node, objectVar, inputVar, lines, options);
      case "children":
        return this.generateChildren(objectVar, lines);
      case "descendants":
        return this.generateDescendants(objectVar, lines);
      // Aggregate functions
      case "sum":
        return this.generateSum(objectVar, lines);
      case "min":
        return this.generateMin(objectVar, lines);
      case "max":
        return this.generateMax(objectVar, lines);
      case "avg":
        return this.generateAvg(objectVar, lines);
      // Existence functions
      case "allTrue":
        return this.generateAllTrue(objectVar, lines);
      case "anyTrue":
        return this.generateAnyTrue(objectVar, lines);
      case "allFalse":
        return this.generateAllFalse(objectVar, lines);
      case "anyFalse":
        return this.generateAnyFalse(objectVar, lines);
      case "isDistinct":
        return this.generateIsDistinct(objectVar, lines);
      case "subsetOf":
        return this.generateSubsetOf(node, objectVar, inputVar, lines, options);
      case "supersetOf":
        return this.generateSupersetOf(node, objectVar, inputVar, lines, options);
      // Math functions
      case "abs":
        return this.generateMathSingle(objectVar, lines, "abs", "Math.abs");
      case "ceiling":
        return this.generateMathSingle(objectVar, lines, "ceil", "Math.ceil");
      case "floor":
        return this.generateMathSingle(objectVar, lines, "floor", "Math.floor");
      case "round":
        return this.generateRound(node, objectVar, inputVar, lines, options);
      case "truncate":
        return this.generateMathSingle(objectVar, lines, "trunc", "Math.trunc");
      case "sqrt":
        return this.generateMathSingle(objectVar, lines, "sqrt", "Math.sqrt");
      case "exp":
        return this.generateMathSingle(objectVar, lines, "exp", "Math.exp");
      case "ln":
        return this.generateMathSingle(objectVar, lines, "ln", "Math.log");
      case "log":
        return this.generateLog(node, objectVar, inputVar, lines, options);
      case "power":
        return this.generatePower(node, objectVar, inputVar, lines, options);
      // String functions
      case "toChars":
        return this.generateToChars(objectVar, lines);
      case "replaceMatches":
        return this.generateReplaceMatches(node, objectVar, inputVar, lines, options);
      // Type conversion
      case "toDate":
        return this.generateToDate(objectVar, lines);
      case "toDateTime":
        return this.generateToDateTime(objectVar, lines);
      case "toTime":
        return this.generateToTime(objectVar, lines);
      // FHIR-specific
      case "extension":
        return this.generateExtension(node, objectVar, inputVar, lines, options);
      case "hasExtension":
        return this.generateHasExtension(node, objectVar, inputVar, lines, options);
      case "getValue":
        return this.generateGetValue(objectVar, lines);
      case "htmlChecks":
        return this.generateHtmlChecks(objectVar, lines);
      // Type conversion checks
      case "convertsToString":
        return this.generateConvertsTo(objectVar, lines, "String");
      case "convertsToInteger":
        return this.generateConvertsTo(objectVar, lines, "Integer");
      case "convertsToDecimal":
        return this.generateConvertsTo(objectVar, lines, "Decimal");
      case "convertsToBoolean":
        return this.generateConvertsTo(objectVar, lines, "Boolean");
      case "convertsToDate":
        return this.generateConvertsTo(objectVar, lines, "Date");
      case "convertsToDateTime":
        return this.generateConvertsTo(objectVar, lines, "DateTime");
      case "convertsToTime":
        return this.generateConvertsTo(objectVar, lines, "Time");
      case "convertsToQuantity":
        return this.generateConvertsTo(objectVar, lines, "Quantity");
      // Quantity conversion
      case "toQuantity":
        return this.generateToQuantity(node, objectVar, inputVar, lines, options);
      // Encoding/Decoding
      case "encode":
        return this.generateEncode(node, objectVar, inputVar, lines, options);
      case "decode":
        return this.generateDecode(node, objectVar, inputVar, lines, options);
      // Utility
      case "trace":
        return this.generateTrace(node, objectVar, inputVar, lines, options);
      // Type functions as methods
      case "as":
        return this.generateAsMethod(node, objectVar, lines);
      case "is":
        return this.generateIsMethod(node, objectVar, lines);
      // Aggregate
      case "aggregate":
        return this.generateAggregate(node, objectVar, inputVar, lines, options);
      // Advanced functions
      case "type":
        return this.generateType(objectVar, lines);
      case "defineVariable":
        return this.generateDefineVariable(node, objectVar, inputVar, lines, options);
      case "resolve":
        return this.generateResolve(objectVar, lines);
      case "memberOf":
        return this.generateMemberOf(node, objectVar, inputVar, lines, options);
      // Date/time as methods (in addition to functions)
      case "now":
        return this.generateNow(lines);
      case "today":
        return this.generateToday(lines);
      case "timeOfDay":
        return this.generateTimeOfDay(lines);
      default:
        // Fall back to runtime for complex/uncommon methods
        return this.generateRuntimeMethodCall(node, objectVar, inputVar, lines, options);
    }
  }

  /**
   * Generate where() filter
   */
  private generateWhere(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("where");
    const itemVar = this.newVar("item");
    const indexVar = this.newVar("idx");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    lines.push(`const ${resultVar} = [];`);
    lines.push(`let ${indexVar} = 0;`);
    lines.push(`for (const ${itemVar} of toArray(${objectVar})) {`);
    lines.push(`  const $$this = ${itemVar};`);
    lines.push(`  const $$index = ${indexVar}++;`);
    
    // Generate the predicate
    const predicateVar = this.generateNode(node.arguments[0], itemVar, lines, options);
    
    lines.push(`  const predResult = toArray(${predicateVar});`);
    lines.push(`  if (predResult.length === 1 && predResult[0] === true) {`);
    lines.push(`    ${resultVar}.push(${itemVar});`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate first()
   */
  private generateFirst(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("first");
    lines.push(`const ${resultVar} = toArray(${objectVar})[0];`);
    return resultVar;
  }

  /**
   * Generate last()
   */
  private generateLast(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("last");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr[${resultVar}_arr.length - 1];`);
    return resultVar;
  }

  /**
   * Generate single()
   */
  private generateSingle(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("single");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 ? ${resultVar}_arr[0] : undefined;`);
    return resultVar;
  }

  /**
   * Generate skip(n)
   */
  private generateSkip(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("skip");
    const countVar = node.arguments.length > 0 
      ? this.generateNode(node.arguments[0], inputVar, lines, options)
      : "0";
    lines.push(`const ${resultVar} = toArray(${objectVar}).slice(toArray(${countVar})[0] || 0);`);
    return resultVar;
  }

  /**
   * Generate take(n)
   */
  private generateTake(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("take");
    const countVar = node.arguments.length > 0 
      ? this.generateNode(node.arguments[0], inputVar, lines, options)
      : "0";
    lines.push(`const ${resultVar} = toArray(${objectVar}).slice(0, toArray(${countVar})[0] || 0);`);
    return resultVar;
  }

  /**
   * Generate tail()
   */
  private generateTail(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("tail");
    lines.push(`const ${resultVar} = toArray(${objectVar}).slice(1);`);
    return resultVar;
  }

  /**
   * Generate count()
   */
  private generateCount(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("count");
    lines.push(`const ${resultVar} = toArray(${objectVar}).length;`);
    return resultVar;
  }

  /**
   * Generate empty()
   */
  private generateEmpty(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("empty");
    lines.push(`const ${resultVar} = toArray(${objectVar}).length === 0;`);
    return resultVar;
  }

  /**
   * Generate exists()
   */
  private generateExists(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("exists");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar}).length > 0;`);
    } else {
      // exists(criteria) - check if any item matches
      const itemVar = this.newVar("item");
      lines.push(`let ${resultVar} = false;`);
      lines.push(`for (const ${itemVar} of toArray(${objectVar})) {`);
      
      const predicateVar = this.generateNode(node.arguments[0], itemVar, lines, options);
      
      lines.push(`  const predResult = toArray(${predicateVar});`);
      lines.push(`  if (predResult.length === 1 && predResult[0] === true) {`);
      lines.push(`    ${resultVar} = true;`);
      lines.push(`    break;`);
      lines.push(`  }`);
      lines.push(`}`);
    }
    
    return resultVar;
  }

  /**
   * Generate all()
   */
  private generateAll(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("all");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar}).every(x => x === true);`);
    } else {
      const itemVar = this.newVar("item");
      lines.push(`let ${resultVar} = true;`);
      lines.push(`for (const ${itemVar} of toArray(${objectVar})) {`);
      
      const predicateVar = this.generateNode(node.arguments[0], itemVar, lines, options);
      
      lines.push(`  const predResult = toArray(${predicateVar});`);
      lines.push(`  if (predResult.length !== 1 || predResult[0] !== true) {`);
      lines.push(`    ${resultVar} = false;`);
      lines.push(`    break;`);
      lines.push(`  }`);
      lines.push(`}`);
    }
    
    return resultVar;
  }

  /**
   * Generate select()
   */
  private generateSelect(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("select");
    const itemVar = this.newVar("item");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const ${itemVar} of toArray(${objectVar})) {`);
    
    const projectionVar = this.generateNode(node.arguments[0], itemVar, lines, options);
    
    lines.push(`  ${resultVar}.push(...toArray(${projectionVar}));`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate distinct()
   */
  private generateDistinct(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("distinct");
    lines.push(`const ${resultVar} = [...new Set(toArray(${objectVar}).map(x => JSON.stringify(x)))].map(x => JSON.parse(x));`);
    return resultVar;
  }

  /**
   * Generate not()
   */
  private generateNot(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("not");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'boolean' ? !${resultVar}_arr[0] : undefined;`);
    return resultVar;
  }

  /**
   * Generate hasValue()
   */
  private generateHasValue(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("hasValue");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && ${resultVar}_arr[0] != null;`);
    return resultVar;
  }

  /**
   * Generate iif()
   */
  private generateIif(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("iif");
    
    if (node.arguments.length < 2) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const conditionVar = this.generateNode(node.arguments[0], objectVar, lines, options);
    const trueVar = this.generateNode(node.arguments[1], objectVar, lines, options);
    const falseVar = node.arguments.length > 2 
      ? this.generateNode(node.arguments[2], objectVar, lines, options)
      : "[]";

    lines.push(`const ${resultVar}_cond = toArray(${conditionVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_cond.length === 1 && ${resultVar}_cond[0] === true ? ${trueVar} : ${falseVar};`);
    
    return resultVar;
  }

  /**
   * Generate ofType()
   */
  private generateOfType(node: MethodCallNode, objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("ofType");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const typeArg = node.arguments[0];
    let typeName = "";
    if (typeArg.type === "Identifier") {
      typeName = (typeArg as IdentifierNode).name;
    } else if (typeArg.type === "TypeSpecifier") {
      typeName = (typeArg as any).typeName;
    } else if ((typeArg as any).name) {
      // Sometimes the argument is already parsed differently
      typeName = (typeArg as any).name;
    }

    // Handle FHIR resource types that could have namespace prefix (e.g., FHIR.Patient)
    const simpleTypeName = typeName.includes('.') ? typeName.split('.').pop() : typeName;

    lines.push(`const ${resultVar} = toArray(${objectVar}).filter(x => {
      if (x == null) return false;
      // Check FHIR resource type
      if (typeof x === 'object' && x.resourceType) {
        return x.resourceType === ${JSON.stringify(typeName)} || x.resourceType === ${JSON.stringify(simpleTypeName)};
      }
      // Check primitive types
      const jsType = typeof x;
      const typeMap = { 'string': ['String'], 'number': ['Integer', 'Decimal', 'Number'], 'boolean': ['Boolean'] };
      return (typeMap[jsType] || []).includes(${JSON.stringify(typeName)});
    });`);
    
    return resultVar;
  }

  /**
   * Generate string conversion
   */
  private generateToString(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("str");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 ? String(${resultVar}_arr[0]) : undefined;`);
    return resultVar;
  }

  /**
   * Generate integer conversion
   */
  private generateToInteger(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("int");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 ? parseInt(${resultVar}_arr[0], 10) : undefined;`);
    lines.push(`if (isNaN(${resultVar})) ${resultVar} = undefined;`);
    return resultVar;
  }

  /**
   * Generate decimal conversion
   */
  private generateToDecimal(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("dec");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = ${resultVar}_arr.length === 1 ? parseFloat(${resultVar}_arr[0]) : undefined;`);
    lines.push(`if (isNaN(${resultVar})) ${resultVar} = undefined;`);
    return resultVar;
  }

  /**
   * Generate boolean conversion
   */
  private generateToBoolean(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("bool");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof v === 'boolean') ${resultVar} = v;`);
    lines.push(`  else if (v === 'true' || v === '1') ${resultVar} = true;`);
    lines.push(`  else if (v === 'false' || v === '0') ${resultVar} = false;`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate string method (startsWith, endsWith, contains/includes)
   */
  private generateStringMethod(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions,
    jsMethod: string
  ): string {
    const resultVar = this.newVar("strm");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const argVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_arg = toArray(${argVar})[0];`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' && typeof ${resultVar}_arg === 'string' ? ${resultVar}_arr[0].${jsMethod}(${resultVar}_arg) : undefined;`);
    
    return resultVar;
  }

  /**
   * Generate matches()
   */
  private generateMatches(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("match");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const patternVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_pat = toArray(${patternVar})[0];`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' && typeof ${resultVar}_pat === 'string') {`);
    lines.push(`  try { ${resultVar} = new RegExp(${resultVar}_pat).test(${resultVar}_arr[0]); } catch(e) {}`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate replace()
   */
  private generateReplace(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("repl");
    
    if (node.arguments.length < 2) {
      lines.push(`const ${resultVar} = toArray(${objectVar})[0];`);
      return resultVar;
    }

    const patternVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    const replacementVar = this.generateNode(node.arguments[1], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_pat = toArray(${patternVar})[0];`);
    lines.push(`const ${resultVar}_rep = toArray(${replacementVar})[0] || '';`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' && typeof ${resultVar}_pat === 'string') {`);
    lines.push(`  try { ${resultVar} = ${resultVar}_arr[0].replace(new RegExp(${resultVar}_pat, 'g'), ${resultVar}_rep); } catch(e) { ${resultVar} = ${resultVar}_arr[0]; }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate length()
   */
  private generateLength(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("len");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].length : undefined;`);
    return resultVar;
  }

  /**
   * Generate substring()
   */
  private generateSubstring(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("substr");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar})[0];`);
      return resultVar;
    }

    const startVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    const lengthVar = node.arguments.length > 1 
      ? this.generateNode(node.arguments[1], inputVar, lines, options)
      : null;

    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_start = toArray(${startVar})[0] || 0;`);
    
    if (lengthVar) {
      lines.push(`const ${resultVar}_len = toArray(${lengthVar})[0];`);
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].substring(${resultVar}_start, ${resultVar}_start + ${resultVar}_len) : undefined;`);
    } else {
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].substring(${resultVar}_start) : undefined;`);
    }
    
    return resultVar;
  }

  /**
   * Generate upper()
   */
  private generateUpper(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("upper");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].toUpperCase() : undefined;`);
    return resultVar;
  }

  /**
   * Generate lower()
   */
  private generateLower(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("lower");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].toLowerCase() : undefined;`);
    return resultVar;
  }

  /**
   * Generate trim()
   */
  private generateTrim(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("trim");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].trim() : undefined;`);
    return resultVar;
  }

  /**
   * Generate split()
   */
  private generateSplit(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("split");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const sepVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_sep = toArray(${sepVar})[0] || '';`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? ${resultVar}_arr[0].split(${resultVar}_sep) : [];`);
    
    return resultVar;
  }

  /**
   * Generate join()
   */
  private generateJoin(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("join");
    
    const sepVar = node.arguments.length > 0
      ? this.generateNode(node.arguments[0], inputVar, lines, options)
      : "''";

    lines.push(`const ${resultVar}_sep = toArray(${sepVar})[0] || '';`);
    lines.push(`const ${resultVar} = toArray(${objectVar}).join(${resultVar}_sep);`);
    
    return resultVar;
  }

  /**
   * Generate indexOf()
   */
  private generateIndexOf(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("indexOf");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const searchVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_search = toArray(${searchVar})[0];`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' && typeof ${resultVar}_search === 'string' ? ${resultVar}_arr[0].indexOf(${resultVar}_search) : undefined;`);
    
    return resultVar;
  }

  /**
   * Generate union()
   */
  private generateUnion(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("union");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_set = new Set();`);
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const x of [...toArray(${objectVar}), ...toArray(${otherVar})]) {`);
    lines.push(`  const key = JSON.stringify(x);`);
    lines.push(`  if (!${resultVar}_set.has(key)) {`);
    lines.push(`    ${resultVar}_set.add(key);`);
    lines.push(`    ${resultVar}.push(x);`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate combine()
   */
  private generateCombine(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("combine");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar} = [...toArray(${objectVar}), ...toArray(${otherVar})];`);
    
    return resultVar;
  }

  /**
   * Generate intersect()
   */
  private generateIntersect(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("intersect");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = [];`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_set = new Set(toArray(${otherVar}).map(x => JSON.stringify(x)));`);
    lines.push(`const ${resultVar} = toArray(${objectVar}).filter(x => ${resultVar}_set.has(JSON.stringify(x)));`);
    
    return resultVar;
  }

  /**
   * Generate exclude()
   */
  private generateExclude(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("exclude");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_set = new Set(toArray(${otherVar}).map(x => JSON.stringify(x)));`);
    lines.push(`const ${resultVar} = toArray(${objectVar}).filter(x => !${resultVar}_set.has(JSON.stringify(x)));`);
    
    return resultVar;
  }

  /**
   * Generate repeat()
   */
  private generateRepeat(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("repeat");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const itemVar = this.newVar("item");
    
    lines.push(`const ${resultVar} = [];`);
    lines.push(`const ${resultVar}_seen = new Set();`);
    lines.push(`let ${resultVar}_queue = [...toArray(${objectVar})];`);
    lines.push(`while (${resultVar}_queue.length > 0) {`);
    lines.push(`  const ${itemVar} = ${resultVar}_queue.shift();`);
    lines.push(`  const ${itemVar}_key = JSON.stringify(${itemVar});`);
    lines.push(`  if (${resultVar}_seen.has(${itemVar}_key)) continue;`);
    lines.push(`  ${resultVar}_seen.add(${itemVar}_key);`);
    lines.push(`  ${resultVar}.push(${itemVar});`);
    
    const projectionVar = this.generateNode(node.arguments[0], itemVar, lines, options);
    
    lines.push(`  ${resultVar}_queue.push(...toArray(${projectionVar}));`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate children()
   */
  private generateChildren(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("children");
    
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item != null && typeof item === 'object') {`);
    lines.push(`    for (const key of Object.keys(item)) {`);
    lines.push(`      const val = item[key];`);
    lines.push(`      if (val != null) {`);
    lines.push(`        if (Array.isArray(val)) ${resultVar}.push(...val);`);
    lines.push(`        else ${resultVar}.push(val);`);
    lines.push(`      }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate descendants()
   */
  private generateDescendants(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("desc");
    
    lines.push(`const ${resultVar} = [];`);
    lines.push(`const ${resultVar}_queue = [...toArray(${objectVar})];`);
    lines.push(`while (${resultVar}_queue.length > 0) {`);
    lines.push(`  const item = ${resultVar}_queue.shift();`);
    lines.push(`  if (item != null && typeof item === 'object') {`);
    lines.push(`    for (const key of Object.keys(item)) {`);
    lines.push(`      const val = item[key];`);
    lines.push(`      if (val != null) {`);
    lines.push(`        if (Array.isArray(val)) {`);
    lines.push(`          ${resultVar}.push(...val);`);
    lines.push(`          ${resultVar}_queue.push(...val);`);
    lines.push(`        } else {`);
    lines.push(`          ${resultVar}.push(val);`);
    lines.push(`          ${resultVar}_queue.push(val);`);
    lines.push(`        }`);
    lines.push(`      }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  // ============================================
  // Aggregate Functions
  // ============================================

  /**
   * Generate sum()
   */
  private generateSum(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("sum");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar}).filter(x => typeof x === 'number');`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length > 0 ? ${resultVar}_arr.reduce((a, b) => a + b, 0) : undefined;`);
    return resultVar;
  }

  /**
   * Generate min()
   */
  private generateMin(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("min");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length > 0) {`);
    lines.push(`  ${resultVar} = ${resultVar}_arr[0];`);
    lines.push(`  for (let i = 1; i < ${resultVar}_arr.length; i++) {`);
    lines.push(`    if (${resultVar}_arr[i] < ${resultVar}) ${resultVar} = ${resultVar}_arr[i];`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate max()
   */
  private generateMax(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("max");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length > 0) {`);
    lines.push(`  ${resultVar} = ${resultVar}_arr[0];`);
    lines.push(`  for (let i = 1; i < ${resultVar}_arr.length; i++) {`);
    lines.push(`    if (${resultVar}_arr[i] > ${resultVar}) ${resultVar} = ${resultVar}_arr[i];`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate avg()
   */
  private generateAvg(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("avg");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar}).filter(x => typeof x === 'number');`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length > 0 ? ${resultVar}_arr.reduce((a, b) => a + b, 0) / ${resultVar}_arr.length : undefined;`);
    return resultVar;
  }

  // ============================================
  // Existence Functions
  // ============================================

  /**
   * Generate allTrue()
   */
  private generateAllTrue(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("allTrue");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length > 0 && ${resultVar}_arr.every(x => x === true);`);
    return resultVar;
  }

  /**
   * Generate anyTrue()
   */
  private generateAnyTrue(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("anyTrue");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.some(x => x === true);`);
    return resultVar;
  }

  /**
   * Generate allFalse()
   */
  private generateAllFalse(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("allFalse");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length > 0 && ${resultVar}_arr.every(x => x === false);`);
    return resultVar;
  }

  /**
   * Generate anyFalse()
   */
  private generateAnyFalse(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("anyFalse");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.some(x => x === false);`);
    return resultVar;
  }

  /**
   * Generate isDistinct()
   */
  private generateIsDistinct(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("isDistinct");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_set = new Set(${resultVar}_arr.map(x => JSON.stringify(x)));`);
    lines.push(`const ${resultVar} = ${resultVar}_set.size === ${resultVar}_arr.length;`);
    return resultVar;
  }

  /**
   * Generate subsetOf()
   */
  private generateSubsetOf(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("subsetOf");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = true;`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_other = new Set(toArray(${otherVar}).map(x => JSON.stringify(x)));`);
    lines.push(`const ${resultVar} = toArray(${objectVar}).every(x => ${resultVar}_other.has(JSON.stringify(x)));`);
    
    return resultVar;
  }

  /**
   * Generate supersetOf()
   */
  private generateSupersetOf(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("supersetOf");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = true;`);
      return resultVar;
    }

    const otherVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_self = new Set(toArray(${objectVar}).map(x => JSON.stringify(x)));`);
    lines.push(`const ${resultVar} = toArray(${otherVar}).every(x => ${resultVar}_self.has(JSON.stringify(x)));`);
    
    return resultVar;
  }

  // ============================================
  // Math Functions
  // ============================================

  /**
   * Generate single-argument math function
   */
  private generateMathSingle(objectVar: string, lines: string[], name: string, jsFunc: string): string {
    const resultVar = this.newVar(name);
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' ? ${jsFunc}(${resultVar}_arr[0]) : undefined;`);
    return resultVar;
  }

  /**
   * Generate round() with optional precision
   */
  private generateRound(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("round");
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    
    if (node.arguments.length > 0) {
      const precisionVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`const ${resultVar}_prec = toArray(${precisionVar})[0] || 0;`);
      lines.push(`const ${resultVar}_factor = Math.pow(10, ${resultVar}_prec);`);
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' ? Math.round(${resultVar}_arr[0] * ${resultVar}_factor) / ${resultVar}_factor : undefined;`);
    } else {
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' ? Math.round(${resultVar}_arr[0]) : undefined;`);
    }
    
    return resultVar;
  }

  /**
   * Generate log() with base
   */
  private generateLog(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("log");
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    
    if (node.arguments.length > 0) {
      const baseVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`const ${resultVar}_base = toArray(${baseVar})[0];`);
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' && typeof ${resultVar}_base === 'number' ? Math.log(${resultVar}_arr[0]) / Math.log(${resultVar}_base) : undefined;`);
    } else {
      lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' ? Math.log10(${resultVar}_arr[0]) : undefined;`);
    }
    
    return resultVar;
  }

  /**
   * Generate power()
   */
  private generatePower(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("power");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const expVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_exp = toArray(${expVar})[0];`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'number' && typeof ${resultVar}_exp === 'number' ? Math.pow(${resultVar}_arr[0], ${resultVar}_exp) : undefined;`);
    
    return resultVar;
  }

  // ============================================
  // String Functions
  // ============================================

  /**
   * Generate toChars()
   */
  private generateToChars(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("toChars");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' ? [...${resultVar}_arr[0]] : [];`);
    return resultVar;
  }

  /**
   * Generate replaceMatches()
   */
  private generateReplaceMatches(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("replMatch");
    
    if (node.arguments.length < 2) {
      lines.push(`const ${resultVar} = toArray(${objectVar})[0];`);
      return resultVar;
    }

    const patternVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    const replacementVar = this.generateNode(node.arguments[1], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_pat = toArray(${patternVar})[0];`);
    lines.push(`const ${resultVar}_rep = toArray(${replacementVar})[0] || '';`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string' && typeof ${resultVar}_pat === 'string') {`);
    lines.push(`  try { ${resultVar} = ${resultVar}_arr[0].replace(new RegExp(${resultVar}_pat, 'g'), ${resultVar}_rep); } catch(e) { ${resultVar} = ${resultVar}_arr[0]; }`);
    lines.push(`}`);
    
    return resultVar;
  }

  // ============================================
  // Type Conversion Functions
  // ============================================

  /**
   * Generate toDate()
   */
  private generateToDate(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("toDate");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof v === 'string') {`);
    lines.push(`    const match = v.match(/^(\\d{4})(-\\d{2})?(-\\d{2})?/);`);
    lines.push(`    if (match) ${resultVar} = match[0];`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate toDateTime()
   */
  private generateToDateTime(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("toDateTime");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof v === 'string') {`);
    lines.push(`    const d = new Date(v);`);
    lines.push(`    if (!isNaN(d.getTime())) ${resultVar} = d.toISOString();`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate toTime()
   */
  private generateToTime(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("toTime");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof v === 'string') {`);
    lines.push(`    const match = v.match(/T?(\\d{2}:\\d{2}(:\\d{2})?)/);`);
    lines.push(`    if (match) ${resultVar} = match[1];`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  // ============================================
  // FHIR-specific Functions
  // ============================================

  /**
   * Generate extension()
   */
  private generateExtension(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("ext");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = [];`);
      return resultVar;
    }

    const urlVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_url = toArray(${urlVar})[0];`);
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item?.extension) {`);
    lines.push(`    for (const ext of toArray(item.extension)) {`);
    lines.push(`      if (ext?.url === ${resultVar}_url) ${resultVar}.push(ext);`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate hasExtension()
   */
  private generateHasExtension(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("hasExt");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = false;`);
      return resultVar;
    }

    const urlVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_url = toArray(${urlVar})[0];`);
    lines.push(`let ${resultVar} = false;`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item?.extension) {`);
    lines.push(`    for (const ext of toArray(item.extension)) {`);
    lines.push(`      if (ext?.url === ${resultVar}_url) { ${resultVar} = true; break; }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`  if (${resultVar}) break;`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate getValue() - FHIR value[x] pattern
   */
  private generateGetValue(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("getValue");
    const valueProps = ['valueString', 'valueInteger', 'valueDecimal', 'valueBoolean', 
      'valueDate', 'valueDateTime', 'valueTime', 'valueCode', 'valueCoding', 
      'valueQuantity', 'valueReference', 'valueIdentifier', 'valueCodeableConcept',
      'valueUri', 'valueUrl', 'valueCanonical', 'valueBase64Binary', 'valueInstant',
      'valueOid', 'valueUuid', 'valueId', 'valueMarkdown', 'valueUnsignedInt',
      'valuePositiveInt', 'valueAddress', 'valueAge', 'valueAnnotation', 
      'valueAttachment', 'valueContactPoint', 'valueCount', 'valueDistance',
      'valueDuration', 'valueHumanName', 'valueMoney', 'valuePeriod', 'valueRange',
      'valueRatio', 'valueSampledData', 'valueSignature', 'valueTiming'];
    
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item != null && typeof item === 'object') {`);
    for (const prop of valueProps) {
      lines.push(`    if (item.${prop} !== undefined) { ${resultVar}.push(item.${prop}); continue; }`);
    }
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate htmlChecks() - basic XHTML validation
   */
  private generateHtmlChecks(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("htmlChecks");
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = true;`);
    lines.push(`for (const item of ${resultVar}_arr) {`);
    lines.push(`  if (typeof item === 'string') {`);
    lines.push(`    // Basic checks: no scripts, no events`);
    lines.push(`    if (/<script/i.test(item) || /on\\w+\\s*=/i.test(item)) {`);
    lines.push(`      ${resultVar} = false; break;`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate convertsTo*() functions
   */
  private generateConvertsTo(objectVar: string, lines: string[], targetType: string): string {
    const resultVar = this.newVar("convertsTo" + targetType);
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = ${resultVar}_arr.length === 1;`);
    lines.push(`if (${resultVar}) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    
    switch (targetType) {
      case "String":
        lines.push(`  ${resultVar} = v != null;`);
        break;
      case "Integer":
        lines.push(`  if (typeof v === 'number') ${resultVar} = Number.isInteger(v);`);
        lines.push(`  else if (typeof v === 'string') ${resultVar} = /^-?\\d+$/.test(v);`);
        lines.push(`  else if (typeof v === 'boolean') ${resultVar} = true;`);
        lines.push(`  else ${resultVar} = false;`);
        break;
      case "Decimal":
        lines.push(`  if (typeof v === 'number') ${resultVar} = !isNaN(v);`);
        lines.push(`  else if (typeof v === 'string') ${resultVar} = !isNaN(parseFloat(v));`);
        lines.push(`  else if (typeof v === 'boolean') ${resultVar} = true;`);
        lines.push(`  else ${resultVar} = false;`);
        break;
      case "Boolean":
        lines.push(`  if (typeof v === 'boolean') ${resultVar} = true;`);
        lines.push(`  else if (typeof v === 'string') ${resultVar} = ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase());`);
        lines.push(`  else if (typeof v === 'number') ${resultVar} = v === 0 || v === 1;`);
        lines.push(`  else ${resultVar} = false;`);
        break;
      case "Date":
        lines.push(`  if (typeof v === 'string') ${resultVar} = /^\\d{4}(-\\d{2}(-\\d{2})?)?$/.test(v);`);
        lines.push(`  else ${resultVar} = false;`);
        break;
      case "DateTime":
        lines.push(`  if (typeof v === 'string') {`);
        lines.push(`    const d = new Date(v);`);
        lines.push(`    ${resultVar} = !isNaN(d.getTime());`);
        lines.push(`  } else ${resultVar} = false;`);
        break;
      case "Time":
        lines.push(`  if (typeof v === 'string') ${resultVar} = /^\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?$/.test(v);`);
        lines.push(`  else ${resultVar} = false;`);
        break;
      case "Quantity":
        lines.push(`  if (typeof v === 'number') ${resultVar} = true;`);
        lines.push(`  else if (typeof v === 'object' && v?.value !== undefined) ${resultVar} = true;`);
        lines.push(`  else if (typeof v === 'string') ${resultVar} = /^-?\\d+(\\.\\d+)?\\s*'[^']*'$/.test(v) || /^-?\\d+(\\.\\d+)?$/.test(v);`);
        lines.push(`  else ${resultVar} = false;`);
        break;
    }
    
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate toQuantity()
   */
  private generateToQuantity(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("toQuantity");
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const v = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof v === 'number') {`);
    
    if (node.arguments.length > 0) {
      const unitVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`    const unit = toArray(${unitVar})[0] || '1';`);
      lines.push(`    ${resultVar} = { value: v, unit: unit };`);
    } else {
      lines.push(`    ${resultVar} = { value: v, unit: '1' };`);
    }
    
    lines.push(`  } else if (typeof v === 'object' && v?.value !== undefined) {`);
    lines.push(`    ${resultVar} = v;`);
    lines.push(`  } else if (typeof v === 'string') {`);
    lines.push(`    const match = v.match(/^(-?\\d+(?:\\.\\d+)?)\\s*'([^']*)'$/);`);
    lines.push(`    if (match) ${resultVar} = { value: parseFloat(match[1]), unit: match[2] };`);
    lines.push(`    else if (/^-?\\d+(\\.\\d+)?$/.test(v)) ${resultVar} = { value: parseFloat(v), unit: '1' };`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate encode()
   */
  private generateEncode(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("encode");
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string') {`);
    
    if (node.arguments.length > 0) {
      const encodingVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`  const encoding = toArray(${encodingVar})[0] || 'base64';`);
      lines.push(`  const str = ${resultVar}_arr[0];`);
      lines.push(`  if (encoding === 'base64') {`);
      lines.push(`    try { ${resultVar} = btoa(unescape(encodeURIComponent(str))); } catch(e) {}`);
      lines.push(`  } else if (encoding === 'urlbase64') {`);
      lines.push(`    try { ${resultVar} = btoa(unescape(encodeURIComponent(str))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); } catch(e) {}`);
      lines.push(`  } else if (encoding === 'hex') {`);
      lines.push(`    ${resultVar} = [...str].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');`);
      lines.push(`  }`);
    } else {
      lines.push(`  try { ${resultVar} = btoa(unescape(encodeURIComponent(${resultVar}_arr[0]))); } catch(e) {}`);
    }
    
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate decode()
   */
  private generateDecode(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("decode");
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1 && typeof ${resultVar}_arr[0] === 'string') {`);
    
    if (node.arguments.length > 0) {
      const encodingVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`  const encoding = toArray(${encodingVar})[0] || 'base64';`);
      lines.push(`  const str = ${resultVar}_arr[0];`);
      lines.push(`  if (encoding === 'base64') {`);
      lines.push(`    try { ${resultVar} = decodeURIComponent(escape(atob(str))); } catch(e) {}`);
      lines.push(`  } else if (encoding === 'urlbase64') {`);
      lines.push(`    try { let s = str.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; ${resultVar} = decodeURIComponent(escape(atob(s))); } catch(e) {}`);
      lines.push(`  } else if (encoding === 'hex') {`);
      lines.push(`    ${resultVar} = str.match(/.{1,2}/g)?.map(b => String.fromCharCode(parseInt(b, 16))).join('') || '';`);
      lines.push(`  }`);
    } else {
      lines.push(`  try { ${resultVar} = decodeURIComponent(escape(atob(${resultVar}_arr[0]))); } catch(e) {}`);
    }
    
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate trace() - debugging helper
   */
  private generateTrace(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("trace");
    
    lines.push(`const ${resultVar} = toArray(${objectVar});`);
    
    if (node.arguments.length > 0) {
      const labelVar = this.generateNode(node.arguments[0], inputVar, lines, options);
      lines.push(`const ${resultVar}_label = toArray(${labelVar})[0] || 'trace';`);
      lines.push(`if (options?.traceFn) options.traceFn(${resultVar}, ${resultVar}_label);`);
    } else {
      lines.push(`if (options?.traceFn) options.traceFn(${resultVar}, 'trace');`);
    }
    
    return resultVar;
  }

  /**
   * Generate as() as a method
   */
  private generateAsMethod(node: MethodCallNode, objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("asMethod");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    const typeArg = node.arguments[0];
    let typeName = "";
    if (typeArg.type === "Identifier") {
      typeName = (typeArg as IdentifierNode).name;
    } else if ((typeArg as any).typeName) {
      typeName = (typeArg as any).typeName;
    } else if ((typeArg as any).name) {
      typeName = (typeArg as any).name;
    }

    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const val = ${resultVar}_arr[0];`);
    lines.push(`  const isType = (typeof val === 'object' && val?.resourceType === ${JSON.stringify(typeName)}) ||`);
    lines.push(`    (['String'].includes(${JSON.stringify(typeName)}) && typeof val === 'string') ||`);
    lines.push(`    (['Integer', 'Decimal'].includes(${JSON.stringify(typeName)}) && typeof val === 'number') ||`);
    lines.push(`    (${JSON.stringify(typeName)} === 'Boolean' && typeof val === 'boolean');`);
    lines.push(`  if (isType) ${resultVar} = val;`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate is() as a method
   */
  private generateIsMethod(node: MethodCallNode, objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("isMethod");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = false;`);
      return resultVar;
    }

    const typeArg = node.arguments[0];
    let typeName = "";
    if (typeArg.type === "Identifier") {
      typeName = (typeArg as IdentifierNode).name;
    } else if ((typeArg as any).typeName) {
      typeName = (typeArg as any).typeName;
    } else if ((typeArg as any).name) {
      typeName = (typeArg as any).name;
    }

    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`let ${resultVar} = false;`);
    lines.push(`if (${resultVar}_arr.length === 1) {`);
    lines.push(`  const val = ${resultVar}_arr[0];`);
    lines.push(`  if (typeof val === 'object' && val?.resourceType === ${JSON.stringify(typeName)}) ${resultVar} = true;`);
    lines.push(`  else {`);
    lines.push(`    const typeMap = { 'string': ['String'], 'number': ['Integer', 'Decimal'], 'boolean': ['Boolean'] };`);
    lines.push(`    ${resultVar} = (typeMap[typeof val] || []).includes(${JSON.stringify(typeName)});`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate aggregate() - iterates with accumulator
   */
  private generateAggregate(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("aggregate");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const itemVar = this.newVar("aggItem");
    const indexVar = this.newVar("aggIdx");
    
    // Initial value (optional second argument)
    if (node.arguments.length > 1) {
      const initVar = this.generateNode(node.arguments[1], inputVar, lines, options);
      lines.push(`let $$total = toArray(${initVar})[0];`);
    } else {
      lines.push(`let $$total = undefined;`);
    }
    
    lines.push(`let ${indexVar} = 0;`);
    lines.push(`for (const ${itemVar} of toArray(${objectVar})) {`);
    lines.push(`  const $$this = ${itemVar};`);
    lines.push(`  const $$index = ${indexVar}++;`);
    
    // Generate the aggregation expression
    const exprVar = this.generateNode(node.arguments[0], itemVar, lines, options);
    
    lines.push(`  const ${resultVar}_val = toArray(${exprVar});`);
    lines.push(`  if (${resultVar}_val.length === 1) $$total = ${resultVar}_val[0];`);
    lines.push(`}`);
    lines.push(`const ${resultVar} = $$total;`);
    
    return resultVar;
  }

  /**
   * Generate type() - returns TypeInfo for each element
   */
  private generateType(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("type");
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item == null) continue;`);
    lines.push(`  let typeName;`);
    lines.push(`  if (typeof item === 'string') typeName = 'System.String';`);
    lines.push(`  else if (typeof item === 'number') typeName = Number.isInteger(item) ? 'System.Integer' : 'System.Decimal';`);
    lines.push(`  else if (typeof item === 'boolean') typeName = 'System.Boolean';`);
    lines.push(`  else if (typeof item === 'object') {`);
    lines.push(`    if (item.resourceType) typeName = 'FHIR.' + item.resourceType;`);
    lines.push(`    else if (item.value !== undefined && item.unit !== undefined) typeName = 'System.Quantity';`);
    lines.push(`    else typeName = 'System.Any';`);
    lines.push(`  }`);
    lines.push(`  if (typeName) ${resultVar}.push({ namespace: typeName.split('.')[0], name: typeName.split('.')[1] || typeName });`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate defineVariable() - defines a variable for subsequent expressions
   */
  private generateDefineVariable(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("defVar");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = toArray(${objectVar});`);
      return resultVar;
    }

    // Get variable name
    const nameArg = node.arguments[0];
    let varName = "";
    if (nameArg.type === "Literal") {
      varName = String((nameArg as LiteralNode).value);
    } else if (nameArg.type === "Identifier") {
      varName = (nameArg as IdentifierNode).name;
    }
    
    // Get variable value (optional second argument, defaults to input)
    if (node.arguments.length > 1) {
      const valueVar = this.generateNode(node.arguments[1], objectVar, lines, options);
      lines.push(`const ${resultVar}_value = toArray(${valueVar});`);
    } else {
      lines.push(`const ${resultVar}_value = toArray(${objectVar});`);
    }
    
    // Store in context for later use
    lines.push(`if (context) context[${JSON.stringify(varName)}] = ${resultVar}_value.length === 1 ? ${resultVar}_value[0] : ${resultVar}_value;`);
    lines.push(`const ${resultVar} = ${resultVar}_value;`);
    
    return resultVar;
  }

  /**
   * Generate resolve() - resolves FHIR references
   * Note: This is a synchronous implementation that looks for references in Bundle entries
   */
  private generateResolve(objectVar: string, lines: string[]): string {
    const resultVar = this.newVar("resolve");
    lines.push(`const ${resultVar} = [];`);
    lines.push(`for (const item of toArray(${objectVar})) {`);
    lines.push(`  if (item == null) continue;`);
    lines.push(`  // Get reference string`);
    lines.push(`  let refStr = typeof item === 'string' ? item : item?.reference;`);
    lines.push(`  if (!refStr) continue;`);
    lines.push(`  // Check context for %resource (Bundle)`);
    lines.push(`  const bundle = context?.resource || context?.rootResource;`);
    lines.push(`  if (bundle?.resourceType === 'Bundle' && bundle?.entry) {`);
    lines.push(`    for (const entry of bundle.entry) {`);
    lines.push(`      if (!entry?.resource) continue;`);
    lines.push(`      const fullUrl = entry.fullUrl || '';`);
    lines.push(`      const resourceRef = entry.resource.resourceType + '/' + entry.resource.id;`);
    lines.push(`      if (fullUrl === refStr || resourceRef === refStr || ('urn:uuid:' + entry.resource.id) === refStr) {`);
    lines.push(`        ${resultVar}.push(entry.resource);`);
    lines.push(`        break;`);
    lines.push(`      }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`  // Also check for resolver function in context`);
    lines.push(`  if (${resultVar}.length === 0 && context?.resolver && typeof context.resolver === 'function') {`);
    lines.push(`    const resolved = context.resolver(refStr);`);
    lines.push(`    if (resolved) ${resultVar}.push(resolved);`);
    lines.push(`  }`);
    lines.push(`}`);
    return resultVar;
  }

  /**
   * Generate memberOf() - checks ValueSet membership
   * Note: This requires a synchronous memberOf function in context
   */
  private generateMemberOf(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("memberOf");
    
    if (node.arguments.length === 0) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const valueSetVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    
    lines.push(`const ${resultVar}_vs = toArray(${valueSetVar})[0];`);
    lines.push(`let ${resultVar} = undefined;`);
    lines.push(`const ${resultVar}_items = toArray(${objectVar});`);
    lines.push(`if (${resultVar}_items.length === 1 && ${resultVar}_vs) {`);
    lines.push(`  const item = ${resultVar}_items[0];`);
    lines.push(`  // Check for memberOf function in context (%terminologies)`);
    lines.push(`  const terminologies = context?.terminologies || context?.['%terminologies'];`);
    lines.push(`  if (terminologies?.memberOf && typeof terminologies.memberOf === 'function') {`);
    lines.push(`    // Extract code from item`);
    lines.push(`    let code, system;`);
    lines.push(`    if (typeof item === 'string') {`);
    lines.push(`      if (item.includes('|')) { [system, code] = item.split('|'); }`);
    lines.push(`      else code = item;`);
    lines.push(`    } else if (item?.code) {`);
    lines.push(`      code = item.code; system = item.system;`);
    lines.push(`    } else if (item?.coding?.[0]) {`);
    lines.push(`      code = item.coding[0].code; system = item.coding[0].system;`);
    lines.push(`    }`);
    lines.push(`    if (code) {`);
    lines.push(`      try { ${resultVar} = terminologies.memberOf({ code, system }, ${resultVar}_vs); } catch(e) {}`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    
    return resultVar;
  }

  /**
   * Generate now() as method
   */
  private generateNow(lines: string[]): string {
    const resultVar = this.newVar("now");
    lines.push(`const ${resultVar} = new Date().toISOString();`);
    return resultVar;
  }

  /**
   * Generate today() as method
   */
  private generateToday(lines: string[]): string {
    const resultVar = this.newVar("today");
    lines.push(`const ${resultVar} = new Date().toISOString().split('T')[0];`);
    return resultVar;
  }

  /**
   * Generate timeOfDay() as method
   */
  private generateTimeOfDay(lines: string[]): string {
    const resultVar = this.newVar("timeOfDay");
    lines.push(`const ${resultVar} = new Date().toISOString().split('T')[1].split('.')[0];`);
    return resultVar;
  }

  /**
   * Fallback: generate runtime method call for complex methods
   */
  private generateRuntimeMethodCall(
    node: MethodCallNode,
    objectVar: string,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    // For methods we don't JIT-compile, we could fall back to the interpreter
    // For now, throw an error
    throw new Error(`JIT: Method '${node.method.name}' not yet supported. Use interpreted mode.`);
  }

  /**
   * Generate function call (not a method)
   */
  private generateFunctionCall(
    node: FunctionCallNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const funcName = node.function.name;

    switch (funcName) {
      case "now":
        return `new Date().toISOString()`;
      case "today":
        return `new Date().toISOString().split('T')[0]`;
      case "timeOfDay":
        return `new Date().toISOString().split('T')[1].split('.')[0]`;
      case "true":
        return "true";
      case "false":
        return "false";
      case "iif":
        return this.generateIifFunction(node, inputVar, lines, options);
      case "children":
        return this.generateChildren(inputVar, lines);
      case "descendants":
        return this.generateDescendants(inputVar, lines);
      default:
        throw new Error(`JIT: Function '${funcName}' not yet supported.`);
    }
  }

  /**
   * Generate iif() as a function call (not method)
   */
  private generateIifFunction(
    node: FunctionCallNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("iif");
    
    if (node.arguments.length < 2) {
      lines.push(`const ${resultVar} = undefined;`);
      return resultVar;
    }

    const conditionVar = this.generateNode(node.arguments[0], inputVar, lines, options);
    const trueVar = this.generateNode(node.arguments[1], inputVar, lines, options);
    const falseVar = node.arguments.length > 2 
      ? this.generateNode(node.arguments[2], inputVar, lines, options)
      : "[]";

    lines.push(`const ${resultVar}_cond = toArray(${conditionVar});`);
    lines.push(`const ${resultVar} = ${resultVar}_cond.length === 1 && ${resultVar}_cond[0] === true ? ${trueVar} : ${falseVar};`);
    
    return resultVar;
  }

  /**
   * Generate indexer: expr[index]
   */
  private generateIndexer(
    node: IndexerNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("idx");
    const objectVar = this.generateNode(node.object, inputVar, lines, options);
    const indexVar = this.generateNode(node.index, inputVar, lines, options);
    
    lines.push(`const ${resultVar}_arr = toArray(${objectVar});`);
    lines.push(`const ${resultVar}_idx = toArray(${indexVar})[0];`);
    lines.push(`const ${resultVar} = typeof ${resultVar}_idx === 'number' ? ${resultVar}_arr[${resultVar}_idx] : undefined;`);
    
    return resultVar;
  }

  /**
   * Generate binary operation
   */
  private generateBinaryOp(
    node: BinaryOpNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("binop");
    const leftVar = this.generateNode(node.left, inputVar, lines, options);
    const rightVar = this.generateNode(node.right, inputVar, lines, options);
    
    const op = node.operator;

    // Handle union operator specially
    if (op === "|") {
      lines.push(`const ${resultVar}_set = new Set();`);
      lines.push(`const ${resultVar} = [];`);
      lines.push(`for (const x of [...toArray(${leftVar}), ...toArray(${rightVar})]) {`);
      lines.push(`  const key = JSON.stringify(x);`);
      lines.push(`  if (!${resultVar}_set.has(key)) { ${resultVar}_set.add(key); ${resultVar}.push(x); }`);
      lines.push(`}`);
      return resultVar;
    }

    lines.push(`const ${resultVar}_l = toArray(${leftVar});`);
    lines.push(`const ${resultVar}_r = toArray(${rightVar});`);
    lines.push(`let ${resultVar};`);

    switch (op) {
      case "=":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? equals(${resultVar}_l[0], ${resultVar}_r[0]) : (${resultVar}_l.length === 0 || ${resultVar}_r.length === 0 ? undefined : false);`);
        break;
      case "!=":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? !equals(${resultVar}_l[0], ${resultVar}_r[0]) : (${resultVar}_l.length === 0 || ${resultVar}_r.length === 0 ? undefined : true);`);
        break;
      case "~":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? equals(${resultVar}_l[0], ${resultVar}_r[0]) : (${resultVar}_l.length === 0 && ${resultVar}_r.length === 0);`);
        break;
      case "!~":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? !equals(${resultVar}_l[0], ${resultVar}_r[0]) : !(${resultVar}_l.length === 0 && ${resultVar}_r.length === 0);`);
        break;
      case "<":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] < ${resultVar}_r[0] : undefined;`);
        break;
      case "<=":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] <= ${resultVar}_r[0] : undefined;`);
        break;
      case ">":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] > ${resultVar}_r[0] : undefined;`);
        break;
      case ">=":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] >= ${resultVar}_r[0] : undefined;`);
        break;
      case "+":
        lines.push(`if (${resultVar}_l.length === 1 && ${resultVar}_r.length === 1) {`);
        lines.push(`  if (typeof ${resultVar}_l[0] === 'string' || typeof ${resultVar}_r[0] === 'string') ${resultVar} = String(${resultVar}_l[0]) + String(${resultVar}_r[0]);`);
        lines.push(`  else ${resultVar} = ${resultVar}_l[0] + ${resultVar}_r[0];`);
        lines.push(`}`);
        break;
      case "-":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] - ${resultVar}_r[0] : undefined;`);
        break;
      case "*":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 ? ${resultVar}_l[0] * ${resultVar}_r[0] : undefined;`);
        break;
      case "/":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 && ${resultVar}_r[0] !== 0 ? ${resultVar}_l[0] / ${resultVar}_r[0] : undefined;`);
        break;
      case "div":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 && ${resultVar}_r[0] !== 0 ? Math.trunc(${resultVar}_l[0] / ${resultVar}_r[0]) : undefined;`);
        break;
      case "mod":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 && ${resultVar}_r[0] !== 0 ? ${resultVar}_l[0] % ${resultVar}_r[0] : undefined;`);
        break;
      case "&":
        lines.push(`${resultVar} = (${resultVar}_l[0] ?? '') + '' + (${resultVar}_r[0] ?? '');`);
        break;
      case "and":
        lines.push(`if (${resultVar}_l.length === 0 || ${resultVar}_r.length === 0) ${resultVar} = ${resultVar}_l.length === 1 && ${resultVar}_l[0] === false ? false : (${resultVar}_r.length === 1 && ${resultVar}_r[0] === false ? false : undefined);`);
        lines.push(`else ${resultVar} = ${resultVar}_l[0] === true && ${resultVar}_r[0] === true;`);
        break;
      case "or":
        lines.push(`if (${resultVar}_l.length === 1 && ${resultVar}_l[0] === true) ${resultVar} = true;`);
        lines.push(`else if (${resultVar}_r.length === 1 && ${resultVar}_r[0] === true) ${resultVar} = true;`);
        lines.push(`else if (${resultVar}_l.length === 1 && ${resultVar}_r.length === 1) ${resultVar} = false;`);
        lines.push(`else ${resultVar} = undefined;`);
        break;
      case "xor":
        lines.push(`if (${resultVar}_l.length === 1 && ${resultVar}_r.length === 1 && typeof ${resultVar}_l[0] === 'boolean' && typeof ${resultVar}_r[0] === 'boolean') {`);
        lines.push(`  ${resultVar} = ${resultVar}_l[0] !== ${resultVar}_r[0];`);
        lines.push(`} else ${resultVar} = undefined;`);
        break;
      case "implies":
        lines.push(`if (${resultVar}_l.length === 1 && ${resultVar}_l[0] === false) ${resultVar} = true;`);
        lines.push(`else if (${resultVar}_r.length === 1 && ${resultVar}_r[0] === true) ${resultVar} = true;`);
        lines.push(`else if (${resultVar}_l.length === 1 && ${resultVar}_l[0] === true && ${resultVar}_r.length === 1) ${resultVar} = ${resultVar}_r[0];`);
        lines.push(`else ${resultVar} = undefined;`);
        break;
      case "in":
        lines.push(`${resultVar} = ${resultVar}_l.length === 1 ? toArray(${rightVar}).some(x => equals(x, ${resultVar}_l[0])) : undefined;`);
        break;
      case "contains":
        lines.push(`${resultVar} = ${resultVar}_r.length === 1 ? toArray(${leftVar}).some(x => equals(x, ${resultVar}_r[0])) : undefined;`);
        break;
      default:
        lines.push(`${resultVar} = undefined; // Unknown operator: ${op}`);
    }

    return resultVar;
  }

  /**
   * Generate unary operation
   */
  private generateUnaryOp(
    node: UnaryOpNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("unary");
    const operandVar = this.generateNode(node.operand, inputVar, lines, options);
    
    switch (node.operator) {
      case "-":
        lines.push(`const ${resultVar}_arr = toArray(${operandVar});`);
        lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 ? -${resultVar}_arr[0] : undefined;`);
        break;
      case "+":
        lines.push(`const ${resultVar}_arr = toArray(${operandVar});`);
        lines.push(`const ${resultVar} = ${resultVar}_arr.length === 1 ? +${resultVar}_arr[0] : undefined;`);
        break;
      default:
        lines.push(`const ${resultVar} = ${operandVar};`);
    }
    
    return resultVar;
  }

  /**
   * Generate type operation (is, as)
   */
  private generateTypeOp(
    node: TypeOpNode,
    inputVar: string,
    lines: string[],
    options: JITOptions
  ): string {
    const resultVar = this.newVar("typeop");
    const exprVar = this.generateNode(node.expression, inputVar, lines, options);
    const typeName = node.targetType.typeName;
    
    if (node.operator === "is") {
      lines.push(`const ${resultVar}_arr = toArray(${exprVar});`);
      lines.push(`let ${resultVar} = false;`);
      lines.push(`if (${resultVar}_arr.length === 1) {`);
      lines.push(`  const val = ${resultVar}_arr[0];`);
      lines.push(`  if (typeof val === 'object' && val?.resourceType === ${JSON.stringify(typeName)}) ${resultVar} = true;`);
      lines.push(`  else {`);
      lines.push(`    const typeMap = { 'string': ['String'], 'number': ['Integer', 'Decimal'], 'boolean': ['Boolean'] };`);
      lines.push(`    ${resultVar} = (typeMap[typeof val] || []).includes(${JSON.stringify(typeName)});`);
      lines.push(`  }`);
      lines.push(`}`);
    } else {
      // as - cast
      lines.push(`const ${resultVar}_arr = toArray(${exprVar});`);
      lines.push(`let ${resultVar} = undefined;`);
      lines.push(`if (${resultVar}_arr.length === 1) {`);
      lines.push(`  const val = ${resultVar}_arr[0];`);
      lines.push(`  const isType = (typeof val === 'object' && val?.resourceType === ${JSON.stringify(typeName)}) ||`);
      lines.push(`    (['String'].includes(${JSON.stringify(typeName)}) && typeof val === 'string') ||`);
      lines.push(`    (['Integer', 'Decimal'].includes(${JSON.stringify(typeName)}) && typeof val === 'number') ||`);
      lines.push(`    (${JSON.stringify(typeName)} === 'Boolean' && typeof val === 'boolean');`);
      lines.push(`  if (isType) ${resultVar} = val;`);
      lines.push(`}`);
    }
    
    return resultVar;
  }

  /**
   * Generate environment variable access
   */
  private generateEnvVariable(node: EnvVariableNode): string {
    return `(context?.[${JSON.stringify(node.name)}])`;
  }
}

// Singleton instance
const jitCompiler = new FhirPathJIT();

/**
 * Compile a FHIRPath expression using JIT
 */
export function compileJIT<T = unknown>(
  ast: ASTNode,
  options?: JITOptions
): CompiledFhirPath<T> {
  return jitCompiler.compile<T>(ast, options);
}

/**
 * Clear the JIT compilation cache
 */
export function clearJITCache(): void {
  jitCompiler.clearCache();
}

export { jitCompiler };
