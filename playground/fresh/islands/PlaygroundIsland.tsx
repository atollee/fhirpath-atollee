import { useState, useEffect, useCallback } from "preact/hooks";
import type { AnalysisResult } from "../../../src/optimizer/mod.ts";

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

const SAMPLE_EXPRESSIONS = [
  { label: "Get given names", expression: "name.given" },
  { label: "Official name", expression: "name.where(use = 'official').given.first()" },
  { label: "Is active", expression: "active" },
  { label: "Count names", expression: "name.count()" },
  { label: "Has phone", expression: "telecom.where(system = 'phone').exists()" },
  { label: "All identifiers", expression: "identifier.value" },
  { label: "Resource type check", expression: "$this is Patient" },
];

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
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"result" | "ast" | "hints">("result");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
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
        body: JSON.stringify({ expression, resource }),
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
      setExecutionTime(performance.now() - startTime);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [expression, resourceJson, addToHistory]);

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

  // Copy shareable URL
  const copyShareableURL = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("expr", expression);
    if (resourceJson !== JSON.stringify(DEFAULT_PATIENT, null, 2)) {
      params.set("resource", resourceJson);
    }
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [expression, resourceJson]);

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
    <div class="space-y-4">
      {/* Expression Input */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">
            Expression
          </h3>
          <div class="flex items-center space-x-2">
            <button
              onClick={toggleFavorite}
              class={`px-2 py-1 text-lg ${isFavorited ? "text-yellow-500" : "text-gray-400"} hover:text-yellow-500`}
              title={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              {isFavorited ? "★" : "☆"}
            </button>
            <button
              onClick={copyShareableURL}
              class={`px-3 py-1.5 text-sm rounded ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {copied ? "✓ Copied!" : "🔗 Share"}
            </button>
          </div>
        </div>
        
        <textarea
          value={expression}
          onInput={(e) => setExpression((e.target as HTMLTextAreaElement).value)}
          class="w-full h-20 p-3 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          placeholder="Enter FHIRPath expression..."
        />

        {/* Sample Expressions */}
        <div class="flex flex-wrap gap-2 mt-2">
          {SAMPLE_EXPRESSIONS.map((s) => (
            <button
              key={s.expression}
              onClick={() => setExpression(s.expression)}
              class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              title={s.expression}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* History & Favorites */}
        <div class="mt-4 space-y-2">
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              📜 Recent Expressions {showHistory ? "▼" : "▶"}
            </button>
            {showHistory && history.length > 0 && (
              <div class="mt-2 max-h-32 overflow-y-auto space-y-1">
                {history.slice(0, 10).map((h) => (
                  <div
                    key={h.timestamp}
                    onClick={() => setExpression(h.expression)}
                    class="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <span class="text-xs font-mono text-blue-600 dark:text-blue-400 truncate max-w-[70%]">
                      {h.expression}
                    </span>
                    <span class="text-xs text-gray-400">{formatTimeAgo(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ⭐ Favorites {showFavorites ? "▼" : "▶"}
            </button>
            {showFavorites && favorites.length > 0 && (
              <div class="mt-2 max-h-32 overflow-y-auto space-y-1">
                {favorites.map((f) => (
                  <div
                    key={f.id}
                    class="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded"
                  >
                    <span
                      onClick={() => setExpression(f.expression)}
                      class="text-xs font-mono text-blue-600 dark:text-blue-400 truncate max-w-[70%] cursor-pointer hover:underline"
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
                      class="text-xs text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resource Input */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
            Resource (JSON)
          </h3>
          <textarea
            value={resourceJson}
            onInput={(e) => setResourceJson((e.target as HTMLTextAreaElement).value)}
            class="w-full h-64 p-3 font-mono text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Result Panel */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          {/* Tabs */}
          <div class="flex border-b border-gray-200 dark:border-gray-700 mb-3">
            {(["result", "ast", "hints"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                class={`px-4 py-2 text-sm font-medium ${
                  activeTab === tab
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div class="h-56 overflow-auto">
            {activeTab === "result" && (
              <div>
                {error ? (
                  <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                ) : result ? (
                  <pre class="text-xs font-mono text-blue-600 dark:text-blue-400 whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                ) : (
                  <div class="text-gray-400 text-sm">(empty)</div>
                )}
              </div>
            )}

            {activeTab === "ast" && analysis?.ast && (
              <pre class="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {JSON.stringify(analysis.ast, null, 2)}
              </pre>
            )}

            {activeTab === "hints" && (
              <div class="space-y-2">
                {analysis?.hints && analysis.hints.length > 0 ? (
                  analysis.hints.map((hint, i) => (
                    <div
                      key={i}
                      class={`p-3 rounded border-l-4 ${
                        hint.severity === "critical" ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                        hint.severity === "warning" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" :
                        hint.severity === "suggestion" ? "border-green-500 bg-green-50 dark:bg-green-900/20" :
                        "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      }`}
                    >
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        {hint.severity === "critical" ? "🚨" : hint.severity === "warning" ? "⚠️" : hint.severity === "suggestion" ? "💡" : "ℹ️"}{" "}
                        {hint.message}
                      </div>
                      <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {hint.explanation}
                      </div>
                      {hint.suggestion && (
                        <div class="text-xs text-green-600 dark:text-green-400 mt-1 font-mono">
                          💡 {hint.suggestion}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div class="p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded text-sm text-green-700 dark:text-green-300">
                    ✓ No optimization suggestions
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-3 flex items-center justify-between text-sm">
        <div class="flex items-center space-x-4">
          <span class="text-gray-500 dark:text-gray-400">
            ⏱️ {executionTime.toFixed(2)}ms
          </span>
          {analysis && (
            <>
              <span class="text-gray-500 dark:text-gray-400">
                📊 Complexity: {analysis.complexity}/100
              </span>
              <span class={`px-2 py-0.5 rounded text-xs font-medium ${
                analysis.jitCompatible
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
              }`}>
                {analysis.jitCompatible ? "JIT Compatible" : "JIT Incompatible"}
              </span>
            </>
          )}
        </div>
        {loading && (
          <span class="text-blue-500">Evaluating...</span>
        )}
      </div>
    </div>
  );
}
