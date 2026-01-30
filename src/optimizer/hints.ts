/**
 * FHIRPath Expression Optimization Hints
 * 
 * Analyzes FHIRPath AST and provides suggestions for better performance.
 */

import type {
  ASTNode,
  ExpressionNode,
  MemberAccessNode,
  MethodCallNode,
  BinaryOpNode,
  FunctionCallNode,
  IdentifierNode,
} from "../parser/ast.ts";
import { parseFhirPath } from "../parser/mod.ts";

/**
 * Optimization hint severity
 */
export enum HintSeverity {
  /** Minor optimization opportunity */
  Info = "info",
  /** Recommended optimization */
  Suggestion = "suggestion",
  /** Important performance issue */
  Warning = "warning",
  /** Critical performance problem */
  Critical = "critical",
}

/**
 * Optimization hint
 */
export interface OptimizationHint {
  /** Hint severity */
  severity: HintSeverity;
  /** Hint message */
  message: string;
  /** Detailed explanation */
  explanation: string;
  /** Suggested fix (if available) */
  suggestion?: string;
  /** Code location (if available) */
  location?: {
    start: number;
    end: number;
  };
  /** Performance impact estimate */
  impact?: "low" | "medium" | "high";
  /** Category of optimization */
  category: string;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  /** Is the expression valid? */
  valid: boolean;
  /** Parse error (if invalid) */
  error?: string;
  /** Optimization hints */
  hints: OptimizationHint[];
  /** Complexity score (0-100) */
  complexity: number;
  /** Is JIT-compilable? */
  jitCompatible: boolean;
  /** JIT incompatibility reason (if not compatible) */
  jitIncompatibleReason?: string;
}

/**
 * AST visitor context
 */
interface VisitorContext {
  hints: OptimizationHint[];
  depth: number;
  inWhere: boolean;
  inSelect: boolean;
  whereCount: number;
  selectCount: number;
  functionCalls: Map<string, number>;
}

/**
 * Analyze a FHIRPath expression and provide optimization hints
 */
export function analyzeExpression(expression: string): AnalysisResult {
  const result: AnalysisResult = {
    valid: true,
    hints: [],
    complexity: 0,
    jitCompatible: true,
  };

  // Try to parse
  let ast: ASTNode;
  try {
    ast = parseFhirPath(expression);
  } catch (error) {
    result.valid = false;
    result.error = error instanceof Error ? error.message : "Unknown parse error";
    return result;
  }

  // Create visitor context
  const context: VisitorContext = {
    hints: [],
    depth: 0,
    inWhere: false,
    inSelect: false,
    whereCount: 0,
    selectCount: 0,
    functionCalls: new Map(),
  };

  // Visit the AST
  visitNode(ast, context);

  // Post-analysis checks
  checkPatterns(expression, context);
  checkComplexity(expression, context);
  checkJitCompatibility(ast, result);

  // Deduplicate hints by message to avoid showing the same hint multiple times
  const seenMessages = new Set<string>();
  result.hints = context.hints.filter(hint => {
    if (seenMessages.has(hint.message)) {
      return false;
    }
    seenMessages.add(hint.message);
    return true;
  });
  result.complexity = calculateComplexity(expression, context);

  return result;
}

/**
 * Visit an AST node recursively
 */
function visitNode(node: ASTNode, context: VisitorContext): void {
  context.depth++;

  switch (node.type) {
    case "Expression":
      visitNode((node as ExpressionNode).child, context);
      break;

    case "MemberAccess":
      visitMemberAccess(node as MemberAccessNode, context);
      break;

    case "MethodCall":
      visitMethodCall(node as MethodCallNode, context);
      break;

    case "FunctionCall":
      visitFunctionCall(node as FunctionCallNode, context);
      break;

    case "BinaryOp":
      visitBinaryOp(node as BinaryOpNode, context);
      break;

    // Other node types
    default:
      // Visit children if they exist
      const anyNode = node as unknown as Record<string, unknown>;
      for (const key of Object.keys(anyNode)) {
        const value = anyNode[key];
        if (value && typeof value === "object" && "type" in value) {
          visitNode(value as ASTNode, context);
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === "object" && "type" in item) {
              visitNode(item as ASTNode, context);
            }
          }
        }
      }
  }

  context.depth--;
}

