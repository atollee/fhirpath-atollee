/**
 * Type definitions for @atollee/fhirpath-atollee
 * 
 * These types are designed to be compatible with fhirpath.js while 
 * providing better TypeScript support.
 */

/**
 * FHIRPath expression path with optional base type
 */
export interface Path {
  /** Base resource type (e.g., "Patient", "Observation") */
  base?: string;
  /** The FHIRPath expression */
  expression: string;
}

/**
 * FHIR model information for type checking and navigation
 */
export interface Model {
  /** Model version: 'r6', 'r5', 'r4', 'stu3', or 'dstu2' */
  version: 'r6' | 'r5' | 'r4' | 'stu3' | 'dstu2';

  /** 
   * Hash of resource element paths that are choice types.
   * e.g., { "Observation.value": ["Quantity", "CodeableConcept", "string", ...] }
   */
  choiceTypePaths: Record<string, string[]>;

  /**
   * Hash from paths to the path where their content is defined.
   * e.g., { "Questionnaire.item.item": "Questionnaire.item" }
   */
  pathsDefinedElsewhere: Record<string, string>;

  /**
   * Mapping data types to parent data types.
   */
  type2Parent: Record<string, string>;

  /**
   * Mapping paths to data types.
   * Can be a simple string or an object with code and refType for references.
   */
  path2Type: Record<string, string | { code: string; refType: string[] }>;

  /**
   * Optional score/weight configuration for weight() function
   */
  score?: {
    propertyURI?: string;
    extensionURI: string[];
  };
}

/**
 * Evaluation context variables
 */
export interface EvaluationContext {
  /** The current resource being evaluated */
  resource?: unknown;
  /** The root resource (for nested evaluations) */
  rootResource?: unknown;
  /** The evaluation context (for constraints) */
  context?: unknown;
  /** %terminologies proxy (set automatically when terminologyService is provided) */
  terminologies?: unknown;
  /** %factory for creating FHIR types (set automatically) */
  factory?: unknown;
  /** Additional custom variables */
  [key: string]: unknown;
}

/**
 * Parameter type specification for user-defined functions
 */
export type ParamType = 
  | 'Expr'           // Unevaluated expression (macro)
  | 'AnyAtRoot'      // Any value evaluated at root
  | 'Identifier'     // Identifier token
  | 'TypeSpecifier'  // Type specifier (e.g., Patient, Quantity)
  | 'Any'            // Any evaluated value
  | 'Integer'        // Integer value
  | 'Boolean'        // Boolean value
  | 'Number'         // Numeric value
  | 'String';        // String value

/**
 * User-defined function definition
 */
export interface UserFunction {
  /** The function implementation */
  fn: (...args: unknown[]) => unknown;
  /** 
   * Arity definition: maps number of params to their types
   * e.g., { 0: [], 1: ['String'], 2: ['String', 'Integer'] }
   */
  arity?: Record<number, ParamType[]>;
  /** If true, return empty when any param is empty */
  nullable?: boolean;
  /** If true, return internal FHIRPath structures */
  internalStructures?: boolean;
}

/**
 * Table of user-defined functions
 */
export type UserInvocationTable = Record<string, UserFunction>;

/**
 * Terminology Service interface - minimal version for options
 * Full interface is in terminology/types.ts
 */
export interface ITerminologyServiceBase {
  memberOf(coded: unknown, valueSetUrl: string): Promise<boolean>;
  expand?(valueSet: unknown, params?: unknown): Promise<unknown>;
  lookup?(coded: unknown, params?: unknown): Promise<unknown>;
  validateVS?(valueSet: unknown, coded: unknown, params?: unknown): Promise<unknown>;
  validateCS?(codeSystem: unknown, coded: unknown, params?: unknown): Promise<unknown>;
  subsumes?(system: string, codeA: unknown, codeB: unknown, params?: unknown): Promise<unknown>;
  translate?(conceptMap: unknown, coded: unknown, params?: unknown): Promise<unknown>;
}

/**
 * Options for FHIRPath evaluation
 */
