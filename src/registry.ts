/**
 * FHIRPath Registry API
 * 
 * Provides introspection capabilities for available FHIRPath functions and operators.
 * Useful for tooling, autocomplete, and documentation.
 * 
 * @example
 * ```typescript
 * import { registry } from "@atollee/fhirpath-atollee";
 * 
 * // List all functions
 * const functions = registry.listFunctions();
 * console.log(functions.map(f => f.name));
 * 
 * // Get function details
 * const whereFunc = registry.getFunction('where');
 * console.log(whereFunc?.signatures);
 * ```
 */

/**
 * Function parameter definition
 */
export interface FunctionParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Whether the parameter is optional */
  optional?: boolean;
  /** Description */
  description?: string;
}

/**
 * Function signature definition
 */
export interface FunctionSignature {
  /** Parameter definitions */
  parameters: FunctionParameter[];
  /** Return type */
  returnType: string;
}

/**
 * FHIRPath function definition
 */
export interface FunctionDefinition {
  /** Function name */
  name: string;
  /** Function category */
  category: FunctionCategory;
  /** Human-readable description */
  description: string;
  /** Function signatures (overloads) */
  signatures: FunctionSignature[];
  /** FHIRPath specification version (default: 2.0.0) */
  specVersion?: "2.0.0" | "3.0.0-ballot";
  /** Example usage */
  example?: string;
}

/**
 * Operator definition
 */
export interface OperatorDefinition {
  /** Operator symbol */
  symbol: string;
  /** Operator name */
  name: string;
  /** Operator category */
  category: OperatorCategory;
  /** Description */
  description: string;
  /** Precedence (higher = binds tighter) */
  precedence: number;
  /** Whether the operator is unary */
  unary?: boolean;
  /** Left operand type */
  leftType?: string;
  /** Right operand type */
  rightType?: string;
  /** Return type */
  returnType: string;
}

/**
 * Function categories
 */
export type FunctionCategory = 
  | "Existence"
  | "Filtering"
  | "Subsetting"
  | "Combining"
  | "Conversion"
  | "String"
  | "Math"
  | "DateTime"
  | "Navigation"
  | "Utility"
  | "Aggregate"
  | "Type"
  | "Boolean";

/**
 * Operator categories
 */
export type OperatorCategory = 
  | "Arithmetic"
  | "Comparison"
  | "Equality"
  | "Boolean"
  | "String"
  | "Collection"
  | "Type";

/**
 * All FHIRPath functions
 */
