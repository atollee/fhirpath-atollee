/**
 * Remote Terminology Service Implementation
 * 
 * Connects to a FHIR Terminology Server via HTTP REST API.
 */

import type { 
  ITerminologyService, 
  CodedValue, 
  TerminologyParams,
  SubsumesResult,
  RemoteTerminologyServiceConfig,
  FhirValueSet,
  FhirParameters,
  FhirCodeSystem,
  FhirConceptMap,
  FhirCoding,
  FhirCodeableConcept,
} from "./types.ts";

// Type alias for backward compatibility
type ValueSet = FhirValueSet;
type Parameters = FhirParameters;
type CodeSystem = FhirCodeSystem;
type ConceptMap = FhirConceptMap;
type Coding = FhirCoding;
type CodeableConcept = FhirCodeableConcept;

/** Parameters parameter entry */
interface ParametersParameter {
  name?: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueCode?: string;
  valueCoding?: Coding;
  part?: ParametersParameter[];
  resource?: unknown;
}

/**
 * Simple LRU cache for terminology responses
 */
class TerminologyCache {
  private cache = new Map<string, { value: unknown; expires: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 100, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Remote FHIR Terminology Service
 */
export class RemoteTerminologyService implements ITerminologyService {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeoutMs: number;
  private cache?: TerminologyCache;

  constructor(config: RemoteTerminologyServiceConfig) {
    // Ensure URL doesn't end with slash
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/fhir+json",
      "Accept": "application/fhir+json",
      ...config.headers,
    };
    this.timeoutMs = config.timeoutMs ?? 30000;
    
    if (config.enableCache !== false) {
      this.cache = new TerminologyCache(100, config.cacheTtlMs ?? 60000);
    }
  }

  /**
   * Make HTTP request to terminology server
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Terminology server error (${response.status}): ${errorText}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert CodedValue to Coding for API calls
   */
  private toCoding(coded: CodedValue): Coding {
    if (typeof coded === "string") {
      // Assume format "system|code" or just "code"
      const parts = coded.split("|");
      if (parts.length === 2) {
        return { system: parts[0], code: parts[1] };
      }
      return { code: coded };
    }
    if ("coding" in coded) {
      // CodeableConcept - use first coding
      const cc = coded as CodeableConcept;
      return cc.coding?.[0] ?? { code: "" };
    }
    return coded as Coding;
  }

  /**
   * Build query parameters from TerminologyParams
   */
  private buildQueryParams(params?: TerminologyParams): string {
    if (!params || Object.keys(params).length === 0) return "";
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }

  /**
   * Extract boolean result from Parameters
   */
  private getBooleanResult(params: Parameters, paramName = "result"): boolean {
    const param = params.parameter?.find((p: ParametersParameter) => p.name === paramName);
    return param?.valueBoolean ?? false;
  }

  /**
   * Extract code result from Parameters
   */
  private getCodeResult(params: Parameters, paramName = "outcome"): string | undefined {
    const param = params.parameter?.find((p: ParametersParameter) => p.name === paramName);
    return param?.valueCode;
  }

  // ============================================================
  // ITerminologyService Implementation
  // ============================================================

  async expand(
    valueSet: string | ValueSet,
    params?: TerminologyParams,
  ): Promise<ValueSet> {
    const cacheKey = `expand:${typeof valueSet === "string" ? valueSet : valueSet.url}:${JSON.stringify(params)}`;
    
    if (this.cache) {
      const cached = this.cache.get<ValueSet>(cacheKey);
      if (cached) return cached;
    }

    let result: ValueSet;

    if (typeof valueSet === "string") {
      // URL reference - use GET
      const qs = this.buildQueryParams({ url: valueSet, ...params });
      result = await this.request<ValueSet>("GET", `/ValueSet/$expand${qs}`);
    } else {
      // Inline ValueSet - use POST
      const paramEntries: ParametersParameter[] = [
        { name: "valueSet", resource: valueSet },
        ...Object.entries(params ?? {}).map(([name, value]) => ({
          name,
          valueString: String(value),
        })),
      ];
      const parameters: Parameters = {
        resourceType: "Parameters",
        parameter: paramEntries as Parameters["parameter"],
      };
      result = await this.request<ValueSet>("POST", "/ValueSet/$expand", parameters);
    }

    if (this.cache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async lookup(
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    const coding = this.toCoding(coded);
    const qs = this.buildQueryParams({
      system: coding.system,
      code: coding.code,
      version: coding.version,
      ...params,
    });
    
    return this.request<Parameters>("GET", `/CodeSystem/$lookup${qs}`);
  }

  async validateVS(
    valueSet: string | ValueSet,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    const coding = this.toCoding(coded);
    
    if (typeof valueSet === "string") {
      const qs = this.buildQueryParams({
        url: valueSet,
        system: coding.system,
        code: coding.code,
        ...params,
      });
      return this.request<Parameters>("GET", `/ValueSet/$validate-code${qs}`);
    } else {
      const paramEntries: ParametersParameter[] = [
        { name: "valueSet", resource: valueSet },
        { name: "coding", valueCoding: coding },
        ...Object.entries(params ?? {}).map(([name, value]) => ({
          name,
          valueString: String(value),
        })),
      ];
      const parameters: Parameters = {
        resourceType: "Parameters",
        parameter: paramEntries as Parameters["parameter"],
      };
      return this.request<Parameters>("POST", "/ValueSet/$validate-code", parameters);
    }
  }

  async validateCS(
    codeSystem: string | CodeSystem,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    const coding = this.toCoding(coded);
    
    if (typeof codeSystem === "string") {
      const qs = this.buildQueryParams({
        url: codeSystem,
        code: coding.code,
        ...params,
      });
      return this.request<Parameters>("GET", `/CodeSystem/$validate-code${qs}`);
    } else {
      const paramEntries: ParametersParameter[] = [
        { name: "codeSystem", resource: codeSystem },
        { name: "coding", valueCoding: coding },
        ...Object.entries(params ?? {}).map(([name, value]) => ({
          name,
          valueString: String(value),
        })),
      ];
      const parameters: Parameters = {
        resourceType: "Parameters",
        parameter: paramEntries as Parameters["parameter"],
      };
      return this.request<Parameters>("POST", "/CodeSystem/$validate-code", parameters);
    }
  }

  async subsumes(
    system: string,
    codeA: CodedValue,
    codeB: CodedValue,
    params?: TerminologyParams,
  ): Promise<SubsumesResult> {
    const codingA = this.toCoding(codeA);
    const codingB = this.toCoding(codeB);
    
    const qs = this.buildQueryParams({
      system,
      codeA: codingA.code,
      codeB: codingB.code,
      ...params,
    });
    
    const result = await this.request<Parameters>("GET", `/CodeSystem/$subsumes${qs}`);
    const outcome = this.getCodeResult(result, "outcome");
    
    if (outcome === "equivalent" || outcome === "subsumes" || 
        outcome === "subsumed-by" || outcome === "not-subsumed") {
      return outcome;
    }
    
    return "not-subsumed";
  }

  async translate(
    conceptMap: string | ConceptMap,
    coded: CodedValue,
    params?: TerminologyParams,
  ): Promise<Parameters> {
    const coding = this.toCoding(coded);
    
    if (typeof conceptMap === "string") {
      const qs = this.buildQueryParams({
        url: conceptMap,
        system: coding.system,
        code: coding.code,
        ...params,
      });
      return this.request<Parameters>("GET", `/ConceptMap/$translate${qs}`);
    } else {
      const paramEntries: ParametersParameter[] = [
        { name: "conceptMap", resource: conceptMap },
        { name: "coding", valueCoding: coding },
        ...Object.entries(params ?? {}).map(([name, value]) => ({
          name,
          valueString: String(value),
        })),
      ];
      const parameters: Parameters = {
        resourceType: "Parameters",
        parameter: paramEntries as Parameters["parameter"],
      };
      return this.request<Parameters>("POST", "/ConceptMap/$translate", parameters);
    }
  }

  async memberOf(
    coded: CodedValue,
    valueSetUrl: string,
  ): Promise<boolean> {
    const cacheKey = `memberOf:${valueSetUrl}:${JSON.stringify(this.toCoding(coded))}`;
    
    if (this.cache) {
      const cached = this.cache.get<boolean>(cacheKey);
      if (cached !== undefined) return cached;
    }

    try {
      const result = await this.validateVS(valueSetUrl, coded);
      const isMember = this.getBooleanResult(result, "result");
      
      if (this.cache) {
        this.cache.set(cacheKey, isMember);
      }
      
      return isMember;
    } catch {
      // If validation fails, code is not a member
      return false;
    }
  }
}

/**
 * Create a terminology service from a URL
 */
export function createTerminologyService(
  url: string,
  headers?: Record<string, string>,
): ITerminologyService {
  return new RemoteTerminologyService({
    baseUrl: url,
    headers,
    enableCache: true,
  });
}
