/**
 * FHIRPath Language Definition for Monaco Editor
 * 
 * Provides syntax highlighting, autocomplete, and validation for FHIRPath expressions.
 */

/**
 * FHIRPath language ID
 */
export const FHIRPATH_LANGUAGE_ID = "fhirpath";

/**
 * FHIRPath built-in functions with documentation
 */
export const FHIRPATH_FUNCTIONS: FunctionDefinition[] = [
  // Existence functions
  { name: "empty", signature: "empty() : Boolean", description: "Returns true if the collection is empty", category: "Existence" },
  { name: "exists", signature: "exists([criteria]) : Boolean", description: "Returns true if the collection has any elements, optionally matching criteria", category: "Existence" },
  { name: "all", signature: "all(criteria) : Boolean", description: "Returns true if all elements match the criteria", category: "Existence" },
  { name: "allTrue", signature: "allTrue() : Boolean", description: "Returns true if all elements are true", category: "Existence" },
  { name: "anyTrue", signature: "anyTrue() : Boolean", description: "Returns true if any element is true", category: "Existence" },
  { name: "allFalse", signature: "allFalse() : Boolean", description: "Returns true if all elements are false", category: "Existence" },
  { name: "anyFalse", signature: "anyFalse() : Boolean", description: "Returns true if any element is false", category: "Existence" },
  
  // Filtering and projection
  { name: "where", signature: "where(criteria) : Collection", description: "Filters elements matching criteria", category: "Filtering" },
  { name: "select", signature: "select(projection) : Collection", description: "Projects each element using the expression", category: "Filtering" },
  { name: "repeat", signature: "repeat(expression) : Collection", description: "Repeatedly applies expression until no new items", category: "Filtering" },
  { name: "ofType", signature: "ofType(type) : Collection", description: "Returns elements of the specified type", category: "Filtering" },
  
  // Subsetting
  { name: "first", signature: "first() : Element", description: "Returns the first element", category: "Subsetting" },
  { name: "last", signature: "last() : Element", description: "Returns the last element", category: "Subsetting" },
  { name: "tail", signature: "tail() : Collection", description: "Returns all but the first element", category: "Subsetting" },
  { name: "skip", signature: "skip(num) : Collection", description: "Skips the first num elements", category: "Subsetting" },
  { name: "take", signature: "take(num) : Collection", description: "Takes the first num elements", category: "Subsetting" },
  { name: "single", signature: "single() : Element", description: "Returns the single element (error if 0 or >1)", category: "Subsetting" },
  { name: "intersect", signature: "intersect(other) : Collection", description: "Returns elements in both collections", category: "Subsetting" },
  { name: "exclude", signature: "exclude(other) : Collection", description: "Returns elements not in the other collection", category: "Subsetting" },
  
  // Combining
  { name: "union", signature: "union(other) : Collection", description: "Returns distinct elements from both collections", category: "Combining" },
  { name: "combine", signature: "combine(other) : Collection", description: "Combines all elements (with duplicates)", category: "Combining" },
  
  // Conversion
  { name: "iif", signature: "iif(condition, true-result [, false-result]) : Element", description: "Conditional expression", category: "Conversion" },
  { name: "toBoolean", signature: "toBoolean() : Boolean", description: "Converts to Boolean", category: "Conversion" },
  { name: "toInteger", signature: "toInteger() : Integer", description: "Converts to Integer", category: "Conversion" },
  { name: "toDecimal", signature: "toDecimal() : Decimal", description: "Converts to Decimal", category: "Conversion" },
  { name: "toString", signature: "toString() : String", description: "Converts to String", category: "Conversion" },
  { name: "toDate", signature: "toDate() : Date", description: "Converts to Date", category: "Conversion" },
  { name: "toDateTime", signature: "toDateTime() : DateTime", description: "Converts to DateTime", category: "Conversion" },
  { name: "toTime", signature: "toTime() : Time", description: "Converts to Time", category: "Conversion" },
  { name: "toQuantity", signature: "toQuantity([unit]) : Quantity", description: "Converts to Quantity", category: "Conversion" },
  { name: "convertsToBoolean", signature: "convertsToBoolean() : Boolean", description: "True if can convert to Boolean", category: "Conversion" },
  { name: "convertsToInteger", signature: "convertsToInteger() : Boolean", description: "True if can convert to Integer", category: "Conversion" },
  { name: "convertsToDecimal", signature: "convertsToDecimal() : Boolean", description: "True if can convert to Decimal", category: "Conversion" },
  { name: "convertsToString", signature: "convertsToString() : Boolean", description: "True if can convert to String", category: "Conversion" },
  { name: "convertsToDate", signature: "convertsToDate() : Boolean", description: "True if can convert to Date", category: "Conversion" },
  { name: "convertsToDateTime", signature: "convertsToDateTime() : Boolean", description: "True if can convert to DateTime", category: "Conversion" },
  { name: "convertsToTime", signature: "convertsToTime() : Boolean", description: "True if can convert to Time", category: "Conversion" },
  { name: "convertsToQuantity", signature: "convertsToQuantity() : Boolean", description: "True if can convert to Quantity", category: "Conversion" },
  
  // String functions
  { name: "indexOf", signature: "indexOf(substring) : Integer", description: "Returns index of substring (-1 if not found)", category: "String" },
  { name: "substring", signature: "substring(start [, length]) : String", description: "Returns substring", category: "String" },
  { name: "startsWith", signature: "startsWith(prefix) : Boolean", description: "True if string starts with prefix", category: "String" },
  { name: "endsWith", signature: "endsWith(suffix) : Boolean", description: "True if string ends with suffix", category: "String" },
  { name: "contains", signature: "contains(substring) : Boolean", description: "True if string contains substring", category: "String" },
  { name: "upper", signature: "upper() : String", description: "Converts to uppercase", category: "String" },
  { name: "lower", signature: "lower() : String", description: "Converts to lowercase", category: "String" },
  { name: "replace", signature: "replace(pattern, substitution) : String", description: "Replaces pattern with substitution", category: "String" },
  { name: "matches", signature: "matches(regex) : Boolean", description: "True if string matches regex", category: "String" },
  { name: "replaceMatches", signature: "replaceMatches(regex, substitution) : String", description: "Replaces regex matches", category: "String" },
  { name: "length", signature: "length() : Integer", description: "Returns string length", category: "String" },
  { name: "toChars", signature: "toChars() : Collection", description: "Splits string into characters", category: "String" },
  { name: "trim", signature: "trim() : String", description: "Removes leading/trailing whitespace", category: "String" },
  { name: "split", signature: "split(separator) : Collection", description: "Splits string by separator", category: "String" },
  { name: "join", signature: "join([separator]) : String", description: "Joins collection into string", category: "String" },
  
  // Math functions
  { name: "abs", signature: "abs() : Number", description: "Returns absolute value", category: "Math" },
  { name: "ceiling", signature: "ceiling() : Integer", description: "Rounds up to nearest integer", category: "Math" },
  { name: "exp", signature: "exp() : Decimal", description: "Returns e^value", category: "Math" },
  { name: "floor", signature: "floor() : Integer", description: "Rounds down to nearest integer", category: "Math" },
  { name: "ln", signature: "ln() : Decimal", description: "Returns natural logarithm", category: "Math" },
  { name: "log", signature: "log(base) : Decimal", description: "Returns logarithm with specified base", category: "Math" },
  { name: "power", signature: "power(exponent) : Number", description: "Returns value^exponent", category: "Math" },
  { name: "round", signature: "round([precision]) : Decimal", description: "Rounds to specified precision", category: "Math" },
  { name: "sqrt", signature: "sqrt() : Decimal", description: "Returns square root", category: "Math" },
  { name: "truncate", signature: "truncate() : Integer", description: "Truncates to integer", category: "Math" },
  
  // Tree navigation
  { name: "children", signature: "children() : Collection", description: "Returns all direct children", category: "Navigation" },
  { name: "descendants", signature: "descendants() : Collection", description: "Returns all descendants", category: "Navigation" },
  
  // Utility
  { name: "trace", signature: "trace(name [, projection]) : Collection", description: "Logs value for debugging", category: "Utility" },
  { name: "now", signature: "now() : DateTime", description: "Returns current date/time", category: "Utility" },
  { name: "today", signature: "today() : Date", description: "Returns current date", category: "Utility" },
  { name: "timeOfDay", signature: "timeOfDay() : Time", description: "Returns current time", category: "Utility" },
  
  // Aggregate functions
  { name: "count", signature: "count() : Integer", description: "Returns number of elements", category: "Aggregate" },
  { name: "distinct", signature: "distinct() : Collection", description: "Returns distinct elements", category: "Aggregate" },
  { name: "isDistinct", signature: "isDistinct() : Boolean", description: "True if all elements are distinct", category: "Aggregate" },
  { name: "aggregate", signature: "aggregate(aggregator [, init]) : Element", description: "Custom aggregation", category: "Aggregate" },
  
  // Boolean logic
  { name: "not", signature: "not() : Boolean", description: "Negates boolean value", category: "Boolean" },
  
  // Type functions
  { name: "is", signature: "is(type) : Boolean", description: "True if value is of specified type", category: "Type" },
  { name: "as", signature: "as(type) : Element", description: "Casts to specified type", category: "Type" },
  
  // FHIR-specific
  { name: "resolve", signature: "resolve() : Resource", description: "Resolves a Reference to its target resource", category: "FHIR" },
  { name: "extension", signature: "extension(url) : Collection", description: "Returns extensions with matching URL", category: "FHIR" },
  { name: "hasValue", signature: "hasValue() : Boolean", description: "True if element has a value", category: "FHIR" },
  { name: "memberOf", signature: "memberOf(valueSet) : Boolean", description: "True if code is in value set", category: "FHIR" },
  { name: "htmlChecks", signature: "htmlChecks() : Boolean", description: "Validates XHTML content", category: "FHIR" },
];

