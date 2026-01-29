import { useEffect, useRef, useState } from "preact/hooks";

// Monaco types (minimal interface)
interface Monaco {
  editor: {
    create: (container: HTMLElement, options: Record<string, unknown>) => MonacoEditor;
    defineTheme: (name: string, theme: Record<string, unknown>) => void;
    setTheme: (name: string) => void;
  };
  languages: {
    register: (language: { id: string }) => void;
    setLanguageConfiguration: (id: string, config: Record<string, unknown>) => void;
    setMonarchTokensProvider: (id: string, provider: Record<string, unknown>) => void;
    registerCompletionItemProvider: (id: string, provider: Record<string, unknown>) => { dispose: () => void };
    registerHoverProvider: (id: string, provider: Record<string, unknown>) => { dispose: () => void };
    CompletionItemKind: Record<string, number>;
  };
  KeyMod: { CtrlCmd: number };
  KeyCode: { Enter: number };
}

interface MonacoEditor {
  getValue: () => string;
  setValue: (value: string) => void;
  onDidChangeModelContent: (callback: () => void) => { dispose: () => void };
  addCommand: (keybinding: number, handler: () => void) => void;
  getModel: () => { getOffsetAt: (pos: { lineNumber: number; column: number }) => number } | null;
  dispose: () => void;
  layout: () => void;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  height?: string;
  isDark?: boolean;
}

// FHIRPath language definition
const FHIRPATH_LANGUAGE_CONFIG = {
  comments: { lineComment: "//" },
  brackets: [["(", ")"], ["[", "]"], ["{", "}"]],
  autoClosingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "'", close: "'", notIn: ["string"] },
  ],
};

