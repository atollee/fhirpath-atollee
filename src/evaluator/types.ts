/**
 * FHIRPath Evaluator Types
 * 
 * Types for the native FHIRPath evaluator.
 */

import type { Model } from "../types.ts";
import type { ITerminologyService, TerminologiesProxy } from "../terminology/mod.ts";
import type { ITypeFactory } from "../factory/mod.ts";

/**
 * A FHIRPath collection is always an array (can be empty)
 */
export type FhirPathCollection = unknown[];

/**
 * Context for FHIRPath evaluation
 */
export interface EvaluationContext {
  /** The root resource being evaluated */
  resource?: unknown;
  /** The root resource (same as resource for top-level) */
  rootResource?: unknown;
  /** The context element (for constraints) */
  context?: unknown;
  /** %terminologies proxy for terminology operations */
  terminologies?: TerminologiesProxy;
  /** %factory for creating FHIR types */
  factory?: ITypeFactory;
  /** Additional environment variables */
  [key: string]: unknown;
}

/**
 * Reference resolver interface for resolve() function
 * Allows resolving FHIR references to actual resources
 */
export interface IReferenceResolver {
  /**
   * Resolve a FHIR reference to a resource
   * @param reference The reference string (e.g., "Patient/123" or full URL)
   * @param context The current evaluation context (may contain Bundle for relative refs)
   * @returns The resolved resource or undefined if not found
   */
  resolve(reference: string, context?: EvaluationContext): unknown | Promise<unknown>;
}

/**
 * Options for FHIRPath evaluation
 */
export interface EvaluatorOptions {
  /** FHIR model for type information */
  model?: Model;
  /** User-defined functions */
  userInvocationTable?: UserInvocationTable;
  /** Trace function for debugging */
  traceFn?: (value: unknown, label: string) => void;
  /** Function to check type derivation */
  isDerivedResourceFn?: (resourceType: string, expectedType: string) => boolean;
  /** Terminology service for memberOf and %terminologies */
  terminologyService?: ITerminologyService;
  /** URL of terminology server (creates RemoteTerminologyService) */
  terminologyUrl?: string;
  /** Enable async evaluation (required for terminology operations) */
  async?: boolean | "always";
  /** Reference resolver for resolve() function */
  referenceResolver?: IReferenceResolver;
}

/**
 * User-defined function signature
 */
export interface UserFunction {
  fn: (...args: unknown[]) => unknown;
  arity?: Record<number, string[]>;
  nullable?: boolean;
}

/**
 * Table of user-defined functions
 */
export type UserInvocationTable = Record<string, UserFunction>;

/**
 * Internal evaluation state
 */
export interface EvaluatorState {
  /** Current collection being processed */
  current: FhirPathCollection;
  /** Environment variables (%resource, etc.) */
  environment: EvaluationContext;
  /** Options */
  options: EvaluatorOptions;
  /** Current index (for $index) */
  index: number;
  /** Total/accumulator (for $total in aggregate) - can be any value */
  total: unknown;
  /** Defined variables (from defineVariable) */
  variables: Map<string, FhirPathCollection>;
}

/**
 * FHIRPath type system types
 */
export type FhirPathType = 
  | "Boolean"
  | "String" 
  | "Integer"
  | "Decimal"
  | "Date"
  | "DateTime"
  | "Time"
  | "Quantity"
  | "FHIR";

/**
 * Quantity value with unit
 */
export interface FhirPathQuantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
}

/**
 * Check if a value is a FHIRPath quantity
 */
export function isQuantity(value: unknown): value is FhirPathQuantity {
  return typeof value === "object" && value !== null && "value" in value && typeof (value as FhirPathQuantity).value === "number";
}

// ============================================================
// REFLECTION TYPE INFO (FHIRPath STU)
// ============================================================

/**
 * Base type for all TypeInfo structures
 */
export interface TypeInfo {
  readonly _typeInfo: true;
}

/**
 * TypeInfo for primitive/simple types (String, Integer, Boolean, etc.)
 */
export interface SimpleTypeInfo extends TypeInfo {
  readonly namespace: string;
  readonly name: string;
  readonly baseType: string;
}

/**
 * Element definition within a ClassInfo
 */
