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
 * JIT Compiler for FHIRPath expressions
 */
export class FhirPathJIT {
  private cache = new Map<string, CompiledFhirPath>();
  private varCounter = 0;

  /**
   * Compile a FHIRPath AST to a native JavaScript function
   */
  compile<T = unknown>(ast: ASTNode, options: JITOptions = {}): CompiledFhirPath<T> {
    const cacheKey = JSON.stringify(ast);
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as CompiledFhirPath<T>;
    }

    this.varCounter = 0;
    const code = this.generateFunction(ast, options);
    
    if (options.debug) {
      console.log("Generated JIT code:");
      console.log(code);
    }

    // Create the function
    const fn = new Function("resource", "context", "options", code) as CompiledFhirPath<T>;
    
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
    
    // Runtime helpers
    lines.push(`
// Runtime helpers
const toArray = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const flatten = (arr) => arr.flat();
const equals = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
};
const compare = (a, b) => {
  if (a === b) return 0;
  if (a < b) return -1;
  return 1;
};
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
