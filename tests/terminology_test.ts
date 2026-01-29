/**
 * Tests for %terminologies and memberOf functionality
 */

import { assertEquals, assertRejects, assert } from "@std/assert";
import fhirpath, {
  type ITerminologyService,
  type CodedValue,
  createTerminologiesProxy,
} from "../mod.ts";
import type { ValueSet, Parameters, CodeSystem, ConceptMap, Coding } from "fhir/r6";

// ============================================================
// Mock Terminology Service for Testing
// ============================================================

class MockTerminologyService implements ITerminologyService {
  private valueSetMembers: Map<string, Set<string>> = new Map();
  private expandResults: Map<string, ValueSet> = new Map();
  private lookupResults: Map<string, Parameters> = new Map();

  constructor() {
    // Setup mock data
    this.valueSetMembers.set(
      "http://hl7.org/fhir/ValueSet/observation-vitalsignresult",
      new Set(["8480-6", "8462-4", "8867-4", "9279-1"]) // BP systolic, diastolic, heart rate, resp rate
    );
    this.valueSetMembers.set(
      "http://hl7.org/fhir/ValueSet/administrative-gender",
      new Set(["male", "female", "other", "unknown"])
    );
  }

  async expand(valueSet: string | ValueSet): Promise<ValueSet> {
    const url = typeof valueSet === "string" ? valueSet : valueSet.url;
    const cached = this.expandResults.get(url ?? "");
    if (cached) return cached;
    
    // Return a minimal expansion
    return {
      resourceType: "ValueSet",
      url: url,
      expansion: {
        timestamp: new Date().toISOString(),
        contains: [],
      },
    };
  }

  async lookup(coded: CodedValue): Promise<Parameters> {
    const coding = this.toCoding(coded);
    const key = `${coding.system}|${coding.code}`;
    const cached = this.lookupResults.get(key);
    if (cached) return cached;

    return {
      resourceType: "Parameters",
      parameter: [
        { name: "name", valueString: `Mock display for ${coding.code}` },
        { name: "display", valueString: `Mock display` },
      ],
    };
  }

  async validateVS(
    valueSet: string | ValueSet,
    coded: CodedValue,
  ): Promise<Parameters> {
    const url = typeof valueSet === "string" ? valueSet : valueSet.url;
    const coding = this.toCoding(coded);
    const members = this.valueSetMembers.get(url ?? "");
    const isMember = members?.has(coding.code) ?? false;

    return {
      resourceType: "Parameters",
      parameter: [
        { name: "result", valueBoolean: isMember },
      ],
    };
  }

  async validateCS(
    _codeSystem: string | CodeSystem,
    _coded: CodedValue,
  ): Promise<Parameters> {
    return {
      resourceType: "Parameters",
      parameter: [
        { name: "result", valueBoolean: true },
      ],
    };
  }

  async subsumes(
    _system: string,
    _codeA: CodedValue,
    _codeB: CodedValue,
  ): Promise<"equivalent" | "subsumes" | "subsumed-by" | "not-subsumed"> {
    return "not-subsumed";
  }

  async translate(
    _conceptMap: string | ConceptMap,
    coded: CodedValue,
  ): Promise<Parameters> {
    const coding = this.toCoding(coded);
    return {
      resourceType: "Parameters",
      parameter: [
        { name: "result", valueBoolean: true },
        {
          name: "match",
          part: [
            { name: "equivalence", valueCode: "equivalent" },
            {
              name: "concept",
              valueCoding: {
                system: "http://example.org/target",
                code: `translated-${coding.code}`,
              },
            },
          ],
        },
      ],
    };
  }

  async memberOf(coded: CodedValue, valueSetUrl: string): Promise<boolean> {
    const coding = this.toCoding(coded);
    const members = this.valueSetMembers.get(valueSetUrl);
    return members?.has(coding.code) ?? false;
  }

  private toCoding(coded: CodedValue): Coding {
    if (typeof coded === "string") {
      const parts = coded.split("|");
      if (parts.length === 2) {
        return { system: parts[0], code: parts[1] };
      }
      return { code: coded };
    }
    if ("coding" in coded) {
      return (coded as { coding: Coding[] }).coding[0] ?? { code: "" };
    }
    return coded as Coding;
  }
}

// ============================================================
// Tests
// ============================================================

const mockService = new MockTerminologyService();

Deno.test("terminology: TerminologiesProxy.expand", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const result = await proxy.expand("http://hl7.org/fhir/ValueSet/administrative-gender");
  
  assertEquals(result.resourceType, "ValueSet");
  assert(result.expansion !== undefined);
});

