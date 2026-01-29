/**
 * FHIRPath Visual Expression Builder
 * 
 * A Web Component for building FHIRPath expressions visually.
 * Framework-agnostic - works with React, Vue, Angular, or vanilla HTML.
 * 
 * @example
 * ```html
 * <fhirpath-builder
 *   resource-type="Patient"
 *   value="name.given"
 *   @change="handleChange"
 * ></fhirpath-builder>
 * ```
 */

import fhirpath from "../mod.ts";

// Function categories for the builder UI
const FUNCTION_CATEGORIES = {
  existence: {
    label: "Existence",
    functions: [
      { name: "empty", label: "Empty", description: "Returns true if collection is empty", args: [] },
      { name: "exists", label: "Exists", description: "Returns true if collection has items", args: ["expression?"] },
      { name: "all", label: "All", description: "Returns true if all items match criteria", args: ["expression"] },
      { name: "allTrue", label: "All True", description: "Returns true if all items are true", args: [] },
      { name: "anyTrue", label: "Any True", description: "Returns true if any item is true", args: [] },
      { name: "allFalse", label: "All False", description: "Returns true if all items are false", args: [] },
      { name: "anyFalse", label: "Any False", description: "Returns true if any item is false", args: [] },
      { name: "count", label: "Count", description: "Returns number of items", args: [] },
      { name: "hasValue", label: "Has Value", description: "Returns true if item has a value", args: [] },
    ],
  },
  filtering: {
    label: "Filtering",
    functions: [
      { name: "where", label: "Where", description: "Filter items by expression", args: ["expression"] },
      { name: "select", label: "Select", description: "Project items by expression", args: ["expression"] },
      { name: "ofType", label: "Of Type", description: "Filter by FHIR type", args: ["type"] },
      { name: "distinct", label: "Distinct", description: "Remove duplicates", args: [] },
    ],
  },
  subsetting: {
    label: "Subsetting",
    functions: [
      { name: "first", label: "First", description: "Returns first item", args: [] },
      { name: "last", label: "Last", description: "Returns last item", args: [] },
      { name: "tail", label: "Tail", description: "Returns all except first", args: [] },
      { name: "take", label: "Take", description: "Returns first N items", args: ["count"] },
      { name: "skip", label: "Skip", description: "Skips first N items", args: ["count"] },
      { name: "single", label: "Single", description: "Returns single item or error", args: [] },
    ],
  },
  strings: {
    label: "Strings",
    functions: [
      { name: "startsWith", label: "Starts With", description: "Check if starts with string", args: ["prefix"] },
      { name: "endsWith", label: "Ends With", description: "Check if ends with string", args: ["suffix"] },
      { name: "contains", label: "Contains", description: "Check if contains string", args: ["substring"] },
      { name: "replace", label: "Replace", description: "Replace substring", args: ["pattern", "replacement"] },
      { name: "matches", label: "Matches", description: "Match regex pattern", args: ["pattern"] },
      { name: "indexOf", label: "Index Of", description: "Find position of substring", args: ["substring"] },
      { name: "substring", label: "Substring", description: "Extract substring", args: ["start", "length?"] },
      { name: "upper", label: "Upper", description: "Convert to uppercase", args: [] },
      { name: "lower", label: "Lower", description: "Convert to lowercase", args: [] },
      { name: "trim", label: "Trim", description: "Remove whitespace", args: [] },
      { name: "length", label: "Length", description: "String length", args: [] },
    ],
  },
  math: {
    label: "Math",
    functions: [
      { name: "abs", label: "Absolute", description: "Absolute value", args: [] },
      { name: "ceiling", label: "Ceiling", description: "Round up", args: [] },
      { name: "floor", label: "Floor", description: "Round down", args: [] },
      { name: "round", label: "Round", description: "Round to precision", args: ["precision?"] },
      { name: "sqrt", label: "Square Root", description: "Square root", args: [] },
      { name: "ln", label: "Natural Log", description: "Natural logarithm", args: [] },
      { name: "exp", label: "Exponential", description: "e raised to power", args: [] },
      { name: "power", label: "Power", description: "Raise to power", args: ["exponent"] },
    ],
  },
  aggregate: {
    label: "Aggregate",
    functions: [
      { name: "sum", label: "Sum", description: "Sum of values", args: [] },
      { name: "min", label: "Min", description: "Minimum value", args: [] },
      { name: "max", label: "Max", description: "Maximum value", args: [] },
      { name: "avg", label: "Average", description: "Average value", args: [] },
      { name: "aggregate", label: "Aggregate", description: "Custom aggregation", args: ["expression", "init?"] },
    ],
  },
  types: {
    label: "Type Conversion",
    functions: [
      { name: "toInteger", label: "To Integer", description: "Convert to integer", args: [] },
      { name: "toDecimal", label: "To Decimal", description: "Convert to decimal", args: [] },
      { name: "toString", label: "To String", description: "Convert to string", args: [] },
      { name: "toBoolean", label: "To Boolean", description: "Convert to boolean", args: [] },
      { name: "toDate", label: "To Date", description: "Convert to date", args: [] },
      { name: "toDateTime", label: "To DateTime", description: "Convert to datetime", args: [] },
      { name: "toTime", label: "To Time", description: "Convert to time", args: [] },
      { name: "toQuantity", label: "To Quantity", description: "Convert to quantity", args: ["unit?"] },
    ],
  },
  utility: {
    label: "Utility",
    functions: [
      { name: "iif", label: "If-Then-Else", description: "Conditional expression", args: ["condition", "thenExpr", "elseExpr?"] },
      { name: "trace", label: "Trace", description: "Debug output", args: ["label", "expression?"] },
      { name: "children", label: "Children", description: "All child elements", args: [] },
      { name: "descendants", label: "Descendants", description: "All descendants", args: [] },
    ],
  },
};

