/**
 * Type Factory Implementation
 * 
 * Provides the %factory FHIRPath environment variable for creating
 * FHIR data types within expressions.
 */

import type { 
  ITypeFactory, 
  PrimitiveWithExtension,
  FhirExtension,
  FhirIdentifier,
  FhirHumanName,
  FhirContactPoint,
  FhirAddress,
  FhirQuantity,
  FhirCoding,
  FhirCodeableConcept,
} from "./types.ts";

// Type aliases for backward compatibility
type Extension = FhirExtension;
type Identifier = FhirIdentifier;
type HumanName = FhirHumanName;
type ContactPoint = FhirContactPoint;
type Address = FhirAddress;
type Quantity = FhirQuantity;
type Coding = FhirCoding;
type CodeableConcept = FhirCodeableConcept;

/**
 * Type Factory implementation
 */
export class TypeFactory implements ITypeFactory {
  
  // ============================================================
  // Primitive Type Factories
  // ============================================================

  private createPrimitive<T>(value: T, extensions?: Extension[]): PrimitiveWithExtension<T> {
    const result: PrimitiveWithExtension<T> = { value };
    if (extensions && extensions.length > 0) {
      result.extension = extensions;
    }
    return result;
  }

  boolean(value: boolean, extensions?: Extension[]): PrimitiveWithExtension<boolean> {
    return this.createPrimitive(value, extensions);
  }

  integer(value: number, extensions?: Extension[]): PrimitiveWithExtension<number> {
    return this.createPrimitive(Math.floor(value), extensions);
  }

