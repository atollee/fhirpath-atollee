/**
 * LRU Cache for parsed FHIRPath expressions
 * 
 * This cache stores parsed ASTs to avoid re-parsing the same expressions.
 * It uses a simple LRU (Least Recently Used) eviction strategy.
 * 
 * Thread-safety note: This cache is designed for single-threaded use.
 * For worker-based parallelization, each worker should have its own cache
 * or use a shared-nothing architecture.
 */

import type { ASTNode, CacheStats } from "./types.ts";

/**
 * Cache entry with access metadata
 */
interface CacheEntry {
  ast: ASTNode;
  lastAccess: number;
}

/**
 * LRU Cache for FHIRPath ASTs
 */
export class ExpressionCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  /**
   * Create a new expression cache
   * @param maxSize Maximum number of expressions to cache (default: 500)
   */
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Generate a cache key for an expression
   * The key includes the base type if specified
   */
  private makeKey(expression: string, base?: string): string {
    return base ? `${base}::${expression}` : expression;
  }

  /**
   * Get a cached AST or undefined if not found
   */
  get(expression: string, base?: string): ASTNode | undefined {
    const key = this.makeKey(expression, base);
    const entry = this.cache.get(key);
    
    if (entry) {
      // Update access time for LRU
      entry.lastAccess = Date.now();
      this.hits++;
      return entry.ast;
    }
    
    this.misses++;
    return undefined;
  }

  /**
   * Store an AST in the cache
   */
  set(expression: string, ast: ASTNode, base?: string): void {
    const key = this.makeKey(expression, base);
    
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      ast,
      lastAccess: Date.now(),
    });
  }

  /**
   * Check if an expression is cached
   */
  has(expression: string, base?: string): boolean {
    return this.cache.has(this.makeKey(expression, base));
  }

  /**
   * Remove an expression from cache
   */
  delete(expression: string, base?: string): boolean {
    return this.cache.delete(this.makeKey(expression, base));
  }

  /**
   * Clear all cached expressions
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Iterate over all cached expressions (for debugging)
   */
  *entries(): IterableIterator<[string, ASTNode]> {
    for (const [key, entry] of this.cache) {
      yield [key, entry.ast];
    }
  }
}

/**
 * Global default cache instance
 * 
 * This is used by the default API functions (evaluate, compile).
 * Applications can create their own cache instances for isolation.
 */
export const globalCache = new ExpressionCache(1000);