// Common FHIR paths by resource type
const COMMON_PATHS: Record<string, string[]> = {
  Patient: [
    "id",
    "identifier",
    "identifier.value",
    "identifier.system",
    "name",
    "name.family",
    "name.given",
    "name.text",
    "gender",
    "birthDate",
    "address",
    "address.city",
    "address.country",
    "telecom",
    "telecom.value",
    "active",
    "deceasedBoolean",
    "deceasedDateTime",
  ],
  Observation: [
    "id",
    "status",
    "code",
    "code.coding",
    "code.coding.code",
    "code.coding.system",
    "code.coding.display",
    "valueQuantity",
    "valueQuantity.value",
    "valueQuantity.unit",
    "valueString",
    "valueCodeableConcept",
    "effectiveDateTime",
    "subject",
    "subject.reference",
    "performer",
    "category",
  ],
  Condition: [
    "id",
    "clinicalStatus",
    "verificationStatus",
    "code",
    "code.coding",
    "code.text",
    "subject",
    "onsetDateTime",
    "abatementDateTime",
    "recordedDate",
    "severity",
  ],
  Medication: [
    "id",
    "code",
    "code.coding",
    "status",
    "form",
    "ingredient",
  ],
  Encounter: [
    "id",
    "status",
    "class",
    "type",
    "subject",
    "period",
    "period.start",
    "period.end",
    "participant",
  ],
};

// Operators
const OPERATORS = [
  { symbol: "=", label: "Equals", description: "Check equality" },
  { symbol: "!=", label: "Not Equals", description: "Check inequality" },
  { symbol: ">", label: "Greater Than", description: "Check if greater" },
  { symbol: "<", label: "Less Than", description: "Check if less" },
  { symbol: ">=", label: "Greater or Equal", description: "Check if greater or equal" },
  { symbol: "<=", label: "Less or Equal", description: "Check if less or equal" },
  { symbol: "~", label: "Equivalent", description: "Check equivalence" },
  { symbol: "+", label: "Add", description: "Addition / concatenation" },
  { symbol: "-", label: "Subtract", description: "Subtraction" },
  { symbol: "*", label: "Multiply", description: "Multiplication" },
  { symbol: "/", label: "Divide", description: "Division" },
  { symbol: "and", label: "And", description: "Logical AND" },
  { symbol: "or", label: "Or", description: "Logical OR" },
  { symbol: "|", label: "Union", description: "Combine collections" },
  { symbol: "in", label: "In", description: "Check membership" },
  { symbol: "contains", label: "Contains", description: "Check if contains" },
];

/**
 * FHIRPath Visual Builder Web Component
 */
export class FhirPathBuilder extends HTMLElement {
  private shadow: ShadowRoot;
  private expression = "";
  private resourceType = "Patient";
  private testResource: unknown = null;
  private testResult: unknown[] = [];
  private parseError: string | null = null;

