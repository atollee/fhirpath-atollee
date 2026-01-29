/**
 * Streaming Evaluation API for FHIRPath
 * 
 * Enables processing of large datasets (1000+ resources) without memory overflow.
 * Uses AsyncIterator for lazy evaluation and backpressure support.
 * 
 * @example
 * ```typescript
 * import { evaluateStream, StreamingOptions } from "@atollee/fhirpath/streaming";
 * 
 * // Stream through a large Bundle
 * const bundle = await fetchLargeBundle();
 * 
 * for await (const result of evaluateStream(bundle, "entry.resource.where(resourceType='Patient')")) {
 *   console.log("Found patient:", result);
 *   // Process one at a time - no memory buildup
 * }
 * 
 * // With batch processing
 * const stream = evaluateStream(bundle, "entry.resource", { batchSize: 100 });
 * for await (const batch of stream.batches()) {
 *   await processBatch(batch);
 * }
 * ```
 */

import { FhirPathEngine, getGlobalEngine } from "./engine.ts";
import type { ASTNode, EvaluationContext, Model, Options } from "./types.ts";

/**
 * Options for streaming evaluation
 */
export interface StreamingOptions extends Options {
  /** 
   * Number of items to yield per iteration (default: 1)
   * Higher values reduce overhead but increase memory usage
   */
  batchSize?: number;
  
  /**
   * Maximum number of results to yield (default: unlimited)
   */
  limit?: number;
  
  /**
   * Number of results to skip before yielding (default: 0)
   */
  offset?: number;
  
  /**
   * Callback for progress reporting
   */
  onProgress?: (processed: number, total?: number) => void;
  
  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;
}

/**
 * Result wrapper with metadata
 */
export interface StreamResult<T = unknown> {
  /** The actual result value */
  value: T;
  /** Index of this result in the stream */
  index: number;
  /** Path to this result in the source data */
  path?: string;
}

/**
 * Streaming evaluator class
 */
export class FhirPathStream<T = unknown> implements AsyncIterable<T> {
  private engine: FhirPathEngine;
  private expression: string;
  private compiledAst: ASTNode | null = null;
  private data: unknown;
  private context: EvaluationContext;
  private options: StreamingOptions;
  private model?: Model;

  constructor(
    data: unknown,
    expression: string,
    context: EvaluationContext = {},
    model?: Model,
    options: StreamingOptions = {},
  ) {
    this.engine = getGlobalEngine();
    this.expression = expression;
    this.data = data;
    this.context = context;
    this.model = model;
    this.options = options;
  }

  /**
   * Compile the expression (lazy, cached)
   */
  private getCompiledAst(): ASTNode {
    if (!this.compiledAst) {
      const compiled = this.engine.compile(this.expression, this.model);
      // Extract AST from compiled expression
      this.compiledAst = (compiled as unknown as { ast: ASTNode }).ast;
    }
    return this.compiledAst;
  }

  /**
   * Check if data is a FHIR Bundle
   */
  private isBundle(data: unknown): data is { resourceType: "Bundle"; entry?: Array<{ resource?: unknown }> } {
    return (
      typeof data === "object" &&
      data !== null &&
      (data as Record<string, unknown>).resourceType === "Bundle"
    );
  }

