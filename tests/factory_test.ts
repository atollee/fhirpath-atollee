/**
 * Tests for %factory Type Factory functionality
 */

import { assertEquals, assert } from "@std/assert";
import fhirpath, {
  TypeFactory,
  createTypeFactory,
  globalFactory,
  type ITypeFactory,
} from "../mod.ts";

// ============================================================
// TypeFactory Direct Tests
// ============================================================

const factory = createTypeFactory();

Deno.test("factory: createTypeFactory returns ITypeFactory", () => {
  assert(factory !== null);
  assert(typeof factory.string === "function");
  assert(typeof factory.Extension === "function");
});

Deno.test("factory: globalFactory is available", () => {
  assert(globalFactory !== null);
  assert(globalFactory instanceof TypeFactory);
});

// ============================================================
// Primitive Type Tests
// ============================================================

Deno.test("factory: string()", () => {
  const result = factory.string("hello");
  assertEquals(result, { value: "hello" });
});

Deno.test("factory: string() with extension", () => {
  const ext = { url: "http://example.org/ext", valueString: "test" };
  const result = factory.string("hello", [ext]);
  assertEquals(result, { value: "hello", extension: [ext] });
});

Deno.test("factory: boolean()", () => {
  assertEquals(factory.boolean(true), { value: true });
  assertEquals(factory.boolean(false), { value: false });
});

Deno.test("factory: integer()", () => {
  assertEquals(factory.integer(42), { value: 42 });
  assertEquals(factory.integer(3.7), { value: 3 }); // truncated
});

Deno.test("factory: decimal()", () => {
  assertEquals(factory.decimal(3.14159), { value: 3.14159 });
});

Deno.test("factory: date()", () => {
  assertEquals(factory.date("2024-01-15"), { value: "2024-01-15" });
});

Deno.test("factory: dateTime()", () => {
  assertEquals(factory.dateTime("2024-01-15T10:30:00Z"), { value: "2024-01-15T10:30:00Z" });
});

Deno.test("factory: time()", () => {
  assertEquals(factory.time("14:30:00"), { value: "14:30:00" });
});

Deno.test("factory: uri()", () => {
  assertEquals(factory.uri("urn:uuid:12345"), { value: "urn:uuid:12345" });
});

Deno.test("factory: url()", () => {
  assertEquals(factory.url("https://example.org"), { value: "https://example.org" });
});

Deno.test("factory: code()", () => {
  assertEquals(factory.code("active"), { value: "active" });
});

Deno.test("factory: id()", () => {
  assertEquals(factory.id("patient-123"), { value: "patient-123" });
});

Deno.test("factory: unsignedInt()", () => {
  assertEquals(factory.unsignedInt(100), { value: 100 });
  assertEquals(factory.unsignedInt(-5), { value: 0 }); // clamped to 0
});

Deno.test("factory: positiveInt()", () => {
  assertEquals(factory.positiveInt(100), { value: 100 });
  assertEquals(factory.positiveInt(0), { value: 1 }); // clamped to 1
  assertEquals(factory.positiveInt(-5), { value: 1 }); // clamped to 1
});

// ============================================================
// Complex Type Tests
// ============================================================

Deno.test("factory: Extension()", () => {
  const ext = factory.Extension("http://example.org/ext");
  assertEquals(ext, { url: "http://example.org/ext" });
});

Deno.test("factory: Extension() with string value", () => {
  const ext = factory.Extension("http://example.org/ext", "test value");
  assertEquals(ext.url, "http://example.org/ext");
  assertEquals((ext as Record<string, unknown>).valueString, "test value");
});

Deno.test("factory: Extension() with boolean value", () => {
  const ext = factory.Extension("http://example.org/flag", true);
  assertEquals((ext as Record<string, unknown>).valueBoolean, true);
});

Deno.test("factory: Extension() with integer value", () => {
  const ext = factory.Extension("http://example.org/count", 42);
  assertEquals((ext as Record<string, unknown>).valueInteger, 42);
});

Deno.test("factory: Identifier()", () => {
  const id = factory.Identifier("http://example.org", "12345", "official");
  assertEquals(id, {
    system: "http://example.org",
    value: "12345",
    use: "official",
  });
});

Deno.test("factory: Identifier() minimal", () => {
  const id = factory.Identifier(undefined, "12345");
  assertEquals(id, { value: "12345" });
});

Deno.test("factory: HumanName()", () => {
  const name = factory.HumanName("Doe", "John", "Dr.", undefined, "Dr. John Doe", "official");
  assertEquals(name, {
    family: "Doe",
    given: ["John"],
    prefix: ["Dr."],
    text: "Dr. John Doe",
    use: "official",
  });
});

Deno.test("factory: HumanName() with arrays", () => {
  const name = factory.HumanName("Doe", ["John", "James"], ["Dr.", "Prof."]);
  assertEquals(name, {
    family: "Doe",
    given: ["John", "James"],
    prefix: ["Dr.", "Prof."],
  });
});

Deno.test("factory: ContactPoint()", () => {
  const cp = factory.ContactPoint("phone", "+1-555-1234", "home");
  assertEquals(cp, {
    system: "phone",
    value: "+1-555-1234",
    use: "home",
  });
});

Deno.test("factory: Address()", () => {
  const addr = factory.Address(
    ["123 Main St", "Apt 4"],
    "Springfield",
    "IL",
    "62701",
    "USA",
    "home",
    "both"
  );
  assertEquals(addr, {
    line: ["123 Main St", "Apt 4"],
    city: "Springfield",
    state: "IL",
    postalCode: "62701",
    country: "USA",
    use: "home",
    type: "both",
  });
});