  integer64(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  string(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  decimal(value: number, extensions?: Extension[]): PrimitiveWithExtension<number> {
    return this.createPrimitive(value, extensions);
  }

  uri(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  url(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  canonical(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  base64Binary(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  instant(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  date(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  dateTime(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  time(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  code(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  oid(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  id(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  markdown(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  unsignedInt(value: number, extensions?: Extension[]): PrimitiveWithExtension<number> {
    const unsignedValue = Math.max(0, Math.floor(value));
    return this.createPrimitive(unsignedValue, extensions);
  }

  positiveInt(value: number, extensions?: Extension[]): PrimitiveWithExtension<number> {
    const positiveValue = Math.max(1, Math.floor(value));
    return this.createPrimitive(positiveValue, extensions);
  }

  uuid(value: string, extensions?: Extension[]): PrimitiveWithExtension<string> {
    return this.createPrimitive(value, extensions);
  }

  // ============================================================
  // Complex Type Factories
  // ============================================================

  Extension(url: string, value?: unknown): Extension {
    const ext: Extension = { url };
    
    if (value !== undefined) {
      // Determine the value type and set the appropriate value[x] property
      const valueType = this.determineValueType(value);
      if (valueType) {
        (ext as Record<string, unknown>)[`value${valueType}`] = value;
      }
    }
    
    return ext;
  }

  Identifier(
    system?: string,
    value?: string,
    use?: "usual" | "official" | "temp" | "secondary" | "old",
    type?: CodeableConcept,
  ): Identifier {
    const identifier: Identifier = {};
    
    if (system !== undefined) identifier.system = system;
    if (value !== undefined) identifier.value = value;
    if (use !== undefined) identifier.use = use;
    if (type !== undefined) identifier.type = type;
    
    return identifier;
  }

  HumanName(
    family?: string,
    given?: string | string[],
    prefix?: string | string[],
    suffix?: string | string[],
    text?: string,
    use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden",
  ): HumanName {
    const name: HumanName = {};
    
    if (family !== undefined) name.family = family;
    if (given !== undefined) name.given = Array.isArray(given) ? given : [given];
    if (prefix !== undefined) name.prefix = Array.isArray(prefix) ? prefix : [prefix];
    if (suffix !== undefined) name.suffix = Array.isArray(suffix) ? suffix : [suffix];
    if (text !== undefined) name.text = text;
    if (use !== undefined) name.use = use;
    
    return name;
  }

  ContactPoint(
    system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other",
    value?: string,
    use?: "home" | "work" | "temp" | "old" | "mobile",
  ): ContactPoint {
    const contact: ContactPoint = {};
    
    if (system !== undefined) contact.system = system;
    if (value !== undefined) contact.value = value;
    if (use !== undefined) contact.use = use;
    
    return contact;
  }

  Address(
    line?: string | string[],
    city?: string,
    state?: string,
    postalCode?: string,
    country?: string,
    use?: "home" | "work" | "temp" | "old" | "billing",
    type?: "postal" | "physical" | "both",
  ): Address {
    const address: Address = {};
    
    if (line !== undefined) address.line = Array.isArray(line) ? line : [line];
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (postalCode !== undefined) address.postalCode = postalCode;
    if (country !== undefined) address.country = country;
    if (use !== undefined) address.use = use;
    if (type !== undefined) address.type = type;
    
    return address;
  }

  Quantity(
    system?: string,
    code?: string,
    value?: number,
    unit?: string,
  ): Quantity {
    const quantity: Quantity = {};
    
    if (system !== undefined) quantity.system = system;
    if (code !== undefined) quantity.code = code;
    if (value !== undefined) quantity.value = value;
    if (unit !== undefined) quantity.unit = unit;
    
    return quantity;
  }

  Coding(
    system?: string,
    code?: string,
    display?: string,
    version?: string,
  ): Coding {
    const coding: Coding = {};
    
    if (system !== undefined) coding.system = system;
    if (code !== undefined) coding.code = code;
    if (display !== undefined) coding.display = display;
    if (version !== undefined) coding.version = version;
    
    return coding;
  }

  CodeableConcept(
    coding?: Coding | Coding[],
    text?: string,
  ): CodeableConcept {
    const concept: CodeableConcept = {};
    
    if (coding !== undefined) {
      concept.coding = Array.isArray(coding) ? coding : [coding];
    }
    if (text !== undefined) concept.text = text;
    
    return concept;
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  create(typeName: string): unknown {
    // Create an empty instance based on type name
    const normalizedType = typeName.toLowerCase();
    
    // Primitive types
    const primitiveDefaults: Record<string, unknown> = {
      boolean: false,
      integer: 0,
      integer64: "0",
      string: "",
      decimal: 0.0,
      uri: "",
      url: "",
      canonical: "",
      base64binary: "",
      instant: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
      datetime: new Date().toISOString(),
      time: "00:00:00",
      code: "",
      oid: "",
      id: "",
      markdown: "",
      unsignedint: 0,
      positiveint: 1,
      uuid: "",
    };
    
    if (normalizedType in primitiveDefaults) {
      return { value: primitiveDefaults[normalizedType] };
    }
    
    // Complex types
    switch (normalizedType) {
      case "extension":
        return { url: "" };
      case "identifier":
        return {};
      case "humanname":
        return {};
      case "contactpoint":
        return {};
      case "address":
        return {};
      case "quantity":
        return {};
      case "coding":
        return {};
      case "codeableconcept":
        return {};
      case "reference":
        return {};
      case "period":
        return {};
      case "range":
        return {};
      case "ratio":
        return {};
      case "attachment":
        return {};
      case "annotation":
        return {};
      case "signature":
        return {};
      default:
        // For unknown types, return an empty object
        return {};
    }
  }

  withExtension(instance: unknown, url: string, value?: unknown): unknown {
    if (typeof instance !== "object" || instance === null) {
      return instance;
    }
    
    const obj = { ...instance as Record<string, unknown> };
    const extension = this.Extension(url, value);
    
    if (!obj.extension) {
      obj.extension = [];
    }
    
    (obj.extension as Extension[]).push(extension);
    
    return obj;
  }

  withProperty(instance: unknown, name: string, value: unknown): unknown {
    if (typeof instance !== "object" || instance === null) {
      return instance;
    }
    
    return {
      ...instance as Record<string, unknown>,
      [name]: value,
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Determine the FHIR value[x] type suffix for a value
   */
  private determineValueType(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    
    const type = typeof value;
    
    if (type === "boolean") {
      return "Boolean";
    }
    
    if (type === "number") {
      return Number.isInteger(value) ? "Integer" : "Decimal";
    }
    
    if (type === "string") {
      const str = value as string;
      
      // Check for date/time patterns
      if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(str)) {
        return "Date";
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(str)) {
        return "DateTime";
      }
      if (/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
        return "Time";
      }
      if (/^urn:uuid:/.test(str) || /^urn:oid:/.test(str)) {
        return "Uri";
      }
      if (/^https?:\/\//.test(str)) {
        return "Url";
      }
      
      return "String";
    }
    
    if (type === "object") {
      const obj = value as Record<string, unknown>;
      
      // Check for known complex types
      if ("coding" in obj) {
        return "CodeableConcept";
      }
      if ("system" in obj && "code" in obj && !("value" in obj)) {
        return "Coding";
      }
      if ("reference" in obj) {
        return "Reference";
      }
      if ("value" in obj && ("unit" in obj || "code" in obj || "system" in obj)) {
        return "Quantity";
      }
      if ("start" in obj || "end" in obj) {
        return "Period";
      }
      if ("low" in obj || "high" in obj) {
        return "Range";
      }
      if ("numerator" in obj || "denominator" in obj) {
        return "Ratio";
      }
      if ("family" in obj || "given" in obj) {
        return "HumanName";
      }
      if ("line" in obj || "city" in obj) {
        return "Address";
      }
      if ("url" in obj && Object.keys(obj).some(k => k.startsWith("value"))) {
        return "Extension";
      }
    }
    
    return null;
  }
}

/**
 * Create a singleton TypeFactory instance
 */
export function createTypeFactory(): ITypeFactory {
  return new TypeFactory();
}

/**
 * Global TypeFactory instance
 */
export const globalFactory = new TypeFactory();
