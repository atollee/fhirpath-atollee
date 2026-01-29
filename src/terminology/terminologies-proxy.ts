/**
 * %terminologies Proxy for FHIRPath
 * 
 * This class provides the %terminologies environment variable
 * for FHIRPath expressions.
 * 
 * Usage in FHIRPath:
 * - %terminologies.expand(valueSetUrl)
 * - %terminologies.lookup(coding)
 * - %terminologies.validateVS(valueSetUrl, coding)
 * - %terminologies.validateCS(codeSystemUrl, coding)
 * - %terminologies.subsumes(system, codeA, codeB)
 * - %terminologies.translate(conceptMapUrl, coding)
 */

import type { 
  ITerminologyService, 
  CodedValue, 
  TerminologyParams,
  SubsumesResult,
  FhirValueSet,
  FhirParameters,
  FhirCodeSystem,
  FhirConceptMap,
} from "./types.ts";

// Type aliases for backward compatibility
type ValueSet = FhirValueSet;
type Parameters = FhirParameters;
type CodeSystem = FhirCodeSystem;
type ConceptMap = FhirConceptMap;

/**
 * Terminologies proxy that wraps an ITerminologyService
 * and provides the FHIRPath %terminologies API
 */
export class TerminologiesProxy {
  constructor(private service: ITerminologyService) {}

  /**
   * Expand a ValueSet
   * 
   * FHIRPath: %terminologies.expand(valueSet, params)
   */
  async expand(
    valueSet: string | ValueSet,
    params?: TerminologyParams,
  ): Promise<ValueSet> {
    return this.service.expand(valueSet, params);
  }

  /**
   * Lookup a code
   * 
   * FHIRPath: %terminologies.lookup(coded, params)
   */
  async lookup(
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    return this.service.lookup(coded, params);
  }

  /**
   * Validate code against ValueSet
   * 
   * FHIRPath: %terminologies.validateVS(valueSet, coded, params)
   */
  async validateVS(
    valueSet: string | ValueSet,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    return this.service.validateVS(valueSet, coded, params);
  }

  /**
   * Validate code against CodeSystem
   * 
   * FHIRPath: %terminologies.validateCS(codeSystem, coded, params)
   */
  async validateCS(
    codeSystem: string | CodeSystem,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    return this.service.validateCS(codeSystem, coded, params);
  }

  /**
   * Test subsumption
   * 
   * FHIRPath: %terminologies.subsumes(system, coded1, coded2, params)
   */
  async subsumes(
    system: string,
    codeA: CodedValue,
    codeB: CodedValue,
    params?: TerminologyParams,
  ): Promise<SubsumesResult> {
    return this.service.subsumes(system, codeA, codeB, params);
  }

  /**
   * Translate code
   * 
   * FHIRPath: %terminologies.translate(conceptMap, coded, params)
   */
  async translate(
    conceptMap: string | ConceptMap,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    return this.service.translate(conceptMap, coded, params);
  }

  /**
   * Get the underlying service
   */
  getService(): ITerminologyService {
    return this.service;
  }
}

/**
 * Create a %terminologies proxy from an ITerminologyService
 */
export function createTerminologiesProxy(
  service: ITerminologyService,
): TerminologiesProxy {
  return new TerminologiesProxy(service);
}