/**
 * Visit member access node
 */
function visitMemberAccess(node: MemberAccessNode, context: VisitorContext): void {
  visitNode(node.object, context);
}

/**
 * Visit method call node
 */
function visitMethodCall(node: MethodCallNode, context: VisitorContext): void {
  const methodName = node.method.name;
  
  // Track function calls
  const count = context.functionCalls.get(methodName) || 0;
  context.functionCalls.set(methodName, count + 1);

  // Check for specific method optimizations
  switch (methodName) {
    case "where":
      context.whereCount++;
      checkWhereOptimizations(node, context);
      
      // Visit with context flag
      const prevInWhere = context.inWhere;
      context.inWhere = true;
      visitNode(node.object, context);
      for (const arg of node.arguments) {
        visitNode(arg, context);
      }
      context.inWhere = prevInWhere;
      return;

    case "select":
      context.selectCount++;
      checkSelectOptimizations(node, context);
      
      const prevInSelect = context.inSelect;
      context.inSelect = true;
      visitNode(node.object, context);
      for (const arg of node.arguments) {
        visitNode(arg, context);
      }
      context.inSelect = prevInSelect;
      return;

    case "first":
    case "last":
    case "single":
      checkSubsettingOptimizations(node, context);
      break;

    case "count":
      checkCountOptimizations(node, context);
      break;

    case "repeat":
      checkRepeatOptimizations(node, context);
      break;

    case "descendants":
      context.hints.push({
        severity: HintSeverity.Warning,
        message: "descendants() can be expensive on large resources",
        explanation: "The descendants() function traverses the entire resource tree, which can be slow for deeply nested or large resources.",
        suggestion: "Consider using more specific paths if possible",
        impact: "high",
        category: "Performance",
        location: { start: node.start || 0, end: node.end || 0 },
      });
      break;

    case "resolve":
      context.hints.push({
        severity: HintSeverity.Info,
        message: "resolve() requires external reference resolution",
        explanation: "The resolve() function needs access to a reference resolver. Ensure one is configured in the evaluation options.",
        category: "Configuration",
        location: { start: node.start || 0, end: node.end || 0 },
      });
      break;

    case "memberOf":
      context.hints.push({
        severity: HintSeverity.Info,
        message: "memberOf() requires terminology service",
        explanation: "The memberOf() function needs a terminology service. Ensure async mode is enabled and a terminology service is configured.",
        category: "Configuration",
        location: { start: node.start || 0, end: node.end || 0 },
      });
      break;
  }

  // Visit children
  visitNode(node.object, context);
  for (const arg of node.arguments) {
    visitNode(arg, context);
  }
}

/**
 * Visit function call node
 */
function visitFunctionCall(node: FunctionCallNode, context: VisitorContext): void {
  const funcName = node.function.name;
  
  const count = context.functionCalls.get(funcName) || 0;
  context.functionCalls.set(funcName, count + 1);

  for (const arg of node.arguments) {
    visitNode(arg, context);
  }
}

/**
 * Visit binary operation node
 */
function visitBinaryOp(node: BinaryOpNode, context: VisitorContext): void {
  // Check for union usage
  if (node.operator === "|") {
    if (context.depth > 3) {
      context.hints.push({
        severity: HintSeverity.Suggestion,
        message: "Nested union operations may impact performance",
        explanation: "Multiple union operations create new collections. Consider restructuring if possible.",
        impact: "medium",
        category: "Performance",
        location: { start: node.start || 0, end: node.end || 0 },
      });
    }
  }

  visitNode(node.left, context);
  visitNode(node.right, context);
}

