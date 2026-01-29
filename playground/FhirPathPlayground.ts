/**
 * FHIRPath Playground Web Component
 * 
 * An interactive playground for testing and debugging FHIRPath expressions.
 * 
 * Features:
 * - Live expression evaluation
 * - Syntax highlighting and autocomplete (Monaco-ready)
 * - AST visualization
 * - Optimization hints
 * - Step-by-step debugging
 * - Performance metrics
 * 
 * @example
 * ```html
 * <fhirpath-playground></fhirpath-playground>
 * 
 * <script type="module">
 *   import { FhirPathPlayground } from '@atollee/fhirpath/playground';
 *   customElements.define('fhirpath-playground', FhirPathPlayground);
 *   
 *   const playground = document.querySelector('fhirpath-playground');
 *   playground.setResource({ resourceType: 'Patient', name: [{ given: ['John'] }] });
 * </script>
 * ```
 */

import { createDefaultAPI } from "../src/api.ts";
import { parseFhirPath } from "../src/parser/mod.ts";
import { analyzeExpression, formatHints, type AnalysisResult } from "../src/optimizer/mod.ts";
import type { ASTNode } from "../src/parser/ast.ts";

const fhirpath = createDefaultAPI();

/**
 * Evaluation step for debugging
 */
interface EvaluationStep {
  expression: string;
  input: unknown;
  output: unknown;
  duration: number;
}

/**
 * Playground state
 */
interface PlaygroundState {
  expression: string;
  resource: unknown;
  context: Record<string, unknown>;
  result: unknown[] | null;
  error: string | null;
  ast: ASTNode | null;
  analysis: AnalysisResult | null;
  steps: EvaluationStep[];
  executionTime: number;
}

/**
 * History entry for expression tracking
 */
interface HistoryEntry {
  expression: string;
  timestamp: number;
  resourceType?: string;
}

/**
 * Favorite expression entry
 */
interface FavoriteEntry {
  id: string;
  expression: string;
  label: string;
  resourceType?: string;
  createdAt: number;
}

/**
 * Storage keys for persistence
 */
const STORAGE_KEYS = {
  HISTORY: "fhirpath-playground-history",
  FAVORITES: "fhirpath-playground-favorites",
} as const;

/**
 * Maximum history entries to keep
 */
const MAX_HISTORY_ENTRIES = 50;

/**
 * Default sample patient resource
 */
const DEFAULT_PATIENT = {
  resourceType: "Patient",
  id: "example",
  meta: {
    versionId: "1",
    lastUpdated: "2024-01-15T10:30:00Z",
  },
  identifier: [
    { system: "http://example.org/mrn", value: "12345" },
  ],
  active: true,
  name: [
    { use: "official", family: "Doe", given: ["John", "James"] },
    { use: "nickname", given: ["Johnny"] },
  ],
  gender: "male",
  birthDate: "1990-05-15",
  address: [
    { city: "Boston", state: "MA", country: "USA" },
  ],
  telecom: [
    { system: "phone", value: "555-1234" },
    { system: "email", value: "john@example.com" },
  ],
};

/**
 * Sample expressions for quick testing
 */
const SAMPLE_EXPRESSIONS = [
  { label: "Get given names", expression: "name.given" },
  { label: "Official name", expression: "name.where(use = 'official').given.first()" },
  { label: "Is active", expression: "active" },
  { label: "Count names", expression: "name.count()" },
  { label: "Has phone", expression: "telecom.where(system = 'phone').exists()" },
  { label: "Age calculation", expression: "birthDate" },
  { label: "All identifiers", expression: "identifier.value" },
  { label: "Resource type check", expression: "$this is Patient" },
];

/**
 * FHIRPath Playground Web Component
 */