/**
 * FHIRPath operators
 */
export const FHIRPATH_OPERATORS: OperatorDefinition[] = [
  // Comparison
  { symbol: "=", description: "Equals", category: "Comparison" },
  { symbol: "!=", description: "Not equals", category: "Comparison" },
  { symbol: "~", description: "Equivalent (ignores case/whitespace)", category: "Comparison" },
  { symbol: "!~", description: "Not equivalent", category: "Comparison" },
  { symbol: "<", description: "Less than", category: "Comparison" },
  { symbol: ">", description: "Greater than", category: "Comparison" },
  { symbol: "<=", description: "Less than or equal", category: "Comparison" },
  { symbol: ">=", description: "Greater than or equal", category: "Comparison" },
  
  // Boolean
  { symbol: "and", description: "Logical AND", category: "Boolean" },
  { symbol: "or", description: "Logical OR", category: "Boolean" },
  { symbol: "xor", description: "Logical XOR", category: "Boolean" },
  { symbol: "implies", description: "Logical implication", category: "Boolean" },
  
  // Arithmetic
  { symbol: "+", description: "Addition / String concatenation", category: "Arithmetic" },
  { symbol: "-", description: "Subtraction", category: "Arithmetic" },
  { symbol: "*", description: "Multiplication", category: "Arithmetic" },
  { symbol: "/", description: "Division", category: "Arithmetic" },
  { symbol: "div", description: "Integer division", category: "Arithmetic" },
  { symbol: "mod", description: "Modulo", category: "Arithmetic" },
  
  // String
  { symbol: "&", description: "String concatenation (null-safe)", category: "String" },
  
  // Collections
  { symbol: "|", description: "Union", category: "Collections" },
  { symbol: "in", description: "Membership test", category: "Collections" },
  { symbol: "contains", description: "Contains element", category: "Collections" },
];

