/**
 * Tests for previously limited functions:
 * - aggregate() - Full implementation with $total and $this
 * - resolve() - Reference resolution
 * - htmlChecks() - XHTML validation
 */

import { assertEquals, assert } from "@std/assert";
import fhirpath from "../mod.ts";
import type { IReferenceResolver, EvaluationContext } from "../src/evaluator/types.ts";

// Helper
const eval_ = (expr: string, data: unknown = {}, options?: Record<string, unknown>) => 
  fhirpath.evaluate(data, expr, undefined, undefined, options);

// ============================================================
// aggregate() Tests
// ============================================================

Deno.test("aggregate: sum using $total + $this", () => {
  const result = eval_("(1 | 2 | 3 | 4 | 5).aggregate($total + $this, 0)", {});
  assertEquals(result, [15]);
});

Deno.test("aggregate: product using $total * $this", () => {
  const result = eval_("(1 | 2 | 3 | 4).aggregate($total * $this, 1)", {});
  assertEquals(result, [24]);
});

Deno.test("aggregate: count using $total + 1", () => {
  const result = eval_("('a' | 'b' | 'c').aggregate($total + 1, 0)", {});
  assertEquals(result, [3]);
});

Deno.test("aggregate: factorial simulation", () => {
  // Calculate 5! = 120
  const result = eval_("(1 | 2 | 3 | 4 | 5).aggregate($total * $this, 1)", {});
  assertEquals(result, [120]);
});

Deno.test("aggregate: string concatenation", () => {
  const result = eval_("('a' | 'b' | 'c').aggregate($total & $this, '')", {});
  assertEquals(result, ["abc"]);
});

Deno.test("aggregate: maximum value", () => {
  const result = eval_("(3 | 1 | 4 | 1 | 5 | 9 | 2 | 6).aggregate(iif($this > $total, $this, $total), 0)", {});
  assertEquals(result, [9]);
});

Deno.test("aggregate: empty collection returns init", () => {
  const result = eval_("{}.aggregate($total + $this, 0)", {});
  assertEquals(result, [0]);
});

Deno.test("aggregate: without init, $total starts undefined", () => {
  // Without init, $total is undefined
  // undefined + number = NaN, which gets filtered out
  // Best practice: always provide an init value
  const result = eval_("(10 | 20 | 30).aggregate($total + $this)", {});
  // Result is empty because NaN gets filtered (expected behavior)
  assertEquals(result, []);
});

Deno.test("aggregate: on patient data - sum ages", () => {
  const data = {
    patients: [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
      { name: "Bob", age: 35 },
    ]
  };
  const result = eval_("patients.aggregate($total + age, 0)", data);
  assertEquals(result, [90]);
});

Deno.test("aggregate: complex expression with select", () => {
  const data = { values: [1, 2, 3, 4, 5] };
  // Sum of squares
  const result = eval_("values.aggregate($total + ($this * $this), 0)", data);
  assertEquals(result, [55]); // 1 + 4 + 9 + 16 + 25 = 55
});

// ============================================================
// resolve() Tests - Bundle Context
// ============================================================

const bundle = {
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      fullUrl: "urn:uuid:patient-1",
      resource: {
        resourceType: "Patient",
        id: "patient-1",
        name: [{ family: "Smith", given: ["John"] }]
      }
    },
    {
      fullUrl: "urn:uuid:observation-1",
      resource: {
        resourceType: "Observation",
        id: "obs-1",
        subject: { reference: "Patient/patient-1" },
        code: { coding: [{ code: "glucose" }] },
        valueQuantity: { value: 100, unit: "mg/dL" }
      }
    },
    {
      fullUrl: "http://example.org/Patient/123",
      resource: {
        resourceType: "Patient",
        id: "123",
        name: [{ family: "Jones", given: ["Jane"] }]
      }
    }
  ]
};

Deno.test("resolve: reference within Bundle by relative reference", () => {
  const obs = bundle.entry[1].resource;
  const result = fhirpath.evaluate(obs, "subject.resolve().name.family", { resource: bundle });
  assertEquals(result, ["Smith"]);
});

Deno.test("resolve: reference by fullUrl", () => {
  const data = {
    resourceType: "Encounter",
    subject: { reference: "urn:uuid:patient-1" }
  };
  const result = fhirpath.evaluate(data, "subject.resolve().name.given", { resource: bundle });
  assertEquals(result, ["John"]);
});

Deno.test("resolve: reference by http fullUrl", () => {
  const data = {
    resourceType: "Encounter",
    subject: { reference: "http://example.org/Patient/123" }
  };
  const result = fhirpath.evaluate(data, "subject.resolve().name.family", { resource: bundle });
  assertEquals(result, ["Jones"]);
});

Deno.test("resolve: unresolvable reference returns empty", () => {
  const data = {
    resourceType: "Encounter",
    subject: { reference: "Patient/nonexistent" }
  };
  const result = fhirpath.evaluate(data, "subject.resolve()", { resource: bundle });
  assertEquals(result, []);
});

