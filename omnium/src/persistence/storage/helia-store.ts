/**
 * OMNIUM Content-Addressed Store
 *
 * Content-addressed storage using FsBlockstore directly.
 * Bypasses Helia's internal IdentityBlockstore to avoid generator bugs.
 * Provides a clean interface for storing and retrieving JSON data.
 */

import { CID } from 'multiformats/cid';
import { FsBlockstore } from 'blockstore-fs';
import * as json from 'multiformats/codecs/json';
import { sha256 } from 'multiformats/hashes/sha2';
import type { ContentStore, PersistenceConfig } from '../types.js';
import { StorageCache } from './cache.js';

/**
 * Content-addressed storage using FsBlockstore directly.
 *
 * Features:
 * - JSON serialization with CID calculation
 * - Filesystem blockstore for persistence
 * - Optional LRU cache for performance
 * - CID-based retrieval
 */
export class HeliaStore implements ContentStore {
  private blockstore: FsBlockstore | null = null;
  private cache: StorageCache | null = null;
  private config: PersistenceConfig;
  private initialized = false;

  constructor(config: PersistenceConfig) {
    this.config = config;
    if (config.cacheEnabled) {
      this.cache = new StorageCache(config.cacheMaxSize);
    }
  }

  /**
   * Initialize the filesystem blockstore.
   * Must be called before any storage operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create filesystem blockstore for persistent storage
    this.blockstore = new FsBlockstore(this.config.storagePath);

    // Explicitly open the blockstore before use
    await this.blockstore.open();

    this.initialized = true;
  }

  /**
   * Store JSON-serializable data, return CID.
   */
  async store<T>(data: T): Promise<CID> {
    this.ensureInitialized();

    // Encode data as JSON bytes
    const bytes = json.encode(data);

    // Calculate hash
    const hash = await sha256.digest(bytes);

    // Create CID (version 1, json codec)
    const cid = CID.create(1, json.code, hash);

    // Store the bytes
    await this.blockstore!.put(cid, bytes);

    // Cache the data
    if (this.cache) {
      this.cache.set(cid, data);
    }

    return cid;
  }

  /**
   * Retrieve data by CID.
   * Returns null if not found.
   */
  async retrieve<T>(cid: CID): Promise<T | null> {
    this.ensureInitialized();

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get<T>(cid);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      // Check if exists first
      const exists = await this.blockstore!.has(cid);
      if (!exists) {
        return null;
      }

      // Get bytes from blockstore - collect async generator
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.blockstore!.get(cid)) {
        chunks.push(chunk);
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const bytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }

      // Decode JSON
      const data = json.decode<T>(bytes);

      // Cache the result
      if (this.cache && data !== null) {
        this.cache.set(cid, data);
      }

      return data;
    } catch (err) {
      console.error('[HeliaStore] Retrieve error:', err);
      return null;
    }
  }

  /**
   * Check if a CID exists in storage.
   */
  async has(cid: CID): Promise<boolean> {
    this.ensureInitialized();

    // Check cache first
    if (this.cache?.has(cid)) {
      return true;
    }

    return this.blockstore!.has(cid);
  }

  /**
   * Pin a CID to prevent garbage collection.
   * (No-op for FsBlockstore - files persist until deleted)
   */
  async pin(_cid: CID): Promise<void> {
    this.ensureInitialized();
    // FsBlockstore doesn't need pinning - files persist
  }

  /**
   * Unpin a CID (allows garbage collection).
   */
  async unpin(cid: CID): Promise<void> {
    this.ensureInitialized();

    // Remove from cache
    if (this.cache) {
      this.cache.invalidate(cid);
    }

    // Optionally delete from blockstore
    // For now, we keep data even when unpinned
  }

  /**
   * Get the underlying blockstore.
   * Useful for direct access if needed.
   */
  getBlockstore(): FsBlockstore | null {
    return this.blockstore;
  }

  /**
   * Get cache statistics (if caching enabled).
   */
  getCacheStats(): ReturnType<StorageCache['getStats']> | null {
    return this.cache?.getStats() ?? null;
  }

  /**
   * Check if store is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Graceful shutdown.
   */
  async close(): Promise<void> {
    // Close the blockstore
    if (this.blockstore) {
      await this.blockstore.close();
      this.blockstore = null;
    }

    if (this.cache) {
      this.cache.clear();
    }

    this.initialized = false;
  }

  /**
   * Ensure the store is initialized before operations.
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.blockstore) {
      throw new Error('HeliaStore not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create and initialize a HeliaStore.
 * Convenience function for one-step setup.
 */
export async function createHeliaStore(
  config: Partial<PersistenceConfig> = {}
): Promise<HeliaStore> {
  const { DEFAULT_PERSISTENCE_CONFIG } = await import('../types.js');
  const fullConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
  const store = new HeliaStore(fullConfig);
  await store.initialize();
  return store;
}
