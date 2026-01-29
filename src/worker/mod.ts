/**
 * FHIRPath Worker Pool Module
 * 
 * Parallel FHIRPath evaluation using Web Workers.
 */

export {
  FhirPathWorkerPool,
  getGlobalWorkerPool,
  shutdownGlobalPool,
} from "./pool.ts";

export type {
  WorkerTask,
  WorkerResult,
  WorkerPoolConfig,
  WorkerPoolStats,
  BatchEvaluationOptions,
  BatchEvaluationResult,
} from "./types.ts";