/**
 * Reference resolver interface for resolve() function
 * Allows resolving FHIR references to actual resources
 */
export interface IReferenceResolverBase {
  /**
   * Resolve a FHIR reference to a resource
   * @param reference The reference string (e.g., "Patient/123" or full URL)
   * @param context Optional context (may contain Bundle for relative refs)
   * @returns The resolved resource or undefined if not found
   */
  resolve(reference: string, context?: Record<string, unknown>): unknown | Promise<unknown>;
}

export interface Options {
  /** Whether to resolve internal FHIRPath types to JSON */
  resolveInternalTypes?: boolean;
  /** Trace function for debugging */
  traceFn?: (value: unknown, label: string) => void;
  /** User-defined functions */
  userInvocationTable?: UserInvocationTable;
  /** Terminology service URL for memberOf() and %terminologies */
  terminologyUrl?: string;
  /** Pre-configured terminology service instance */
  terminologyService?: ITerminologyServiceBase;
  /** 
   * HTTP headers for external requests (e.g., terminology server)
   * Format: { [serverUrl]: { [headerName]: headerValue } }
   */
  httpHeaders?: Record<string, Record<string, string>>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** 
   * Function to check if a resource type derives from another.
   * Used for is() and as() operations with polymorphic types.
   */
  isDerivedResourceFn?: (resourceType: string, expectedType: string) => boolean;
  /** Enable async evaluation for terminology operations */
  async?: boolean | 'always';
  /** Reference resolver for resolve() function */
  referenceResolver?: IReferenceResolverBase;
}

/**
 * Async evaluation options
 */
export interface AsyncOptions extends Options {
  async: true | 'always';
}

/**
 * Sync evaluation options (default)
 */
export interface SyncOptions extends Options {
  async?: false;
}

/**
 * Combined option variants
 */
export type OptionVariants = SyncOptions | AsyncOptions;

/**
 * A compiled FHIRPath expression that can be evaluated multiple times
 */
export interface CompiledExpression {
  /** The original expression string */
  readonly expression: string;
  /** The base type (if specified) */
  readonly base?: string;
  /** The parsed AST (internal) */
  readonly ast: ASTNode;
  /** 
   * Evaluate this expression against a resource.
   * @param resource The FHIR resource to evaluate against
   * @param context Optional evaluation context (environment variables)
   * @param options Additional options for this evaluation
   */
  (resource: unknown, context?: EvaluationContext, options?: Options): unknown[];
}

/**
 * AST Node types (internal representation)
 */
export type ASTNodeType = 
  | 'EntireExpression'
  | 'TermExpression'
  | 'InvocationExpression'
  | 'IndexerExpression'
  | 'PolarityExpression'
  | 'MemberInvocation'
  | 'FunctionInvocation'
  | 'ThisInvocation'
  | 'IndexInvocation'
  | 'TotalInvocation'
  | 'Identifier'
  | 'ParamList'
  | 'TypeSpecifier'
  | 'UnionExpression'
  | 'InequalityExpression'
  | 'EqualityExpression'
  | 'MembershipExpression'
  | 'AndExpression'
  | 'OrExpression'
  | 'XorExpression'
  | 'ImpliesExpression'
  | 'AdditiveExpression'
  | 'MultiplicativeExpression'
  | 'LiteralTerm'
  | 'BooleanLiteral'
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'DateLiteral'
  | 'DateTimeLiteral'
  | 'TimeLiteral'
  | 'QuantityLiteral'
  | 'NullLiteral'
  | 'ExternalConstant';

/**
 * AST Node structure
 */
export interface ASTNode {
  type: ASTNodeType;
  text?: string;
  children?: ASTNode[];
  terminalNodeText?: string[];
  value?: unknown;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Current number of entries */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Hit rate (hits / (hits + misses)) */
  hitRate: number;
}

/**
 * FHIRPath type information
 */
export interface FhirPathTypeInfo {
  namespace: string;
  name: string;
}

/**
 * Result of type() function
 */
export interface TypeResult {
  namespace: string;
  name: string;
}
