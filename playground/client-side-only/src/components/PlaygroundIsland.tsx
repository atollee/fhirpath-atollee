import { useState, useEffect, useCallback } from 'preact/hooks';
import { MonacoEditor } from './MonacoEditor';
import { evaluateFhirpath, type EvaluationResult } from '../utils/fhirpath';
import { type Language, type Translations, getTranslations } from '../utils/i18n';

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
  isDark: boolean;
  lang: Language;
}

const STORAGE_KEYS = {
  HISTORY: 'fhirpath-playground-history',
  FAVORITES: 'fhirpath-playground-favorites',
};

const MAX_HISTORY = 50;

const DEFAULT_PATIENT = {
  resourceType: 'Patient',
  id: 'example',
  meta: { versionId: '1', lastUpdated: '2024-01-15T10:30:00Z' },
  identifier: [{ system: 'http://example.org/mrn', value: '12345' }],
  active: true,
  name: [
    { use: 'official', family: 'Doe', given: ['John', 'James'] },
    { use: 'nickname', given: ['Johnny'] },
  ],
  gender: 'male',
  birthDate: '1990-05-15',
  address: [{ city: 'Boston', state: 'MA', country: 'USA' }],
  telecom: [
    { system: 'phone', value: '555-1234' },
    { system: 'email', value: 'john@example.com' },
  ],
};