/**
 * FHIRPath keywords
 */
export const FHIRPATH_KEYWORDS = [
  "$this",
  "$index", 
  "$total",
  "true",
  "false",
  "{}",
];

/**
 * Common FHIR resource types
 */
export const FHIR_RESOURCE_TYPES = [
  "Patient", "Practitioner", "Organization", "Location",
  "Encounter", "Condition", "Observation", "Procedure",
  "MedicationRequest", "MedicationStatement", "Medication",
  "DiagnosticReport", "ServiceRequest", "CarePlan",
  "AllergyIntolerance", "Immunization", "DocumentReference",
  "Bundle", "Composition", "Claim", "Coverage",
  "Appointment", "Schedule", "Slot", "Task",
];

/**
 * Common FHIR element paths by resource type
 */
export const COMMON_PATHS: Record<string, string[]> = {
  Patient: [
    "id", "meta", "identifier", "active", "name", "telecom",
    "gender", "birthDate", "deceased", "address", "maritalStatus",
    "multipleBirth", "photo", "contact", "communication",
    "generalPractitioner", "managingOrganization", "link",
  ],
  Observation: [
    "id", "meta", "identifier", "status", "category", "code",
    "subject", "encounter", "effective", "issued", "performer",
    "value", "dataAbsentReason", "interpretation", "note",
    "bodySite", "method", "specimen", "device", "referenceRange",
    "component",
  ],
  Condition: [
    "id", "meta", "identifier", "clinicalStatus", "verificationStatus",
    "category", "severity", "code", "bodySite", "subject", "encounter",
    "onset", "abatement", "recordedDate", "recorder", "asserter",
    "stage", "evidence", "note",
  ],
  Encounter: [
    "id", "meta", "identifier", "status", "class", "type", "serviceType",
    "priority", "subject", "episodeOfCare", "basedOn", "participant",
    "appointment", "period", "length", "reasonCode", "reasonReference",
    "diagnosis", "account", "hospitalization", "location", "serviceProvider",
  ],
  Bundle: [
    "id", "meta", "identifier", "type", "timestamp", "total",
    "link", "entry", "entry.fullUrl", "entry.resource", "entry.search",
    "entry.request", "entry.response", "signature",
  ],
};

