import { useEffect, useRef, useState } from 'preact/hooks';

// Monaco types (minimal interface)
interface Monaco {
  editor: {
    create: (container: HTMLElement, options: Record<string, unknown>) => MonacoEditorInstance;
    defineTheme: (name: string, theme: Record<string, unknown>) => void;
    setTheme: (name: string) => void;
  };
  languages: {
    register: (language: { id: string }) => void;
    setLanguageConfiguration: (id: string, config: Record<string, unknown>) => void;
    setMonarchTokensProvider: (id: string, provider: Record<string, unknown>) => void;
    registerCompletionItemProvider: (id: string, provider: Record<string, unknown>) => { dispose: () => void };
    CompletionItemKind: Record<string, number>;
  };
  KeyMod: { CtrlCmd: number };
  KeyCode: { Enter: number };
}

interface MonacoEditorInstance {
  getValue: () => string;
  setValue: (value: string) => void;
  onDidChangeModelContent: (callback: () => void) => { dispose: () => void };
  onDidContentSizeChange: (callback: (e: { contentHeight: number }) => void) => { dispose: () => void };
  addCommand: (keybinding: number, handler: () => void) => void;
  getContentHeight: () => number;
  dispose: () => void;
  layout: () => void;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  minHeight?: number;
  maxHeight?: number;
  isDark?: boolean;
}

const FHIRPATH_LANGUAGE_CONFIG = {
  comments: { lineComment: '//' },
  brackets: [['(', ')'], ['[', ']'], ['{', '}']],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: "'", close: "'", notIn: ['string'] },
  ],
};

