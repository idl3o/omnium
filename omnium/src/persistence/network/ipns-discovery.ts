/**
 * IPNS Discovery Layer
 *
 * Mutable names pointing to immutable content.
 *
 * IPNS (InterPlanetary Name System) provides the discovery mechanism for
 * content-addressed sync. Each node publishes their head CID under their
 * IPNS name. Others can resolve this name to find the current state.
 *
 * The flow:
 * 1. Node creates/updates state → publish snapshot → get head CID
 * 2. Node publishes head CID to IPNS → others can discover it
 * 3. Resolver asks "what is node X's current state?" → resolves IPNS → gets CID
 * 4. Resolver fetches CID → compares chains → syncs if needed
 *
 * Key insight: IPNS is just the discovery layer. The actual data lives in
 * content-addressed storage (IPFS/Helia). IPNS just points to where to start.
 */

import { CID } from 'multiformats/cid';
import type { IPNS, PublishOptions, ResolveOptions } from '@helia/ipns';
import type { PublicKey, PeerId } from '@libp2p/interface';
import type { ContentSync, SyncResult, SnapshotApplier, SnapshotMerger } from './content-sync.js';

/**
 * Result of publishing to IPNS.
 */
export interface PublishResult {
  /** Whether publish succeeded */
  success: boolean;

  /** The IPNS name (public key) */
  name?: string;

  /** The CID that was published */
  cid?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of resolving an IPNS name.
 */
export interface ResolveResult {
  /** Whether resolution succeeded */
  success: boolean;

  /** The resolved CID */
  cid?: string;

  /** Any path component */
  path?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * A known peer's IPNS name for discovery.
 */
export interface KnownPeer {
  /** Human-readable name */
  name: string;

  /** IPNS key (public key or CID) */
  ipnsKey: string;

  /** When we last synced from this peer */
  lastSync?: number;

  /** Their last known height */
  lastKnownHeight?: number;
}

/**
 * Configuration for IPNSDiscovery.
 */
export interface IPNSDiscoveryConfig {
  /** Key name in the libp2p keychain for publishing */
  keyName: string;

  /** How long the IPNS record is valid (ms) - default 24h */
  lifetime?: number;

  /** TTL for caching (ms) - default 5 min */
  ttl?: number;
}

const DEFAULT_CONFIG: Required<IPNSDiscoveryConfig> = {
  keyName: 'omnium-head',
  lifetime: 24 * 60 * 60 * 1000, // 24 hours
  ttl: 5 * 60 * 1000, // 5 minutes
};

/**
 * IPNS-based discovery for Omnium.
 *
 * Usage:
 * ```typescript
 * import { ipns } from '@helia/ipns';
 * import { createHelia } from 'helia';
 *
 * const helia = await createHelia();
 * const name = ipns(helia);
 *
 * const discovery = new IPNSDiscovery(name, contentSync, {
 *   keyName: 'my-omnium-node'
 * });
 *
 * // Publish current state
 * await discovery.publishHead();
 *
 * // Discover and sync from a peer
 * const result = await discovery.discoverAndSync(peerKey, applySnapshot);
 * ```
 */
export class IPNSDiscovery {
  private ipns: IPNS;
  private sync: ContentSync;
  private config: Required<IPNSDiscoveryConfig>;
  private knownPeers: Map<string, KnownPeer> = new Map();
  private lastPublish?: { name: string; cid: string; timestamp: number };

