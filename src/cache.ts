/**
 * High-Performance LRU Cache for parsed FHIRPath expressions
 * 
 * This cache stores parsed ASTs to avoid re-parsing the same expressions.
 * Uses O(1) LRU eviction with a double-linked list + Map combination.
 * 
 * Performance: O(1) for get, set, and eviction operations.
 * 
 * Thread-safety note: This cache is designed for single-threaded use.
 * For worker-based parallelization, each worker should have its own cache
 * or use a shared-nothing architecture.
 */

import type { ASTNode, CacheStats } from "./types.ts";

/**
 * Node in the double-linked list for O(1) LRU eviction
 */
interface LRUNode {
  key: string;
  ast: ASTNode;
  prev: LRUNode | null;
  next: LRUNode | null;
}

/**
 * High-Performance LRU Cache for FHIRPath ASTs
 * 
 * Uses a combination of Map (O(1) lookup) and double-linked list (O(1) eviction)
 */
export class ExpressionCache {
  private cache: Map<string, LRUNode>;
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  
  // Double-linked list head (most recent) and tail (least recent)
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;

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
   * Move a node to the front of the list (most recently used)
   */
  private moveToFront(node: LRUNode): void {
    if (node === this.head) return; // Already at front
    
    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;
    
    // Insert at front
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  /**
   * Add a new node to the front of the list
   */
  private addToFront(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  /**
   * Remove the tail node (least recently used) - O(1)
   */
  private removeTail(): LRUNode | null {
    if (!this.tail) return null;
    
    const removed = this.tail;
    this.tail = removed.prev;
    if (this.tail) {
      this.tail.next = null;
    } else {
      this.head = null;
    }
    removed.prev = null;
    removed.next = null;
    return removed;
  }

  /**
   * Get a cached AST or undefined if not found - O(1)
   */
  get(expression: string, base?: string): ASTNode | undefined {
    const key = this.makeKey(expression, base);
    const node = this.cache.get(key);
    
    if (node) {
      // Move to front (most recently used)
      this.moveToFront(node);
      this.hits++;
      return node.ast;
    }
    
    this.misses++;
    return undefined;
  }

  /**
   * Store an AST in the cache - O(1)
   */
  set(expression: string, ast: ASTNode, base?: string): void {
    const key = this.makeKey(expression, base);
    
    // Check if already exists
    const existing = this.cache.get(key);
    if (existing) {
      existing.ast = ast;
      this.moveToFront(existing);
      return;
    }
    
    // Evict if at capacity - O(1)
    if (this.cache.size >= this.maxSize) {
      const removed = this.removeTail();
      if (removed) {
        this.cache.delete(removed.key);
      }
    }
    
    // Create new node and add to front
    const node: LRUNode = { key, ast, prev: null, next: null };
    this.addToFront(node);
    this.cache.set(key, node);
  }

  /**
   * Check if an expression is cached - O(1)
   */
  has(expression: string, base?: string): boolean {
    return this.cache.has(this.makeKey(expression, base));
  }

  /**
   * Remove an expression from cache - O(1)
   */
  delete(expression: string, base?: string): boolean {
    const key = this.makeKey(expression, base);
    const node = this.cache.get(key);
    
    if (!node) return false;
    
    // Remove from list
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    
    return this.cache.delete(key);
  }

  /**
   * Clear all cached expressions
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
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
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Iterate over all cached expressions (for debugging)
   * Returns entries in LRU order (most recent first)
   */
  *entries(): IterableIterator<[string, ASTNode]> {
    let current = this.head;
    while (current) {
      yield [current.key, current.ast];
      current = current.next;
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
