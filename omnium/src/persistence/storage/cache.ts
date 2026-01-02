/**
 * OMNIUM Storage Cache
 *
 * LRU (Least Recently Used) cache for frequently accessed data.
 * Reduces Helia lookups for hot data.
 */

import type { CID } from 'multiformats/cid';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Simple LRU cache for content-addressed data.
 * Keys are CID strings, values are the stored objects.
 */
export class StorageCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from cache.
   * Moves the entry to the end (most recently used).
   */
  get<T>(cid: CID): T | undefined {
    const key = cid.toString();
    const entry = this.cache.get(key);

    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.hits++;
      return entry.data as T;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Store a value in cache.
   * Evicts oldest entry if at capacity.
   */
  set<T>(cid: CID, data: T): void {
    const key = cid.toString();

    // If already exists, remove to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a CID is in cache.
   */
  has(cid: CID): boolean {
    return this.cache.has(cid.toString());
  }

  /**
   * Invalidate a specific entry.
   */
  invalidate(cid: CID): void {
    this.cache.delete(cid.toString());
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}