export class FhirPathPlayground extends HTMLElement {
  private state: PlaygroundState;
  private shadow: ShadowRoot;
  private autoEvaluate: boolean = true;
  private evaluateTimeout: ReturnType<typeof setTimeout> | null = null;
  private history: HistoryEntry[] = [];
  private favorites: FavoriteEntry[] = [];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.state = {
      expression: "name.given",
      resource: DEFAULT_PATIENT,
      context: {},
      result: null,
      error: null,
      ast: null,
      analysis: null,
      steps: [],
      executionTime: 0,
    };
  }

  connectedCallback() {
    this.loadFromStorage();
    this.loadFromURL();
    this.render();
    this.evaluate();
  }

  // ==================== URL Sharing ====================

  /**
   * Load state from URL parameters
   */
  private loadFromURL(): void {
    const params = new URLSearchParams(globalThis.location?.search || "");
    
    const expr = params.get("expr");
    if (expr) {
      try {
        this.state.expression = decodeURIComponent(expr);
      } catch {
        // Invalid encoding, ignore
      }
    }

    const resource = params.get("resource");
    if (resource) {
      try {
        this.state.resource = JSON.parse(decodeURIComponent(resource));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }

  /**
   * Generate a shareable URL for the current state
   */
  getShareableURL(): string {
    const baseURL = globalThis.location?.href.split("?")[0] || "";
    const params = new URLSearchParams();
    
    params.set("expr", encodeURIComponent(this.state.expression));
    
    // Only include resource if it's not the default
    const resourceStr = JSON.stringify(this.state.resource);
    if (resourceStr !== JSON.stringify(DEFAULT_PATIENT)) {
      params.set("resource", encodeURIComponent(resourceStr));
    }

    return `${baseURL}?${params.toString()}`;
  }

  /**
   * Copy shareable URL to clipboard
   */
  async copyShareableURL(): Promise<boolean> {
    const url = this.getShareableURL();
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== History Management ====================

  /**
   * Load history and favorites from localStorage
   */
  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const historyData = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (historyData) {
        this.history = JSON.parse(historyData);
      }

      const favoritesData = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favoritesData) {
        this.favorites = JSON.parse(favoritesData);
      }
    } catch {
      // Storage error, ignore
    }
  }

  /**
   * Save history to localStorage
   */
  private saveHistory(): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Save favorites to localStorage
   */
  private saveFavorites(): void {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(this.favorites));
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Add expression to history
   */
  private addToHistory(expression: string): void {
    if (!expression.trim()) return;

    // Get resource type if available
    const resourceType = (this.state.resource as { resourceType?: string })?.resourceType;

    // Remove duplicate if exists
    this.history = this.history.filter(h => h.expression !== expression);

    // Add new entry at the beginning
    this.history.unshift({
      expression,
      timestamp: Date.now(),
      resourceType,
    });

    // Trim to max entries
    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(0, MAX_HISTORY_ENTRIES);
    }

    this.saveHistory();
    this.updateHistoryDisplay();
  }

  /**
   * Get expression history
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.updateHistoryDisplay();
  }

  // ==================== Favorites Management ====================

  /**
   * Add current expression to favorites
   */
  addToFavorites(label?: string): FavoriteEntry {
    const resourceType = (this.state.resource as { resourceType?: string })?.resourceType;
    
    const entry: FavoriteEntry = {
      id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      expression: this.state.expression,
      label: label || this.state.expression.substring(0, 30) + (this.state.expression.length > 30 ? "..." : ""),
      resourceType,
      createdAt: Date.now(),
    };

    // Check for duplicate
    const existing = this.favorites.find(f => f.expression === entry.expression);
    if (existing) {
      return existing;
    }

    this.favorites.push(entry);
    this.saveFavorites();
    this.updateFavoritesDisplay();

    return entry;
  }

  /**
   * Remove from favorites
   */
  removeFromFavorites(id: string): void {
    this.favorites = this.favorites.filter(f => f.id !== id);
    this.saveFavorites();
    this.updateFavoritesDisplay();
  }

  /**
   * Check if current expression is favorited
   */
  isFavorited(): boolean {
    return this.favorites.some(f => f.expression === this.state.expression);
  }

  /**
   * Get all favorites
   */
  getFavorites(): FavoriteEntry[] {
    return [...this.favorites];
  }

  /**
   * Update history display in UI
   */
  private updateHistoryDisplay(): void {
    const historyEl = this.shadow.querySelector("#history-list");
    if (!historyEl) return;

    if (this.history.length === 0) {
      historyEl.innerHTML = '<div class="empty-state">No recent expressions</div>';
      return;
    }

    historyEl.innerHTML = this.history.slice(0, 10).map(h => `
      <div class="history-item" data-expr="${this.escapeAttr(h.expression)}">
        <span class="history-expr">${this.escapeHTML(h.expression)}</span>
        <span class="history-meta">${this.formatTimeAgo(h.timestamp)}</span>
      </div>
    `).join("");

    // Add click handlers
    historyEl.querySelectorAll(".history-item").forEach(item => {
      item.addEventListener("click", () => {
        const expr = item.getAttribute("data-expr");
        if (expr) this.setExpression(expr);
      });
    });
  }

  /**
   * Update favorites display in UI
   */
  private updateFavoritesDisplay(): void {
    const favoritesEl = this.shadow.querySelector("#favorites-list");
    const favBtn = this.shadow.querySelector("#fav-btn");
    
    if (favBtn) {
      favBtn.textContent = this.isFavorited() ? "★" : "☆";
      favBtn.setAttribute("title", this.isFavorited() ? "Remove from favorites" : "Add to favorites");
    }

    if (!favoritesEl) return;

    if (this.favorites.length === 0) {
      favoritesEl.innerHTML = '<div class="empty-state">No favorites yet</div>';
      return;
    }

    favoritesEl.innerHTML = this.favorites.map(f => `
      <div class="favorite-item">
        <span class="favorite-expr" data-expr="${this.escapeAttr(f.expression)}">${this.escapeHTML(f.label)}</span>
        <button class="remove-fav-btn" data-id="${f.id}" title="Remove">×</button>
      </div>
    `).join("");

    // Add click handlers
    favoritesEl.querySelectorAll(".favorite-expr").forEach(item => {
      item.addEventListener("click", () => {
        const expr = item.getAttribute("data-expr");
        if (expr) this.setExpression(expr);
      });
    });

    favoritesEl.querySelectorAll(".remove-fav-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (id) this.removeFromFavorites(id);
      });
    });
  }

  /**
   * Helper to escape HTML
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Helper to escape attribute value
   */
  private escapeAttr(str: string): string {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /**
   * Format timestamp as relative time
   */
  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Set the FHIR resource to evaluate against
   */
  setResource(resource: unknown): void {
    this.state.resource = resource;
    this.evaluate();
  }

  /**
   * Set the FHIRPath expression
   */
  setExpression(expression: string): void {
    this.state.expression = expression;
    const input = this.shadow.querySelector<HTMLTextAreaElement>("#expression-input");
    if (input) input.value = expression;
    this.evaluate();
  }

  /**
   * Set context variables
   */
  setContext(context: Record<string, unknown>): void {
    this.state.context = context;
    this.evaluate();
  }

  /**
   * Get current result
   */
  getResult(): unknown[] | null {
    return this.state.result;
  }

  /**
   * Evaluate the current expression
   */
  private evaluate(): void {
    const { expression, resource, context } = this.state;

    if (!expression.trim()) {
      this.state.result = null;
      this.state.error = null;
      this.state.ast = null;
      this.state.analysis = null;
      this.updateResultDisplay();
      return;
    }

    // Parse AST
    try {
      this.state.ast = parseFhirPath(expression);
    } catch (e) {
      this.state.ast = null;
    }

    // Analyze for optimization hints
    this.state.analysis = analyzeExpression(expression);

    // Evaluate
    const startTime = performance.now();
    try {
      this.state.result = fhirpath.evaluate(resource, expression, context) as unknown[];
      this.state.error = null;
    } catch (e) {
      this.state.result = null;
      this.state.error = e instanceof Error ? e.message : String(e);
    }
    this.state.executionTime = performance.now() - startTime;

    this.updateResultDisplay();
    this.updateFavoritesDisplay();
    
    // Add to history if successful
    if (!this.state.error && this.state.expression.trim()) {
      this.addToHistory(this.state.expression);
    }
    
    this.dispatchEvent(new CustomEvent("evaluate", { detail: this.state }));
  }

  /**
   * Debounced evaluation for typing
   */
  private debouncedEvaluate(): void {
    if (this.evaluateTimeout) {
      clearTimeout(this.evaluateTimeout);
    }
    this.evaluateTimeout = setTimeout(() => this.evaluate(), 300);
  }

  /**
   * Update the result display
   */
  private updateResultDisplay(): void {
    const resultEl = this.shadow.querySelector("#result");
    const errorEl = this.shadow.querySelector("#error");
    const astEl = this.shadow.querySelector("#ast");
    const hintsEl = this.shadow.querySelector("#hints");
    const metricsEl = this.shadow.querySelector("#metrics");

    if (resultEl) {
      if (this.state.result !== null) {
        resultEl.textContent = JSON.stringify(this.state.result, null, 2);
        resultEl.classList.remove("error");
      } else {
        resultEl.textContent = "(empty)";
      }
    }

    if (errorEl) {
      if (this.state.error) {
        errorEl.textContent = this.state.error;
        errorEl.classList.add("visible");
      } else {
        errorEl.textContent = "";
        errorEl.classList.remove("visible");
      }
    }

    if (astEl && this.state.ast) {
      astEl.textContent = this.formatAST(this.state.ast);
    }

    if (hintsEl && this.state.analysis) {
      if (this.state.analysis.hints.length > 0) {
        hintsEl.innerHTML = this.formatHintsHTML(this.state.analysis);
      } else {
        hintsEl.innerHTML = '<div class="hint hint-ok">✓ No optimization suggestions</div>';
      }
    }

    if (metricsEl) {
      const jitStatus = this.state.analysis?.jitCompatible 
        ? '<span class="badge badge-success">JIT Compatible</span>'
        : '<span class="badge badge-warning">JIT Incompatible</span>';
      
      metricsEl.innerHTML = `
        <span class="metric">⏱️ ${this.state.executionTime.toFixed(3)}ms</span>
        <span class="metric">📊 Complexity: ${this.state.analysis?.complexity || 0}/100</span>
        ${jitStatus}
      `;
    }
  }

  /**
   * Format AST for display
   */
  private formatAST(ast: ASTNode, indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    const lines: string[] = [];

    lines.push(`${prefix}${ast.type}`);

    for (const [key, value] of Object.entries(ast)) {
      if (key === "type" || key === "start" || key === "end") continue;

      if (value && typeof value === "object" && "type" in value) {
        lines.push(`${prefix}  ${key}:`);
        lines.push(this.formatAST(value as ASTNode, indent + 2));
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}  ${key}: [`);
        for (const item of value) {
          if (item && typeof item === "object" && "type" in item) {
            lines.push(this.formatAST(item as ASTNode, indent + 2));
          } else {
            lines.push(`${prefix}    ${JSON.stringify(item)}`);
          }
        }
        lines.push(`${prefix}  ]`);
      } else {
        lines.push(`${prefix}  ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Format hints as HTML
   */
  private formatHintsHTML(analysis: AnalysisResult): string {
    return analysis.hints.map(hint => {
      const icon = {
        info: "ℹ️",
        suggestion: "💡",
        warning: "⚠️",
        critical: "🚨",
      }[hint.severity];

      return `
        <div class="hint hint-${hint.severity}">
          <div class="hint-header">
            <span class="hint-icon">${icon}</span>
            <span class="hint-category">[${hint.category}]</span>
            <span class="hint-message">${hint.message}</span>
          </div>
          <div class="hint-body">${hint.explanation}</div>
          ${hint.suggestion ? `<div class="hint-suggestion">💡 ${hint.suggestion}</div>` : ""}
        </div>
      `;
    }).join("");
  }

  /**
   * Render the component
   */
  private render(): void {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e0e0e0;
          background: #1e1e1e;
          border-radius: 8px;
          overflow: hidden;
        }
        
        * {
          box-sizing: border-box;
        }
        
        .playground {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          gap: 1px;
          background: #333;
          min-height: 500px;
        }
        
        .panel {
          background: #252526;
          padding: 12px;
          overflow: auto;
        }
        
        .panel-header {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .expression-panel {
          grid-column: 1 / -1;
        }
        
        .expression-input {
          width: 100%;
          height: 80px;
          background: #1e1e1e;
          border: 1px solid #3c3c3c;
          border-radius: 4px;
          color: #d4d4d4;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 14px;
          padding: 8px;
          resize: vertical;
        }
        
        .expression-input:focus {
          outline: none;
          border-color: #007acc;
        }
        
        .samples {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }
        
        .sample-btn {
          background: #3c3c3c;
          border: none;
          border-radius: 4px;
          color: #d4d4d4;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .sample-btn:hover {
          background: #505050;
        }
        
        .resource-input {
          width: 100%;
          height: 100%;
          min-height: 200px;
          background: #1e1e1e;
          border: 1px solid #3c3c3c;
          border-radius: 4px;
          color: #d4d4d4;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          padding: 8px;
          resize: none;
        }
        
        .result {
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          white-space: pre-wrap;
          background: #1e1e1e;
          border-radius: 4px;
          padding: 8px;
          min-height: 100px;
          color: #9cdcfe;
        }
        
        .error {
          color: #f48771;
          background: #3a1d1d;
          padding: 8px;
          border-radius: 4px;
          margin-top: 8px;
          display: none;
        }
        
        .error.visible {
          display: block;
        }
        
        .ast {
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 11px;
          white-space: pre;
          color: #808080;
          background: #1e1e1e;
          border-radius: 4px;
          padding: 8px;
        }
        
        .metrics-panel {
          grid-column: 1 / -1;
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 8px 12px;
        }
        
        .metric {
          font-size: 12px;
          color: #888;
        }
        
        .badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
        
        .badge-success {
          background: #2d5a2d;
          color: #89d185;
        }
        
        .badge-warning {
          background: #5a4d2d;
          color: #d1a185;
        }
        
        .hint {
          background: #2d2d2d;
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 8px;
          border-left: 3px solid #888;
        }
        
        .hint-info { border-left-color: #3794ff; }
        .hint-suggestion { border-left-color: #89d185; }
        .hint-warning { border-left-color: #cca700; }
        .hint-critical { border-left-color: #f48771; }
        .hint-ok { border-left-color: #89d185; color: #89d185; }
        
        .hint-header {
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .hint-icon { margin-right: 4px; }
        .hint-category { color: #888; font-size: 11px; margin-right: 8px; }
        .hint-body { color: #aaa; font-size: 12px; }
        .hint-suggestion { 
          margin-top: 4px; 
          font-family: monospace; 
          font-size: 11px;
          color: #89d185;
        }
        
        .tabs {
          display: flex;
          gap: 1px;
          background: #333;
          margin-bottom: 8px;
        }
        
        .tab {
          background: #2d2d2d;
          border: none;
          color: #888;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tab:hover { color: #d4d4d4; }
        .tab.active { background: #1e1e1e; color: #d4d4d4; }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        .toolbar {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          align-items: center;
        }
        
        .toolbar-btn {
          background: #3c3c3c;
          border: none;
          border-radius: 4px;
          color: #d4d4d4;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .toolbar-btn:hover {
          background: #505050;
        }
        
        .toolbar-btn.fav-btn {
          font-size: 16px;
          padding: 4px 8px;
          color: #cca700;
        }
        
        .toolbar-btn.share-btn {
          background: #264f78;
        }
        
        .toolbar-btn.share-btn:hover {
          background: #366f98;
        }
        
        .toolbar-btn.share-btn.copied {
          background: #2d5a2d;
        }
        
        .history-panel, .favorites-panel {
          margin-top: 8px;
          max-height: 150px;
          overflow-y: auto;
        }
        
        .history-item, .favorite-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .history-item:hover, .favorite-item:hover {
          background: #3c3c3c;
        }
        
        .history-expr, .favorite-expr {
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 11px;
          color: #9cdcfe;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 70%;
        }
        
        .history-meta {
          font-size: 10px;
          color: #666;
        }
        
        .remove-fav-btn {
          background: transparent;
          border: none;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          padding: 0 4px;
        }
        
        .remove-fav-btn:hover {
          color: #f48771;
        }
        
        .empty-state {
          color: #666;
          font-size: 11px;
          text-align: center;
          padding: 12px;
        }
        
        .collapsible-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          padding: 6px 0;
        }
        
        .collapsible-header:hover {
          color: #d4d4d4;
        }
        
        .collapse-icon {
          transition: transform 0.2s;
        }
        
        .collapsed .collapse-icon {
          transform: rotate(-90deg);
        }
        
        .collapsed .collapsible-content {
          display: none;
        }
      </style>
      
      <div class="playground">
        <div class="panel expression-panel">
          <div class="panel-header">
            <span>Expression</span>
            <label style="font-size: 11px; color: #888;">
              <input type="checkbox" id="auto-evaluate" checked> Auto-evaluate
            </label>
          </div>
          <textarea 
            id="expression-input" 
            class="expression-input" 
            placeholder="Enter FHIRPath expression..."
          >${this.state.expression}</textarea>
          <div class="toolbar">
            <button id="fav-btn" class="toolbar-btn fav-btn" title="Add to favorites">☆</button>
            <button id="share-btn" class="toolbar-btn share-btn" title="Copy shareable link">
              🔗 Share
            </button>
            <div style="flex: 1;"></div>
            <div class="samples">
              ${SAMPLE_EXPRESSIONS.map(s => `
                <button class="sample-btn" data-expr="${s.expression}" title="${s.expression}">
                  ${s.label}
                </button>
              `).join("")}
            </div>
          </div>
          
          <div class="collapsible" id="history-section">
            <div class="collapsible-header panel-header" style="margin-top: 12px;">
              <span>📜 Recent Expressions</span>
              <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content history-panel">
              <div id="history-list"></div>
            </div>
          </div>
          
          <div class="collapsible collapsed" id="favorites-section">
            <div class="collapsible-header panel-header">
              <span>⭐ Favorites</span>
              <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content favorites-panel">
              <div id="favorites-list"></div>
            </div>
          </div>
        </div>
        
        <div class="panel">
          <div class="panel-header">Resource (JSON)</div>
          <textarea 
            id="resource-input" 
            class="resource-input"
          >${JSON.stringify(this.state.resource, null, 2)}</textarea>
        </div>
        
        <div class="panel">
          <div class="tabs">
            <button class="tab active" data-tab="result">Result</button>
            <button class="tab" data-tab="ast">AST</button>
            <button class="tab" data-tab="hints">Hints</button>
          </div>
          
          <div id="tab-result" class="tab-content active">
            <pre id="result" class="result"></pre>
            <div id="error" class="error"></div>
          </div>
          
          <div id="tab-ast" class="tab-content">
            <pre id="ast" class="ast"></pre>
          </div>
          
          <div id="tab-hints" class="tab-content">
            <div id="hints"></div>
          </div>
        </div>
        
        <div class="panel metrics-panel">
          <div id="metrics"></div>
        </div>
      </div>
    `;

    // Event listeners
    const expressionInput = this.shadow.querySelector<HTMLTextAreaElement>("#expression-input");
    if (expressionInput) {
      expressionInput.addEventListener("input", (e) => {
        this.state.expression = (e.target as HTMLTextAreaElement).value;
        if (this.autoEvaluate) {
          this.debouncedEvaluate();
        }
      });
    }

    const resourceInput = this.shadow.querySelector<HTMLTextAreaElement>("#resource-input");
    if (resourceInput) {
      resourceInput.addEventListener("input", (e) => {
        try {
          this.state.resource = JSON.parse((e.target as HTMLTextAreaElement).value);
          if (this.autoEvaluate) {
            this.debouncedEvaluate();
          }
        } catch {
          // Invalid JSON, ignore
        }
      });
    }

    const autoEvaluateCheckbox = this.shadow.querySelector<HTMLInputElement>("#auto-evaluate");
    if (autoEvaluateCheckbox) {
      autoEvaluateCheckbox.addEventListener("change", (e) => {
        this.autoEvaluate = (e.target as HTMLInputElement).checked;
      });
    }

    // Sample buttons
    this.shadow.querySelectorAll(".sample-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const expr = btn.getAttribute("data-expr");
        if (expr && expressionInput) {
          expressionInput.value = expr;
          this.state.expression = expr;
          this.evaluate();
        }
      });
    });

    // Tab switching
    this.shadow.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const tabName = tab.getAttribute("data-tab");
        
        this.shadow.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        this.shadow.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        
        tab.classList.add("active");
        this.shadow.querySelector(`#tab-${tabName}`)?.classList.add("active");
      });
    });

    // Favorite button
    const favBtn = this.shadow.querySelector("#fav-btn");
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        if (this.isFavorited()) {
          const fav = this.favorites.find(f => f.expression === this.state.expression);
          if (fav) this.removeFromFavorites(fav.id);
        } else {
          this.addToFavorites();
        }
      });
    }

    // Share button
    const shareBtn = this.shadow.querySelector("#share-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        const success = await this.copyShareableURL();
        if (success) {
          shareBtn.textContent = "✓ Copied!";
          shareBtn.classList.add("copied");
          setTimeout(() => {
            shareBtn.textContent = "🔗 Share";
            shareBtn.classList.remove("copied");
          }, 2000);
        }
      });
    }

    // Collapsible sections
    this.shadow.querySelectorAll(".collapsible-header").forEach(header => {
      header.addEventListener("click", () => {
        const section = header.parentElement;
        if (section) {
          section.classList.toggle("collapsed");
        }
      });
    });

    // Initialize displays
    this.updateHistoryDisplay();
    this.updateFavoritesDisplay();
  }
}

// Export for standalone use
export default FhirPathPlayground;