const FHIRPATH_MONARCH_TOKENS = {
  defaultToken: "",
  tokenPostfix: ".fhirpath",
  keywords: ["and", "or", "xor", "implies", "div", "mod", "in", "contains", "is", "as"],
  operators: ["=", "!=", "~", "!~", "<", ">", "<=", ">=", "+", "-", "*", "/", "|", "&"],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4})/,
  tokenizer: {
    root: [
      [/\$this|\$index|\$total/, "variable.predefined"],
      [/%[a-zA-Z_]\w*/, "variable"],
      [/[a-zA-Z_]\w*(?=\s*\()/, "function"],
      [/\b(and|or|xor|implies|div|mod|in|contains|is|as)\b/, "keyword"],
      [/\b(true|false)\b/, "constant.language"],
      [/\d+\.\d+/, "number.float"],
      [/\d+/, "number"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/'/, "string", "@string_single"],
      [/@\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?/, "date"],
      [/\d+(\.\d+)?\s*'[^']*'/, "number.quantity"],
      [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      [/[a-zA-Z_]\w*/, "identifier"],
      [/[ \t\r\n]+/, ""],
      [/[{}()\[\]]/, "@brackets"],
      [/[,.]/, "delimiter"],
    ],
    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/'/, "string", "@pop"],
    ],
  },
};

// FHIRPath functions for autocomplete
const FHIRPATH_FUNCTIONS = [
  { name: "where", signature: "where(criteria)", description: "Filter elements matching criteria" },
  { name: "select", signature: "select(projection)", description: "Project each element" },
  { name: "first", signature: "first()", description: "Returns the first element" },
  { name: "last", signature: "last()", description: "Returns the last element" },
  { name: "count", signature: "count()", description: "Returns number of elements" },
  { name: "exists", signature: "exists([criteria])", description: "True if collection has elements" },
  { name: "empty", signature: "empty()", description: "True if collection is empty" },
  { name: "all", signature: "all(criteria)", description: "True if all match criteria" },
  { name: "distinct", signature: "distinct()", description: "Returns distinct elements" },
  { name: "contains", signature: "contains(substring)", description: "True if string contains substring" },
  { name: "startsWith", signature: "startsWith(prefix)", description: "True if starts with prefix" },
  { name: "endsWith", signature: "endsWith(suffix)", description: "True if ends with suffix" },
  { name: "matches", signature: "matches(regex)", description: "True if matches regex" },
  { name: "replace", signature: "replace(pattern, replacement)", description: "Replace pattern" },
  { name: "length", signature: "length()", description: "String length" },
  { name: "toInteger", signature: "toInteger()", description: "Convert to integer" },
  { name: "toString", signature: "toString()", description: "Convert to string" },
  { name: "toBoolean", signature: "toBoolean()", description: "Convert to boolean" },
  { name: "iif", signature: "iif(condition, true-result, false-result)", description: "Conditional" },
  { name: "now", signature: "now()", description: "Current date/time" },
  { name: "today", signature: "today()", description: "Current date" },
  { name: "not", signature: "not()", description: "Boolean negation" },
  { name: "is", signature: "is(type)", description: "Type check" },
  { name: "as", signature: "as(type)", description: "Type cast" },
  { name: "ofType", signature: "ofType(type)", description: "Filter by type" },
  { name: "resolve", signature: "resolve()", description: "Resolve Reference" },
  { name: "extension", signature: "extension(url)", description: "Get extension by URL" },
];

export default function MonacoEditor({ 
  value, 
  onChange, 
  onSubmit,
  height = "38px",
  isDark = false,
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load Monaco from CDN
  useEffect(() => {
    const loadMonaco = async () => {
      try {
        // Check if already loaded
        if ((globalThis as unknown as { monaco?: Monaco }).monaco) {
          monacoRef.current = (globalThis as unknown as { monaco: Monaco }).monaco;
          setIsLoading(false);
          return;
        }

        // Load Monaco loader
        const loaderScript = document.createElement("script");
        loaderScript.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js";
        loaderScript.async = true;
        
        await new Promise<void>((resolve, reject) => {
          loaderScript.onload = () => resolve();
          loaderScript.onerror = () => reject(new Error("Failed to load Monaco loader"));
          document.head.appendChild(loaderScript);
        });

        // Configure and load Monaco
        const require = (globalThis as unknown as { require: { config: (cfg: unknown) => void; (deps: string[], cb: (monaco: Monaco) => void): void } }).require;
        require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" } });
        
        await new Promise<void>((resolve) => {
          require(["vs/editor/editor.main"], (monaco: Monaco) => {
            monacoRef.current = monaco;
            (globalThis as unknown as { monaco: Monaco }).monaco = monaco;
            
            // Register FHIRPath language
            monaco.languages.register({ id: "fhirpath" });
            monaco.languages.setLanguageConfiguration("fhirpath", FHIRPATH_LANGUAGE_CONFIG as Record<string, unknown>);
            monaco.languages.setMonarchTokensProvider("fhirpath", FHIRPATH_MONARCH_TOKENS as Record<string, unknown>);
            
            // Register completion provider
            monaco.languages.registerCompletionItemProvider("fhirpath", {
              triggerCharacters: [".", "("],
              provideCompletionItems: () => ({
                suggestions: FHIRPATH_FUNCTIONS.map((fn) => ({
                  label: fn.name,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: fn.name + (fn.signature.includes("()") ? "()" : "("),
                  documentation: `${fn.signature}\n\n${fn.description}`,
                  detail: fn.signature,
                })),
              }),
            });

            // Define themes
            monaco.editor.defineTheme("fhirpath-light", {
              base: "vs",
              inherit: true,
              rules: [
                { token: "function.fhirpath", foreground: "0070C1" },
                { token: "keyword.fhirpath", foreground: "0000FF" },
                { token: "variable.predefined.fhirpath", foreground: "001080" },
                { token: "string.fhirpath", foreground: "A31515" },
                { token: "number.fhirpath", foreground: "098658" },
              ],
              colors: {
                "editor.background": "#f8fafc",
              },
            });
            
            monaco.editor.defineTheme("fhirpath-dark", {
              base: "vs-dark",
              inherit: true,
              rules: [
                { token: "function.fhirpath", foreground: "DCDCAA" },
                { token: "keyword.fhirpath", foreground: "569CD6" },
                { token: "variable.predefined.fhirpath", foreground: "9CDCFE" },
                { token: "string.fhirpath", foreground: "CE9178" },
                { token: "number.fhirpath", foreground: "B5CEA8" },
              ],
              colors: {
                "editor.background": "#141416",
              },
            });

            resolve();
          });
        });
        
        setIsLoading(false);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load Monaco");
        setIsLoading(false);
      }
    };

    loadMonaco();
  }, []);

  // Create editor when Monaco is loaded
  useEffect(() => {
    if (isLoading || loadError || !containerRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;
    
    // Set theme based on dark mode
    monaco.editor.setTheme(isDark ? "fhirpath-dark" : "fhirpath-light");

    if (!editorRef.current) {
      const editor = monaco.editor.create(containerRef.current, {
        value,
        language: "fhirpath",
        theme: isDark ? "fhirpath-dark" : "fhirpath-light",
        minimap: { enabled: false },
        lineNumbers: "off",
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: { vertical: "hidden", horizontal: "auto", useShadows: false },
        wordWrap: "on",
        fontSize: 14,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        tabCompletion: "on",
      });

      // Handle content changes
      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      });

      // Handle Ctrl+Enter for submit
      if (onSubmit) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onSubmit);
      }

      editorRef.current = editor;
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [isLoading, loadError, isDark]);

  // Update theme when dark mode changes
  useEffect(() => {
    if (monacoRef.current && !isLoading) {
      monacoRef.current.editor.setTheme(isDark ? "fhirpath-dark" : "fhirpath-light");
    }
  }, [isDark, isLoading]);

  // Sync external value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  if (loadError) {
    return (
      <input
        type="text"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        class="w-full px-3 py-2 font-mono text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        placeholder="Enter FHIRPath expression..."
      />
    );
  }

  return (
    <div class="relative">
      {isLoading && (
        <div class="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600">
          <span class="text-sm text-slate-500">Loading editor...</span>
        </div>
      )}
      <div
        ref={containerRef}
        class="w-full rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden"
        style={{ height, minHeight: height }}
      />
    </div>
  );
}
