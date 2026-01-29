/**
 * Terminology Service Types for FHIRPath %terminologies API
 * 
 * Implements the FHIR FHIRPath Terminology Service API:
 * https://build.fhir.org/fhirpath.html#txapi
 */

// Inline FHIR type definitions (no external dependency)
// These are simplified versions compatible with FHIR R4/R5/R6

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
 * FHIR ValueSet type (simplified)
 */
export interface FhirValueSet {
  resourceType: "ValueSet";
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  status?: string;
  expansion?: {
    identifier?: string;
    timestamp?: string;
    total?: number;
    contains?: Array<{
      system?: string;
      version?: string;
      code?: string;
      display?: string;
    }>;
  };
  compose?: {
    include?: Array<{
      system?: string;
      version?: string;
      concept?: Array<{ code?: string; display?: string }>;
      filter?: Array<{ property?: string; op?: string; value?: string }>;
    }>;
  };
  [key: string]: unknown;
}

/**
 * FHIR CodeSystem type (simplified)
 */
export interface FhirCodeSystem {
  resourceType: "CodeSystem";
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  status?: string;
  concept?: Array<{
    code?: string;
    display?: string;
    definition?: string;
  }>;
  [key: string]: unknown;
}

/**
 * FHIR ConceptMap type (simplified)
 */
export interface FhirConceptMap {
  resourceType: "ConceptMap";
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  status?: string;
  group?: Array<{
    source?: string;
    target?: string;
    element?: Array<{
      code?: string;
      target?: Array<{
        code?: string;
        equivalence?: string;
      }>;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * FHIR Parameters type (simplified)
 */
export interface FhirParameters {
  resourceType: "Parameters";
  parameter?: Array<{
    name?: string;
    valueString?: string;
    valueBoolean?: boolean;
    valueCode?: string;
    valueCoding?: FhirCoding;
    part?: Array<{
      name?: string;
      valueString?: string;
      valueBoolean?: boolean;
      valueCode?: string;
    }>;
  }>;
  [key: string]: unknown;
}

/**
 * Coded value - can be a Coding or CodeableConcept
 */
export type CodedValue = FhirCoding | FhirCodeableConcept | string;

/**
 * Parameters for terminology operations
 */
export interface TerminologyParams {
  [key: string]: unknown;
}

/**
 * Result of subsumes operation
 */
export type SubsumesResult = "equivalent" | "subsumes" | "subsumed-by" | "not-subsumed";

/**
 * Terminology Service Interface
 * 
 * Provides access to terminology operations from FHIRPath expressions.
 * This interface can be implemented by:
 * - Remote FHIR Terminology Server (via HTTP)
 * - Local terminology database
 * - In-memory terminology provider
 */
export interface ITerminologyService {
  /**
   * Expand a ValueSet
   * 
   * @param valueSet - ValueSet URL or inline ValueSet
   * @param params - Expansion parameters
   * @returns Expanded ValueSet
   */
  expand(
    valueSet: string | FhirValueSet,
    params?: TerminologyParams,
  ): Promise<FhirValueSet>;

  /**
   * Lookup a code in a CodeSystem
   * 
   * @param coded - The code to lookup (Coding, CodeableConcept, or code string)
   * @param params - Lookup parameters (system, version, etc.)
   * @returns Parameters resource with lookup results
   */
  lookup(
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<FhirParameters>;

  /**
   * Validate a code against a ValueSet
   * 
   * @param valueSet - ValueSet URL or inline ValueSet
   * @param coded - The code to validate
   * @param params - Validation parameters
   * @returns Parameters resource with validation results
   */
  validateVS(
    valueSet: string | FhirValueSet,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<FhirParameters>;

  /**
   * Validate a code against a CodeSystem
   * 
   * @param codeSystem - CodeSystem URL or inline CodeSystem
   * @param coded - The code to validate
   * @param params - Validation parameters
   * @returns Parameters resource with validation results
   */
  validateCS(
    codeSystem: string | FhirCodeSystem,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<FhirParameters>;

  /**
   * Test subsumption relationship between two codes
   * 
   * @param system - The code system URL
   * @param codeA - First code
   * @param codeB - Second code
   * @param params - Additional parameters
   * @returns Subsumption relationship code
   */
  subsumes(
    system: string,
    codeA: CodedValue,
    codeB: CodedValue,
    params?: TerminologyParams,
  ): Promise<SubsumesResult>;

  /**
   * Translate a code using a ConceptMap
   * 
   * @param conceptMap - ConceptMap URL or inline ConceptMap
   * @param coded - The code to translate
   * @param params - Translation parameters
   * @returns Parameters resource with translation results
   */
  translate(
    conceptMap: string | FhirConceptMap,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<FhirParameters>;

  /**
   * Check if a code is a member of a ValueSet
   * 
   * @param coded - The code to check
   * @param valueSetUrl - The ValueSet URL
   * @returns true if the code is a member
   */
  memberOf(
    coded: CodedValue,
    valueSetUrl: string,
  ): Promise<boolean>;
}

/**
 * Configuration for remote terminology service
 */
export interface RemoteTerminologyServiceConfig {
  /** Base URL of the terminology server */
  baseUrl: string;
  
  /** Optional HTTP headers (e.g., for authentication) */
  headers?: Record<string, string>;
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Enable caching of terminology responses */
  enableCache?: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Options for terminology operations in FHIRPath
 */
export interface TerminologyOptions {
  /** URL of the terminology server */
  terminologyUrl?: string;
  
  /** Pre-configured terminology service */
  terminologyService?: ITerminologyService;
  
  /** HTTP headers for terminology requests */
  httpHeaders?: Record<string, Record<string, string>>;
}