/**
 * Check for where() optimizations
 */
function checkWhereOptimizations(node: MethodCallNode, context: VisitorContext): void {
  // Multiple where clauses
  if (context.whereCount > 1) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Multiple where() clauses could be combined",
      explanation: "Multiple sequential where() filters each create an iteration. Combining them with 'and' may be more efficient.",
      suggestion: "Combine predicates: where(cond1 and cond2)",
      impact: "medium",
      category: "Performance",
    });
  }

  // Empty where clause
  if (node.arguments.length === 0) {
    context.hints.push({
      severity: HintSeverity.Warning,
      message: "Empty where() clause has no effect",
      explanation: "A where() without a predicate returns all items unchanged.",
      suggestion: "Add a predicate or remove the where() call",
      impact: "low",
      category: "Code Quality",
      location: { start: node.start || 0, end: node.end || 0 },
    });
  }
}

/**
 * Check for select() optimizations
 */
function checkSelectOptimizations(node: MethodCallNode, context: VisitorContext): void {
  // select() after select()
  if (context.selectCount > 1) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Multiple select() calls could potentially be combined",
      explanation: "Sequential select() operations create multiple iterations. Consider combining projections.",
      impact: "low",
      category: "Performance",
    });
  }
}

/**
 * Check for subsetting optimizations
 */
function checkSubsettingOptimizations(node: MethodCallNode, context: VisitorContext): void {
  // Check what comes before first()/last()
  if (node.object.type === "MethodCall") {
    const prevMethod = (node.object as MethodCallNode).method.name;
    
    // first() after where() - common and efficient
    // But first() after first() is redundant
    if (prevMethod === "first" || prevMethod === "last" || prevMethod === "single") {
      context.hints.push({
        severity: HintSeverity.Warning,
        message: `Redundant ${node.method.name}() after ${prevMethod}()`,
        explanation: `${prevMethod}() already returns a single element, so ${node.method.name}() has no additional effect.`,
        suggestion: `Remove the second ${node.method.name}()`,
        impact: "low",
        category: "Code Quality",
        location: { start: node.start || 0, end: node.end || 0 },
      });
    }
  }
}

/**
 * Check for count() optimizations
 */
function checkCountOptimizations(node: MethodCallNode, context: VisitorContext): void {
  // This is checked at the pattern level in checkPatterns()
}

/**
 * Check for repeat() optimizations
 */
function checkRepeatOptimizations(node: MethodCallNode, context: VisitorContext): void {
  context.hints.push({
    severity: HintSeverity.Info,
    message: "repeat() iterates until no new items are found",
    explanation: "The repeat() function can be computationally expensive for deep or cyclic structures. Ensure proper termination.",
    impact: "medium",
    category: "Performance",
    location: { start: node.start || 0, end: node.end || 0 },
  });
}

/**
 * Check for common patterns that can be optimized
 */
