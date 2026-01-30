import { useState, useEffect, useCallback } from "preact/hooks";
import type { AnalysisResult } from "../../../src/optimizer/mod.ts";
import MonacoEditor from "./MonacoEditor.tsx";
import { type Language, type Translations, getTranslations, STORAGE_KEY as LANG_STORAGE_KEY, DEFAULT_LANGUAGE } from "../utils/i18n.ts";

interface HistoryEntry {
  expression: string;
  timestamp: number;
  resourceType?: string;
}

interface FavoriteEntry {
  id: string;
  expression: string;
  label: string;
  createdAt: number;
}

interface PlaygroundIslandProps {
  initialExpression?: string;
  initialResource?: unknown;
  initialResult?: unknown[];
  initialError?: string;
}

const STORAGE_KEYS = {
  HISTORY: "fhirpath-playground-history",
  FAVORITES: "fhirpath-playground-favorites",
};

const MAX_HISTORY = 50;

const DEFAULT_PATIENT = {
  resourceType: "Patient",
  id: "example",
  meta: { versionId: "1", lastUpdated: "2024-01-15T10:30:00Z" },
  identifier: [{ system: "http://example.org/mrn", value: "12345" }],
  active: true,
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-05-15",
  address: [{ city: "Boston", state: "MA", country: "USA" }],
  telecom: [
    { system: "phone", value: "555-1234" },
    { system: "email", value: "john@example.com" },
  ],
};

// Legacy simple expressions (kept for quick access buttons)
const getSampleExpressions = (t: Translations) => [
  { label: t.samples.givenNames, expression: "name.given" },
  { label: t.samples.officialName, expression: "name.where(use = 'official').given.first()" },
  { label: t.samples.isActive, expression: "active" },
  { label: t.samples.countNames, expression: "name.count()" },
  { label: t.samples.hasPhone, expression: "telecom.where(system = 'phone').exists()" },
  { label: t.samples.identifiers, expression: "identifier.value" },
  { label: t.samples.typeCheck, expression: "$this is Patient" },
];

// Expression item with optional v3 flag for STU functions
interface ExpressionItem {
  label: string;
  expr: string;
  v3?: boolean; // true = FHIRPath v3.0.0 STU (not normative yet)
}

