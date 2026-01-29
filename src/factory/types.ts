/**
 * Type Factory Types for FHIRPath %factory API
 * 
 * Implements the FHIR FHIRPath Type Factory API:
 * https://hl7.org/fhir/fhirpath.html#factory
 */

// Inline FHIR type definitions (no external dependency)
// These are compatible with FHIR R4/R5/R6

/**
 * FHIR Extension type
 */
export interface FhirExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueUri?: string;
  valueUrl?: string;
  valueCode?: string;
  valueDate?: string;
  valueDateTime?: string;
  valueCoding?: FhirCoding;
  valueQuantity?: FhirQuantity;
  valueReference?: { reference?: string };
  [key: string]: unknown;
}

/**
 * FHIR Coding type
 */
export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

/**
 * FHIR CodeableConcept type
 */
export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

/**
 * FHIR Quantity type
 */
export interface FhirQuantity {
  value?: number;
  comparator?: string;
  unit?: string;
  system?: string;
  code?: string;
}

/**
 * FHIR Identifier type
 */
export interface FhirIdentifier {
  use?: "usual" | "official" | "temp" | "secondary" | "old";
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
  period?: { start?: string; end?: string };
  assigner?: { reference?: string; display?: string };
}

/**
 * FHIR HumanName type
 */
export interface FhirHumanName {
  use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: { start?: string; end?: string };
}

/**
 * FHIR ContactPoint type
 */
export interface FhirContactPoint {
  system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: "home" | "work" | "temp" | "old" | "mobile";
  rank?: number;
  period?: { start?: string; end?: string };
}

/**
 * FHIR Address type
 */
export interface FhirAddress {
  use?: "home" | "work" | "temp" | "old" | "billing";
  type?: "postal" | "physical" | "both";
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: { start?: string; end?: string };
}

// Type aliases for backward compatibility
type Extension = FhirExtension;
type Coding = FhirCoding;
type CodeableConcept = FhirCodeableConcept;
type Quantity = FhirQuantity;
type Identifier = FhirIdentifier;
type HumanName = FhirHumanName;
type ContactPoint = FhirContactPoint;
type Address = FhirAddress;

/**
 * Primitive value with optional extensions
 */
export interface PrimitiveWithExtension<T> {
  value?: T;
  id?: string;
  extension?: FhirExtension[];
}

/**
 * FHIR Primitive types that can be created via %factory
 */
export type FhirPrimitiveType = 
  | "boolean"
  | "integer"
  | "integer64"
  | "string"
  | "decimal"
  | "uri"
  | "url"
  | "canonical"
  | "base64Binary"
  | "instant"
  | "date"
  | "dateTime"
  | "time"
  | "code"
  | "oid"
  | "id"
  | "markdown"
  | "unsignedInt"
  | "positiveInt"
  | "uuid";

/**
 * Type Factory Interface
 * 
 * Provides methods to create FHIR data types within FHIRPath expressions.
 */
export interface ITypeFactory {
  // ============================================================
  // Primitive Type Factories
  // ============================================================

  /**
   * Create a boolean value with optional extensions
   */
  boolean(value: boolean, extensions?: Extension[]): PrimitiveWithExtension<boolean>;

  /**
   * Create an integer value with optional extensions
   */
  integer(value: number, extensions?: Extension[]): PrimitiveWithExtension<number>;

  /**
   * Create an integer64 value with optional extensions
   */
  integer64(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a string value with optional extensions
   */
  string(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a decimal value with optional extensions
   */
  decimal(value: number, extensions?: Extension[]): PrimitiveWithExtension<number>;

  /**
   * Create a uri value with optional extensions
   */
  uri(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a url value with optional extensions
   */
  url(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a canonical value with optional extensions
   */
  canonical(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a base64Binary value with optional extensions
   */
  base64Binary(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create an instant value with optional extensions
   */
  instant(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a date value with optional extensions
   */
  date(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a dateTime value with optional extensions
   */
  dateTime(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a time value with optional extensions
   */
  time(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a code value with optional extensions
   */
  code(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create an oid value with optional extensions
   */
  oid(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create an id value with optional extensions
   */
  id(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create a markdown value with optional extensions
   */
  markdown(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  /**
   * Create an unsignedInt value with optional extensions
   */
  unsignedInt(value: number, extensions?: Extension[]): PrimitiveWithExtension<number>;

  /**
   * Create a positiveInt value with optional extensions
   */
  positiveInt(value: number, extensions?: Extension[]): PrimitiveWithExtension<number>;

  /**
   * Create a uuid value with optional extensions
   */
  uuid(value: string, extensions?: Extension[]): PrimitiveWithExtension<string>;

  // ============================================================
  // Complex Type Factories
  // ============================================================

  /**
   * Create an Extension
   */
  Extension(url: string, value?: unknown): Extension;

  /**
   * Create an Identifier
   */
  Identifier(
    system?: string,
    value?: string,
    use?: "usual" | "official" | "temp" | "secondary" | "old",
    type?: CodeableConcept,
  ): Identifier;

  /**
   * Create a HumanName
   */
  HumanName(
    family?: string,
    given?: string | string[],
    prefix?: string | string[],
    suffix?: string | string[],
    text?: string,
    use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden",
  ): HumanName;

  /**
   * Create a ContactPoint
   */
  ContactPoint(
    system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other",
    value?: string,
    use?: "home" | "work" | "temp" | "old" | "mobile",
  ): ContactPoint;

  /**
   * Create an Address
   */
  Address(
    line?: string | string[],
    city?: string,
    state?: string,
    postalCode?: string,
    country?: string,
    use?: "home" | "work" | "temp" | "old" | "billing",
    type?: "postal" | "physical" | "both",
  ): Address;

  /**
   * Create a Quantity
   */
  Quantity(
    system?: string,
    code?: string,
    value?: number,
    unit?: string,
  ): Quantity;

  /**
   * Create a Coding
   */
  Coding(
    system?: string,
    code?: string,
    display?: string,
    version?: string,
  ): Coding;

  /**
   * Create a CodeableConcept
   */
  CodeableConcept(
    coding?: Coding | Coding[],
    text?: string,
  ): CodeableConcept;

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Create an empty instance of any type
   */
  create(typeName: string): unknown;

  /**
   * Add an extension to an existing instance
   */
  withExtension(instance: unknown, url: string, value?: unknown): unknown;

  /**
   * Add a property to an existing instance
   */
  withProperty(instance: unknown, name: string, value: unknown): unknown;
}
