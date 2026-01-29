/**
 * FHIRPath Monaco Editor Integration
 * 
 * Provides complete language support for FHIRPath in Monaco Editor:
 * - Syntax highlighting
 * - Autocomplete
 * - Hover documentation
 * - Validation/Diagnostics
 * 
 * @example
 * ```typescript
 * import { registerFhirPathLanguage } from "@atollee/fhirpath/monaco";
 * import * as monaco from "monaco-editor";
 * 
 * // Register the language
 * registerFhirPathLanguage(monaco);
 * 
 * // Create an editor with FHIRPath support
 * const editor = monaco.editor.create(document.getElementById('container'), {
 *   value: 'Patient.name.given',
 *   language: 'fhirpath'
 * });
 * ```
 */

// Re-export language definitions
export {
  FHIRPATH_LANGUAGE_ID,
  FHIRPATH_FUNCTIONS,
  FHIRPATH_OPERATORS,
  FHIRPATH_KEYWORDS,
  FHIR_RESOURCE_TYPES,
  COMMON_PATHS,
  FHIRPATH_LANGUAGE_CONFIG,
  FHIRPATH_MONARCH_TOKENS,
  type FunctionDefinition,
  type OperatorDefinition,
} from "./language.ts";

// Re-export completion provider
export {
  provideFhirPathCompletions,
  getCompletions,
  getSnippetCompletions,
  analyzeContext,
  CompletionItemKind,
  type CompletionItem,
  type CompletionContext,
} from "./completion.ts";

// Re-export hover provider
export {
  provideFhirPathHover,
  getFunctionsByCategory,
  getFunctionDocumentation,
  type HoverResult,
} from "./hover.ts";

// Re-export diagnostics provider
export {
  provideFhirPathDiagnostics,
  validateFhirPath,
  isValidFhirPath,
  getFhirPathError,
  DiagnosticSeverity,
  type Diagnostic,
} from "./diagnostics.ts";

import {
  FHIRPATH_LANGUAGE_ID,
  FHIRPATH_LANGUAGE_CONFIG,
  FHIRPATH_MONARCH_TOKENS,
} from "./language.ts";
import { provideFhirPathCompletions, getSnippetCompletions } from "./completion.ts";
import { provideFhirPathHover } from "./hover.ts";
import { provideFhirPathDiagnostics } from "./diagnostics.ts";

/**
 * Monaco Editor type (minimal interface for registration)
 */
interface Monaco {
  languages: {
    register(language: { id: string; extensions?: string[]; aliases?: string[] }): void;
    setLanguageConfiguration(languageId: string, configuration: unknown): void;
    setMonarchTokensProvider(languageId: string, provider: unknown): void;
    registerCompletionItemProvider(languageId: string, provider: unknown): void;
    registerHoverProvider(languageId: string, provider: unknown): void;
  };
  editor: {
    setModelMarkers(model: unknown, owner: string, markers: unknown[]): void;
  };
}

/**
 * Editor model interface
 */
interface EditorModel {
  getValue(): string;
  getOffsetAt(position: { lineNumber: number; column: number }): number;
  onDidChangeContent(listener: () => void): { dispose(): void };
}

/**
 * Register FHIRPath language support in Monaco Editor
 * 
 * @param monaco - The Monaco Editor namespace
 * @param options - Optional configuration
 */
export function registerFhirPathLanguage(
  monaco: Monaco,
  options: {
    /** Enable real-time validation (default: true) */
    validation?: boolean;
    /** Validation debounce delay in ms (default: 500) */
    validationDelay?: number;
    /** Additional snippets to include */
    customSnippets?: unknown[];
  } = {}
): void {
  const {
    validation = true,
    validationDelay = 500,
  } = options;

  // Register the language
  monaco.languages.register({
    id: FHIRPATH_LANGUAGE_ID,
    extensions: [".fhirpath"],
    aliases: ["FHIRPath", "fhirpath"],
  });

  // Set language configuration
  monaco.languages.setLanguageConfiguration(FHIRPATH_LANGUAGE_ID, FHIRPATH_LANGUAGE_CONFIG);

  // Set tokenizer for syntax highlighting
  monaco.languages.setMonarchTokensProvider(FHIRPATH_LANGUAGE_ID, FHIRPATH_MONARCH_TOKENS);

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(FHIRPATH_LANGUAGE_ID, {
    triggerCharacters: [".", "(", "%"],
    
    provideCompletionItems: (model: EditorModel, position: { lineNumber: number; column: number }) => {
      const text = model.getValue();
      const offset = model.getOffsetAt(position);
      
      const completions = provideFhirPathCompletions(text, offset);
      const snippets = getSnippetCompletions();
      
      return {
        suggestions: [...completions, ...snippets],
      };
    },
  });

  // Register hover provider
  monaco.languages.registerHoverProvider(FHIRPATH_LANGUAGE_ID, {
    provideHover: (model: EditorModel, position: { lineNumber: number; column: number }) => {
      const text = model.getValue();
      return provideFhirPathHover(text, position.lineNumber, position.column);
    },
  });

  // Validation is enabled - users can call setupFhirPathValidation() with their editor model
}

/**
 * Setup real-time validation for a Monaco editor model
 * 
 * @param monaco - The Monaco Editor namespace
 * @param model - The editor model to validate
 * @param debounceMs - Debounce delay in milliseconds
 * @returns Disposable to stop validation
 */
export function setupFhirPathValidation(
  monaco: Monaco,
  model: EditorModel,
  debounceMs: number = 500
): { dispose(): void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const validate = () => {
    const expression = model.getValue();
    const diagnostics = provideFhirPathDiagnostics(expression);
    monaco.editor.setModelMarkers(model, FHIRPATH_LANGUAGE_ID, diagnostics);
  };
  
  const debouncedValidate = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(validate, debounceMs);
  };
  
  // Initial validation
  validate();
  
  // Setup change listener
  const subscription = model.onDidChangeContent(debouncedValidate);
  
  return {
    dispose: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.dispose();
    },
  };
}

/**
 * Theme tokens for FHIRPath (for custom themes)
 */
export const FHIRPATH_THEME_TOKENS = [
  { token: "function.fhirpath", foreground: "DCDCAA" },
  { token: "keyword.fhirpath", foreground: "569CD6" },
  { token: "variable.predefined.fhirpath", foreground: "9CDCFE" },
  { token: "variable.fhirpath", foreground: "4EC9B0" },
  { token: "string.fhirpath", foreground: "CE9178" },
  { token: "number.fhirpath", foreground: "B5CEA8" },
  { token: "number.quantity.fhirpath", foreground: "B5CEA8" },
  { token: "date.fhirpath", foreground: "D7BA7D" },
  { token: "operator.fhirpath", foreground: "D4D4D4" },
  { token: "constant.language.fhirpath", foreground: "569CD6" },
  { token: "identifier.fhirpath", foreground: "9CDCFE" },
];

/**
 * Define FHIRPath theme for Monaco
 */
export function defineFhirPathTheme(monaco: Monaco & { editor: { defineTheme(name: string, theme: unknown): void } }): void {
  monaco.editor.defineTheme("fhirpath-dark", {
    base: "vs-dark",
    inherit: true,
    rules: FHIRPATH_THEME_TOKENS,
    colors: {},
  });
}