// Categorized expressions based on Supported Functions in README
// Functions marked with v3: true are from FHIRPath v3.0.0 STU (Standard for Trial Use)
// v2.0.0 is the current Normative Release (ANSI Standard since 2020)
const getCategorizedExpressions = (t: Translations): Record<string, ExpressionItem[]> => ({
  [t.sampleCategories.basic]: [
    { label: "Path navigation", expr: "name.given" },
    { label: "Property access", expr: "birthDate" },
    { label: "Array index", expr: "name[0].family" },
    { label: "Chained paths", expr: "name.given.first()" },
  ],
  [t.sampleCategories.existence]: [
    { label: "empty()", expr: "name.empty()" },
    { label: "exists()", expr: "name.exists()" },
    { label: "exists(criteria)", expr: "name.exists(use = 'official')" },
    { label: "all(criteria)", expr: "name.all(family.exists())" },
    { label: "allTrue()", expr: "(true | true | true).allTrue()" },
    { label: "anyTrue()", expr: "(false | true | false).anyTrue()" },
    { label: "allFalse()", expr: "(false | false).allFalse()" },
    { label: "anyFalse()", expr: "(true | false).anyFalse()" },
    { label: "hasValue()", expr: "name.first().hasValue()" },
    { label: "subsetOf()", expr: "('a' | 'b').subsetOf('a' | 'b' | 'c')" },
    { label: "supersetOf()", expr: "('a' | 'b' | 'c').supersetOf('a' | 'b')" },
  ],
  [t.sampleCategories.filtering]: [
    { label: "where()", expr: "name.where(use = 'official')" },
    { label: "select()", expr: "name.select(given.first())" },
    { label: "repeat()", expr: "name.repeat(given)" },
    { label: "ofType()", expr: "children().ofType(HumanName)" },
    { label: "is", expr: "$this is Patient" },
    { label: "as", expr: "($this as Patient).name" },
  ],
  [t.sampleCategories.subsetting]: [
    { label: "single()", expr: "name.where(use = 'official').single()" },
    { label: "first()", expr: "name.first()" },
    { label: "last()", expr: "name.last()" },
    { label: "tail()", expr: "name.given.tail()" },
    { label: "skip(n)", expr: "name.given.skip(1)" },
    { label: "take(n)", expr: "name.given.take(2)" },
    { label: "intersect()", expr: "name.given.intersect('John' | 'Jane')" },
    { label: "exclude()", expr: "name.given.exclude('James')" },
  ],
  [t.sampleCategories.combining]: [
    { label: "union (|)", expr: "name.given | name.family" },
    { label: "combine()", expr: "name.given.combine(name.family)" },
    { label: "distinct()", expr: "('a' | 'b' | 'a').distinct()" },
    { label: "isDistinct()", expr: "name.given.isDistinct()" },
  ],
  [t.sampleCategories.strings]: [
    { label: "length()", expr: "name.family.length()" },
    { label: "upper()", expr: "name.family.upper()" },
    { label: "lower()", expr: "name.family.lower()" },
    { label: "startsWith()", expr: "name.family.startsWith('D')" },
    { label: "endsWith()", expr: "name.family.endsWith('oe')" },
    { label: "contains()", expr: "name.family.contains('o')" },
    { label: "substring()", expr: "name.family.substring(0, 2)" },
    { label: "indexOf()", expr: "name.family.indexOf('o')" },
    { label: "replace()", expr: "name.family.replace('Doe', 'Smith')" },
    { label: "matches()", expr: "name.family.matches('[A-Z].*')" },
    { label: "replaceMatches()", expr: "name.family.replaceMatches('[aeiou]', '*')" },
    { label: "split()", expr: "'a,b,c'.split(',')", v3: true },
    { label: "join()", expr: "name.given.join(', ')", v3: true },
    { label: "trim()", expr: "'  hello  '.trim()", v3: true },
    { label: "toChars()", expr: "'abc'.toChars()" },
    { label: "encode()", expr: "'hello'.encode('base64')", v3: true },
    { label: "decode()", expr: "'aGVsbG8='.decode('base64')", v3: true },
  ],
  [t.sampleCategories.math]: [
    { label: "abs()", expr: "(-5).abs()" },
    { label: "ceiling()", expr: "(3.2).ceiling()" },
    { label: "floor()", expr: "(3.8).floor()" },
    { label: "round()", expr: "(3.567).round(2)" },
    { label: "sqrt()", expr: "(16).sqrt()" },
    { label: "power()", expr: "(2).power(10)" },
    { label: "ln()", expr: "(10).ln()" },
    { label: "log()", expr: "(100).log(10)" },
    { label: "exp()", expr: "(1).exp()" },
    { label: "truncate()", expr: "(3.9).truncate()" },
  ],
  [t.sampleCategories.aggregate]: [
    { label: "count()", expr: "name.count()" },
    { label: "sum()", expr: "(1 | 2 | 3 | 4 | 5).sum()", v3: true },
    { label: "min()", expr: "(5 | 2 | 8 | 1).min()", v3: true },
    { label: "max()", expr: "(5 | 2 | 8 | 1).max()", v3: true },
    { label: "avg()", expr: "(10 | 20 | 30).avg()", v3: true },
    { label: "aggregate() sum", expr: "(1 | 2 | 3).aggregate($total + $this, 0)" },
    { label: "aggregate() product", expr: "(1 | 2 | 3 | 4).aggregate($total * $this, 1)" },
    { label: "aggregate() concat", expr: "('a' | 'b' | 'c').aggregate($total & $this, '')" },
  ],
  [t.sampleCategories.conversion]: [
    { label: "toString()", expr: "(123).toString()" },
    { label: "toInteger()", expr: "'42'.toInteger()" },
    { label: "toDecimal()", expr: "'3.14'.toDecimal()" },
    { label: "toBoolean()", expr: "'true'.toBoolean()" },
    { label: "toDate()", expr: "birthDate.toDate()" },
    { label: "toDateTime()", expr: "'2024-01-15T10:30:00Z'.toDateTime()" },
    { label: "toTime()", expr: "'14:30:00'.toTime()" },
    { label: "toQuantity()", expr: "5.5.toQuantity('kg')" },
    { label: "convertsToString()", expr: "(123).convertsToString()" },
    { label: "convertsToInteger()", expr: "'abc'.convertsToInteger()" },
    { label: "convertsToDecimal()", expr: "'3.14'.convertsToDecimal()" },
    { label: "convertsToBoolean()", expr: "'yes'.convertsToBoolean()" },
    { label: "convertsToDate()", expr: "birthDate.convertsToDate()" },
    { label: "convertsToDateTime()", expr: "'2024-01-15'.convertsToDateTime()" },
    { label: "convertsToTime()", expr: "'14:30:00'.convertsToTime()" },
    { label: "convertsToQuantity()", expr: "'10 kg'.convertsToQuantity()" },
    { label: "iif()", expr: "iif(active, 'Yes', 'No')" },
  ],
  [t.sampleCategories.navigation]: [
    { label: "children()", expr: "children()" },
    { label: "descendants()", expr: "descendants().take(5)" },
  ],
  [t.sampleCategories.fhirSpecific]: [
    { label: "extension(url)", expr: "extension('http://example.org/ext')" },
    { label: "hasExtension()", expr: "hasExtension('http://example.org/ext')" },
    { label: "getValue()", expr: "identifier.first().getValue()" },
    { label: "resolve()", expr: "generalPractitioner.resolve()" },
    { label: "memberOf()", expr: "gender.memberOf('http://hl7.org/fhir/ValueSet/administrative-gender')" },
    { label: "htmlChecks()", expr: "text.div.htmlChecks()" },
    { label: "resourceType", expr: "resourceType" },
    { label: "id", expr: "id" },
    { label: "meta.versionId", expr: "meta.versionId" },
    { label: "meta.lastUpdated", expr: "meta.lastUpdated" },
    { label: "meta.profile", expr: "meta.profile" },
    { label: "meta.tag", expr: "meta.tag" },
  ],
  [t.sampleCategories.boolean]: [
    { label: "not()", expr: "active.not()" },
    { label: "and", expr: "active and name.exists()" },
    { label: "or", expr: "active or deceased" },
    { label: "xor", expr: "true xor false" },
    { label: "implies", expr: "active implies name.exists()" },
    { label: "= (equals)", expr: "gender = 'male'" },
    { label: "!= (not equals)", expr: "gender != 'female'" },
    { label: "~ (equivalent)", expr: "name.family ~ 'DOE'" },
    { label: "< > <= >=", expr: "name.count() > 0" },
  ],
  [t.sampleCategories.utility]: [
    { label: "today()", expr: "today()" },
    { label: "now()", expr: "now()" },
    { label: "timeOfDay()", expr: "timeOfDay()" },
    { label: "trace()", expr: "name.trace('debug')" },
    { label: "defineVariable()", expr: "defineVariable('x', name.first()).select(%x.given)", v3: true },
    { label: "type()", expr: "name.type()", v3: true },
    { label: "$this", expr: "name.where($this.use = 'official')" },
    { label: "$index", expr: "name.select($index)" },
    { label: "$total", expr: "(1|2|3).aggregate($total + $this, 0)" },
    { label: "%resource", expr: "%resource.resourceType" },
  ],
});