const FHIRPATH_MONARCH_TOKENS = {
  defaultToken: '',
  tokenPostfix: '.fhirpath',
  keywords: ['and', 'or', 'xor', 'implies', 'div', 'mod', 'in', 'contains', 'is', 'as'],
  operators: ['=', '!=', '~', '!~', '<', '>', '<=', '>=', '+', '-', '*', '/', '|', '&'],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4})/,
  tokenizer: {
    root: [
      [/\$this|\$index|\$total/, 'variable.predefined'],
      [/%[a-zA-Z_]\w*/, 'variable'],
      [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
      [/\b(and|or|xor|implies|div|mod|in|contains|is|as)\b/, 'keyword'],
      [/\b(true|false)\b/, 'constant.language'],
      [/\d+\.\d+/, 'number.float'],
      [/\d+/, 'number'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'/, 'string', '@string_single'],
      [/@\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?/, 'date'],
      [/\d+(\.\d+)?\s*'[^']*'/, 'number.quantity'],
      [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
      [/[a-zA-Z_]\w*/, 'identifier'],
      [/[ \t\r\n]+/, ''],
      [/[{}()\[\]]/, '@brackets'],
      [/[,.]/, 'delimiter'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
};

const FHIRPATH_FUNCTIONS = [
  { name: 'where', signature: 'where(criteria)', description: 'Filter elements matching criteria' },
  { name: 'select', signature: 'select(projection)', description: 'Project each element' },
  { name: 'first', signature: 'first()', description: 'Returns the first element' },
  { name: 'last', signature: 'last()', description: 'Returns the last element' },
  { name: 'count', signature: 'count()', description: 'Returns number of elements' },
  { name: 'exists', signature: 'exists([criteria])', description: 'True if collection has elements' },
  { name: 'empty', signature: 'empty()', description: 'True if collection is empty' },
  { name: 'all', signature: 'all(criteria)', description: 'True if all match criteria' },
  { name: 'distinct', signature: 'distinct()', description: 'Returns distinct elements' },
  { name: 'contains', signature: 'contains(substring)', description: 'True if string contains substring' },
  { name: 'startsWith', signature: 'startsWith(prefix)', description: 'True if starts with prefix' },
  { name: 'endsWith', signature: 'endsWith(suffix)', description: 'True if ends with suffix' },
  { name: 'matches', signature: 'matches(regex)', description: 'True if matches regex' },
  { name: 'replace', signature: 'replace(pattern, replacement)', description: 'Replace pattern' },
  { name: 'length', signature: 'length()', description: 'String length' },
  { name: 'toInteger', signature: 'toInteger()', description: 'Convert to integer' },
  { name: 'toString', signature: 'toString()', description: 'Convert to string' },
  { name: 'iif', signature: 'iif(condition, true-result, false-result)', description: 'Conditional' },
  { name: 'now', signature: 'now()', description: 'Current date/time' },
  { name: 'today', signature: 'today()', description: 'Current date' },
];

// Detect iOS/mobile devices where Monaco doesn't work properly
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS devices (iPhone, iPad, iPod) - all iOS browsers use WebKit
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Android mobile (not tablets with keyboards)
  const isAndroidMobile = /Android/.test(ua) && /Mobile/.test(ua);
  return isIOS || isAndroidMobile;
}

export function MonacoEditor({ 
  value, 
  onChange, 
  onSubmit,
  minHeight = 38,
  maxHeight = 200,
  isDark = false,
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState(minHeight);
  const [isMobile] = useState(() => isMobileDevice());

  useEffect(() => {
    // Skip Monaco loading on mobile devices - Monaco doesn't work on iOS
    if (isMobile) {
      setIsLoading(false);
      return;
    }

    const loadMonaco = async () => {
      try {
        if ((globalThis as unknown as { monaco?: Monaco }).monaco) {
          monacoRef.current = (globalThis as unknown as { monaco: Monaco }).monaco;
          setIsLoading(false);
          return;
        }

        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
        loaderScript.async = true;
        
        await new Promise<void>((resolve, reject) => {
          loaderScript.onload = () => resolve();
          loaderScript.onerror = () => reject(new Error('Failed to load Monaco loader'));
          document.head.appendChild(loaderScript);
        });

        const require = (globalThis as unknown as { require: { config: (cfg: unknown) => void; (deps: string[], cb: (monaco: Monaco) => void): void } }).require;
        require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
        
        await new Promise<void>((resolve) => {
          require(['vs/editor/editor.main'], (monaco: Monaco) => {
            monacoRef.current = monaco;
            (globalThis as unknown as { monaco: Monaco }).monaco = monaco;
            
            monaco.languages.register({ id: 'fhirpath' });
            monaco.languages.setLanguageConfiguration('fhirpath', FHIRPATH_LANGUAGE_CONFIG as Record<string, unknown>);
            monaco.languages.setMonarchTokensProvider('fhirpath', FHIRPATH_MONARCH_TOKENS as Record<string, unknown>);
            
            monaco.languages.registerCompletionItemProvider('fhirpath', {
              triggerCharacters: ['.', '('],
              provideCompletionItems: () => ({
                suggestions: FHIRPATH_FUNCTIONS.map((fn) => ({
                  label: fn.name,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: fn.name + (fn.signature.includes('()') ? '()' : '('),
                  documentation: `${fn.signature}\n\n${fn.description}`,
                  detail: fn.signature,
                })),
              }),
            });

            monaco.editor.defineTheme('fhirpath-light', {
              base: 'vs',
              inherit: true,
              rules: [
                { token: 'function.fhirpath', foreground: '0070C1' },
                { token: 'keyword.fhirpath', foreground: '0000FF' },
                { token: 'variable.predefined.fhirpath', foreground: '001080' },
                { token: 'string.fhirpath', foreground: 'A31515' },
                { token: 'number.fhirpath', foreground: '098658' },
              ],
              colors: { 'editor.background': '#f8fafc' },
            });
            
            monaco.editor.defineTheme('fhirpath-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'function.fhirpath', foreground: 'DCDCAA' },
                { token: 'keyword.fhirpath', foreground: '569CD6' },
                { token: 'variable.predefined.fhirpath', foreground: '9CDCFE' },
                { token: 'string.fhirpath', foreground: 'CE9178' },
                { token: 'number.fhirpath', foreground: 'B5CEA8' },
              ],
              colors: { 'editor.background': '#141416' },
            });

            resolve();
          });
        });
        
        setIsLoading(false);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load Monaco');
        setIsLoading(false);
      }
    };

    loadMonaco();
  }, []);

  useEffect(() => {
    if (isLoading || loadError || !containerRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;
    monaco.editor.setTheme(isDark ? 'fhirpath-dark' : 'fhirpath-light');

    if (!editorRef.current) {
      const editor = monaco.editor.create(containerRef.current, {
        value,
        language: 'fhirpath',
        theme: isDark ? 'fhirpath-dark' : 'fhirpath-light',
        minimap: { enabled: false },
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 0,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: { vertical: 'hidden', horizontal: 'auto', useShadows: false },
        wordWrap: 'on',
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        tabCompletion: 'on',
      });

      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      });

      const updateHeight = () => {
        const contentHeight = editor.getContentHeight();
        const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
        setEditorHeight(newHeight);
        editor.layout();
      };
      
      editor.onDidContentSizeChange(updateHeight);
      setTimeout(updateHeight, 50);

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

  useEffect(() => {
    if (monacoRef.current && !isLoading) {
      monacoRef.current.editor.setTheme(isDark ? 'fhirpath-dark' : 'fhirpath-light');
    }
  }, [isDark, isLoading]);

  // Sync external value changes and update height
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
      // Recalculate height after value change
      setTimeout(() => {
        if (editorRef.current) {
          const contentHeight = editorRef.current.getContentHeight();
          const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
          setEditorHeight(newHeight);
          editorRef.current.layout();
        }
      }, 10);
    }
  }, [value, minHeight, maxHeight]);

  // Mobile textarea ref for auto-resize
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea when value changes (for mobile)
  useEffect(() => {
    if ((loadError || isMobile) && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, loadError, isMobile, minHeight, maxHeight]);

  // Fallback for mobile devices (iOS/Android) or load errors
  // Monaco Editor doesn't work properly on mobile - shows broken canvas/cursor artifacts
  if (loadError || isMobile) {
    const handleTextareaInput = (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement;
      onChange(textarea.value);
      // Auto-resize: reset height then set to scrollHeight
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    };

    return (
      <div class="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onInput={handleTextareaInput}
          onKeyDown={(e) => {
            if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          class="w-full px-3 py-2 font-mono text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-[rgb(30,210,255)] focus:border-transparent overflow-hidden"
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
          placeholder="Enter FHIRPath expression..."
          rows={1}
        />
      </div>
    );
  }

  return (
    <div class="relative">
      {isLoading && (
        <div 
          class="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600"
          style={{ minHeight: `${minHeight}px` }}
        >
          <span class="text-sm text-slate-500">Loading editor...</span>
        </div>
      )}
      <div
        ref={containerRef}
        class="w-full rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden transition-[height] duration-100 focus-within:outline-none focus-within:ring-1 focus-within:ring-[rgb(30,210,255)] focus-within:border-transparent"
        style={{ height: `${editorHeight}px`, minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
      />
    </div>
  );
}