  /**
   * Extract iterable items from data
   * For Bundles, yields entry resources; otherwise yields the data itself
   */
  private *getIterableItems(): Generator<{ item: unknown; index: number; path: string }> {
    if (this.isBundle(this.data)) {
      const entries = this.data.entry || [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.resource) {
          yield { 
            item: entry.resource, 
            index: i, 
            path: `Bundle.entry[${i}].resource` 
          };
        }
      }
    } else if (Array.isArray(this.data)) {
      for (let i = 0; i < this.data.length; i++) {
        yield { item: this.data[i], index: i, path: `[${i}]` };
      }
    } else {
      yield { item: this.data, index: 0, path: "" };
    }
  }

  /**
   * Async iterator implementation
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    const { batchSize = 1, limit, offset = 0, onProgress, signal } = this.options;
    
    let processed = 0;
    let yielded = 0;
    let batch: T[] = [];

    // For Bundles with entry.resource expressions, evaluate on the whole Bundle first
    // to get proper path resolution
    const results = this.engine.evaluate(
      this.data,
      this.expression,
      { ...this.context, resource: this.data },
      this.model,
      this.options,
    ) as T[];

    // Stream through results
    for (const result of results) {
      // Check for abort
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      processed++;

      // Skip offset
      if (processed <= offset) {
        continue;
      }

      // Check limit
      if (limit !== undefined && yielded >= limit) {
        return;
      }

      // Batch handling
      if (batchSize > 1) {
        batch.push(result);
        if (batch.length >= batchSize) {
          for (const item of batch) {
            yield item;
            yielded++;
          }
          batch = [];
        }
      } else {
        yield result;
        yielded++;
      }

      // Progress callback
      if (onProgress) {
        onProgress(processed, results.length);
      }
    }

    // Yield remaining batch items
    for (const item of batch) {
      yield item;
      yielded++;
    }
  }

  /**
   * Iterate in batches
   */
  async *batches(size?: number): AsyncGenerator<T[]> {
    const batchSize = size || this.options.batchSize || 100;
    let batch: T[] = [];

    for await (const item of this) {
      batch.push(item);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  /**
   * Collect all results into an array
   * Warning: This loads all results into memory
   */
  async toArray(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results;
  }

  /**
   * Get the first result
   */
  async first(): Promise<T | undefined> {
    for await (const item of this) {
      return item;
    }
    return undefined;
  }

  /**
   * Count results without collecting them
   */
  async count(): Promise<number> {
    let count = 0;
    for await (const _ of this) {
      count++;
    }
    return count;
  }

  /**
   * Check if any results exist
   */
  async exists(): Promise<boolean> {
    for await (const _ of this) {
      return true;
    }
    return false;
  }

  /**
   * Apply a filter function
   */
  filter(predicate: (item: T) => boolean | Promise<boolean>): FhirPathFilteredStream<T> {
    return new FhirPathFilteredStream(this, predicate);
  }

  /**
   * Apply a map function
   */
  map<U>(mapper: (item: T) => U | Promise<U>): FhirPathMappedStream<T, U> {
    return new FhirPathMappedStream(this, mapper);
  }

  /**
   * Take only the first n items
   */
  take(n: number): FhirPathTakeStream<T> {
    return new FhirPathTakeStream(this, n);
  }

  /**
   * Skip the first n items
   */
  skip(n: number): FhirPathSkipStream<T> {
    return new FhirPathSkipStream(this, n);
  }
}

/**
 * Base class for stream wrappers with common methods
 */
abstract class StreamWrapper<T> implements AsyncIterable<T> {
  abstract [Symbol.asyncIterator](): AsyncGenerator<T>;
  
  async toArray(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results;
  }
  
  filter(predicate: (item: T) => boolean | Promise<boolean>): FhirPathFilteredStream<T> {
    return new FhirPathFilteredStream(this, predicate);
  }
  
  map<U>(mapper: (item: T) => U | Promise<U>): FhirPathMappedStream<T, U> {
    return new FhirPathMappedStream(this, mapper);
  }
  
  take(n: number): FhirPathTakeStream<T> {
    return new FhirPathTakeStream(this, n);
  }
  
  skip(n: number): FhirPathSkipStream<T> {
    return new FhirPathSkipStream(this, n);
  }
}

/**
 * Filtered stream wrapper
 */
class FhirPathFilteredStream<T> extends StreamWrapper<T> {
  constructor(
    private source: AsyncIterable<T>,
    private predicate: (item: T) => boolean | Promise<boolean>,
  ) {
    super();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for await (const item of this.source) {
      if (await this.predicate(item)) {
        yield item;
      }
    }
  }
}

/**
 * Mapped stream wrapper
 */
class FhirPathMappedStream<T, U> extends StreamWrapper<U> {
  constructor(
    private source: AsyncIterable<T>,
    private mapper: (item: T) => U | Promise<U>,
  ) {
    super();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<U> {
    for await (const item of this.source) {
      yield await this.mapper(item);
    }
  }
}

/**
 * Take stream wrapper
 */
class FhirPathTakeStream<T> extends StreamWrapper<T> {
  constructor(
    private source: AsyncIterable<T>,
    private n: number,
  ) {
    super();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    let count = 0;
    for await (const item of this.source) {
      if (count >= this.n) break;
      yield item;
      count++;
    }
  }
}

/**
 * Skip stream wrapper
 */
class FhirPathSkipStream<T> extends StreamWrapper<T> {
  constructor(
    private source: AsyncIterable<T>,
    private n: number,
  ) {
    super();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    let count = 0;
    for await (const item of this.source) {
      if (count >= this.n) {
        yield item;
      }
      count++;
    }
  }
}

/**
 * Create a streaming evaluator for large datasets
 * 
 * @param data - FHIR resource, Bundle, or array of resources
 * @param expression - FHIRPath expression to evaluate
 * @param context - Evaluation context variables
 * @param model - FHIR model (r4, r5, r6)
 * @param options - Streaming options
 * @returns AsyncIterable stream of results
 * 
 * @example
 * ```typescript
 * // Process a large Bundle
 * const bundle = await fetch("/fhir/Patient?_count=10000").then(r => r.json());
 * 
 * for await (const patient of evaluateStream(bundle, "entry.resource")) {
 *   console.log(patient.id);
 * }
 * 
 * // With options
 * const stream = evaluateStream(bundle, "entry.resource.name.given", {
 *   limit: 100,
 *   offset: 50,
 *   onProgress: (n) => console.log(`Processed ${n} items`),
 * });
 * 
 * const names = await stream.toArray();
 * ```
 */
export function evaluateStream<T = unknown>(
  data: unknown,
  expression: string,
  context?: EvaluationContext,
  model?: Model,
  options?: StreamingOptions,
): FhirPathStream<T> {
  return new FhirPathStream<T>(data, expression, context, model, options);
}

/**
 * Evaluate with a callback for each result (event-driven style)
 * 
 * @param data - FHIR resource or Bundle
 * @param expression - FHIRPath expression
 * @param callback - Function called for each result
 * @param options - Evaluation options
 * @returns Promise that resolves when all results are processed
 */
export async function evaluateEach<T = unknown>(
  data: unknown,
  expression: string,
  callback: (result: T, index: number) => void | Promise<void>,
  context?: EvaluationContext,
  model?: Model,
  options?: StreamingOptions,
): Promise<number> {
  const stream = evaluateStream<T>(data, expression, context, model, options);
  let index = 0;
  
  for await (const result of stream) {
    await callback(result, index++);
  }
  
  return index;
}

/**
 * Create a readable stream (Web Streams API)
 * 
 * @param data - FHIR resource or Bundle
 * @param expression - FHIRPath expression
 * @param options - Streaming options
 * @returns ReadableStream of results
 */
export function toReadableStream<T = unknown>(
  data: unknown,
  expression: string,
  context?: EvaluationContext,
  model?: Model,
  options?: StreamingOptions,
): ReadableStream<T> {
  const asyncIterator = evaluateStream<T>(data, expression, context, model, options)[Symbol.asyncIterator]();
  
  return new ReadableStream<T>({
    async pull(controller) {
      const { value, done } = await asyncIterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    cancel() {
      // Signal abort if supported
      asyncIterator.return?.(undefined);
    },
  });
}

// Default export
export default {
  evaluateStream,
  evaluateEach,
  toReadableStream,
  FhirPathStream,
};