Deno.test("factory: Quantity()", () => {
  const q = factory.Quantity("http://unitsofmeasure.org", "kg", 75.5, "kilogram");
  assertEquals(q, {
    system: "http://unitsofmeasure.org",
    code: "kg",
    value: 75.5,
    unit: "kilogram",
  });
});

Deno.test("factory: Coding()", () => {
  const c = factory.Coding("http://loinc.org", "8480-6", "Systolic BP", "2.77");
  assertEquals(c, {
    system: "http://loinc.org",
    code: "8480-6",
    display: "Systolic BP",
    version: "2.77",
  });
});

Deno.test("factory: CodeableConcept()", () => {
  const coding = factory.Coding("http://loinc.org", "8480-6", "Systolic BP");
  const cc = factory.CodeableConcept(coding, "Systolic Blood Pressure");
  assertEquals(cc, {
    coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }],
    text: "Systolic Blood Pressure",
  });
});

Deno.test("factory: CodeableConcept() with multiple codings", () => {
  const coding1 = factory.Coding("http://loinc.org", "8480-6");
  const coding2 = factory.Coding("http://snomed.info/sct", "271649006");
  const cc = factory.CodeableConcept([coding1, coding2]);
  assertEquals(cc.coding?.length, 2);
});

// ============================================================
// Utility Method Tests
// ============================================================

Deno.test("factory: create() - primitive type", () => {
  const result = factory.create("string");
  assertEquals(result, { value: "" });
});

Deno.test("factory: create() - integer", () => {
  const result = factory.create("integer");
  assertEquals(result, { value: 0 });
});

Deno.test("factory: create() - complex type", () => {
  const result = factory.create("Identifier");
  assertEquals(result, {});
});

Deno.test("factory: withExtension()", () => {
  const base = { resourceType: "Patient", id: "123" };
  const result = factory.withExtension(base, "http://example.org/ext", "value");
  
  assert((result as Record<string, unknown>).extension !== undefined);
  const extensions = (result as Record<string, unknown>).extension as Array<Record<string, unknown>>;
  assertEquals(extensions.length, 1);
  assertEquals(extensions[0].url, "http://example.org/ext");
});

Deno.test("factory: withExtension() adds to existing", () => {
  const base = { 
    resourceType: "Patient", 
    extension: [{ url: "http://example.org/ext1", valueString: "first" }] 
  };
  const result = factory.withExtension(base, "http://example.org/ext2", "second");
  
  const extensions = (result as Record<string, unknown>).extension as Array<Record<string, unknown>>;
  assertEquals(extensions.length, 2);
});

Deno.test("factory: withProperty()", () => {
  const base = { resourceType: "Patient" };
  const result = factory.withProperty(base, "active", true);
  
  assertEquals((result as Record<string, unknown>).active, true);
  assertEquals((result as Record<string, unknown>).resourceType, "Patient");
});

Deno.test("factory: withProperty() overwrites existing", () => {
  const base = { resourceType: "Patient", active: false };
  const result = factory.withProperty(base, "active", true);
  
  assertEquals((result as Record<string, unknown>).active, true);
});

// ============================================================
// FHIRPath Integration Tests
// ============================================================

Deno.test("factory: %factory.string() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.string('hello')",
    { factory: globalFactory }
  );
  assertEquals(result, [{ value: "hello" }]);
});

Deno.test("factory: %factory.Coding() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.Coding('http://loinc.org', '8480-6', 'Systolic BP')",
    { factory: globalFactory }
  );
  assertEquals(result, [{
    system: "http://loinc.org",
    code: "8480-6",
    display: "Systolic BP",
  }]);
});

Deno.test("factory: %factory.Extension() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.Extension('http://example.org/ext')",
    { factory: globalFactory }
  );
  assertEquals(result, [{ url: "http://example.org/ext" }]);
});

Deno.test("factory: %factory.Quantity() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.Quantity('http://unitsofmeasure.org', 'kg', 80, 'kilogram')",
    { factory: globalFactory }
  );
  assertEquals(result, [{
    system: "http://unitsofmeasure.org",
    code: "kg",
    value: 80,
    unit: "kilogram",
  }]);
});

Deno.test("factory: %factory.HumanName() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.HumanName('Smith', 'John')",
    { factory: globalFactory }
  );
  assertEquals(result, [{
    family: "Smith",
    given: ["John"],
  }]);
});

Deno.test("factory: %factory is available by default", () => {
  // %factory should be automatically available in evaluation context
  const result = fhirpath.evaluate(
    {},
    "%factory.integer(42)"
  );
  assertEquals(result, [{ value: 42 }]);
});

Deno.test("factory: %factory.boolean() in FHIRPath", () => {
  const result = fhirpath.evaluate({}, "%factory.boolean(true)");
  assertEquals(result, [{ value: true }]);
});

Deno.test("factory: %factory.create() in FHIRPath", () => {
  const result = fhirpath.evaluate(
    {},
    "%factory.create('Identifier')"
  );
  assertEquals(result, [{}]);
});

Deno.test("factory: chained %factory calls", () => {
  // Create a patient with name using factory
  const result = fhirpath.evaluate(
    { resourceType: "Patient" },
    "%factory.HumanName('Doe', 'John').family"
  );
  assertEquals(result, ["Doe"]);
});