function checkPatterns(expression: string, context: VisitorContext): void {
  // count() = 0 instead of empty()
  if (/\.count\(\)\s*=\s*0/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Use empty() instead of count() = 0",
      explanation: "empty() is more efficient as it can short-circuit after checking the first element.",
      suggestion: expression.replace(/\.count\(\)\s*=\s*0/g, ".empty()"),
      impact: "low",
      category: "Performance",
    });
  }

  // count() > 0 instead of exists()
  if (/\.count\(\)\s*>\s*0/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Use exists() instead of count() > 0",
      explanation: "exists() is more efficient as it can short-circuit after finding the first element.",
      suggestion: expression.replace(/\.count\(\)\s*>\s*0/g, ".exists()"),
      impact: "low",
      category: "Performance",
    });
  }

  // count() >= 1 instead of exists()
  if (/\.count\(\)\s*>=\s*1/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Use exists() instead of count() >= 1",
      explanation: "exists() is more efficient as it can short-circuit after finding the first element.",
      suggestion: expression.replace(/\.count\(\)\s*>=\s*1/g, ".exists()"),
      impact: "low",
      category: "Performance",
    });
  }

  // not().not() double negation
  if (/\.not\(\)\.not\(\)/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Warning,
      message: "Double negation not().not() is unnecessary",
      explanation: "Calling not() twice returns the original value.",
      suggestion: "Remove both not() calls",
      impact: "low",
      category: "Code Quality",
    });
  }

  // exists().not() instead of empty()
  if (/\.exists\(\)\.not\(\)/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Suggestion,
      message: "Use empty() instead of exists().not()",
      explanation: "empty() is more readable and semantically clearer.",
      suggestion: expression.replace(/\.exists\(\)\.not\(\)/g, ".empty()"),
      impact: "low",
      category: "Code Quality",
    });
  }

  // Deep nesting (more than 5 levels of method chaining)
  const chainDepth = (expression.match(/\.\w+\(/g) || []).length;
  if (chainDepth > 5) {
    context.hints.push({
      severity: HintSeverity.Info,
      message: "Deeply chained expression",
      explanation: `This expression has ${chainDepth} method calls. Consider breaking it into smaller parts for readability.`,
      impact: "low",
      category: "Code Quality",
    });
  }

  // Using .single() without error handling consideration
  if (/\.single\(\)/.test(expression)) {
    context.hints.push({
      severity: HintSeverity.Info,
      message: "single() throws an error if collection has 0 or >1 items",
      explanation: "Consider whether .first() or error handling is more appropriate for your use case.",
      category: "Code Quality",
    });
  }
}

/**
 * Check JIT compatibility
 */
function checkJitCompatibility(ast: ASTNode, result: AnalysisResult): void {
  const unsupportedFeatures: string[] = [];
  
  checkJitNode(ast, unsupportedFeatures);
  
  if (unsupportedFeatures.length > 0) {
    result.jitCompatible = false;
    result.jitIncompatibleReason = `Uses features not yet supported by JIT: ${unsupportedFeatures.join(", ")}`;
  }
}

/**
 * Check if a node is JIT-compatible
 */
function checkJitNode(node: ASTNode, unsupported: string[]): void {
  switch (node.type) {
    case "MethodCall":
      const methodCall = node as MethodCallNode;
      const methodName = methodCall.method.name;
      
      // List of JIT-supported methods (100% coverage as of v0.7.6)
      const jitSupported = new Set([
        // Collection
        "where", "first", "last", "single", "skip", "take", "tail",
        "count", "empty", "exists", "all", "select", "distinct", "repeat",
        // Existence
        "allTrue", "anyTrue", "allFalse", "anyFalse", "hasValue",
        "isDistinct", "subsetOf", "supersetOf",
        // Aggregate
        "sum", "min", "max", "avg", "aggregate",
        // Math
        "abs", "ceiling", "floor", "round", "truncate",
        "sqrt", "exp", "ln", "log", "power",
        // String
        "startsWith", "endsWith", "contains", "matches", "replace",
        "replaceMatches", "length", "substring", "upper", "lower",
        "trim", "split", "join", "indexOf", "toChars",
        // Type
        "ofType", "as", "is", "type",
        // Conversion
        "toString", "toInteger", "toDecimal", "toBoolean",
        "toDate", "toDateTime", "toTime", "toQuantity",
        // Conversion checks
        "convertsToString", "convertsToInteger", "convertsToDecimal",
        "convertsToBoolean", "convertsToDate", "convertsToDateTime",
        "convertsToTime", "convertsToQuantity",
        // Boolean
        "not", "iif",
        // DateTime
        "now", "today", "timeOfDay",
        // FHIR
        "extension", "hasExtension", "getValue", "resolve", "memberOf", "htmlChecks",
        // Navigation
        "children", "descendants",
        // Combining
        "union", "combine", "intersect", "exclude",
        // Encoding
        "encode", "decode",
        // Utility
        "trace", "defineVariable",
      ]);
      
      if (!jitSupported.has(methodName) && !unsupported.includes(methodName)) {
        unsupported.push(methodName);
      }
      
      checkJitNode(methodCall.object, unsupported);
      for (const arg of methodCall.arguments) {
        checkJitNode(arg, unsupported);
      }
      break;

    case "FunctionCall":
      const funcCall = node as FunctionCallNode;
      const funcName = funcCall.function.name;
      
      const jitFuncsSupported = new Set(["now", "today", "timeOfDay", "true", "false", "iif", "children", "descendants"]);
      
      if (!jitFuncsSupported.has(funcName) && !unsupported.includes(funcName)) {
        unsupported.push(`${funcName}()`);
      }
      
      for (const arg of funcCall.arguments) {
        checkJitNode(arg, unsupported);
      }
      break;

    default:
      // Check children recursively
      const anyNode = node as unknown as Record<string, unknown>;
      for (const key of Object.keys(anyNode)) {
        const value = anyNode[key];
        if (value && typeof value === "object" && "type" in value) {
          checkJitNode(value as ASTNode, unsupported);
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === "object" && "type" in item) {
              checkJitNode(item as ASTNode, unsupported);
            }
          }
        }
      }
  }
}