const getSampleExpressions = (t: Translations) => [
  { label: t.samples.givenNames, expression: 'name.given' },
  { label: t.samples.officialName, expression: "name.where(use = 'official').given.first()" },
  { label: t.samples.isActive, expression: 'active' },
  { label: t.samples.countNames, expression: 'name.count()' },
  { label: t.samples.hasPhone, expression: "telecom.where(system = 'phone').exists()" },
  { label: t.samples.identifiers, expression: 'identifier.value' },
  { label: t.samples.typeCheck, expression: '$this is Patient' },
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
    { label: 'Path navigation', expr: 'name.given' },
    { label: 'Property access', expr: 'birthDate' },
    { label: 'Array index', expr: 'name[0].family' },
    { label: 'Chained paths', expr: 'name.given.first()' },
  ],
  [t.sampleCategories.existence]: [
    { label: 'empty()', expr: 'name.empty()' },
    { label: 'exists()', expr: 'name.exists()' },
    { label: 'exists(criteria)', expr: "name.exists(use = 'official')" },
    { label: 'all(criteria)', expr: 'name.all(family.exists())' },
    { label: 'allTrue()', expr: '(true | true | true).allTrue()' },
    { label: 'anyTrue()', expr: '(false | true | false).anyTrue()' },
    { label: 'allFalse()', expr: '(false | false).allFalse()' },
    { label: 'anyFalse()', expr: '(true | false).anyFalse()' },
    { label: 'hasValue()', expr: 'name.first().hasValue()' },
    { label: 'subsetOf()', expr: "('a' | 'b').subsetOf('a' | 'b' | 'c')" },
    { label: 'supersetOf()', expr: "('a' | 'b' | 'c').supersetOf('a' | 'b')" },
  ],
  [t.sampleCategories.filtering]: [
    { label: 'where()', expr: "name.where(use = 'official')" },
    { label: 'select()', expr: 'name.select(given.first())' },
    { label: 'repeat()', expr: 'name.repeat(given)' },
    { label: 'ofType()', expr: 'children().ofType(HumanName)' },
    { label: 'is', expr: '$this is Patient' },
    { label: 'as', expr: '($this as Patient).name' },
  ],
  [t.sampleCategories.subsetting]: [
    { label: 'single()', expr: "name.where(use = 'official').single()" },
    { label: 'first()', expr: 'name.first()' },
    { label: 'last()', expr: 'name.last()' },
    { label: 'tail()', expr: 'name.given.tail()' },
    { label: 'skip(n)', expr: 'name.given.skip(1)' },
    { label: 'take(n)', expr: 'name.given.take(2)' },
    { label: 'intersect()', expr: "name.given.intersect('John' | 'Jane')" },
    { label: 'exclude()', expr: "name.given.exclude('James')" },
  ],
  [t.sampleCategories.combining]: [
    { label: 'union (|)', expr: 'name.given | name.family' },
    { label: 'combine()', expr: 'name.given.combine(name.family)' },
    { label: 'distinct()', expr: "('a' | 'b' | 'a').distinct()" },
    { label: 'isDistinct()', expr: 'name.given.isDistinct()' },
  ],
  [t.sampleCategories.strings]: [
    { label: 'length()', expr: 'name.family.length()' },
    { label: 'upper()', expr: 'name.family.upper()' },
    { label: 'lower()', expr: 'name.family.lower()' },
    { label: 'startsWith()', expr: "name.family.startsWith('D')" },
    { label: 'endsWith()', expr: "name.family.endsWith('oe')" },
    { label: 'contains()', expr: "name.family.contains('o')" },
    { label: 'substring()', expr: 'name.family.substring(0, 2)' },
    { label: 'indexOf()', expr: "name.family.indexOf('o')" },
    { label: 'replace()', expr: "name.family.replace('Doe', 'Smith')" },
    { label: 'matches()', expr: "name.family.matches('[A-Z].*')" },
    { label: 'replaceMatches()', expr: "name.family.replaceMatches('[aeiou]', '*')" },
    { label: 'split()', expr: "'a,b,c'.split(',')", v3: true },
    { label: 'join()', expr: "name.given.join(', ')", v3: true },
    { label: 'trim()', expr: "'  hello  '.trim()", v3: true },
    { label: 'toChars()', expr: "'abc'.toChars()" },
    { label: 'encode()', expr: "'hello'.encode('base64')", v3: true },
    { label: 'decode()', expr: "'aGVsbG8='.decode('base64')", v3: true },
  ],
  [t.sampleCategories.math]: [
    { label: 'abs()', expr: '(-5).abs()' },
    { label: 'ceiling()', expr: '(3.2).ceiling()' },
    { label: 'floor()', expr: '(3.8).floor()' },
    { label: 'round()', expr: '(3.567).round(2)' },
    { label: 'sqrt()', expr: '(16).sqrt()' },
    { label: 'power()', expr: '(2).power(10)' },
    { label: 'ln()', expr: '(10).ln()' },
    { label: 'log()', expr: '(100).log(10)' },
    { label: 'exp()', expr: '(1).exp()' },
    { label: 'truncate()', expr: '(3.9).truncate()' },
  ],
  [t.sampleCategories.aggregate]: [
    { label: 'count()', expr: 'name.count()' },
    { label: 'sum()', expr: '(1 | 2 | 3 | 4 | 5).sum()', v3: true },
    { label: 'min()', expr: '(5 | 2 | 8 | 1).min()', v3: true },
    { label: 'max()', expr: '(5 | 2 | 8 | 1).max()', v3: true },
    { label: 'avg()', expr: '(10 | 20 | 30).avg()', v3: true },
    { label: 'aggregate() sum', expr: '(1 | 2 | 3).aggregate($total + $this, 0)' },
    { label: 'aggregate() product', expr: '(1 | 2 | 3 | 4).aggregate($total * $this, 1)' },
    { label: 'aggregate() concat', expr: "('a' | 'b' | 'c').aggregate($total & $this, '')" },
  ],
  [t.sampleCategories.conversion]: [
    { label: 'toString()', expr: '(123).toString()' },
    { label: 'toInteger()', expr: "'42'.toInteger()" },
    { label: 'toDecimal()', expr: "'3.14'.toDecimal()" },
    { label: 'toBoolean()', expr: "'true'.toBoolean()" },
    { label: 'toDate()', expr: 'birthDate.toDate()' },
    { label: 'toDateTime()', expr: "'2024-01-15T10:30:00Z'.toDateTime()" },
    { label: 'toTime()', expr: "'14:30:00'.toTime()" },
    { label: 'toQuantity()', expr: "5.5.toQuantity('kg')" },
    { label: 'convertsToString()', expr: '(123).convertsToString()' },
    { label: 'convertsToInteger()', expr: "'abc'.convertsToInteger()" },
    { label: 'convertsToDecimal()', expr: "'3.14'.convertsToDecimal()" },
    { label: 'convertsToBoolean()', expr: "'yes'.convertsToBoolean()" },
    { label: 'convertsToDate()', expr: 'birthDate.convertsToDate()' },
    { label: 'convertsToDateTime()', expr: "'2024-01-15'.convertsToDateTime()" },
    { label: 'convertsToTime()', expr: "'14:30:00'.convertsToTime()" },
    { label: 'convertsToQuantity()', expr: "'10 kg'.convertsToQuantity()" },
    { label: 'iif()', expr: "iif(active, 'Yes', 'No')" },
  ],
  [t.sampleCategories.navigation]: [
    { label: 'children()', expr: 'children()' },
    { label: 'descendants()', expr: 'descendants().take(5)' },
  ],
  [t.sampleCategories.fhirSpecific]: [
    { label: 'extension(url)', expr: "extension('http://example.org/ext')" },
    { label: 'hasExtension()', expr: "hasExtension('http://example.org/ext')" },
    { label: 'getValue()', expr: 'identifier.first().getValue()' },
    { label: 'resolve()', expr: 'generalPractitioner.resolve()' },
    { label: 'memberOf()', expr: "gender.memberOf('http://hl7.org/fhir/ValueSet/administrative-gender')" },
    { label: 'htmlChecks()', expr: 'text.div.htmlChecks()' },
    { label: 'resourceType', expr: 'resourceType' },
    { label: 'id', expr: 'id' },
    { label: 'meta.versionId', expr: 'meta.versionId' },
    { label: 'meta.lastUpdated', expr: 'meta.lastUpdated' },
    { label: 'meta.profile', expr: 'meta.profile' },
    { label: 'meta.tag', expr: 'meta.tag' },
  ],
  [t.sampleCategories.boolean]: [
    { label: 'not()', expr: 'active.not()' },
    { label: 'and', expr: 'active and name.exists()' },
    { label: 'or', expr: 'active or deceased' },
    { label: 'xor', expr: 'true xor false' },
    { label: 'implies', expr: 'active implies name.exists()' },
    { label: '= (equals)', expr: "gender = 'male'" },
    { label: '!= (not equals)', expr: "gender != 'female'" },
    { label: '~ (equivalent)', expr: "name.family ~ 'DOE'" },
    { label: '< > <= >=', expr: 'name.count() > 0' },
  ],
  [t.sampleCategories.utility]: [
    { label: 'today()', expr: 'today()' },
    { label: 'now()', expr: 'now()' },
    { label: 'timeOfDay()', expr: 'timeOfDay()' },
    { label: 'trace()', expr: "name.trace('debug')" },
    { label: 'defineVariable()', expr: "defineVariable('x', name.first()).select(%x.given)", v3: true },
    { label: 'type()', expr: 'name.type()', v3: true },
    { label: '$this', expr: "name.where($this.use = 'official')" },
    { label: '$index', expr: 'name.select($index)' },
    { label: '$total', expr: '(1|2|3).aggregate($total + $this, 0)' },
    { label: '%resource', expr: '%resource.resourceType' },
  ],
});