const FUNCTIONS: FunctionDefinition[] = [
  // ============================================================
  // EXISTENCE FUNCTIONS
  // ============================================================
  {
    name: "empty",
    category: "Existence",
    description: "Returns true if the collection is empty",
    signatures: [{ parameters: [], returnType: "Boolean" }],
    example: "Patient.name.empty()",
  },
  {
    name: "exists",
    category: "Existence",
    description: "Returns true if the collection has any elements, optionally matching criteria",
    signatures: [
      { parameters: [], returnType: "Boolean" },
      { parameters: [{ name: "criteria", type: "Expression" }], returnType: "Boolean" },
    ],
    example: "Patient.name.exists(use = 'official')",
  },
  {
    name: "all",
    category: "Existence",
    description: "Returns true if all elements satisfy the criteria",
    signatures: [
      { parameters: [{ name: "criteria", type: "Expression" }], returnType: "Boolean" },
    ],
    example: "Patient.name.all(given.exists())",
  },
  {
    name: "allTrue",
    category: "Existence",
    description: "Returns true if all elements in the collection are true",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "anyTrue",
    category: "Existence",
    description: "Returns true if any element in the collection is true",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "allFalse",
    category: "Existence",
    description: "Returns true if all elements in the collection are false",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "anyFalse",
    category: "Existence",
    description: "Returns true if any element in the collection is false",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "hasValue",
    category: "Existence",
    description: "Returns true if the collection has a single element with a value",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "isDistinct",
    category: "Existence",
    description: "Returns true if all elements in the collection are distinct",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "subsetOf",
    category: "Existence",
    description: "Returns true if this collection is a subset of the other",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Boolean" },
    ],
  },
  {
    name: "supersetOf",
    category: "Existence",
    description: "Returns true if this collection is a superset of the other",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Boolean" },
    ],
  },
  
  // ============================================================
  // FILTERING / SUBSETTING FUNCTIONS
  // ============================================================
  {
    name: "where",
    category: "Filtering",
    description: "Filters the collection to elements matching the criteria",
    signatures: [
      { parameters: [{ name: "criteria", type: "Expression" }], returnType: "Collection" },
    ],
    example: "Patient.name.where(use = 'official')",
  },
  {
    name: "select",
    category: "Filtering",
    description: "Projects each element through the projection expression",
    signatures: [
      { parameters: [{ name: "projection", type: "Expression" }], returnType: "Collection" },
    ],
    example: "Patient.name.select(given.first())",
  },
  {
    name: "ofType",
    category: "Filtering",
    description: "Filters to elements of the specified type",
    signatures: [
      { parameters: [{ name: "type", type: "TypeSpecifier" }], returnType: "Collection" },
    ],
    example: "Bundle.entry.resource.ofType(Patient)",
  },
  {
    name: "first",
    category: "Subsetting",
    description: "Returns the first element of the collection",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "last",
    category: "Subsetting",
    description: "Returns the last element of the collection",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "tail",
    category: "Subsetting",
    description: "Returns all but the first element",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "take",
    category: "Subsetting",
    description: "Returns the first n elements",
    signatures: [
      { parameters: [{ name: "n", type: "Integer" }], returnType: "Collection" },
    ],
  },
  {
    name: "skip",
    category: "Subsetting",
    description: "Returns all but the first n elements",
    signatures: [
      { parameters: [{ name: "n", type: "Integer" }], returnType: "Collection" },
    ],
  },
  {
    name: "single",
    category: "Subsetting",
    description: "Returns the single element (error if not exactly one)",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "distinct",
    category: "Subsetting",
    description: "Returns distinct elements",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  
  // ============================================================
  // COMBINING FUNCTIONS
  // ============================================================
  {
    name: "combine",
    category: "Combining",
    description: "Combines two collections (may include duplicates)",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Collection" },
    ],
  },
  {
    name: "union",
    category: "Combining",
    description: "Returns the union of two collections (distinct)",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Collection" },
    ],
  },
  {
    name: "intersect",
    category: "Combining",
    description: "Returns the intersection of two collections",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Collection" },
    ],
  },
  {
    name: "exclude",
    category: "Combining",
    description: "Returns elements in this but not in other",
    signatures: [
      { parameters: [{ name: "other", type: "Collection" }], returnType: "Collection" },
    ],
  },
  
  // ============================================================
  // AGGREGATE FUNCTIONS
  // ============================================================
  {
    name: "count",
    category: "Aggregate",
    description: "Returns the number of elements",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "sum",
    category: "Aggregate",
    description: "Returns the sum of numeric values",
    signatures: [{ parameters: [], returnType: "Decimal" }],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "min",
    category: "Aggregate",
    description: "Returns the minimum value",
    signatures: [{ parameters: [], returnType: "Any" }],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "max",
    category: "Aggregate",
    description: "Returns the maximum value",
    signatures: [{ parameters: [], returnType: "Any" }],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "avg",
    category: "Aggregate",
    description: "Returns the average of numeric values",
    signatures: [{ parameters: [], returnType: "Decimal" }],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "aggregate",
    category: "Aggregate",
    description: "Aggregates elements using accumulator",
    signatures: [
      { 
        parameters: [
          { name: "init", type: "Any" },
          { name: "accumulator", type: "Expression" },
        ], 
        returnType: "Any" 
      },
    ],
    example: "value.aggregate(0, $total + $this)",
  },
  
  // ============================================================
  // STRING FUNCTIONS
  // ============================================================
  {
    name: "indexOf",
    category: "String",
    description: "Returns the index of the substring",
    signatures: [
      { parameters: [{ name: "substring", type: "String" }], returnType: "Integer" },
    ],
  },
  {
    name: "substring",
    category: "String",
    description: "Returns a substring",
    signatures: [
      { 
        parameters: [
          { name: "start", type: "Integer" },
          { name: "length", type: "Integer", optional: true },
        ], 
        returnType: "String" 
      },
    ],
  },
  {
    name: "startsWith",
    category: "String",
    description: "Returns true if string starts with prefix",
    signatures: [
      { parameters: [{ name: "prefix", type: "String" }], returnType: "Boolean" },
    ],
  },
  {
    name: "endsWith",
    category: "String",
    description: "Returns true if string ends with suffix",
    signatures: [
      { parameters: [{ name: "suffix", type: "String" }], returnType: "Boolean" },
    ],
  },
  {
    name: "contains",
    category: "String",
    description: "Returns true if string contains substring",
    signatures: [
      { parameters: [{ name: "substring", type: "String" }], returnType: "Boolean" },
    ],
  },
  {
    name: "upper",
    category: "String",
    description: "Converts to uppercase",
    signatures: [{ parameters: [], returnType: "String" }],
  },
  {
    name: "lower",
    category: "String",
    description: "Converts to lowercase",
    signatures: [{ parameters: [], returnType: "String" }],
  },
  {
    name: "replace",
    category: "String",
    description: "Replaces occurrences of pattern",
    signatures: [
      { 
        parameters: [
          { name: "pattern", type: "String" },
          { name: "replacement", type: "String" },
        ], 
        returnType: "String" 
      },
    ],
  },
  {
    name: "matches",
    category: "String",
    description: "Returns true if string matches regex",
    signatures: [
      { parameters: [{ name: "regex", type: "String" }], returnType: "Boolean" },
    ],
  },
  {
    name: "replaceMatches",
    category: "String",
    description: "Replaces regex matches",
    signatures: [
      { 
        parameters: [
          { name: "regex", type: "String" },
          { name: "replacement", type: "String" },
        ], 
        returnType: "String" 
      },
    ],
  },
  {
    name: "length",
    category: "String",
    description: "Returns string length",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "toChars",
    category: "String",
    description: "Converts string to collection of characters",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "split",
    category: "String",
    description: "Splits string by separator",
    signatures: [
      { parameters: [{ name: "separator", type: "String" }], returnType: "Collection" },
    ],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "join",
    category: "String",
    description: "Joins collection elements with separator",
    signatures: [
      { parameters: [{ name: "separator", type: "String", optional: true }], returnType: "String" },
    ],
    specVersion: "3.0.0-ballot",
  },
  {
    name: "trim",
    category: "String",
    description: "Trims whitespace from both ends",
    signatures: [{ parameters: [], returnType: "String" }],
    specVersion: "3.0.0-ballot",
  },
  
  // ============================================================
  // MATH FUNCTIONS
  // ============================================================
  {
    name: "abs",
    category: "Math",
    description: "Returns absolute value",
    signatures: [{ parameters: [], returnType: "Number" }],
  },
  {
    name: "ceiling",
    category: "Math",
    description: "Returns ceiling (round up)",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "floor",
    category: "Math",
    description: "Returns floor (round down)",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "round",
    category: "Math",
    description: "Rounds to specified precision",
    signatures: [
      { parameters: [{ name: "precision", type: "Integer", optional: true }], returnType: "Decimal" },
    ],
  },
  {
    name: "truncate",
    category: "Math",
    description: "Truncates to integer",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "exp",
    category: "Math",
    description: "Returns e^n",
    signatures: [{ parameters: [], returnType: "Decimal" }],
  },
  {
    name: "ln",
    category: "Math",
    description: "Returns natural logarithm",
    signatures: [{ parameters: [], returnType: "Decimal" }],
  },
  {
    name: "log",
    category: "Math",
    description: "Returns logarithm with specified base",
    signatures: [
      { parameters: [{ name: "base", type: "Decimal" }], returnType: "Decimal" },
    ],
  },
  {
    name: "power",
    category: "Math",
    description: "Returns base raised to exponent",
    signatures: [
      { parameters: [{ name: "exponent", type: "Number" }], returnType: "Number" },
    ],
  },
  {
    name: "sqrt",
    category: "Math",
    description: "Returns square root",
    signatures: [{ parameters: [], returnType: "Decimal" }],
  },
  
  // ============================================================
  // CONVERSION FUNCTIONS
  // ============================================================
  {
    name: "toBoolean",
    category: "Conversion",
    description: "Converts to Boolean",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "toInteger",
    category: "Conversion",
    description: "Converts to Integer",
    signatures: [{ parameters: [], returnType: "Integer" }],
  },
  {
    name: "toDecimal",
    category: "Conversion",
    description: "Converts to Decimal",
    signatures: [{ parameters: [], returnType: "Decimal" }],
  },
  {
    name: "toString",
    category: "Conversion",
    description: "Converts to String",
    signatures: [{ parameters: [], returnType: "String" }],
  },
  {
    name: "toDate",
    category: "Conversion",
    description: "Converts to Date",
    signatures: [{ parameters: [], returnType: "Date" }],
  },
  {
    name: "toDateTime",
    category: "Conversion",
    description: "Converts to DateTime",
    signatures: [{ parameters: [], returnType: "DateTime" }],
  },
  {
    name: "toTime",
    category: "Conversion",
    description: "Converts to Time",
    signatures: [{ parameters: [], returnType: "Time" }],
  },
  {
    name: "toQuantity",
    category: "Conversion",
    description: "Converts to Quantity",
    signatures: [
      { parameters: [{ name: "unit", type: "String", optional: true }], returnType: "Quantity" },
    ],
  },
  {
    name: "convertsToBoolean",
    category: "Conversion",
    description: "Returns true if value can be converted to Boolean",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToInteger",
    category: "Conversion",
    description: "Returns true if value can be converted to Integer",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToDecimal",
    category: "Conversion",
    description: "Returns true if value can be converted to Decimal",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToString",
    category: "Conversion",
    description: "Returns true if value can be converted to String",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToDate",
    category: "Conversion",
    description: "Returns true if value can be converted to Date",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToDateTime",
    category: "Conversion",
    description: "Returns true if value can be converted to DateTime",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToTime",
    category: "Conversion",
    description: "Returns true if value can be converted to Time",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  {
    name: "convertsToQuantity",
    category: "Conversion",
    description: "Returns true if value can be converted to Quantity",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
  
  // ============================================================
  // DATETIME FUNCTIONS
  // ============================================================
  {
    name: "now",
    category: "DateTime",
    description: "Returns current date and time",
    signatures: [{ parameters: [], returnType: "DateTime" }],
  },
  {
    name: "today",
    category: "DateTime",
    description: "Returns current date",
    signatures: [{ parameters: [], returnType: "Date" }],
  },
  {
    name: "timeOfDay",
    category: "DateTime",
    description: "Returns current time",
    signatures: [{ parameters: [], returnType: "Time" }],
  },
  
  // ============================================================
  // NAVIGATION FUNCTIONS
  // ============================================================
  {
    name: "children",
    category: "Navigation",
    description: "Returns all child elements",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "descendants",
    category: "Navigation",
    description: "Returns all descendant elements",
    signatures: [{ parameters: [], returnType: "Collection" }],
  },
  {
    name: "resolve",
    category: "Navigation",
    description: "Resolves a reference",
    signatures: [{ parameters: [], returnType: "Resource" }],
  },
  
  // ============================================================
  // TYPE FUNCTIONS
  // ============================================================
  {
    name: "is",
    category: "Type",
    description: "Checks if value is of specified type",
    signatures: [
      { parameters: [{ name: "type", type: "TypeSpecifier" }], returnType: "Boolean" },
    ],
  },
  {
    name: "as",
    category: "Type",
    description: "Casts to specified type (returns empty if not compatible)",
    signatures: [
      { parameters: [{ name: "type", type: "TypeSpecifier" }], returnType: "Any" },
    ],
  },
  {
    name: "type",
    category: "Type",
    description: "Returns the type of the element",
    signatures: [{ parameters: [], returnType: "TypeInfo" }],
    specVersion: "3.0.0-ballot",
  },
  
  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  {
    name: "trace",
    category: "Utility",
    description: "Logs values for debugging",
    signatures: [
      { parameters: [{ name: "name", type: "String" }], returnType: "Collection" },
      { 
        parameters: [
          { name: "name", type: "String" },
          { name: "projection", type: "Expression" },
        ], 
        returnType: "Collection" 
      },
    ],
    example: "Patient.name.trace('names').given.first()",
  },
  {
    name: "iif",
    category: "Utility",
    description: "If-then-else expression",
    signatures: [
      { 
        parameters: [
          { name: "condition", type: "Boolean" },
          { name: "trueResult", type: "Any" },
          { name: "falseResult", type: "Any", optional: true },
        ], 
        returnType: "Any" 
      },
    ],
    example: "iif(active, 'Active', 'Inactive')",
  },
  {
    name: "defineVariable",
    category: "Utility",
    description: "Defines a variable for use in subsequent expressions",
    signatures: [
      { 
        parameters: [
          { name: "name", type: "String" },
          { name: "expression", type: "Expression" },
        ], 
        returnType: "Collection" 
      },
    ],
    specVersion: "3.0.0-ballot",
    example: "name.defineVariable('fullName', given.first() + ' ' + family)",
  },
  
  // ============================================================
  // BOOLEAN FUNCTIONS
  // ============================================================
  {
    name: "not",
    category: "Boolean",
    description: "Returns logical negation",
    signatures: [{ parameters: [], returnType: "Boolean" }],
  },
];

/**
 * All FHIRPath operators
 */
const OPERATORS: OperatorDefinition[] = [
  // Arithmetic
  { symbol: "+", name: "addition", category: "Arithmetic", description: "Addition", precedence: 4, leftType: "Number", rightType: "Number", returnType: "Number" },
  { symbol: "-", name: "subtraction", category: "Arithmetic", description: "Subtraction", precedence: 4, leftType: "Number", rightType: "Number", returnType: "Number" },
  { symbol: "*", name: "multiplication", category: "Arithmetic", description: "Multiplication", precedence: 5, leftType: "Number", rightType: "Number", returnType: "Number" },
  { symbol: "/", name: "division", category: "Arithmetic", description: "Division", precedence: 5, leftType: "Number", rightType: "Number", returnType: "Decimal" },
  { symbol: "div", name: "integer division", category: "Arithmetic", description: "Integer division", precedence: 5, leftType: "Integer", rightType: "Integer", returnType: "Integer" },
  { symbol: "mod", name: "modulo", category: "Arithmetic", description: "Modulo", precedence: 5, leftType: "Integer", rightType: "Integer", returnType: "Integer" },
  { symbol: "-", name: "negation", category: "Arithmetic", description: "Unary negation", precedence: 7, unary: true, returnType: "Number" },
  
  // Comparison
  { symbol: "<", name: "less than", category: "Comparison", description: "Less than", precedence: 3, returnType: "Boolean" },
  { symbol: ">", name: "greater than", category: "Comparison", description: "Greater than", precedence: 3, returnType: "Boolean" },
  { symbol: "<=", name: "less or equal", category: "Comparison", description: "Less than or equal", precedence: 3, returnType: "Boolean" },
  { symbol: ">=", name: "greater or equal", category: "Comparison", description: "Greater than or equal", precedence: 3, returnType: "Boolean" },
  
  // Equality
  { symbol: "=", name: "equals", category: "Equality", description: "Equality (empty propagating)", precedence: 2, returnType: "Boolean" },
  { symbol: "!=", name: "not equals", category: "Equality", description: "Inequality (empty propagating)", precedence: 2, returnType: "Boolean" },
  { symbol: "~", name: "equivalent", category: "Equality", description: "Equivalence", precedence: 2, returnType: "Boolean" },
  { symbol: "!~", name: "not equivalent", category: "Equality", description: "Not equivalent", precedence: 2, returnType: "Boolean" },
  
  // Boolean
  { symbol: "and", name: "and", category: "Boolean", description: "Logical AND", precedence: 1, leftType: "Boolean", rightType: "Boolean", returnType: "Boolean" },
  { symbol: "or", name: "or", category: "Boolean", description: "Logical OR", precedence: 0, leftType: "Boolean", rightType: "Boolean", returnType: "Boolean" },
  { symbol: "xor", name: "xor", category: "Boolean", description: "Logical XOR", precedence: 0, leftType: "Boolean", rightType: "Boolean", returnType: "Boolean" },
  { symbol: "implies", name: "implies", category: "Boolean", description: "Logical implication", precedence: 0, leftType: "Boolean", rightType: "Boolean", returnType: "Boolean" },
  
  // Collection
  { symbol: "|", name: "union", category: "Collection", description: "Union", precedence: 4, returnType: "Collection" },
  { symbol: "in", name: "in", category: "Collection", description: "Membership", precedence: 2, returnType: "Boolean" },
  { symbol: "contains", name: "contains", category: "Collection", description: "Contains", precedence: 2, returnType: "Boolean" },
  
  // Type
  { symbol: "is", name: "is", category: "Type", description: "Type check", precedence: 6, returnType: "Boolean" },
  { symbol: "as", name: "as", category: "Type", description: "Type cast", precedence: 6, returnType: "Any" },
];

/**
 * FHIRPath Registry - provides introspection for functions and operators
 */
export const registry = {
  /**
   * List all available functions
   * @param options - Filter options
   */
  listFunctions(options?: { 
    category?: FunctionCategory;
    specVersion?: "2.0.0" | "3.0.0-ballot";
  }): FunctionDefinition[] {
    let result = [...FUNCTIONS];
    
    if (options?.category) {
      result = result.filter(f => f.category === options.category);
    }
    
    if (options?.specVersion) {
      result = result.filter(f => 
        (f.specVersion ?? "2.0.0") === options.specVersion
      );
    }
    
    return result;
  },
  
  /**
   * Get a specific function by name
   */
  getFunction(name: string): FunctionDefinition | undefined {
    return FUNCTIONS.find(f => f.name === name);
  },
  
  /**
   * List all available operators
   * @param options - Filter options
   */
  listOperators(options?: {
    category?: OperatorCategory;
  }): OperatorDefinition[] {
    let result = [...OPERATORS];
    
    if (options?.category) {
      result = result.filter(o => o.category === options.category);
    }
    
    return result;
  },
  
  /**
   * Get a specific operator by symbol
   */
  getOperator(symbol: string): OperatorDefinition | undefined {
    return OPERATORS.find(o => o.symbol === symbol);
  },
  
  /**
   * Get all function categories
   */
  getFunctionCategories(): FunctionCategory[] {
    const categories = new Set(FUNCTIONS.map(f => f.category));
    return Array.from(categories);
  },
  
  /**
   * Get all operator categories
   */
  getOperatorCategories(): OperatorCategory[] {
    const categories = new Set(OPERATORS.map(o => o.category));
    return Array.from(categories);
  },
  
  /**
   * Get functions by category, grouped
   */
  getFunctionsByCategory(): Record<FunctionCategory, FunctionDefinition[]> {
    const result = {} as Record<FunctionCategory, FunctionDefinition[]>;
    
    for (const func of FUNCTIONS) {
      if (!result[func.category]) {
        result[func.category] = [];
      }
      result[func.category].push(func);
    }
    
    return result;
  },
  
  /**
   * Search functions by name or description
   */
  searchFunctions(query: string): FunctionDefinition[] {
    const lowerQuery = query.toLowerCase();
    return FUNCTIONS.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) ||
      f.description.toLowerCase().includes(lowerQuery)
    );
  },
  
  /**
   * Get count of functions and operators
   */
  getStats(): { functions: number; operators: number; categories: number } {
    return {
      functions: FUNCTIONS.length,
      operators: OPERATORS.length,
      categories: this.getFunctionCategories().length,
    };
  },
};
