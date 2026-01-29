/**
 * FHIRPath Evaluator
 * 
 * Evaluates a FHIRPath AST against FHIR data.
 * This is a native TypeScript implementation.
 */

import type {
  ASTNode,
  BinaryOpNode,
  EmptySetNode,
  EnvVariableNode,
  ExpressionNode,
  FunctionCallNode,
  IdentifierNode,
  IndexerNode,
  IndexNode,
  LiteralNode,
  MemberAccessNode,
  MethodCallNode,
  ParenNode,
  ThisNode,
  TotalNode,
  TypeOpNode,
  TypeSpecifierNode,
  UnaryOpNode,
} from "../parser/ast.ts";

import type {
  EvaluationContext,
  EvaluatorOptions,
  EvaluatorState,
  FhirPathCollection,
} from "./types.ts";

import * as fn from "./functions.ts";

/**
 * Evaluator error
 */
export class EvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluatorError";
  }
}

/**
 * FHIRPath Evaluator
 */
export class FhirPathEvaluator {
  private state: EvaluatorState;

  constructor(
    private readonly ast: ExpressionNode,
    private readonly options: EvaluatorOptions = {},
  ) {
    this.state = this.createInitialState();
  }

  /**
   * Evaluate against a resource
   */
  evaluate(resource: unknown, context: EvaluationContext = {}): FhirPathCollection {
    // Reset state
    this.state = this.createInitialState();
    this.state.environment = {
      resource,
      rootResource: context.rootResource ?? resource,
      context: context.context ?? resource,
      ...context,
    };

    // Start with resource as initial collection
    this.state.current = resource != null ? [resource] : [];

    // Evaluate the AST
    return this.evalNode(this.ast.child);
  }

  private createInitialState(): EvaluatorState {
    return {
      current: [],
      environment: {},
      options: this.options,
      index: 0,
      total: 0,
      variables: new Map(),
    };
  }

  // ============================================================
  // Node evaluation dispatch
  // ============================================================

  private evalNode(node: ASTNode): FhirPathCollection {
    switch (node.type) {
      case "Literal":
        return this.evalLiteral(node as LiteralNode);
      case "Identifier":
        return this.evalIdentifier(node as IdentifierNode);
      case "MemberAccess":
        return this.evalMemberAccess(node as MemberAccessNode);
      case "FunctionCall":
        return this.evalFunctionCall(node as FunctionCallNode);
      case "MethodCall":
        return this.evalMethodCall(node as MethodCallNode);
      case "Indexer":
        return this.evalIndexer(node as IndexerNode);
      case "BinaryOp":
        return this.evalBinaryOp(node as BinaryOpNode);
      case "UnaryOp":
        return this.evalUnaryOp(node as UnaryOpNode);
      case "TypeOp":
        return this.evalTypeOp(node as TypeOpNode);
      case "This":
        return this.evalThis();
      case "Index":
        return this.evalIndex();
      case "Total":
        return this.evalTotal();
      case "EnvVariable":
        return this.evalEnvVariable(node as EnvVariableNode);
      case "EmptySet":
        return [];
      case "Paren":
        return this.evalNode((node as ParenNode).expression);
      default:
        throw new EvaluatorError(`Unknown node type: ${node.type}`);
    }
  }

  // ============================================================
  // Literal evaluation
  // ============================================================

  private evalLiteral(node: LiteralNode): FhirPathCollection {
    if (node.literalType === "null") return [];
    if (node.literalType === "quantity") {
      return [{ value: node.value as number, unit: node.unit }];
    }
    return [node.value];
  }

  // ============================================================
  // Identifier/Member evaluation
  // ============================================================

  private evalIdentifier(node: IdentifierNode): FhirPathCollection {
    const name = node.name;

    // Check for defined variables first
    if (this.state.variables.has(name)) {
      return this.state.variables.get(name)!;
    }

    // Navigate from current collection
    return this.getChildren(this.state.current, name);
  }

  private evalMemberAccess(node: MemberAccessNode): FhirPathCollection {
    const base = this.evalNode(node.object);
    return this.getChildren(base, node.member.name);
  }

  private getChildren(collection: FhirPathCollection, name: string): FhirPathCollection {
    const result: FhirPathCollection = [];

    for (const item of collection) {
      if (item == null || typeof item !== "object") continue;

      const obj = item as Record<string, unknown>;

      // Direct property access
      if (name in obj) {
        const value = obj[name];
        if (Array.isArray(value)) {
          result.push(...value);
        } else if (value != null) {
          result.push(value);
        }
      }

      // Check for polymorphic fields (value[x] pattern)
      // e.g., valueQuantity, valueString, etc.
      for (const key of Object.keys(obj)) {
        if (key.startsWith(name) && key !== name) {
          const suffix = key.slice(name.length);
          if (suffix[0] === suffix[0].toUpperCase()) {
            const value = obj[key];
            if (value != null) {
              if (Array.isArray(value)) {
                result.push(...value);
              } else {
                result.push(value);
              }
            }
          }
        }
      }
    }

    return result;
  }

  // ============================================================
  // Function/Method evaluation
  // ============================================================

  private evalFunctionCall(node: FunctionCallNode): FhirPathCollection {
    const name = node.function.name;
    const args = node.arguments;

    // Check user-defined functions first
    if (this.options.userInvocationTable?.[name]) {
      return this.callUserFunction(name, this.state.current, args);
    }

    // Built-in functions
    return this.callBuiltinFunction(name, this.state.current, args) as FhirPathCollection;
  }