  constructor(
    ipns: IPNS,
    sync: ContentSync,
    config: Partial<IPNSDiscoveryConfig> = {}
  ) {
    this.ipns = ipns;
    this.sync = sync;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Publish current head to IPNS.
   * Call this whenever local state changes.
   */
  async publishHead(options?: Partial<PublishOptions>): Promise<PublishResult> {
    const headCid = this.sync.getHeadCid();

    if (!headCid) {
      return {
        success: false,
        error: 'No state to publish',
      };
    }

    try {
      const cid = CID.parse(headCid);

      const result = await this.ipns.publish(this.config.keyName, cid, {
        lifetime: options?.lifetime ?? this.config.lifetime,
        ttl: options?.ttl ?? this.config.ttl,
        ...options,
      });

      const name = publicKeyToString(result.publicKey);

      this.lastPublish = {
        name,
        cid: headCid,
        timestamp: Date.now(),
      };

      return {
        success: true,
        name,
        cid: headCid,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Resolve an IPNS name to get the current head CID.
   */
  async resolveHead(
    key: string | PublicKey | PeerId | CID,
    options?: Partial<ResolveOptions>
  ): Promise<ResolveResult> {
    try {
      const ipnsKey = typeof key === 'string' ? CID.parse(key) : key;

      const result = await this.ipns.resolve(
        ipnsKey as CID<unknown, 0x72, 0x00 | 0x12, 1>,
        options
      );

      return {
        success: true,
        cid: result.cid.toString(),
        path: result.path,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Discover a peer's current state and sync from it.
   *
   * This is the main entry point for discovery-based sync:
   * 1. Resolve the peer's IPNS name to get their head CID
   * 2. Use ContentSync to compare and sync
   */
  async discoverAndSync(
    peerKey: string | PublicKey | PeerId | CID,
    applySnapshot: SnapshotApplier,
    mergeSnapshots?: SnapshotMerger,
    resolveOptions?: Partial<ResolveOptions>
  ): Promise<{ resolve: ResolveResult; sync?: SyncResult }> {
    // First, resolve the IPNS name
    const resolved = await this.resolveHead(peerKey, resolveOptions);

    if (!resolved.success || !resolved.cid) {
      return { resolve: resolved };
    }

    // Then sync from the resolved CID
    const syncResult = await this.sync.syncFrom(
      resolved.cid,
      applySnapshot,
      mergeSnapshots
    );

    // Update known peer info
    const keyStr = typeof peerKey === 'string' ? peerKey : peerKey.toString();
    const existing = this.knownPeers.get(keyStr);
    if (existing) {
      existing.lastSync = Date.now();
      existing.lastKnownHeight = this.sync.getHeight();
    }

    return { resolve: resolved, sync: syncResult };
  }

  /**
   * Add a known peer for discovery.
   */
  addKnownPeer(peer: KnownPeer): void {
    this.knownPeers.set(peer.ipnsKey, peer);
  }

  /**
   * Remove a known peer.
   */
  removeKnownPeer(ipnsKey: string): boolean {
    return this.knownPeers.delete(ipnsKey);
  }

  /**
   * Get all known peers.
   */
  getKnownPeers(): KnownPeer[] {
    return Array.from(this.knownPeers.values());
  }

  /**
   * Sync from all known peers.
   * Returns results for each peer.
   */
  async syncFromAllPeers(
    applySnapshot: SnapshotApplier,
    mergeSnapshots?: SnapshotMerger
  ): Promise<Map<string, { resolve: ResolveResult; sync?: SyncResult }>> {
    const results = new Map<
      string,
      { resolve: ResolveResult; sync?: SyncResult }
    >();

    for (const peer of this.knownPeers.values()) {
      const result = await this.discoverAndSync(
        peer.ipnsKey,
        applySnapshot,
        mergeSnapshots
      );
      results.set(peer.ipnsKey, result);
    }

    return results;
  }

  /**
   * Get our own IPNS name (if we've published).
   */
  getOwnName(): string | null {
    return this.lastPublish?.name ?? null;
  }

  /**
   * Get last publish info.
   */
  getLastPublish(): { name: string; cid: string; timestamp: number } | null {
    return this.lastPublish ?? null;
  }

  /**
   * Get discovery info for debugging/display.
   */
  getInfo(): {
    keyName: string;
    ownName: string | null;
    lastPublish: { cid: string; timestamp: number } | null;
    knownPeers: number;
    syncInfo: ReturnType<ContentSync['getInfo']>;
  } {
    return {
      keyName: this.config.keyName,
      ownName: this.getOwnName(),
      lastPublish: this.lastPublish
        ? { cid: this.lastPublish.cid, timestamp: this.lastPublish.timestamp }
        : null,
      knownPeers: this.knownPeers.size,
      syncInfo: this.sync.getInfo(),
    };
  }
}

/**
 * Convert a PublicKey to a string representation.
 */
function publicKeyToString(publicKey: PublicKey): string {
  // PublicKey has a toCID() method that gives us a CID
  return publicKey.toCID().toString();
}

/**
 * Create an IPNSDiscovery instance.
 */
export function createIPNSDiscovery(
  ipns: IPNS,
  sync: ContentSync,
  config?: Partial<IPNSDiscoveryConfig>
): IPNSDiscovery {
  return new IPNSDiscovery(ipns, sync, config);
}

/**
 * Helper: Create a share URL for discovery.
 *
 * Users can share this URL to let others sync from them.
 * Format: omnium://discover/<ipns-key>
 */
export function createDiscoveryUrl(ipnsKey: string): string {
  return `omnium://discover/${ipnsKey}`;
}

/**
 * Helper: Parse a discovery URL.
 * Returns the IPNS key or null if invalid.
 */
export function parseDiscoveryUrl(url: string): string | null {
  const match = url.match(/^omnium:\/\/discover\/(.+)$/);
  return match ? match[1] : null;
}