export interface ClassInfoElement {
  readonly name: string;
  readonly type: string;
  readonly isOneBased: boolean;
}

/**
 * TypeInfo for class/complex types (Patient, Observation, etc.)
 */
export interface ClassInfo extends TypeInfo {
  readonly namespace: string;
  readonly name: string;
  readonly baseType: string;
  readonly element: ClassInfoElement[];
}

/**
 * TypeInfo for collection/list types
 */
export interface ListTypeInfo extends TypeInfo {
  readonly elementType: string;
}

/**
 * Element definition within a TupleTypeInfo
 */
export interface TupleTypeInfoElement {
  readonly name: string;
  readonly type: string;
  readonly isOneBased: boolean;
}

/**
 * TypeInfo for anonymous/tuple types (e.g., Patient.contact)
 */
export interface TupleTypeInfo extends TypeInfo {
  readonly element: TupleTypeInfoElement[];
}

/**
 * Create a SimpleTypeInfo
 */
export function createSimpleTypeInfo(name: string, baseType = "System.Any"): SimpleTypeInfo {
  return {
    _typeInfo: true,
    namespace: "System",
    name,
    baseType,
  };
}

/**
 * Create a ClassInfo for a FHIR resource or complex type
 */
export function createClassInfo(
  namespace: string,
  name: string,
  baseType: string,
  element: ClassInfoElement[] = []
): ClassInfo {
  return {
    _typeInfo: true,
    namespace,
    name,
    baseType,
    element,
  };
}

/**
 * Create a ListTypeInfo
 */
export function createListTypeInfo(elementType: string): ListTypeInfo {
  return {
    _typeInfo: true,
    elementType,
  };
}

/**
 * Create a TupleTypeInfo
 */
export function createTupleTypeInfo(element: TupleTypeInfoElement[]): TupleTypeInfo {
  return {
    _typeInfo: true,
    element,
  };
}

/**
 * Get the TypeInfo for a value
 */
export function getTypeInfo(value: unknown): TypeInfo {
  if (value === null || value === undefined) {
    return createSimpleTypeInfo("Any");
  }

  // Primitive types
  if (typeof value === "boolean") {
    return createSimpleTypeInfo("Boolean");
  }
  if (typeof value === "string") {
    // Check if it's a date/time string
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
      return createSimpleTypeInfo("Date");
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return createSimpleTypeInfo("DateTime");
    }
    if (/^\d{2}:\d{2}(:\d{2})?/.test(value)) {
      return createSimpleTypeInfo("Time");
    }
    return createSimpleTypeInfo("String");
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return createSimpleTypeInfo("Integer");
    }
    return createSimpleTypeInfo("Decimal");
  }

  // Quantity
  if (isQuantity(value)) {
    return createSimpleTypeInfo("Quantity");
  }

  // Objects (FHIR resources and complex types)
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    
    // FHIR Resource
    if ("resourceType" in obj && typeof obj.resourceType === "string") {
      return createClassInfo("FHIR", obj.resourceType, "FHIR.DomainResource", []);
    }

    // Anonymous/Tuple type - return basic info
    const elements: TupleTypeInfoElement[] = Object.keys(obj).map(key => ({
      name: key,
      type: getTypeString(obj[key]),
      isOneBased: false,
    }));
    return createTupleTypeInfo(elements);
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return createListTypeInfo("System.Any");
    }
    return createListTypeInfo(getTypeString(value[0]));
  }

  return createSimpleTypeInfo("Any");
}

/**
 * Get a type string for a value (used in TypeInfo)
 */
function getTypeString(value: unknown): string {
  if (value === null || value === undefined) {
    return "System.Any";
  }
  if (typeof value === "boolean") return "System.Boolean";
  if (typeof value === "string") return "System.String";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "System.Integer" : "System.Decimal";
  }
  if (isQuantity(value)) return "System.Quantity";
  if (Array.isArray(value)) {
    return value.length > 0 ? `List<${getTypeString(value[0])}>` : "List<System.Any>";
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if ("resourceType" in obj && typeof obj.resourceType === "string") {
      return `FHIR.${obj.resourceType}`;
    }
    return "FHIR.Element";
  }
  return "System.Any";
}