export function PlaygroundIsland({ isDark, lang }: PlaygroundIslandProps) {
  const t = getTranslations(lang);
  const sampleExpressions = getSampleExpressions(t);
  const categorizedExpressions = getCategorizedExpressions(t);
  
  const [expression, setExpression] = useState("name.given");
  const [resourceJson, setResourceJson] = useState(JSON.stringify(DEFAULT_PATIENT, null, 2));
  const [result, setResult] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EvaluationResult['analysis']>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'result' | 'ast' | 'hints'>('result');
  const [executionTime, setExecutionTime] = useState(0);
  const [usedJit, setUsedJit] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showExpressionBrowser, setShowExpressionBrowser] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    try { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(entries)); } catch { /* ignore */ }
  }, []);

  const saveFavorites = useCallback((entries: FavoriteEntry[]) => {
    try { localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(entries)); } catch { /* ignore */ }
  }, []);

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

  // Client-side evaluation
  const evaluate = useCallback(async () => {
    if (!expression.trim()) {
      setResult(null);
      setError(null);
      setAnalysis(null);
      return;
    }

    setLoading(true);

    try {
      let resource;
      try {
        resource = JSON.parse(resourceJson);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const evalResult = await evaluateFhirpath(expression, resource);

      if (evalResult.error) {
        setError(evalResult.error);
        setResult(null);
      } else {
        setResult(evalResult.result);
        setError(null);
        addToHistory(expression);
      }

      setAnalysis(evalResult.analysis);
      setExecutionTime(evalResult.meta.evaluationMs);
      setUsedJit(evalResult.meta.usedJit);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [expression, resourceJson, addToHistory]);

  // Auto-evaluate on expression/resource change
  useEffect(() => {
    const timer = setTimeout(() => { evaluate(); }, 300);
    return () => clearTimeout(timer);
  }, [expression, resourceJson]);

  const toggleFavorite = useCallback(() => {
    const isFav = favorites.some(f => f.expression === expression);
    
    if (isFav) {
      setFavorites(prev => {
        const newFavs = prev.filter(f => f.expression !== expression);
        saveFavorites(newFavs);
        return newFavs;
      });
    } else {
      setFavorites(prev => {
        const newFav: FavoriteEntry = {
          id: crypto.randomUUID(),
          expression,
          label: expression.length > 30 ? expression.slice(0, 30) + '...' : expression,
          createdAt: Date.now(),
        };
        const newFavs = [newFav, ...prev];
        saveFavorites(newFavs);
        return newFavs;
      });
    }
  }, [expression, favorites, saveFavorites]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [expression]);

  const isFavorite = favorites.some(f => f.expression === expression);

  return (
    <div class="space-y-3">
      {/* Two-column layout */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        {/* Resource Panel */}
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t.headings.resource}
          </label>
          <textarea
            value={resourceJson}
            onInput={(e) => setResourceJson((e.target as HTMLTextAreaElement).value)}
            class="w-full h-48 font-mono text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-y"
            spellcheck={false}
          />
        </div>

        {/* Results Panel */}
        <div class="space-y-2">
          <div class="flex gap-2">
            {(['result', 'ast', 'hints'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                class={`px-3 py-1 text-sm rounded-t transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium border-t border-x border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab === 'result' ? t.playground.result : tab === 'ast' ? t.playground.ast : t.playground.hints}
                {tab === 'hints' && analysis?.hints?.length ? ` (${analysis.hints.length})` : ''}
              </button>
            ))}
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-44 overflow-auto">
            {activeTab === 'result' && (
              <pre class="p-3 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {error ? (
                  <span class="text-red-600 dark:text-red-400">{error}</span>
                ) : result !== null ? (
                  JSON.stringify(result, null, 2)
                ) : (
                  <span class="text-slate-400">{t.playground.empty}</span>
                )}
              </pre>
            )}
            {activeTab === 'ast' && (
              <pre class="p-3 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {analysis?.ast ? JSON.stringify(analysis.ast, null, 2) : t.playground.empty}
              </pre>
            )}
            {activeTab === 'hints' && (
              <div class="p-3 space-y-2">
                {analysis?.hints?.length ? analysis.hints.map((hint, i) => (
                  <div key={i} class="text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <span class="font-medium text-amber-700 dark:text-amber-300">{hint.type}:</span>
                    <span class="ml-1 text-slate-700 dark:text-slate-300">{hint.message}</span>
                    {hint.suggestion && (
                      <div class="mt-1 font-mono text-amber-600 dark:text-amber-400">{hint.suggestion}</div>
                    )}
                  </div>
                )) : (
                  <span class="text-slate-400 text-sm">{t.playground.noHints}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expression Panel */}
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3">
        <div class="flex items-center gap-2 mb-2 text-xs">
          <span class="font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            {t.headings.expression}
          </span>
          <button
            onClick={toggleFavorite}
            class={`p-1 rounded transition-colors ${isFavorite ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`}
            title={isFavorite ? t.playground.removeFavorite : t.playground.favorite}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <button
            onClick={copyToClipboard}
            class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={t.playground.copy}
          >
            {copied ? '✓' : '📋'}
          </button>
          <div class="relative ml-auto">
            <button
              onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }}
              class="text-xs text-slate-500 dark:text-slate-400 link-atollee transition-colors"
            >
              📜 {t.playground.history} {showHistory ? '▲' : '▼'}
            </button>
            {showHistory && history.length > 0 && (
              <div class="absolute right-0 top-6 z-40 w-64 max-h-48 overflow-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setExpression(h.expression); setShowHistory(false); }}
                    class="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <code class="font-mono text-slate-700 dark:text-slate-300 truncate block">{h.expression}</code>
                  </button>
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
        />
        
        {/* Sample expressions */}
        <div class="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto">
          {sampleExpressions.map((s) => (
            <button
              key={s.expression}
              onClick={() => setExpression(s.expression)}
              class="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap"
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => { setShowExpressionBrowser(!showExpressionBrowser); setShowHistory(false); setShowFavorites(false); }}
            class="px-2 py-0.5 text-xs bg-atollee-ocean/10 dark:bg-atollee-sea/20 text-atollee-ocean dark:text-atollee-sea rounded hover:bg-atollee-ocean/20 dark:hover:bg-atollee-sea/30 transition-colors whitespace-nowrap font-medium"
          >
            📚 {lang === 'de' ? 'Alle Funktionen' : 'All Functions'} {showExpressionBrowser ? '▲' : '▼'}
          </button>
        </div>

        {/* Expression Browser Panel */}
        {showExpressionBrowser && (
          <div class="mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div class="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {Object.keys(categorizedExpressions).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  class={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            {/* Legend for v3 STU */}
            <div class="px-2 py-1 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 text-[10px]">
              <span class="text-slate-400 dark:text-slate-500">
                {lang === 'de' ? 'v2.0.0 = Normativ' : 'v2.0.0 = Normative'}
              </span>
              <span class="text-slate-300 dark:text-slate-600">│</span>
              <span class="v3-stu font-medium">
                {lang === 'de' ? 'v3.0.0 = STU (Entwurf)' : 'v3.0.0 = STU (Draft)'}
              </span>
            </div>
            <div class="max-h-40 overflow-y-auto p-2">
              {selectedCategory && (
                <div class="grid grid-cols-2 gap-1">
                  {categorizedExpressions[selectedCategory]?.map((item) => {
                    const isActive = expression === item.expr;
                    const isV3 = item.v3 === true;
                    return (
                      <button
                        key={item.expr}
                        onClick={() => setExpression(item.expr)}
                        class={`text-left px-2 py-1.5 text-xs rounded transition-colors group ${
                          isActive
                            ? 'bg-blue-600 shadow-sm'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                        title={isV3 ? (lang === 'de' ? 'FHIRPath v3.0.0 STU (noch nicht normativ)' : 'FHIRPath v3.0.0 STU (not normative yet)') : undefined}
                      >
                        <span class={`font-semibold ${isActive ? 'text-white' : isV3 ? 'v3-stu' : 'text-slate-800 dark:text-slate-100'}`}>
                          {item.label}
                          {isV3 && !isActive && <span class="v3-stu-badge">v3</span>}
                        </span>
                        <code class={`block text-[10px] font-mono truncate ${isActive ? 'text-blue-100' : isV3 ? 'v3-stu opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.expr}
                        </code>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Bar */}
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          {analysis && (
            <span class="text-slate-500 dark:text-slate-400 hidden sm:inline">
              📊 {t.playground.complexity}: {analysis.complexity}/100
            </span>
          )}
          {analysis && (
            <span class="text-slate-300 dark:text-slate-600 hidden sm:inline">│</span>
          )}
          <span class="text-slate-500 dark:text-slate-400" title="fhirpath-atollee execution time">
            ⏱️ {(executionTime * 1000).toFixed(0)}µs <span class="text-slate-400 dark:text-slate-500">atollee</span>
          </span>
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
        </div>
        {loading && (
          <span class="text-atollee-ocean animate-pulse">{t.playground.evaluating}</span>
        )}
      </div>
    </div>
  );
}