Deno.test("resolve: without Bundle context returns empty", () => {
  const data = {
    resourceType: "Encounter",
    subject: { reference: "Patient/123" }
  };
  const result = fhirpath.evaluate(data, "subject.resolve()", {});
  assertEquals(result, []);
});

Deno.test("resolve: string reference", () => {
  const data = { ref: "Patient/patient-1" };
  const result = fhirpath.evaluate(data, "ref.resolve().name.family", { resource: bundle });
  assertEquals(result, ["Smith"]);
});

// Test with custom resolver
Deno.test("resolve: with custom IReferenceResolver", () => {
  const mockResolver: IReferenceResolver = {
    resolve(reference: string, _context?: EvaluationContext): unknown {
      if (reference === "Patient/custom-123") {
        return {
          resourceType: "Patient",
          id: "custom-123",
          name: [{ family: "CustomPatient" }]
        };
      }
      return undefined;
    }
  };

  const data = {
    resourceType: "Observation",
    subject: { reference: "Patient/custom-123" }
  };

  const result = fhirpath.evaluate(data, "subject.resolve().name.family", undefined, undefined, {
    referenceResolver: mockResolver
  });
  assertEquals(result, ["CustomPatient"]);
});

// ============================================================
// htmlChecks() Tests
// ============================================================

Deno.test("htmlChecks: valid simple HTML returns true", () => {
  const data = { text: "<div>Hello World</div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [true]);
});

Deno.test("htmlChecks: valid nested HTML returns true", () => {
  const data = { text: "<div><p>Paragraph</p><ul><li>Item 1</li><li>Item 2</li></ul></div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [true]);
});

Deno.test("htmlChecks: script tag returns false", () => {
  const data = { text: "<div><script>alert('xss')</script></div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: inline script returns false", () => {
  const data = { text: "<div onclick=\"alert('xss')\">Click me</div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: javascript URL returns false", () => {
  const data = { text: "<a href=\"javascript:alert('xss')\">Link</a>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: data URL returns false", () => {
  const data = { text: "<img src=\"data:image/png;base64,abc123\">" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: style element returns false", () => {
  const data = { text: "<div><style>body { color: red; }</style></div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: external stylesheet returns false", () => {
  const data = { text: "<link rel=\"stylesheet\" href=\"evil.css\">" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: form element returns false", () => {
  const data = { text: "<form action=\"evil.com\"><input type=\"text\"></form>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: iframe returns false", () => {
  const data = { text: "<iframe src=\"evil.com\"></iframe>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: object element returns false", () => {
  const data = { text: "<object data=\"evil.swf\"></object>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: embed element returns false", () => {
  const data = { text: "<embed src=\"evil.swf\">" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: base element returns false", () => {
  const data = { text: "<base href=\"http://evil.com/\">" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: valid FHIR narrative", () => {
  const data = {
    text: `<div xmlns="http://www.w3.org/1999/xhtml">
      <h1>Patient Summary</h1>
      <p>Name: <b>John Smith</b></p>
      <table>
        <tr><th>Date</th><th>Event</th></tr>
        <tr><td>2024-01-01</td><td>Admission</td></tr>
      </table>
    </div>`
  };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [true]);
});

Deno.test("htmlChecks: unbalanced tags returns false", () => {
  const data = { text: "<div><p>Unclosed paragraph<div>Another div</div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [false]);
});

Deno.test("htmlChecks: empty collection returns true", () => {
  const result = eval_("{}.htmlChecks()", {});
  assertEquals(result, [true]);
});

Deno.test("htmlChecks: self-closing tags are valid", () => {
  const data = { text: "<div><br/><hr/><img src=\"valid.png\" alt=\"img\"/></div>" };
  const result = eval_("text.htmlChecks()", data);
  assertEquals(result, [true]);
});

// ============================================================
// Integration Tests
// ============================================================

Deno.test("integration: aggregate with resolve", () => {
  // Sum observation values from a bundle
  const obsBundle = {
    resourceType: "Bundle",
    entry: [
      { resource: { resourceType: "Observation", id: "1", valueQuantity: { value: 10 } } },
      { resource: { resourceType: "Observation", id: "2", valueQuantity: { value: 20 } } },
      { resource: { resourceType: "Observation", id: "3", valueQuantity: { value: 30 } } },
    ]
  };
  const result = fhirpath.evaluate(obsBundle, "entry.resource.valueQuantity.value.aggregate($total + $this, 0)");
  assertEquals(result, [60]);
});

Deno.test("integration: FHIR resource with htmlChecks on narrative", () => {
  const patient = {
    resourceType: "Patient",
    id: "123",
    text: {
      status: "generated",
      div: "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p>Patient John Smith</p></div>"
    }
  };
  const result = fhirpath.evaluate(patient, "text.div.htmlChecks()");
  assertEquals(result, [true]);
});