  private evalMethodCall(node: MethodCallNode): FhirPathCollection {
    const base = this.evalNode(node.object);
    const name = node.method.name;
    const args = node.arguments;

    // Check user-defined functions first
    if (this.options.userInvocationTable?.[name]) {
      return this.callUserFunction(name, base, args);
    }

    // Check if base contains an object with this method (e.g., %factory.string())
    if (base.length === 1 && base[0] !== null && typeof base[0] === "object") {
      const obj = base[0] as Record<string, unknown>;
      if (typeof obj[name] === "function") {
        // Evaluate arguments
        const evaluatedArgs = args.map(arg => {
          const result = this.evalNode(arg);
          // Unwrap single values from collections
          return result.length === 1 ? result[0] : result;
        });
        
        // Call the method on the object
        const result = (obj[name] as (...args: unknown[]) => unknown)(...evaluatedArgs);
        return this.toCollection(result);
      }
    }

    return this.callBuiltinFunction(name, base, args) as FhirPathCollection;
  }

  private callUserFunction(name: string, collection: FhirPathCollection, args: ASTNode[]): FhirPathCollection {
    const userFn = this.options.userInvocationTable![name];
    const evaluatedArgs = args.map(arg => this.evalNode(arg));
    const result = userFn.fn(collection, ...evaluatedArgs);
    return this.toCollection(result);
  }