  static get observedAttributes() {
    return ["value", "resource-type", "placeholder"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.render();
  }

  connectedCallback() {
    this.setupEventListeners();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    switch (name) {
      case "value":
        this.expression = newValue || "";
        this.updateExpressionInput();
        break;
      case "resource-type":
        this.resourceType = newValue || "Patient";
        this.render();
        break;
    }
  }

  get value(): string {
    return this.expression;
  }

  set value(val: string) {
    this.expression = val;
    this.updateExpressionInput();
    this.dispatchChangeEvent();
  }

  private render() {
    const styles = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #333;
        }
        
        .builder-container {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
        
        .expression-bar {
          display: flex;
          padding: 12px;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
          gap: 8px;
        }
        
        .expression-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 13px;
        }
        
        .expression-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        
        .expression-input.error {
          border-color: #dc3545;
        }
        
        .test-btn {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .test-btn:hover {
          background: #0056b3;
        }
        
        .panels {
          display: flex;
          min-height: 300px;
        }
        
        .panel {
          flex: 1;
          padding: 12px;
          border-right: 1px solid #ddd;
          overflow-y: auto;
          max-height: 400px;
        }
        
        .panel:last-child {
          border-right: none;
        }
        
        .panel-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: #495057;
        }
        
        .category {
          margin-bottom: 16px;
        }
        
        .category-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #6c757d;
          margin-bottom: 8px;
          font-weight: 600;
        }
        
        .function-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .function-btn {
          padding: 4px 8px;
          background: #e9ecef;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        
        .function-btn:hover {
          background: #dee2e6;
        }
        
        .path-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .path-btn {
          padding: 6px 8px;
          background: none;
          border: none;
          border-radius: 4px;
          text-align: left;
          cursor: pointer;
          font-family: monospace;
          font-size: 12px;
        }
        
        .path-btn:hover {
          background: #e9ecef;
        }
        
        .operator-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        
        .operator-btn {
          padding: 6px;
          background: #e9ecef;
          border: none;
          border-radius: 4px;
          font-family: monospace;
          cursor: pointer;
        }
        
        .operator-btn:hover {
          background: #dee2e6;
        }
        
        .result-area {
          padding: 12px;
          background: #f8f9fa;
          border-top: 1px solid #ddd;
        }
        
        .result-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #6c757d;
          margin-bottom: 4px;
        }
        
        .result-value {
          font-family: monospace;
          font-size: 12px;
          background: #fff;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ddd;
          max-height: 100px;
          overflow-y: auto;
        }
        
        .error-text {
          color: #dc3545;
          font-size: 12px;
          margin-top: 4px;
        }
        
        .help-text {
          color: #6c757d;
          font-size: 11px;
          margin-top: 4px;
        }
      </style>
    `;

    const commonPaths = COMMON_PATHS[this.resourceType] || COMMON_PATHS.Patient;

    this.shadow.innerHTML = `
      ${styles}
      <div class="builder-container">
        <div class="expression-bar">
          <input 
            type="text" 
            class="expression-input" 
            placeholder="Enter FHIRPath expression..." 
            value="${this.escapeHtml(this.expression)}"
          >
          <button class="test-btn">Test</button>
        </div>
        
        <div class="panels">
          <div class="panel">
            <div class="panel-title">Common Paths</div>
            <div class="path-list">
              ${commonPaths.map(p => `
                <button class="path-btn" data-path="${p}">${p}</button>
              `).join("")}
            </div>
          </div>
          