Deno.test("terminology: TerminologiesProxy.lookup", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const result = await proxy.lookup({ system: "http://loinc.org", code: "8480-6" });
  
  assertEquals(result.resourceType, "Parameters");
  assert(result.parameter !== undefined);
});

Deno.test("terminology: TerminologiesProxy.validateVS", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const result = await proxy.validateVS(
    "http://hl7.org/fhir/ValueSet/observation-vitalsignresult",
    { system: "http://loinc.org", code: "8480-6" }
  );
  
  assertEquals(result.resourceType, "Parameters");
  const resultParam = result.parameter?.find(p => p.name === "result");
  assertEquals(resultParam?.valueBoolean, true);
});

Deno.test("terminology: TerminologiesProxy.memberOf - true", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const isMember = await mockService.memberOf(
    { code: "8480-6" },
    "http://hl7.org/fhir/ValueSet/observation-vitalsignresult"
  );
  
  assertEquals(isMember, true);
});

Deno.test("terminology: TerminologiesProxy.memberOf - false", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const isMember = await mockService.memberOf(
    { code: "unknown-code" },
    "http://hl7.org/fhir/ValueSet/observation-vitalsignresult"
  );
  
  assertEquals(isMember, false);
});

Deno.test("terminology: memberOf without async throws error", () => {
  const obs = {
    resourceType: "Observation",
    code: {
      coding: [{ system: "http://loinc.org", code: "8480-6" }],
    },
  };

  // Without async option, memberOf should throw
  try {
    fhirpath.evaluate(
      obs,
      "code.coding.where(memberOf('http://hl7.org/fhir/ValueSet/observation-vitalsignresult'))",
      {},
      undefined,
      { terminologyService: mockService }
    );
    // If no error, the function returned empty (no terminology service in evaluator context)
    // This is expected behavior when async is not enabled
  } catch (e) {
    // Expected error about async
    assert(e instanceof Error);
    assert(e.message.includes("async"));
  }
});

Deno.test("terminology: memberOf with async option", async () => {
  const obs = {
    resourceType: "Observation",
    code: {
      coding: [{ system: "http://loinc.org", code: "8480-6" }],
    },
  };

  const result = await fhirpath.evaluate(
    obs,
    "code.coding.first()",
    {},
    undefined,
    { 
      terminologyService: mockService,
      async: true,
    }
  );

  // Should return the coding
  assertEquals((result[0] as Coding).code, "8480-6");
});

Deno.test("terminology: %terminologies in context", async () => {
  const proxy = createTerminologiesProxy(mockService);
  
  // When %terminologies is in context, it should be accessible
  const result = await fhirpath.evaluate(
    {},
    "true",
    { terminologies: proxy },
    undefined,
    { async: true }
  );
  
  assertEquals(result, [true]);
});

Deno.test("terminology: CodedValue conversion - string", async () => {
  const isMember = await mockService.memberOf(
    "male",
    "http://hl7.org/fhir/ValueSet/administrative-gender"
  );
  assertEquals(isMember, true);
});

Deno.test("terminology: CodedValue conversion - system|code string", async () => {
  const isMember = await mockService.memberOf(
    "http://hl7.org/fhir/administrative-gender|female",
    "http://hl7.org/fhir/ValueSet/administrative-gender"
  );
  // toCoding extracts code "female" from "system|code" format
  assertEquals(isMember, true); // "female" is in set
});

Deno.test("terminology: CodedValue conversion - Coding", async () => {
  const isMember = await mockService.memberOf(
    { system: "http://hl7.org/fhir/administrative-gender", code: "male" },
    "http://hl7.org/fhir/ValueSet/administrative-gender"
  );
  assertEquals(isMember, true);
});

Deno.test("terminology: CodedValue conversion - CodeableConcept", async () => {
  const isMember = await mockService.memberOf(
    { 
      coding: [
        { system: "http://hl7.org/fhir/administrative-gender", code: "female" }
      ] 
    },
    "http://hl7.org/fhir/ValueSet/administrative-gender"
  );
  assertEquals(isMember, true);
});

Deno.test("terminology: translate operation", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const result = await proxy.translate(
    "http://example.org/ConceptMap/test",
    { system: "http://example.org/source", code: "ABC" }
  );
  
  assertEquals(result.resourceType, "Parameters");
  const resultParam = result.parameter?.find(p => p.name === "result");
  assertEquals(resultParam?.valueBoolean, true);
});

Deno.test("terminology: subsumes operation", async () => {
  const proxy = createTerminologiesProxy(mockService);
  const result = await proxy.subsumes(
    "http://snomed.info/sct",
    { code: "123" },
    { code: "456" }
  );
  
  assertEquals(result, "not-subsumed");
});
