/**
 * Type Factory Module
 * 
 * Provides support for the FHIRPath %factory API
 * for creating FHIR data types within expressions.
 */

export type {
  ITypeFactory,
  PrimitiveWithExtension,
  FhirPrimitiveType,
} from "./types.ts";

export {
  TypeFactory,
  createTypeFactory,
  globalFactory,
} from "./factory.ts";