          <div class="panel">
            <div class="panel-title">Functions</div>
            ${Object.entries(FUNCTION_CATEGORIES).map(([key, cat]) => `
              <div class="category">
                <div class="category-label">${cat.label}</div>
                <div class="function-list">
                  ${cat.functions.map(f => `
                    <button class="function-btn" data-function="${f.name}" title="${f.description}">
                      ${f.label}
                    </button>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          
          <div class="panel">
            <div class="panel-title">Operators</div>
            <div class="operator-grid">
              ${OPERATORS.map(op => `
                <button class="operator-btn" data-operator="${op.symbol}" title="${op.description}">
                  ${op.symbol}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
        
        <div class="result-area">
          <div class="result-label">Result</div>
          <div class="result-value">${this.formatResult()}</div>
          ${this.parseError ? `<div class="error-text">${this.escapeHtml(this.parseError)}</div>` : ""}
          <div class="help-text">Click paths, functions, or operators to build your expression</div>
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    // Expression input
    const input = this.shadow.querySelector(".expression-input") as HTMLInputElement;
    input?.addEventListener("input", (e) => {
      this.expression = (e.target as HTMLInputElement).value;
      this.validateExpression();
      this.dispatchChangeEvent();
    });

    // Test button
    const testBtn = this.shadow.querySelector(".test-btn");
    testBtn?.addEventListener("click", () => this.runTest());

    // Path buttons
    this.shadow.querySelectorAll(".path-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const path = (btn as HTMLElement).dataset.path;
        this.appendToExpression(path || "");
      });
    });

    // Function buttons
    this.shadow.querySelectorAll(".function-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const funcName = (btn as HTMLElement).dataset.function;
        this.appendFunction(funcName || "");
      });
    });

    // Operator buttons
    this.shadow.querySelectorAll(".operator-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const op = (btn as HTMLElement).dataset.operator;
        this.appendOperator(op || "");
      });
    });
  }

  private appendToExpression(text: string) {
    if (this.expression && !this.expression.endsWith(".") && !this.expression.endsWith("(")) {
      this.expression += ".";
    }
    this.expression += text;
    this.updateExpressionInput();
    this.dispatchChangeEvent();
  }

  private appendFunction(funcName: string) {
    if (this.expression && !this.expression.endsWith(".") && !this.expression.endsWith("(")) {
      this.expression += ".";
    }
    this.expression += funcName + "(";
    this.updateExpressionInput();
    
    // Focus input and position cursor
    const input = this.shadow.querySelector(".expression-input") as HTMLInputElement;
    input?.focus();
  }

  private appendOperator(operator: string) {
    if (this.expression) {
      this.expression += ` ${operator} `;
    }
    this.updateExpressionInput();
    
    const input = this.shadow.querySelector(".expression-input") as HTMLInputElement;
    input?.focus();
  }

  private updateExpressionInput() {
    const input = this.shadow.querySelector(".expression-input") as HTMLInputElement;
    if (input) {
      input.value = this.expression;
    }
    this.validateExpression();
  }

  private validateExpression() {
    try {
      if (this.expression) {
        fhirpath.parse(this.expression);
      }
      this.parseError = null;
      this.shadow.querySelector(".expression-input")?.classList.remove("error");
    } catch (e) {
      this.parseError = (e as Error).message;
      this.shadow.querySelector(".expression-input")?.classList.add("error");
    }
  }

  private runTest() {
    if (!this.expression) {
      this.testResult = [];
      this.updateResult();
      return;
    }

    try {
      const resource = this.testResource || this.getDefaultResource();
      this.testResult = fhirpath.evaluate(resource, this.expression);
      this.parseError = null;
    } catch (e) {
      this.testResult = [];
      this.parseError = (e as Error).message;
    }

    this.updateResult();
  }

  private getDefaultResource(): unknown {
    // Return a sample resource for testing
    return {
      resourceType: this.resourceType,
      id: "example",
      name: [{ given: ["John", "James"], family: "Doe" }],
      gender: "male",
      birthDate: "1990-01-01",
      identifier: [{ system: "http://example.org", value: "12345" }],
      address: [{ city: "Boston", country: "USA" }],
      telecom: [{ system: "phone", value: "555-1234" }],
    };
  }

  private formatResult(): string {
    if (this.testResult.length === 0) {
      return '<span style="color:#6c757d">No results</span>';
    }
    return this.escapeHtml(JSON.stringify(this.testResult, null, 2));
  }

  private updateResult() {
    const resultValue = this.shadow.querySelector(".result-value");
    if (resultValue) {
      resultValue.innerHTML = this.formatResult();
    }

    const errorText = this.shadow.querySelector(".error-text");
    if (this.parseError) {
      if (errorText) {
        errorText.textContent = this.parseError;
      } else {
        const newError = document.createElement("div");
        newError.className = "error-text";
        newError.textContent = this.parseError;
        this.shadow.querySelector(".result-area")?.appendChild(newError);
      }
    } else {
      errorText?.remove();
    }
  }

  private dispatchChangeEvent() {
    this.dispatchEvent(new CustomEvent("change", {
      detail: { value: this.expression },
      bubbles: true,
      composed: true,
    }));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Public method to set test resource
  setTestResource(resource: unknown) {
    this.testResource = resource;
  }
}

// Register the custom element
if (typeof customElements !== "undefined") {
  customElements.define("fhirpath-builder", FhirPathBuilder);
}

// Export for module usage
export default FhirPathBuilder;
export { FUNCTION_CATEGORIES, COMMON_PATHS, OPERATORS };
