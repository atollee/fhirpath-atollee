/**
 * FHIRPath Worker Pool
 * 
 * Manages a pool of Web Workers for parallel FHIRPath evaluation.
 */

import type {
  WorkerPoolConfig,
  WorkerPoolStats,
  WorkerTask,
  WorkerResult,
  WorkerMessage,
  WorkerResponse,
  BatchEvaluationOptions,
  BatchEvaluationResult,
} from "./types.ts";

/**
 * Managed worker instance
 */
interface ManagedWorker {
  worker: Worker;
  busy: boolean;
  taskId?: string;
}

/**
 * Queued task with resolve/reject
 */
interface QueuedTask {
  task: WorkerTask;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
  timeoutId?: number;
}

/**
 * FHIRPath Worker Pool
 */
export class FhirPathWorkerPool {
  private workers: ManagedWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private pendingTasks = new Map<string, QueuedTask>();
  private config: Required<WorkerPoolConfig>;
  private stats = {
    totalProcessed: 0,
    totalDurationMs: 0,
  };
  private isShutdown = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = {
      poolSize: config.poolSize ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) ?? 4,
      maxQueueSize: config.maxQueueSize ?? 1000,
      taskTimeoutMs: config.taskTimeoutMs ?? 30000,
    };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.workers.length > 0) return;

    const workerUrl = new URL("./worker.ts", import.meta.url).href;
    const readyPromises: Promise<void>[] = [];

    for (let i = 0; i < this.config.poolSize; i++) {
      const worker = new Worker(workerUrl, { type: "module" });
      const managed: ManagedWorker = { worker, busy: false };

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${i} failed to initialize`));
        }, 5000);

        const handler = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.type === "ready") {
            clearTimeout(timeout);
            worker.removeEventListener("message", handler);
            resolve();
          }
        };

        worker.addEventListener("message", handler);
      });

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(managed, event.data);
      };

      worker.onerror = (error) => {
        // Worker errors must be logged to console for debugging
        // deno-lint-ignore no-console
        console.error("Worker error:", error);
        this.handleWorkerError(managed, error);
      };

      this.workers.push(managed);
      readyPromises.push(readyPromise);
    }

    await Promise.all(readyPromises);
  }

  /**
   * Execute a single task
   */
  async execute(task: WorkerTask): Promise<WorkerResult> {
    if (this.isShutdown) {
      throw new Error("Worker pool is shut down");
    }

    if (this.workers.length === 0) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = { task, resolve, reject };

      // Set timeout
      queuedTask.timeoutId = setTimeout(() => {
        this.pendingTasks.delete(task.id);
        reject(new Error(`Task ${task.id} timed out after ${this.config.taskTimeoutMs}ms`));
      }, this.config.taskTimeoutMs);

      // Try to dispatch immediately
      const availableWorker = this.workers.find(w => !w.busy);
      if (availableWorker) {
        this.dispatchTask(availableWorker, queuedTask);
      } else {
        // Queue if no worker available
        if (this.taskQueue.length >= this.config.maxQueueSize) {
          clearTimeout(queuedTask.timeoutId);
          reject(new Error("Task queue is full"));
          return;
        }
        this.taskQueue.push(queuedTask);
      }
    });
  }

  /**
   * Execute a batch of evaluations in parallel
   */
  async evaluateBatch(options: BatchEvaluationOptions): Promise<BatchEvaluationResult> {
    const startTime = performance.now();
    const { expression, resources, model, context, chunkSize = 100 } = options;

    // Split resources into chunks
    const chunks: unknown[][] = [];
    for (let i = 0; i < resources.length; i += chunkSize) {
      chunks.push(resources.slice(i, i + chunkSize));
    }

    // Create tasks for each chunk
    const tasks: WorkerTask[] = chunks.map((chunk, index) => ({
      id: `batch-${Date.now()}-${index}`,
      expression,
      resources: chunk,
      model,
      context,
    }));

    // Execute all tasks in parallel
    const taskResults = await Promise.all(tasks.map(task => this.execute(task)));

    // Combine results
    const results: unknown[][] = [];
    for (const taskResult of taskResults) {
      if (taskResult.error) {
        throw new Error(taskResult.error);
      }
      results.push(...taskResult.results);
    }

    return {
      results,
      totalDurationMs: performance.now() - startTime,
      resourceCount: resources.length,
      chunkCount: chunks.length,
    };
  }

  /**
   * Get pool statistics
   */
  getStats(): WorkerPoolStats {
    return {
      poolSize: this.workers.length,
      activeWorkers: this.workers.filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      totalProcessed: this.stats.totalProcessed,
      avgDurationMs: this.stats.totalProcessed > 0 
        ? this.stats.totalDurationMs / this.stats.totalProcessed 
        : 0,
    };
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;

    // Cancel queued tasks
    for (const queued of this.taskQueue) {
      if (queued.timeoutId) clearTimeout(queued.timeoutId);
      queued.reject(new Error("Worker pool shutdown"));
    }
    this.taskQueue = [];

    // Cancel pending tasks
    for (const [, queued] of this.pendingTasks) {
      if (queued.timeoutId) clearTimeout(queued.timeoutId);
      queued.reject(new Error("Worker pool shutdown"));
    }
    this.pendingTasks.clear();

    // Terminate workers
    const shutdownMessage: WorkerMessage = { type: "shutdown" };
    for (const managed of this.workers) {
      managed.worker.postMessage(shutdownMessage);
      managed.worker.terminate();
    }
    this.workers = [];
  }

  private dispatchTask(managed: ManagedWorker, queued: QueuedTask): void {
    managed.busy = true;
    managed.taskId = queued.task.id;
    this.pendingTasks.set(queued.task.id, queued);

    const message: WorkerMessage = {
      type: "task",
      task: queued.task,
    };
    managed.worker.postMessage(message);
  }

  private handleWorkerMessage(managed: ManagedWorker, response: WorkerResponse): void {
    if (response.type === "result" && response.result) {
      const taskId = response.result.id;
      const queued = this.pendingTasks.get(taskId);

      if (queued) {
        if (queued.timeoutId) clearTimeout(queued.timeoutId);
        this.pendingTasks.delete(taskId);

        // Update stats
        this.stats.totalProcessed++;
        this.stats.totalDurationMs += response.result.durationMs;

        queued.resolve(response.result);
      }

      // Mark worker as available and process next task
      managed.busy = false;
      managed.taskId = undefined;
      this.processNextTask(managed);
    }
  }

  private handleWorkerError(managed: ManagedWorker, error: ErrorEvent): void {
    if (managed.taskId) {
      const queued = this.pendingTasks.get(managed.taskId);
      if (queued) {
        if (queued.timeoutId) clearTimeout(queued.timeoutId);
        this.pendingTasks.delete(managed.taskId);
        queued.reject(new Error(`Worker error: ${error.message}`));
      }
    }

    managed.busy = false;
    managed.taskId = undefined;
    this.processNextTask(managed);
  }

  private processNextTask(managed: ManagedWorker): void {
    if (this.taskQueue.length > 0 && !managed.busy) {
      const next = this.taskQueue.shift()!;
      this.dispatchTask(managed, next);
    }
  }
}

// Global pool instance
let globalPool: FhirPathWorkerPool | null = null;

/**
 * Get the global worker pool
 */
export function getGlobalWorkerPool(): FhirPathWorkerPool {
  if (!globalPool) {
    globalPool = new FhirPathWorkerPool();
  }
  return globalPool;
}

/**
 * Shutdown the global worker pool
 */
export async function shutdownGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}
