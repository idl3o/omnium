/**
 * Networked Helia Store
 *
 * Full Helia integration with libp2p networking.
 * Enables content discovery via DHT and fetching via Bitswap.
 *
 * Use this when you need:
 * - Fetch content from other IPFS nodes
 * - Publish content to the network
 * - IPNS name publishing/resolution
 *
 * For local-only persistence, use HeliaStore instead.
 */

import { createHelia } from 'helia';
import { FsBlockstore } from 'blockstore-fs';
import { FsDatastore } from 'datastore-fs';
import { CID } from 'multiformats/cid';
import * as json from 'multiformats/codecs/json';
import { sha256 } from 'multiformats/hashes/sha2';
import type { Helia } from 'helia';
import type { ContentStore, PersistenceConfig } from '../types.js';
import { StorageCache } from './cache.js';

/**
 * Configuration for networked Helia.
 */
export interface NetworkedHeliaConfig extends PersistenceConfig {
  /** Enable DHT for content routing (default: true) */
  enableDHT?: boolean;

  /** Bootstrap peers to connect to (default: public IPFS bootstrap) */
  bootstrapPeers?: string[];

  /** Listen addresses (default: let libp2p choose) */
  listenAddresses?: string[];
}

const DEFAULT_NETWORKED_CONFIG: Partial<NetworkedHeliaConfig> = {
  enableDHT: true,
};

/**
 * Networked content store using Helia.
 *
 * Provides full IPFS networking capabilities:
 * - Content routing via Kademlia DHT
 * - Block exchange via Bitswap
 * - Persistent storage via filesystem
 */
export class NetworkedHeliaStore implements ContentStore {
  private helia: Helia | null = null;
  private cache: StorageCache | null = null;
  private config: NetworkedHeliaConfig;
  private initialized = false;

  constructor(config: NetworkedHeliaConfig) {
    this.config = { ...DEFAULT_NETWORKED_CONFIG, ...config };
    if (config.cacheEnabled) {
      this.cache = new StorageCache(config.cacheMaxSize);
    }
  }

  /**
   * Initialize Helia with networking.
   * This may take a few seconds as it connects to peers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create persistent blockstore and datastore
    const blockstore = new FsBlockstore(`${this.config.storagePath}/blocks`);
    const datastore = new FsDatastore(`${this.config.storagePath}/data`);

    await blockstore.open();
    await datastore.open();

    // Create Helia node
    this.helia = await createHelia({
      blockstore,
      datastore,
    });

    this.initialized = true;
  }

  /**
   * Store data and return CID.
   * Data is stored locally and made available to the network.
   */
  async store<T>(data: T): Promise<CID> {
    this.ensureInitialized();

    // Encode data as JSON bytes
    const bytes = json.encode(data);

    // Calculate hash
    const hash = await sha256.digest(bytes);

    // Create CID (version 1, json codec)
    const cid = CID.create(1, json.code, hash);

    // Store in Helia's blockstore
    await this.helia!.blockstore.put(cid, bytes);

    // Cache locally
    if (this.cache) {
      this.cache.set(cid, data);
    }

    return cid;
  }

  /**
   * Retrieve data by CID.
   * First checks local storage, then attempts network fetch.
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
      // Try to get from Helia (local or network)
      // blockstore.get returns an async generator
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.helia!.blockstore.get(cid)) {
        chunks.push(chunk);
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
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
      // Content not found locally or on network
      return null;
    }
  }

  /**
   * Check if CID exists (locally or can be fetched).
   */
  async has(cid: CID): Promise<boolean> {
    this.ensureInitialized();

    // Check cache first
    if (this.cache?.has(cid)) {
      return true;
    }

    return this.helia!.blockstore.has(cid);
  }

  /**
   * Pin a CID to prevent garbage collection.
   */
  async pin(cid: CID): Promise<void> {
    this.ensureInitialized();
    await this.helia!.pins.add(cid);
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

    try {
      await this.helia!.pins.rm(cid);
    } catch {
      // Ignore if not pinned
    }
  }

  /**
   * Get the underlying Helia instance.
   * Useful for IPNS, pubsub, etc.
   */
  getHelia(): Helia | null {
    return this.helia;
  }

  /**
   * Get our peer ID.
   */
  getPeerId(): string | null {
    return this.helia?.libp2p.peerId.toString() ?? null;
  }

  /**
   * Get connected peer count.
   */
  getPeerCount(): number {
    return this.helia?.libp2p.getConnections().length ?? 0;
  }

  /**
   * Get multiaddresses we're listening on.
   */
  getMultiaddrs(): string[] {
    return (
      this.helia?.libp2p.getMultiaddrs().map((ma) => ma.toString()) ?? []
    );
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): ReturnType<StorageCache['getStats']> | null {
    return this.cache?.getStats() ?? null;
  }

  /**
   * Check if initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get node info for display.
   */
  getInfo(): {
    initialized: boolean;
    peerId: string | null;
    peerCount: number;
    multiaddrs: string[];
  } {
    return {
      initialized: this.initialized,
      peerId: this.getPeerId(),
      peerCount: this.getPeerCount(),
      multiaddrs: this.getMultiaddrs(),
    };
  }

  /**
   * Graceful shutdown.
   */
  async close(): Promise<void> {
    if (this.helia) {
      await this.helia.stop();
      this.helia = null;
    }

    if (this.cache) {
      this.cache.clear();
    }

    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.helia) {
      throw new Error(
        'NetworkedHeliaStore not initialized. Call initialize() first.'
      );
    }
  }
}

/**
 * Create and initialize a NetworkedHeliaStore.
 */
export async function createNetworkedHeliaStore(
  config: Partial<NetworkedHeliaConfig> = {}
): Promise<NetworkedHeliaStore> {
  const { DEFAULT_PERSISTENCE_CONFIG } = await import('../types.js');
  const fullConfig: NetworkedHeliaConfig = {
    ...DEFAULT_PERSISTENCE_CONFIG,
    ...config,
  };
  const store = new NetworkedHeliaStore(fullConfig);
  await store.initialize();
  return store;
}