/**
 * Check for complexity issues
 */
function checkComplexity(expression: string, context: VisitorContext): void {
  const complexity = calculateComplexity(expression, context);
  
  if (complexity > 70) {
    context.hints.push({
      severity: HintSeverity.Warning,
      message: "High expression complexity",
      explanation: `This expression has a complexity score of ${complexity}/100. Consider simplifying or breaking it into smaller parts.`,
      impact: "medium",
      category: "Complexity",
    });
  } else if (complexity > 50) {
    context.hints.push({
      severity: HintSeverity.Info,
      message: "Moderate expression complexity",
      explanation: `This expression has a complexity score of ${complexity}/100.`,
      category: "Complexity",
    });
  }
}

/**
 * Calculate expression complexity score (0-100)
 */
function calculateComplexity(expression: string, context: VisitorContext): number {
  let score = 0;
  
  // Base complexity from length
  score += Math.min(expression.length / 10, 20);
  
  // Complexity from function calls
  for (const [func, count] of context.functionCalls) {
    // Expensive functions
    if (["descendants", "repeat", "aggregate"].includes(func)) {
      score += count * 10;
    }
    // Moderate functions
    else if (["where", "select", "all", "exists"].includes(func)) {
      score += count * 3;
    }
    // Simple functions
    else {
      score += count * 1;
    }
  }
  
  // Nesting depth
  score += context.depth * 2;
  
  // Cap at 100
  return Math.min(Math.round(score), 100);
}

/**
 * Get optimization hints for an expression (convenience function)
 */
export function getOptimizationHints(expression: string): OptimizationHint[] {
  return analyzeExpression(expression).hints;
}

/**
 * Check if expression is JIT-compatible
 */
export function isJitCompatible(expression: string): boolean {
  return analyzeExpression(expression).jitCompatible;
}

/**
 * Get complexity score for an expression
 */
export function getComplexityScore(expression: string): number {
  return analyzeExpression(expression).complexity;
}

/**
 * Format hints as readable text
 */
export function formatHints(hints: OptimizationHint[]): string {
  if (hints.length === 0) {
    return "No optimization hints.";
  }
  
  const lines: string[] = [];
  
  for (const hint of hints) {
    const icon = {
      [HintSeverity.Info]: "ℹ️",
      [HintSeverity.Suggestion]: "💡",
      [HintSeverity.Warning]: "⚠️",
      [HintSeverity.Critical]: "🚨",
    }[hint.severity];
    
    lines.push(`${icon} [${hint.category}] ${hint.message}`);
    lines.push(`   ${hint.explanation}`);
    if (hint.suggestion) {
      lines.push(`   Suggestion: ${hint.suggestion}`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}