  private callBuiltinFunction(name: string, collection: FhirPathCollection, args: ASTNode[]): FhirPathCollection | Promise<FhirPathCollection> {
    switch (name) {
      // Existence
      case "empty":
        return [fn.empty(collection)];
      case "exists":
        if (args.length === 0) {
          return [fn.exists(collection)];
        }
        // exists with criteria
        return [collection.some((_, i) => {
          const saved = this.state.current;
          this.state.current = [collection[i]];
          this.state.index = i;
          const result = this.evalNode(args[0]);
          this.state.current = saved;
          return result.length > 0 && result[0] === true;
        })];
      case "all":
        return [collection.every((_, i) => {
          const saved = this.state.current;
          this.state.current = [collection[i]];
          this.state.index = i;
          const result = this.evalNode(args[0]);
          this.state.current = saved;
          return result.length > 0 && result[0] === true;
        })];
      case "allTrue":
        return [fn.allTrue(collection)];
      case "anyTrue":
        return [fn.anyTrue(collection)];
      case "allFalse":
        return [fn.allFalse(collection)];
      case "anyFalse":
        return [fn.anyFalse(collection)];
      case "hasValue":
        return [fn.hasValue(collection)];
      case "isDistinct":
        return [fn.isDistinct(collection)];
      case "subsetOf":
        return [fn.subsetOf(collection, this.evalNode(args[0]))];
      case "supersetOf":
        return [fn.supersetOf(collection, this.evalNode(args[0]))];

      // Filtering
      case "where":
        return collection.filter((_, i) => {
          const saved = this.state.current;
          this.state.current = [collection[i]];
          this.state.index = i;
          const result = this.evalNode(args[0]);
          this.state.current = saved;
          return result.length > 0 && result[0] === true;
        });
      case "select":
        return collection.flatMap((item, i) => {
          const saved = this.state.current;
          this.state.current = [item];
          this.state.index = i;
          const result = this.evalNode(args[0]);
          this.state.current = saved;
          return result;
        });
      case "distinct":
        return fn.distinct(collection);
      case "first":
        return fn.first(collection);
      case "last":
        return fn.last(collection);
      case "tail":
        return fn.tail(collection);
      case "take":
        return fn.take(collection, this.evalToNumber(args[0]));
      case "skip":
        return fn.skip(collection, this.evalToNumber(args[0]));
      case "single":
        return fn.single(collection);
      case "ofType":
        return this.evalOfType(collection, args[0] as unknown as TypeSpecifierNode);
      
      // as(Type) function - type conversion (returns empty if not convertible)
      case "as":
        if (args.length > 0) {
          return this.evalAsFunction(collection, args[0]);
        }
        return collection;
      
      // is(Type) function - type check (returns boolean)
      case "is":
        if (args.length > 0) {
          return this.evalIsFunction(collection, args[0]);
        }
        return [false];

      // Aggregate
      case "count":
        return [fn.count(collection)];
      case "sum":
        const s = fn.sum(collection);
        return s !== undefined ? [s] : [];
      case "min":
        const mi = fn.min(collection);
        return mi !== undefined ? [mi] : [];
      case "max":
        const ma = fn.max(collection);
        return ma !== undefined ? [ma] : [];
      case "avg":
        const av = fn.avg(collection);
        return av !== undefined ? [av] : [];
      case "aggregate":
        // aggregate(aggregator: expression, init?: value)
        // Iterates through the collection, evaluating aggregator for each item
        // $this = current item, $total = running total (starts at init or {})
        if (args.length === 0) {
          return [];
        }
        return this.evalAggregate(collection, args[0], args[1]);

      // Combining
      case "combine":
        return fn.combine(collection, this.evalNode(args[0]));
      case "union":
        return fn.union(collection, this.evalNode(args[0]));
      case "intersect":
        return fn.intersect(collection, this.evalNode(args[0]));
      case "exclude":
        return fn.exclude(collection, this.evalNode(args[0]));

      // String (operate on first element)
      case "indexOf":
        return this.mapSingle(collection, v => [fn.indexOf(String(v), this.evalToString(args[0]))]);
      case "substring":
        return this.mapSingle(collection, v => {
          const start = this.evalToNumber(args[0]);
          const len = args.length > 1 ? this.evalToNumber(args[1]) : undefined;
          return [fn.substring(String(v), start, len)];
        });
      case "startsWith":
        return this.mapSingle(collection, v => [fn.startsWith(String(v), this.evalToString(args[0]))]);
      case "endsWith":
        return this.mapSingle(collection, v => [fn.endsWith(String(v), this.evalToString(args[0]))]);
      case "contains":
        return this.mapSingle(collection, v => [fn.contains(String(v), this.evalToString(args[0]))]);
      case "upper":
        return this.mapSingle(collection, v => [fn.upper(String(v))]);
      case "lower":
        return this.mapSingle(collection, v => [fn.lower(String(v))]);
      case "replace":
        return this.mapSingle(collection, v => [fn.replace(String(v), this.evalToString(args[0]), this.evalToString(args[1]))]);
      case "matches":
        return this.mapSingle(collection, v => [fn.matches(String(v), this.evalToString(args[0]))]);
      case "replaceMatches":
        return this.mapSingle(collection, v => [fn.replaceMatches(String(v), this.evalToString(args[0]), this.evalToString(args[1]))]);
      case "length":
        return this.mapSingle(collection, v => [fn.length(String(v))]);
      case "toChars":
        return this.mapSingle(collection, v => fn.toChars(String(v)));
      case "split":
        return this.mapSingle(collection, v => fn.split(String(v), this.evalToString(args[0])));
      case "join":
        return [fn.join(collection, args.length > 0 ? this.evalToString(args[0]) : undefined)];
      case "trim":
        return this.mapSingle(collection, v => [fn.trim(String(v))]);

      // Math
      case "abs":
        return this.mapSingle(collection, v => [fn.abs(Number(v))]);
      case "ceiling":
        return this.mapSingle(collection, v => [fn.ceiling(Number(v))]);
      case "floor":
        return this.mapSingle(collection, v => [fn.floor(Number(v))]);
      case "round":
        return this.mapSingle(collection, v => {
          const precision = args.length > 0 ? this.evalToNumber(args[0]) : undefined;
          return [fn.round(Number(v), precision)];
        });
      case "truncate":
        return this.mapSingle(collection, v => [fn.truncate(Number(v))]);
      case "exp":
        return this.mapSingle(collection, v => [fn.exp(Number(v))]);
      case "ln":
        return this.mapSingle(collection, v => [fn.ln(Number(v))]);
      case "log":
        return this.mapSingle(collection, v => [fn.log(Number(v), this.evalToNumber(args[0]))]);
      case "power":
        return this.mapSingle(collection, v => [fn.power(Number(v), this.evalToNumber(args[0]))]);
      case "sqrt":
        return this.mapSingle(collection, v => [fn.sqrt(Number(v))]);

      // Conversion
      case "toInteger":
        return this.mapSingle(collection, v => {
          const r = fn.toInteger(v);
          return r !== undefined ? [r] : [];
        });
      case "toDecimal":
        return this.mapSingle(collection, v => {
          const r = fn.toDecimal(v);
          return r !== undefined ? [r] : [];
        });
      case "toString":
        return this.mapSingle(collection, v => {
          const r = fn.toString(v);
          return r !== undefined ? [r] : [];
        });
      case "toBoolean":
        return this.mapSingle(collection, v => {
          const r = fn.toBoolean(v);
          return r !== undefined ? [r] : [];
        });

      // Logic
      case "not":
        return this.mapSingle(collection, v => [fn.not(v as boolean)]);
      case "iif":
        const cond = this.evalNode(args[0]);
        if (cond.length > 0 && cond[0] === true) {
          return this.evalNode(args[1]);
        } else if (args.length > 2) {
          return this.evalNode(args[2]);
        }
        return [];

      // Utility
      case "today":
        return [fn.today()];
      case "now":
        return [fn.now()];
      case "timeOfDay":
        return [fn.timeOfDay()];

      // Trace (debugging)
      case "trace":
        if (this.options.traceFn) {
          const label = args.length > 0 ? this.evalToString(args[0]) : "";
          this.options.traceFn(collection, label);
        }
        return collection;

      // Variable definition
      case "defineVariable":
        const varName = this.evalToString(args[0]);
        const varValue = args.length > 1 ? this.evalNode(args[1]) : collection;
        this.state.variables.set(varName, varValue);
        return collection;

      // FHIR-specific functions
      case "extension":
        return this.evalExtension(collection, args);
      
      case "hasExtension":
        return [this.evalExtension(collection, args).length > 0];

      case "getValue":
        return this.evalGetValue(collection);

      case "resolve":
        return this.evalResolve(collection);

      case "memberOf":
        // memberOf(valueSet) checks if a code is a member of a ValueSet
        if (args.length > 0) {
          return this.evalMemberOf(collection, args[0]);
        }
        return [];

      case "htmlChecks":
        return this.evalHtmlChecks(collection);

      // Tree navigation functions
      case "descendants":
        return this.evalDescendants(collection);
      
      case "children":
        return this.evalChildren(collection);

      // Additional utility functions
      case "repeat":
        return this.evalRepeat(collection, args);

      // Note: allTrue, anyTrue, allFalse, anyFalse, subsetOf, supersetOf
      // are already handled above using fn.* implementations

      case "isDistinct":
        const seen = new Set<string>();
        for (const item of collection) {
          const key = JSON.stringify(item);
          if (seen.has(key)) return [false];
          seen.add(key);
        }
        return [true];

      case "matches":
        const pattern = this.evalToString(args[0]);
        const regex = new RegExp(pattern);
        return this.mapSingle(collection, v => 
          typeof v === "string" ? [regex.test(v)] : []
        );

      case "replaceMatches":
        const replacePattern = this.evalToString(args[0]);
        const replacement = this.evalToString(args[1]);
        const replaceRegex = new RegExp(replacePattern, "g");
        return this.mapSingle(collection, v => 
          typeof v === "string" ? [v.replace(replaceRegex, replacement)] : []
        );

      case "indexOf":
        const searchStr = this.evalToString(args[0]);
        return this.mapSingle(collection, v => 
          typeof v === "string" ? [v.indexOf(searchStr)] : []
        );

      case "split":
        const separator = this.evalToString(args[0]);
        return this.mapSingle(collection, v => 
          typeof v === "string" ? v.split(separator) : []
        );

      case "trim":
        return this.mapSingle(collection, v => 
          typeof v === "string" ? [v.trim()] : []
        );

      case "encode":
        const encoding = args.length > 0 ? this.evalToString(args[0]) : "urlbase64";
        return this.mapSingle(collection, v => {
          if (typeof v !== "string") return [];
          if (encoding === "urlbase64" || encoding === "base64") {
            return [btoa(v)];
          }
          if (encoding === "hex") {
            return [Array.from(new TextEncoder().encode(v)).map(b => b.toString(16).padStart(2, "0")).join("")];
          }
          return [v];
        });

      case "decode":
        const decoding = args.length > 0 ? this.evalToString(args[0]) : "urlbase64";
        return this.mapSingle(collection, v => {
          if (typeof v !== "string") return [];
          if (decoding === "urlbase64" || decoding === "base64") {
            try { return [atob(v)]; } catch { return []; }
          }
          if (decoding === "hex") {
            // Decode hex string back to text
            try {
              const bytes: number[] = [];
              for (let i = 0; i < v.length; i += 2) {
                bytes.push(parseInt(v.substring(i, i + 2), 16));
              }
              return [new TextDecoder().decode(new Uint8Array(bytes))];
            } catch { return []; }
          }
          return [v];
        });

      case "toChars":
        return this.mapSingle(collection, v => 
          typeof v === "string" ? v.split("") : []
        );

      case "convertsToString":
        return [collection.every(v => v != null)];

      case "convertsToInteger":
        return [collection.every(v => {
          if (typeof v === "number") return Number.isInteger(v);
          if (typeof v === "string") return /^-?\d+$/.test(v);
          if (typeof v === "boolean") return true;
          return false;
        })];

      case "convertsToDecimal":
        return [collection.every(v => {
          if (typeof v === "number") return true;
          if (typeof v === "string") return !isNaN(parseFloat(v));
          if (typeof v === "boolean") return true;
          return false;
        })];

      case "convertsToBoolean":
        return [collection.every(v => 
          typeof v === "boolean" || 
          v === "true" || v === "false" ||
          v === 1 || v === 0
        )];

      default:
        throw new EvaluatorError(`Unknown function: ${name}`);
    }
  }

