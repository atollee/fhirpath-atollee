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