export default function PlaygroundIsland({
  initialExpression = "name.given",
  initialResource,
  initialResult,
  initialError,
}: PlaygroundIslandProps) {
  const [expression, setExpression] = useState(initialExpression);
  const [resourceJson, setResourceJson] = useState(
    JSON.stringify(initialResource || DEFAULT_PATIENT, null, 2)
  );
  const [result, setResult] = useState<unknown[] | null>(initialResult || null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [usedJit, setUsedJit] = useState(false);
  const [fhirpathJsTime, setFhirpathJsTime] = useState<number | null>(null);
  const [fhirpathJsError, setFhirpathJsError] = useState<string | null>(null);
  const [speedup, setSpeedup] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"result" | "ast" | "hints">("result");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showExpressionBrowser, setShowExpressionBrowser] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const [t, setT] = useState<Translations>(getTranslations(DEFAULT_LANGUAGE));
  const [fhirVersion, setFhirVersion] = useState<"r4" | "r4b" | "r5" | "r6">("r6");

  // Detect language
  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "de")) {
      setLang(saved);
      setT(getTranslations(saved));
    }
    
    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent).detail as Language;
      setLang(newLang);
      setT(getTranslations(newLang));
    };
    
    globalThis.addEventListener("languagechange", handleLangChange);
    return () => globalThis.removeEventListener("languagechange", handleLangChange);
  }, []);

  // Detect dark mode
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains("dark"));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const historyData = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (historyData) setHistory(JSON.parse(historyData));
      
      const favoritesData = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favoritesData) setFavorites(JSON.parse(favoritesData));
    } catch {
      // Storage error, ignore
    }
  }, []);

  // Save history
  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(entries));
    } catch { /* ignore */ }
  }, []);

  // Save favorites
  const saveFavorites = useCallback((entries: FavoriteEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(entries));
    } catch { /* ignore */ }
  }, []);

  // Add to history
  const addToHistory = useCallback((expr: string) => {
    if (!expr.trim()) return;
    
    let resource;
    try { resource = JSON.parse(resourceJson); } catch { /* ignore */ }
    const resourceType = resource?.resourceType;

    setHistory(prev => {
      const filtered = prev.filter(h => h.expression !== expr);
      const newHistory = [
        { expression: expr, timestamp: Date.now(), resourceType },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [resourceJson, saveHistory]);

  // Evaluate expression via API
  const evaluate = useCallback(async () => {
    if (!expression.trim()) {
      setResult(null);
      setError(null);
      setAnalysis(null);
      return;
    }

    setLoading(true);
    const startTime = performance.now();

    try {
      let resource;
      try {
        resource = JSON.parse(resourceJson);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression, resource, fhirVersion }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setResult(null);
      } else {
        setResult(data.result);
        setError(null);
        addToHistory(expression);
      }

      setAnalysis(data.analysis || null);
      // Use server-side evaluation time (pure FHIRPath execution)
      setExecutionTime(data._meta?.evaluationMs ?? (performance.now() - startTime));
      setUsedJit(data._meta?.usedJit ?? false);
      setFhirpathJsTime(data._meta?.fhirpathJsMs ?? null);
      setFhirpathJsError(data._meta?.fhirpathJsError ?? null);
      setSpeedup(data._meta?.speedup ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [expression, resourceJson, fhirVersion, addToHistory]);

  // Auto-evaluate on expression/resource change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      evaluate();
    }, 300);
    return () => clearTimeout(timer);
  }, [expression, resourceJson]);

  // Toggle favorite
  const toggleFavorite = useCallback(() => {
    const isFav = favorites.some(f => f.expression === expression);
    
    if (isFav) {
      setFavorites(prev => {
        const newFavs = prev.filter(f => f.expression !== expression);
        saveFavorites(newFavs);
        return newFavs;
      });
    } else {
      const newFav: FavoriteEntry = {
        id: `fav-${Date.now()}`,
        expression,
        label: expression.length > 30 ? expression.slice(0, 30) + "..." : expression,
        createdAt: Date.now(),
      };
      setFavorites(prev => {
        const newFavs = [...prev, newFav];
        saveFavorites(newFavs);
        return newFavs;
      });
    }
  }, [expression, favorites, saveFavorites]);

  // Copy expression to clipboard
  const copyExpression = useCallback(async () => {
    if (!expression.trim()) return;
    
    try {
      await navigator.clipboard.writeText(expression);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [expression]);

  // Format time ago
  const formatTimeAgo = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isFavorited = favorites.some(f => f.expression === expression);

  return (
    <div class="space-y-3">
      {/* Two-column layout on medium+ screens */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        {/* Resource Input */}
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t.headings.resource}
            </h3>
            <div class="flex items-center gap-1.5" title={t.playground.fhirReleaseTooltip}>
              <span class="text-xs text-slate-400 dark:text-slate-500">{t.playground.fhirRelease}</span>
              <select
                value={fhirVersion}
                onChange={(e) => setFhirVersion((e.target as HTMLSelectElement).value as "r4" | "r4b" | "r5" | "r6")}
                class="text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[rgb(30,210,255)]"
              >
                <option value="r4">R4</option>
                <option value="r4b">R4B</option>
                <option value="r5">R5</option>
                <option value="r6">R6</option>
              </select>
            </div>
          </div>
          <textarea
            value={resourceJson}
            onInput={(e) => setResourceJson((e.target as HTMLTextAreaElement).value)}
            class="w-full flex-1 min-h-[160px] p-2 font-mono text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[rgb(30,210,255)] focus:border-transparent resize-none"
            spellcheck={false}
          />
        </div>

        {/* Expression Input + Result Panel stacked */}
        <div class="space-y-3">
          {/* Expression Input */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t.headings.expression}
              </h3>
              <button
                onClick={toggleFavorite}
                class={`text-lg leading-none ${isFavorited ? "text-atollee-orange" : "text-slate-400"} hover:text-atollee-orange transition-colors`}
                title={isFavorited ? t.playground.removeFavorite : t.playground.favorite}
              >
                {isFavorited ? "★" : "☆"}
              </button>
              <button
                onClick={copyExpression}
                class={`px-2 py-0.5 text-xs rounded transition-colors ${
                  copied
                    ? "bg-atollee text-black"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
                title={t.playground.copy}
              >
                {copied ? "✓" : "📋"}
              </button>
              {/* History dropdown */}
              <div class="relative ml-auto">
                <button
                  onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }}
                  class="text-xs text-slate-500 dark:text-slate-400 link-atollee transition-colors"
                >
                  📜 {t.playground.history} {showHistory ? "▲" : "▼"}
                </button>
                {showHistory && history.length > 0 && (
                  <div class="absolute right-0 top-6 z-20 w-64 sm:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {history.slice(0, 10).map((h) => (
                      <div
                        key={h.timestamp}
                        onClick={() => { setExpression(h.expression); setShowHistory(false); }}
                        class="flex justify-between items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <span class="text-xs font-mono code-result truncate">
                          {h.expression}
                        </span>
                        <span class="text-xs text-slate-400 ml-2 whitespace-nowrap">{formatTimeAgo(h.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <MonacoEditor
              value={expression}
              onChange={setExpression}
              onSubmit={evaluate}
              isDark={isDark}
              minHeight={38}
              maxHeight={150}
            />
            {/* Sample Expressions */}
            <div class="flex flex-wrap gap-1.5 mt-2">
              {getSampleExpressions(t).map((s) => (
                <button
                  key={s.expression}
                  onClick={() => setExpression(s.expression)}
                  class="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap"
                  title={s.expression}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Browse All Expressions Button - always on new line */}
            <div class="mt-2">
              <button
                onClick={() => { setShowExpressionBrowser(!showExpressionBrowser); setShowHistory(false); setShowFavorites(false); }}
                class="px-2 py-0.5 text-xs bg-atollee-ocean/10 dark:bg-atollee-sea/20 text-atollee-ocean dark:text-atollee-sea rounded hover:bg-atollee-ocean/20 dark:hover:bg-atollee-sea/30 transition-colors whitespace-nowrap font-medium"
              >
                📚 {lang === "de" ? "Ausdrücke nach Kategorie" : "Expressions by Category"} {showExpressionBrowser ? "▲" : "▼"}
              </button>
            </div>
            {/* Expression Browser Panel - appears below sample buttons */}
            {showExpressionBrowser && (
              <div class="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {/* Category Tabs */}
                <div class="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  {Object.keys(getCategorizedExpressions(t)).map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      class={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedCategory === category
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {/* Legend for v3 STU */}
                <div class="px-2 py-1 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 text-[10px]">
                  <span class="text-slate-400 dark:text-slate-500">
                    {lang === "de" ? "v2.0.0 = Normativ" : "v2.0.0 = Normative"}
                  </span>
                  <span class="text-slate-300 dark:text-slate-600">│</span>
                  <span class="v3-stu font-medium">
                    {lang === "de" ? "v3.0.0 = STU (Entwurf)" : "v3.0.0 = STU (Draft)"}
                  </span>
                </div>
                {/* Expression List */}
                <div class="max-h-40 overflow-y-auto p-2">
                  {selectedCategory ? (
                    <div class="grid grid-cols-2 gap-1">
                      {getCategorizedExpressions(t)[selectedCategory]?.map((item) => {
                        const isActive = expression === item.expr;
                        const isV3 = item.v3 === true;
                        return (
                          <button
                            key={item.expr}
                            onClick={() => setExpression(item.expr)}
                            class={`text-left px-2 py-1.5 text-xs rounded transition-colors group ${
                              isActive
                                ? "bg-blue-600 shadow-sm"
                                : "hover:bg-slate-200 dark:hover:bg-slate-600"
                            }`}
                            title={isV3 ? (lang === "de" ? "FHIRPath v3.0.0 STU (noch nicht normativ)" : "FHIRPath v3.0.0 STU (not normative yet)") : undefined}
                          >
                            <span class={`font-semibold ${isActive ? "text-white" : isV3 ? "v3-stu" : "text-slate-800 dark:text-slate-100"}`}>
                              {item.label}
                              {isV3 && !isActive && <span class="v3-stu-badge">v3</span>}
                            </span>
                            <code class={`block text-[10px] font-mono truncate ${isActive ? "text-blue-100" : isV3 ? "v3-stu opacity-80" : "text-slate-500 dark:text-slate-400"}`}>
                              {item.expr}
                            </code>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div class="text-center text-xs text-slate-400 dark:text-slate-500 py-2">
                      {lang === "de" ? "↑ Kategorie auswählen" : "↑ Select a category"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Result Panel */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3">
            {/* Tabs + Favorites */}
            <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
              <div class="flex border-b border-slate-200 dark:border-slate-700">
                {(["result", "ast", "hints"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    class={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? "border-b-2 tab-active"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {tab === "result" ? t.playground.result : tab === "ast" ? t.playground.ast : t.playground.hints}
                  </button>
                ))}
              </div>
              {/* Favorites dropdown */}
              <div class="relative">
                <button
                  onClick={() => { setShowFavorites(!showFavorites); setShowHistory(false); }}
                  class="text-xs text-slate-500 dark:text-slate-400 link-atollee transition-colors"
                >
                  ⭐ {t.playground.favorites} {showFavorites ? "▲" : "▼"}
                </button>
                {showFavorites && favorites.length > 0 && (
                  <div class="absolute right-0 top-6 z-20 w-64 sm:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {favorites.map((f) => (
                      <div
                        key={f.id}
                        class="flex justify-between items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <span
                          onClick={() => { setExpression(f.expression); setShowFavorites(false); }}
                          class="text-xs font-mono code-result truncate cursor-pointer hover:underline"
                        >
                          {f.label}
                        </span>
                        <button
                          onClick={() => {
                            setFavorites(prev => {
                              const newFavs = prev.filter(x => x.id !== f.id);
                              saveFavorites(newFavs);
                              return newFavs;
                            });
                          }}
                          class="text-xs text-slate-400 hover:text-red-500 ml-2 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <div class="h-40 sm:h-48 md:h-40 overflow-auto bg-slate-50 dark:bg-slate-900 rounded-md p-2">
              {activeTab === "result" && (
                <div>
                  {error ? (
                    <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  ) : result ? (
                    <pre class="text-xs font-mono code-result whitespace-pre-wrap break-words">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  ) : (
                    <div class="text-slate-400 text-sm italic">{t.playground.empty}</div>
                  )}
                </div>
              )}

              {activeTab === "ast" && analysis?.ast && (
                <pre class="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                  {JSON.stringify(analysis.ast, null, 2)}
                </pre>
              )}

              {activeTab === "hints" && (
                <div class="space-y-2">
                  {analysis?.hints && analysis.hints.length > 0 ? (
                    analysis.hints.map((hint, i) => (
                      <div
                        key={i}
                        class={`p-3 rounded-md border-l-4 ${
                          hint.severity === "critical" ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                          hint.severity === "warning" ? "border-atollee bg-[rgba(250,120,0,0.1)] dark:bg-[rgba(250,120,0,0.15)]" :
                          hint.severity === "suggestion" ? "border-atollee-sea bg-[rgba(0,215,215,0.1)] dark:bg-[rgba(0,215,215,0.15)]" :
                          "border-atollee-ocean bg-[rgba(30,210,255,0.1)] dark:bg-[rgba(30,210,255,0.15)]"
                        }`}
                      >
                        <div class="text-sm font-medium text-slate-900 dark:text-white">
                          {hint.severity === "critical" ? "🚨" : hint.severity === "warning" ? "⚠️" : hint.severity === "suggestion" ? "💡" : "ℹ️"}{" "}
                          {hint.message}
                        </div>
                        <div class="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {hint.explanation}
                        </div>
                        {hint.suggestion && (
                          <div class="text-xs text-atollee-sea mt-1 font-mono">
                            💡 {hint.suggestion}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div class="p-3 bg-[rgba(0,215,215,0.1)] dark:bg-[rgba(0,215,215,0.15)] border-l-4 border-atollee-sea rounded-md text-sm text-atollee-sea">
                      ✓ {t.playground.noHints}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Bar - compact, responsive, logically ordered */}
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* 1. Complexity */}
          {analysis && (
            <span class="text-slate-500 dark:text-slate-400 hidden sm:inline">
              📊 {t.playground.complexity}: {analysis.complexity}/100
            </span>
          )}
          {/* 2. Separator */}
          {analysis && (
            <span class="text-slate-300 dark:text-slate-600 hidden sm:inline">│</span>
          )}
          {/* 3. Performance: atollee time */}
          <span class="text-slate-500 dark:text-slate-400" title="fhirpath-atollee execution time">
            ⏱️ {(executionTime * 1000).toFixed(0)}µs <span class="text-slate-400 dark:text-slate-500">atollee</span>
          </span>
          {/* 4. Execution Mode - JIT/Interpreter (after time, explains WHY it's fast) */}
          {analysis && (
            usedJit ? (
              <span class="px-2 py-0.5 rounded text-xs font-medium badge-jit cursor-help" title={t.playground.jitTooltip}>
                ⚡ {t.playground.jit}
              </span>
            ) : (
              <span class="px-2 py-0.5 rounded text-xs font-medium badge-interpreter cursor-help" title={t.playground.interpreterTooltip}>
                🔧 {t.playground.interpreter}
              </span>
            )
          )}
          {/* 5. Performance: fhirpath.js comparison */}
          {fhirpathJsTime !== null ? (
            <span class="text-slate-400 dark:text-slate-500" title="fhirpath.js (npm)">
              vs <span class="font-mono">{(fhirpathJsTime * 1000).toFixed(0)}µs</span>
              <span class="text-slate-300 dark:text-slate-600 ml-1">fhirpath.js</span>
            </span>
          ) : fhirpathJsError ? (
            <span class="text-slate-400 dark:text-slate-500" title={`fhirpath.js: ${fhirpathJsError}`}>
              <span class="text-amber-500 dark:text-amber-400">⚠</span>
              <span class="text-slate-300 dark:text-slate-600 ml-1">fhirpath.js {lang === "de" ? "nicht unterstützt" : "unsupported"}</span>
            </span>
          ) : null}
          {/* 6. Performance: Speedup badge */}
          {speedup !== null && speedup > 1 && (
            <span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-green-600 dark:bg-green-700 text-white" title="Speedup vs fhirpath.js">
              {speedup.toFixed(1)}x {lang === "de" ? "schneller" : "faster"}
            </span>
          )}
        </div>
        {loading && (
          <span class="text-atollee-ocean animate-pulse">{t.playground.evaluating}</span>
        )}
      </div>
    </div>
  );
}