  private evalOfType(collection: FhirPathCollection, typeSpec: TypeSpecifierNode): FhirPathCollection {
    const typeName = typeSpec.typeName;
    return collection.filter(item => {
      if (item == null || typeof item !== "object") return false;
      const obj = item as Record<string, unknown>;
      // Check resourceType for FHIR resources
      if ("resourceType" in obj) {
        return obj.resourceType === typeName;
      }
      // Check type derivation if available
      if (this.options.isDerivedResourceFn) {
        const rt = obj.resourceType as string | undefined;
        if (rt) {
          return this.options.isDerivedResourceFn(rt, typeName);
        }
      }
      return false;
    });
  }

  /**
   * Evaluate as(Type) function - type conversion
   * Returns the value if it matches the type, otherwise empty
   */
  private evalAsFunction(collection: FhirPathCollection, arg: ASTNode): FhirPathCollection {
    // Get the type name from the argument
    const typeName = this.getTypeNameFromArg(arg);
    if (!typeName) return [];
    
    return collection.filter(item => this.isType(item, typeName));
  }

  /**
   * Evaluate is(Type) function - type check
   * Returns true/false for each item
   */
  private evalIsFunction(collection: FhirPathCollection, arg: ASTNode): FhirPathCollection {
    const typeName = this.getTypeNameFromArg(arg);
    if (!typeName) return [false];
    
    if (collection.length === 0) return [];
    return [collection.every(item => this.isType(item, typeName))];
  }

  /**
   * Extract type name from function argument
   */
  private getTypeNameFromArg(arg: ASTNode): string | undefined {
    // The argument could be an Identifier node with the type name
    if (arg.type === "Identifier") {
      return (arg as IdentifierNode).name;
    }
    // Or it could be a TypeSpecifier node
    if (arg.type === "TypeSpecifier") {
      return (arg as TypeSpecifierNode).typeName;
    }
    // Handle string literal (like 'uri')
    if (arg.type === "Literal" && (arg as LiteralNode).literalType === "string") {
      return (arg as LiteralNode).value as string;
    }
    return undefined;
  }

  // ============================================================
  // FHIR-specific function evaluation
  // ============================================================

