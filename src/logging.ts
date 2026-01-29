/**
 * FHIR R6-compliant Logging System
 * 
 * Based on OperationOutcome severity levels from FHIR R6 6.0.0-ballot4:
 * https://hl7.org/fhir/6.0.0-ballot4/valueset-issue-severity.html
 * 
 * Design principles:
 * - No terminal spam - structured for IDE/video-coding development
 * - Plugin source identification
 * - Edge-first, serverless-compatible (no file I/O)
 * - Zero external dependencies
 * - Minimal overhead when disabled
 */

/**
 * FHIR R6 OperationOutcome issue severity levels
 * @see https://hl7.org/fhir/6.0.0-ballot4/codesystem-issue-severity.html
 */
export type LogLevel = "fatal" | "error" | "warning" | "information";

/**
 * Numeric priority for level comparison (lower = more severe)
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  information: 3,
};

/**
 * Log entry structure - FHIR-aligned
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;        // Plugin/module name
  code?: string;         // FHIR issue-type code if applicable
  message: string;
  details?: unknown;     // Additional structured data
  location?: string;     // FHIRPath expression or code location
  duration?: number;     // Execution time in ms (for performance logs)
}

/**
 * Log handler function type
 */
export type LogHandler = (entry: LogEntry) => void;

/**
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  handlers: LogHandler[];
  enabled: boolean;
}

/**
 * Global logger state - lightweight singleton
 */
const state: LoggerConfig = {
  minLevel: "warning",
  handlers: [],
  enabled: true,
};

/**
 * In-memory log buffer for IDE/debugging (circular buffer)
 */
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

/**
 * Default handler - stores in memory buffer (no console spam)
 */
const memoryHandler: LogHandler = (entry) => {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
};

// Initialize with memory handler
state.handlers.push(memoryHandler);

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  if (config.minLevel !== undefined) state.minLevel = config.minLevel;
  if (config.handlers !== undefined) state.handlers = config.handlers;
  if (config.enabled !== undefined) state.enabled = config.enabled;
}

/**
 * Add a log handler
 */
export function addLogHandler(handler: LogHandler): void {
  state.handlers.push(handler);
}

/**
 * Remove a log handler
 */
export function removeLogHandler(handler: LogHandler): void {
  const index = state.handlers.indexOf(handler);
  if (index > -1) state.handlers.splice(index, 1);
}

/**
 * Get recent log entries (for IDE inspection)
 */
export function getLogBuffer(): readonly LogEntry[] {
  return logBuffer;
}

/**
 * Clear log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Get logs filtered by source
 */
export function getLogsBySource(source: string): LogEntry[] {
  return logBuffer.filter(e => e.source === source);
}

/**
 * Get logs filtered by level (and more severe)
 */
export function getLogsByLevel(level: LogLevel): LogEntry[] {
  const priority = LEVEL_PRIORITY[level];
  return logBuffer.filter(e => LEVEL_PRIORITY[e.level] <= priority);
}

/**
 * Check if a level should be logged based on current config
 */
function shouldLog(level: LogLevel): boolean {
  if (!state.enabled) return false;
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[state.minLevel];
}

/**
 * Create a log entry and dispatch to handlers
 */
function log(
  level: LogLevel,
  source: string,
  message: string,
  options?: {
    code?: string;
    details?: unknown;
    location?: string;
    duration?: number;
  }
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    ...options,
  };

  for (const handler of state.handlers) {
    try {
      handler(entry);
    } catch {
      // Silently ignore handler errors - don't break the app
    }
  }
}

/**
 * Create a scoped logger for a specific plugin/module
 */
export function createLogger(source: string) {
  return {
    fatal: (message: string, options?: { code?: string; details?: unknown; location?: string }) =>
      log("fatal", source, message, options),
    
    error: (message: string, options?: { code?: string; details?: unknown; location?: string }) =>
      log("error", source, message, options),
    
    warning: (message: string, options?: { code?: string; details?: unknown; location?: string }) =>
      log("warning", source, message, options),
    
    info: (message: string, options?: { code?: string; details?: unknown; location?: string }) =>
      log("information", source, message, options),

    /**
     * Log with performance timing
     */
    perf: (message: string, duration: number, options?: { details?: unknown }) =>
      log("information", source, message, { ...options, duration }),

    /**
     * Time a function execution
     */
    time: async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        return await fn();
      } finally {
        const duration = performance.now() - start;
        log("information", source, label, { duration });
      }
    },

    /**
     * Conditional debug (only in development)
     */
    debug: (message: string, details?: unknown) => {
      if (Deno?.env?.get?.("DENO_ENV") === "development") {
        log("information", source, `[DEBUG] ${message}`, { details });
      }
    },
  };
}

/**
 * Pre-configured loggers for fhirpath-atollee modules
 */
export const loggers = {
  parser: createLogger("fhirpath-atollee/parser"),
  evaluator: createLogger("fhirpath-atollee/evaluator"),
  jit: createLogger("fhirpath-atollee/jit"),
  optimizer: createLogger("fhirpath-atollee/optimizer"),
  terminology: createLogger("fhirpath-atollee/terminology"),
  streaming: createLogger("fhirpath-atollee/streaming"),
  worker: createLogger("fhirpath-atollee/worker"),
  playground: createLogger("fhirpath-atollee/playground"),
};

/**
 * IDE-friendly handler that formats logs for structured viewing
 * Enable with: addLogHandler(ideHandler)
 */
export const ideHandler: LogHandler = (entry) => {
  // Format: [LEVEL] source | message (duration?)
  const levelIcon = {
    fatal: "💀",
    error: "❌",
    warning: "⚠️",
    information: "ℹ️",
  }[entry.level];

  const durationStr = entry.duration !== undefined 
    ? ` (${entry.duration.toFixed(2)}ms)` 
    : "";

  const locationStr = entry.location 
    ? ` @ ${entry.location}` 
    : "";

  // Structured output for IDE log panel
  console.log(
    `${levelIcon} [${entry.source}] ${entry.message}${durationStr}${locationStr}`
  );

  // Log details separately if present (collapsible in most IDEs)
  if (entry.details !== undefined) {
    console.log("   Details:", entry.details);
  }
};

/**
 * JSON handler for serverless/edge logging systems
 * Enable with: addLogHandler(jsonHandler)
 */
export const jsonHandler: LogHandler = (entry) => {
  console.log(JSON.stringify(entry));
};

/**
 * Export type for external handler implementations
 */
export type { LogHandler as FhirLogHandler };