/**
 * Function definition interface
 */
export interface FunctionDefinition {
  name: string;
  signature: string;
  description: string;
  category: string;
}

/**
 * Operator definition interface
 */
export interface OperatorDefinition {
  symbol: string;
  description: string;
  category: string;
}

/**
 * Monaco language configuration for FHIRPath
 */
export const FHIRPATH_LANGUAGE_CONFIG = {
  comments: {
    lineComment: "//",
  },
  brackets: [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ],
  autoClosingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "{", close: "}" },
    { open: "'", close: "'", notIn: ["string"] },
    { open: '"', close: '"', notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
};

/**
 * Monaco tokenizer rules for FHIRPath syntax highlighting
 */
export const FHIRPATH_MONARCH_TOKENS = {
  defaultToken: "",
  tokenPostfix: ".fhirpath",

  keywords: ["and", "or", "xor", "implies", "div", "mod", "in", "contains", "is", "as"],
  
  operators: ["=", "!=", "~", "!~", "<", ">", "<=", ">=", "+", "-", "*", "/", "|", "&"],
  
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Environment variables
      [/\$this|\$index|\$total/, "variable.predefined"],
      [/%[a-zA-Z_]\w*/, "variable"],
      
      // Functions (followed by parenthesis)
      [/[a-zA-Z_]\w*(?=\s*\()/, "function"],
      
      // Keywords
      [/\b(and|or|xor|implies|div|mod|in|contains|is|as)\b/, "keyword"],
      
      // Booleans
      [/\b(true|false)\b/, "constant.language"],
      
      // Numbers
      [/\d+\.\d+/, "number.float"],
      [/\d+/, "number"],
      
      // Strings
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/'/, "string", "@string_single"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@string_double"],
      
      // Dates/Times
      [/@\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?/, "date"],
      [/@T\d{2}:\d{2}(:\d{2}(\.\d+)?)?/, "date"],
      
      // Quantities
      [/\d+(\.\d+)?\s*'[^']*'/, "number.quantity"],
      
      // Operators
      [/@symbols/, {
        cases: {
          "@operators": "operator",
          "@default": "",
        },
      }],
      
      // Identifiers
      [/[a-zA-Z_]\w*/, "identifier"],
      
      // Whitespace
      [/[ \t\r\n]+/, ""],
      
      // Brackets
      [/[{}()\[\]]/, "@brackets"],
      
      // Delimiters
      [/[,.]/, "delimiter"],
    ],
    
    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"],
    ],
    
    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"],
    ],
  },
};