  /**
   * Evaluate memberOf(valueSet) function
   * Checks if a code/coding is a member of a ValueSet
   * 
   * Returns a Promise if terminologyService is configured (async mode required)
   * Returns empty array if no terminology service is available
   */
  private evalMemberOf(collection: FhirPathCollection, valueSetArg: ASTNode): FhirPathCollection | Promise<FhirPathCollection> {
    // Get the ValueSet URL from the argument
    const valueSetResult = this.evalNode(valueSetArg);
    if (valueSetResult.length === 0) return [];
    const valueSetUrl = String(valueSetResult[0]);

    // Check if we have a terminology service
    const terminologyService = this.options.terminologyService;
    const terminologiesProxy = this.state.environment.terminologies;
    
    if (!terminologyService && !terminologiesProxy) {
      // No terminology service configured - return empty (sync)
      // This matches fhirpath.js behavior when no terminologyUrl is provided
      return [];
    }

    // Check if async mode is enabled
    if (!this.options.async) {
      // Async not enabled - throw error like fhirpath.js does
      throw new EvaluatorError(
        "memberOf() requires async evaluation. Set options.async = true or options.async = 'always'"
      );
    }

    // Async evaluation with terminology service
    const service = terminologyService ?? terminologiesProxy?.getService();
    if (!service) return [];

    // Check each item in the collection
    const checkPromises = collection.map(async (item) => {
      if (item == null) return false;
      
      // Convert item to CodedValue format
      const coded = this.toCodedValue(item);
      if (!coded) return false;

      try {
        return await service.memberOf(coded, valueSetUrl);
      } catch {
        return false;
      }
    });

    // Return Promise that resolves when all checks are done
    return Promise.all(checkPromises).then((results) => {
      // memberOf returns true if ALL items are members
      // or if collection is empty
      if (collection.length === 0) return [];
      const allMembers = results.every(r => r === true);
      return [allMembers];
    });
  }

  /**
   * Convert a FHIR value to a CodedValue for terminology operations
   */
  private toCodedValue(item: unknown): { system?: string; code: string; version?: string } | undefined {
    if (typeof item === "string") {
      // Simple code string
      return { code: item };
    }
    
    if (typeof item !== "object" || item === null) return undefined;
    
    const obj = item as Record<string, unknown>;
    
    // Coding
    if ("code" in obj && typeof obj.code === "string") {
      return {
        system: obj.system as string | undefined,
        code: obj.code,
        version: obj.version as string | undefined,
      };
    }
    
    // CodeableConcept - use first coding
    if ("coding" in obj && Array.isArray(obj.coding) && obj.coding.length > 0) {
      const firstCoding = obj.coding[0] as Record<string, unknown>;
      if (firstCoding && typeof firstCoding.code === "string") {
        return {
          system: firstCoding.system as string | undefined,
          code: firstCoding.code,
          version: firstCoding.version as string | undefined,
        };
      }
    }
    
    return undefined;
  }

  /**
   * Evaluate aggregate(aggregator, init?) function
   * Iterates through collection, evaluating aggregator with $this and $total
   * $this = current item, $total = running total (starts at init or empty)
   */
  private evalAggregate(collection: FhirPathCollection, aggregatorExpr: ASTNode, initExpr?: ASTNode): FhirPathCollection {
    // Get initial value (default to undefined)
    let total: unknown = initExpr ? this.evalNode(initExpr)[0] : undefined;
    
    // Save the current context
    const savedThis = this.state.current;
    const savedTotal = this.state.total;
    
    for (let i = 0; i < collection.length; i++) {
      const item = collection[i];
      
      // Set $this to current item
      this.state.current = [item];
      // Set $total to running total (used by evalTotal())
      this.state.total = total;
      
      // Evaluate the aggregator expression
      const result = this.evalNode(aggregatorExpr);
      
      // Update total with result
      total = result.length > 0 ? result[0] : total;
    }
    
    // Restore context
    this.state.current = savedThis;
    this.state.total = savedTotal;
    
    return total !== undefined ? [total] : [];
  }

  /**
   * Evaluate resolve() function
   * Resolves FHIR references to actual resources
   */
  private evalResolve(collection: FhirPathCollection): FhirPathCollection | Promise<FhirPathCollection> {
    const resolver = this.options.referenceResolver;
    
    // If no resolver configured, try to resolve within Bundle context
    if (!resolver) {
      return this.resolveInBundle(collection);
    }
    
    // Use configured resolver
    const results: (unknown | Promise<unknown>)[] = [];
    let hasPromise = false;
    
    for (const item of collection) {
      const ref = this.extractReference(item);
      if (!ref) continue;
      
      const resolved = resolver.resolve(ref, this.state.environment);
      if (resolved instanceof Promise) {
        hasPromise = true;
      }
      results.push(resolved);
    }
    
    if (hasPromise) {
      return Promise.all(results).then(resolved => 
        resolved.filter(r => r !== undefined && r !== null)
      );
    }
    
    return results.filter(r => r !== undefined && r !== null) as FhirPathCollection;
  }

