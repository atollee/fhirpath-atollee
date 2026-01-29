/**
 * Worker Pool Types
 * 
 * Types for parallel FHIRPath evaluation using Web Workers.
 */

import type { Model } from "../types.ts";

/**
 * Task for worker execution
 */
export interface WorkerTask {
  /** Unique task ID */
  id: string;
  /** FHIRPath expression */
  expression: string;
  /** Resource(s) to evaluate against */
  resources: unknown[];
  /** Optional FHIR model */
  model?: Model;
  /** Optional evaluation context */
  context?: Record<string, unknown>;
}

/**
 * Result from worker execution
 */
export interface WorkerResult {
  /** Task ID */
  id: string;
  /** Results for each resource */
  results: unknown[][];
  /** Error if evaluation failed */
  error?: string;
  /** Execution time in milliseconds */
  durationMs: number;
}

/**
 * Message from main thread to worker
 */
export interface WorkerMessage {
  type: "task" | "shutdown";
  task?: WorkerTask;
}

/**
 * Message from worker to main thread
 */
export interface WorkerResponse {
  type: "result" | "ready" | "error";
  result?: WorkerResult;
  error?: string;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Number of workers (default: navigator.hardwareConcurrency or 4) */
  poolSize?: number;
  /** Maximum queue size (default: 1000) */
  maxQueueSize?: number;
  /** Task timeout in milliseconds (default: 30000) */
  taskTimeoutMs?: number;
}

/**
 * Worker pool statistics
 */
export interface WorkerPoolStats {
  /** Number of workers */
  poolSize: number;
  /** Number of active workers */
  activeWorkers: number;
  /** Number of tasks in queue */
  queuedTasks: number;
  /** Total tasks processed */
  totalProcessed: number;
  /** Average task duration */
  avgDurationMs: number;
}

/**
 * Batch evaluation options
 */
export interface BatchEvaluationOptions {
  /** Expression to evaluate */
  expression: string;
  /** Resources to evaluate against */
  resources: unknown[];
  /** Optional FHIR model */
  model?: Model;
  /** Optional evaluation context */
  context?: Record<string, unknown>;
  /** Chunk size for batching (default: 100) */
  chunkSize?: number;
}

/**
 * Batch evaluation result
 */
export interface BatchEvaluationResult {
  /** Results indexed by resource position */
  results: unknown[][];
  /** Total execution time */
  totalDurationMs: number;
  /** Number of resources processed */
  resourceCount: number;
  /** Number of chunks used */
  chunkCount: number;
}