  /**
   * Extract reference string from a FHIR Reference or string
   */
  private extractReference(item: unknown): string | undefined {
    if (typeof item === "string") {
      return item;
    }
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      // FHIR Reference type
      if ("reference" in obj && typeof obj.reference === "string") {
        return obj.reference;
      }
    }
    return undefined;
  }

  /**
   * Resolve references within a Bundle context
   * Looks for resources in %resource if it's a Bundle
   */
  private resolveInBundle(collection: FhirPathCollection): FhirPathCollection {
    const bundle = this.state.environment.resource;
    if (!bundle || typeof bundle !== "object") {
      return [];
    }
    
    const bundleObj = bundle as Record<string, unknown>;
    if (bundleObj.resourceType !== "Bundle" || !Array.isArray(bundleObj.entry)) {
      return [];
    }
    
    const entries = bundleObj.entry as Array<Record<string, unknown>>;
    const results: FhirPathCollection = [];
    
    for (const item of collection) {
      const ref = this.extractReference(item);
      if (!ref) continue;
      
      // Try to find matching entry
      for (const entry of entries) {
        const resource = entry.resource as Record<string, unknown> | undefined;
        if (!resource) continue;
        
        // Check fullUrl match
        if (entry.fullUrl === ref) {
          results.push(resource);
          break;
        }
        
        // Check relative reference match (e.g., "Patient/123")
        const resourceType = resource.resourceType as string | undefined;
        const resourceId = resource.id as string | undefined;
        if (resourceType && resourceId && ref === `${resourceType}/${resourceId}`) {
          results.push(resource);
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Evaluate htmlChecks() function
   * Validates that XHTML content follows FHIR rules for narrative
   */
  private evalHtmlChecks(collection: FhirPathCollection): FhirPathCollection {
    for (const item of collection) {
      if (typeof item !== "string") {
        continue;
      }
      
      // Perform XHTML validation checks
      if (!this.validateXhtml(item)) {
        return [false];
      }
    }
    
    return [true];
  }

  /**
   * Validate XHTML content according to FHIR rules
   * - No scripts allowed
   * - No event handlers allowed
   * - No javascript/data URLs
   * - Limited dangerous elements
   */
  private validateXhtml(html: string): boolean {
    // Check for script tags (not allowed)
    if (/<script[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for event handlers (not allowed) - match only in attributes
    if (/\s+on[a-z]+\s*=/i.test(html)) {
      return false;
    }
    
    // Check for javascript: URLs (not allowed)
    if (/javascript:/i.test(html)) {
      return false;
    }
    
    // Check for data: URLs (not allowed)
    if (/data:/i.test(html)) {
      return false;
    }
    
    // Check for external stylesheets (not allowed)
    if (/<link[^>]*rel\s*=\s*["']stylesheet/i.test(html)) {
      return false;
    }
    
    // Check for style elements (not allowed in FHIR narrative)
    if (/<style[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for base tags (not allowed)
    if (/<base[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for form elements (not allowed)
    if (/<form[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for input elements (not allowed)
    if (/<input[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for iframe/frame/frameset (not allowed)
    if (/<(i?frame|frameset)[\s>]/i.test(html)) {
      return false;
    }
    
    // Check for object/embed/applet (not allowed)
    if (/<(object|embed|applet)[\s>]/i.test(html)) {
      return false;
    }
    
    // Basic tag balance check using a stack approach
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
    
    const voidElements = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr"
    ]);
    
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      // Skip void elements and self-closing tags
      if (voidElements.has(tagName) || fullTag.endsWith("/>")) {
        continue;
      }
      
      // Check if it's an opening or closing tag
      if (fullTag.startsWith("</")) {
        // Closing tag
        if (tagStack.length === 0 || tagStack[tagStack.length - 1] !== tagName) {
          return false; // Unbalanced
        }
        tagStack.pop();
      } else {
        // Opening tag
        tagStack.push(tagName);
      }
    }
    
    // All tags should be closed
    return tagStack.length === 0;
  }

  /**
   * Evaluate extension(url) function
   * Filters extensions by URL from the current collection
   */
  private evalExtension(collection: FhirPathCollection, args: ASTNode[]): FhirPathCollection {
    // Get the URL to filter by
    const urlArg = args.length > 0 ? this.evalNode(args[0]) : [];
    const url = urlArg.length > 0 ? String(urlArg[0]) : undefined;

    const results: FhirPathCollection = [];

    for (const item of collection) {
      if (item == null || typeof item !== "object") continue;
      
      const obj = item as Record<string, unknown>;
      
      // Get extensions from the item
      const extensions = obj.extension as Array<Record<string, unknown>> | undefined;
      
      if (!extensions || !Array.isArray(extensions)) continue;

      if (url) {
        // Filter by URL
        for (const ext of extensions) {
          if (ext && ext.url === url) {
            results.push(ext);
          }
        }
      } else {
        // Return all extensions
        results.push(...extensions);
      }
    }

    return results;
  }

  /**
   * Evaluate descendants() function
   * Returns all descendants of the input elements
   */
  private evalDescendants(collection: FhirPathCollection): FhirPathCollection {
    const results: FhirPathCollection = [];
    const seen = new Set<unknown>();

    const collectDescendants = (item: unknown) => {
      if (item == null || typeof item !== "object") return;
      if (seen.has(item)) return;
      seen.add(item);

      if (Array.isArray(item)) {
        for (const elem of item) {
          results.push(elem);
          collectDescendants(elem);
        }
      } else {
        const obj = item as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
          if (key.startsWith("_")) continue; // Skip metadata keys
          const value = obj[key];
          if (value != null) {
            if (Array.isArray(value)) {
              for (const elem of value) {
                results.push(elem);
                collectDescendants(elem);
              }
            } else {
              results.push(value);
              collectDescendants(value);
            }
          }
        }
      }
    };

    for (const item of collection) {
      collectDescendants(item);
    }

    return results;
  }

  /**
   * Evaluate children() function
   * Returns immediate children of the input elements
   */
  private evalChildren(collection: FhirPathCollection): FhirPathCollection {
    const results: FhirPathCollection = [];

    for (const item of collection) {
      if (item == null || typeof item !== "object") continue;

      if (Array.isArray(item)) {
        results.push(...item);
      } else {
        const obj = item as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
          if (key.startsWith("_")) continue; // Skip metadata keys
          const value = obj[key];
          if (value != null) {
            if (Array.isArray(value)) {
              results.push(...value);
            } else {
              results.push(value);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Evaluate repeat(expression) function
   * Repeatedly evaluates expression and collects results until no new items
   */
  private evalRepeat(collection: FhirPathCollection, args: ASTNode[]): FhirPathCollection {
    if (args.length === 0) return collection;

    const results: FhirPathCollection = [];
    const seen = new Set<string>();
    let current = collection;

    // Limit iterations to prevent infinite loops
    const maxIterations = 1000;
    let iterations = 0;

    while (current.length > 0 && iterations < maxIterations) {
      iterations++;
      const newItems: FhirPathCollection = [];

      for (const item of current) {
        const key = JSON.stringify(item);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);

        // Evaluate expression with item as context
        // Save and restore current collection
        const savedCurrent = this.state.current;
        this.state.current = [item];
        const evalResult = this.evalNode(args[0]);
        this.state.current = savedCurrent;

        for (const r of evalResult) {
          const rKey = JSON.stringify(r);
          if (!seen.has(rKey)) {
            newItems.push(r);
          }
        }
      }

      current = newItems;
    }

    return results;
  }

  /**
   * Evaluate getValue() function
   * Returns the value of an element (handles value[x] pattern)
   */
  private evalGetValue(collection: FhirPathCollection): FhirPathCollection {
    const results: FhirPathCollection = [];

    // Value property prefixes in FHIR
    const valueProps = [
      "valueString", "valueBoolean", "valueInteger", "valueDecimal",
      "valueDate", "valueDateTime", "valueTime", "valueInstant",
      "valueUri", "valueUrl", "valueCode", "valueOid", "valueId",
      "valueUuid", "valueMarkdown", "valueBase64Binary", "valueCanonical",
      "valueQuantity", "valueCoding", "valueCodeableConcept", "valueReference",
      "valueIdentifier", "valuePeriod", "valueRange", "valueRatio",
      "valueAttachment", "valueAnnotation", "valueAddress", "valueContactPoint",
      "valueHumanName", "valueTiming", "valueMoney", "valueAge", "valueCount",
      "valueDistance", "valueDuration", "valueSampledData", "valueSignature",
      "valueContactDetail", "valueContributor", "valueDataRequirement",
      "valueExpression", "valueParameterDefinition", "valueRelatedArtifact",
      "valueTriggerDefinition", "valueUsageContext", "valueDosage", "valueMeta",
    ];

    for (const item of collection) {
      if (item == null || typeof item !== "object") continue;
      
      const obj = item as Record<string, unknown>;
      
      // Check each value property
      for (const prop of valueProps) {
        if (prop in obj && obj[prop] !== undefined) {
          results.push(obj[prop]);
          break; // Only one value[x] per element
        }
      }
      
      // Also check for simple "value" property
      if ("value" in obj && obj.value !== undefined) {
        results.push(obj.value);
      }
    }

    return results;
  }

  // ============================================================
  // Indexer evaluation
  // ============================================================

  private evalIndexer(node: IndexerNode): FhirPathCollection {
    const base = this.evalNode(node.object);
    const index = this.evalNode(node.index);

    if (index.length !== 1 || typeof index[0] !== "number") {
      throw new EvaluatorError("Indexer requires a single integer");
    }

    const idx = index[0] as number;
    if (idx < 0 || idx >= base.length) {
      return [];
    }

    return [base[idx]];
  }

  // ============================================================
  // Binary operator evaluation
  // ============================================================

  private evalBinaryOp(node: BinaryOpNode): FhirPathCollection {
    const op = node.operator;

    // Short-circuit evaluation for logical operators
    if (op === "and") {
      const left = this.evalNode(node.left);
      if (left.length === 0) return [];
      if (left[0] === false) return [false];
      const right = this.evalNode(node.right);
      if (right.length === 0) return [];
      return [right[0] === true];
    }

    if (op === "or") {
      const left = this.evalNode(node.left);
      if (left.length > 0 && left[0] === true) return [true];
      const right = this.evalNode(node.right);
      if (right.length === 0 && left.length === 0) return [];
      return [right[0] === true || left[0] === true];
    }

    if (op === "xor") {
      const left = this.evalNode(node.left);
      const right = this.evalNode(node.right);
      if (left.length === 0 || right.length === 0) return [];
      return [(left[0] === true) !== (right[0] === true)];
    }

    if (op === "implies") {
      const left = this.evalNode(node.left);
      if (left.length === 0) return [true];
      if (left[0] === false) return [true];
      const right = this.evalNode(node.right);
      if (right.length === 0) return [];
      return [right[0] === true];
    }

    const left = this.evalNode(node.left);
    const right = this.evalNode(node.right);

    // Union
    if (op === "|") {
      return fn.union(left, right);
    }

    // Membership
    if (op === "in") {
      if (left.length === 0) return [];
      return [right.some(r => this.equals(left[0], r))];
    }

    if (op === "contains") {
      if (right.length === 0) return [];
      return [left.some(l => this.equals(l, right[0]))];
    }

    // Equality
    if (op === "=") {
      if (left.length === 0 || right.length === 0) return [];
      return [this.equals(left[0], right[0])];
    }

    if (op === "!=") {
      if (left.length === 0 || right.length === 0) return [];
      return [!this.equals(left[0], right[0])];
    }

    if (op === "~") {
      if (left.length === 0 || right.length === 0) return [];
      return [this.equivalent(left[0], right[0])];
    }

    if (op === "!~") {
      if (left.length === 0 || right.length === 0) return [];
      return [!this.equivalent(left[0], right[0])];
    }

    // Comparison
    if (op === "<" || op === ">" || op === "<=" || op === ">=") {
      if (left.length === 0 || right.length === 0) return [];
      const cmp = this.compare(left[0], right[0]);
      if (cmp === undefined) return [];
      switch (op) {
        case "<": return [cmp < 0];
        case ">": return [cmp > 0];
        case "<=": return [cmp <= 0];
        case ">=": return [cmp >= 0];
      }
    }

    // Arithmetic
    if (op === "+" || op === "-" || op === "*" || op === "/" || op === "div" || op === "mod") {
      if (left.length === 0 || right.length === 0) return [];
      const l = left[0];
      const r = right[0];

      // String concatenation with +
      if (op === "+" && (typeof l === "string" || typeof r === "string")) {
        return [String(l) + String(r)];
      }

      const ln = Number(l);
      const rn = Number(r);

      switch (op) {
        case "+": return [ln + rn];
        case "-": return [ln - rn];
        case "*": return [ln * rn];
        case "/": return rn === 0 ? [] : [ln / rn];
        case "div": return rn === 0 ? [] : [Math.trunc(ln / rn)];
        case "mod": return rn === 0 ? [] : [ln % rn];
      }
    }

    // & is string concatenation (handles empty collections)
    if (op === "&") {
      const l = left.length > 0 ? String(left[0]) : "";
      const r = right.length > 0 ? String(right[0]) : "";
      return [l + r];
    }

    throw new EvaluatorError(`Unknown binary operator: ${op}`);
  }

  // ============================================================
  // Unary operator evaluation
  // ============================================================

  private evalUnaryOp(node: UnaryOpNode): FhirPathCollection {
    const operand = this.evalNode(node.operand);
    if (operand.length === 0) return [];

    const value = operand[0];
    if (typeof value !== "number") {
      throw new EvaluatorError("Unary operator requires a number");
    }

    switch (node.operator) {
      case "+": return [+value];
      case "-": return [-value];
      default:
        throw new EvaluatorError(`Unknown unary operator: ${node.operator}`);
    }
  }

  // ============================================================
  // Type operator evaluation
  // ============================================================

  private evalTypeOp(node: TypeOpNode): FhirPathCollection {
    const value = this.evalNode(node.expression);
    if (value.length === 0) return [];

    const item = value[0];
    const typeName = node.targetType.typeName;

    if (node.operator === "is") {
      return [this.isType(item, typeName)];
    }

    if (node.operator === "as") {
      return this.isType(item, typeName) ? value : [];
    }

    throw new EvaluatorError(`Unknown type operator: ${node.operator}`);
  }

  private isType(value: unknown, typeName: string): boolean {
    if (value == null) return false;

    // Primitive types
    switch (typeName) {
      case "Boolean": return typeof value === "boolean";
      case "String": return typeof value === "string";
      case "Integer": return typeof value === "number" && Number.isInteger(value);
      case "Decimal": return typeof value === "number";
    }

    // FHIR resource types
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if ("resourceType" in obj) {
        if (obj.resourceType === typeName) return true;
        if (this.options.isDerivedResourceFn) {
          return this.options.isDerivedResourceFn(obj.resourceType as string, typeName);
        }
      }
    }

    return false;
  }

  // ============================================================
  // Special nodes
  // ============================================================

  private evalThis(): FhirPathCollection {
    return this.state.current;
  }

  private evalIndex(): FhirPathCollection {
    return [this.state.index];
  }

  private evalTotal(): FhirPathCollection {
    if (this.state.total === undefined) return [];
    return [this.state.total];
  }

  private evalEnvVariable(node: EnvVariableNode): FhirPathCollection {
    const name = node.name;
    const value = this.state.environment[name];
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  // ============================================================
  // Helpers
  // ============================================================

  private evalToNumber(node: ASTNode): number {
    const result = this.evalNode(node);
    if (result.length !== 1 || typeof result[0] !== "number") {
      throw new EvaluatorError("Expected a single number");
    }
    return result[0] as number;
  }

  private evalToString(node: ASTNode): string {
    const result = this.evalNode(node);
    if (result.length !== 1) {
      throw new EvaluatorError("Expected a single value");
    }
    return String(result[0]);
  }

  private mapSingle(collection: FhirPathCollection, fn: (v: unknown) => FhirPathCollection): FhirPathCollection {
    if (collection.length === 0) return [];
    if (collection.length !== 1) {
      throw new EvaluatorError("Expected single value");
    }
    return fn(collection[0]);
  }

  private toCollection(value: unknown): FhirPathCollection {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  /**
   * Deep structural equality without JSON.stringify - O(n) but much faster
   */
  private equals(a: unknown, b: unknown): boolean {
    // Fast path: strict equality
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    // Primitives already checked above
    if (typeof a !== "object") return false;
    
    // Arrays
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.equals(a[i], b[i])) return false;
      }
      return true;
    }
    
    // Objects
    if (Array.isArray(b)) return false;
    
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!(key in bObj)) return false;
      if (!this.equals(aObj[key], bObj[key])) return false;
    }
    
    return true;
  }

  /**
   * Equivalence comparison (case-insensitive for strings)
   */
  private equivalent(a: unknown, b: unknown): boolean {
    // Case-insensitive string comparison
    if (typeof a === "string" && typeof b === "string") {
      return a.toLowerCase() === b.toLowerCase();
    }
    return this.equals(a, b);
  }

  private compare(a: unknown, b: unknown): number | undefined {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    return undefined;
  }
}

/**
 * Convenience function to evaluate a FHIRPath expression
 */
export function evaluateFhirPath(
  ast: ExpressionNode,
  resource: unknown,
  context: EvaluationContext = {},
  options: EvaluatorOptions = {},
): FhirPathCollection {
  const evaluator = new FhirPathEvaluator(ast, options);
  return evaluator.evaluate(resource, context);
}
