/**
 * OMNIUM Node
 *
 * The unified entry point for running an Omnium node.
 * Ties together storage, ledger, sync, and discovery.
 *
 * Usage:
 * ```typescript
 * const node = await createOmniumNode({
 *   storagePath: './.omnium-data',
 *   nodeId: 'my-node',
 *   networked: true, // Enable P2P networking
 * });
 *
 * // Mint some currency
 * node.ledger.mint('wallet-1', 1000);
 *
 * // Save state
 * await node.save();
 *
 * // Publish to network
 * await node.publish();
 *
 * // Sync from a peer
 * await node.syncFrom(peerIpnsKey);
 *
 * // Cleanup
 * await node.stop();
 * ```
 */

import { ipns } from '@helia/ipns';
import type { IPNS } from '@helia/ipns';
import { CID } from 'multiformats/cid';
import { OmniumLedger, createLedger } from './engine/ledger.js';
import { HeliaStore } from './persistence/storage/helia-store.js';
import {
  NetworkedHeliaStore,
  createNetworkedHeliaStore,
} from './persistence/storage/networked-helia-store.js';
import { ChainStore, createChainStore } from './persistence/network/cid-chain.js';
import {
  ContentSync,
  createContentSync,
  SyncResult,
} from './persistence/network/content-sync.js';
import {
  IPNSDiscovery,
  createIPNSDiscovery,
  KnownPeer,
} from './persistence/network/ipns-discovery.js';
import { createSnapshot, restoreFromSnapshot } from './persistence/manager/snapshot.js';
import type { ContentStore, LedgerSnapshot, PersistenceConfig } from './persistence/types.js';
import { DEFAULT_PERSISTENCE_CONFIG } from './persistence/types.js';

/**
 * Configuration for OmniumNode.
 */
export interface OmniumNodeConfig extends Partial<PersistenceConfig> {
  /** Unique identifier for this node */
  nodeId?: string;

  /** Enable P2P networking (default: false for local-only) */
  networked?: boolean;

  /** IPNS key name for publishing (default: 'omnium-head') */
  ipnsKeyName?: string;
}

const DEFAULT_NODE_CONFIG: OmniumNodeConfig = {
  ...DEFAULT_PERSISTENCE_CONFIG,
  nodeId: `omnium-${Date.now().toString(36)}`,
  networked: false,
  ipnsKeyName: 'omnium-head',
};

/**
 * OmniumNode - The complete Omnium runtime.
 *
 * Provides:
 * - Ledger operations (mint, transfer, convert)
 * - Persistent storage (local or networked)
 * - State synchronization
 * - IPNS-based discovery
 */
export class OmniumNode {
  private store: ContentStore;
  private chain: ChainStore;
  private contentSync: ContentSync;
  private ipnsInstance: IPNS | null = null;
  private discovery: IPNSDiscovery | null = null;
  private config: OmniumNodeConfig;
  private _ledger: OmniumLedger;
  private initialized = false;

  /**
   * Create an OmniumNode.
   * Use createOmniumNode() for automatic initialization.
   */
  constructor(
    store: ContentStore,
    ledger: OmniumLedger,
    config: OmniumNodeConfig
  ) {
    this.store = store;
    this._ledger = ledger;
    this.config = config;
    this.chain = createChainStore(store);
    this.contentSync = createContentSync(store, this.chain, {
      nodeId: config.nodeId,
    });
  }

  /**
   * Initialize networking (if enabled).
   * Called automatically by createOmniumNode().
   */
  async initializeNetworking(): Promise<void> {
    if (!this.config.networked) return;
    if (this.initialized) return;

    // Get Helia instance for IPNS
    const networkedStore = this.store as NetworkedHeliaStore;
    const helia = networkedStore.getHelia();

    if (helia) {
      try {
        // IPNS requires keychain - cast to any to bypass strict typing
        // The actual runtime will work if keychain is available
        this.ipnsInstance = ipns(helia as never);
        this.discovery = createIPNSDiscovery(
          this.ipnsInstance,
          this.contentSync,
          { keyName: this.config.ipnsKeyName }
        );
      } catch (err) {
        // IPNS not available - discovery will be null
        console.warn('[OmniumNode] IPNS not available:', err);
      }
    }

    this.initialized = true;
  }

  /**
   * Get the ledger for operations.
   */
  get ledger(): OmniumLedger {
    return this._ledger;
  }

  /**
   * Get the content sync instance.
   */
  get sync(): ContentSync {
    return this.contentSync;
  }

  /**
   * Check if networking is enabled.
   */
  get isNetworked(): boolean {
    return this.config.networked === true && this.discovery !== null;
  }

  /**
   * Get our node ID.
   */
  get nodeId(): string {
    return this.config.nodeId ?? 'unknown';
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  /**
   * Save current state to storage.
   * Returns the head CID.
   */
  async save(): Promise<string> {
    const snapshot = createSnapshot(this._ledger);
    const headCid = await this.contentSync.publish(snapshot);
    return headCid;
  }

  /**
   * Load state from a CID.
   */
  async load(headCid: string): Promise<void> {
    await this.contentSync.initializeFrom(headCid);
    const snapshot = await this.contentSync.fetchSnapshotFromPointer(headCid);
    if (snapshot) {
      this._ledger = restoreFromSnapshot(snapshot);
    }
  }

  /**
   * Get current head CID (if any).
   */
  getHeadCid(): string | null {
    return this.contentSync.getHeadCid();
  }

  /**
   * Get current chain height.
   */
  getHeight(): number {
    return this.contentSync.getHeight();
  }

  // ===========================================================================
  // NETWORKING / SYNC
  // ===========================================================================

  /**
   * Publish current state to IPNS.
   * Requires networking to be enabled.
   */
  async publish(): Promise<{ success: boolean; name?: string; error?: string }> {
    if (!this.discovery) {
      return { success: false, error: 'Networking not enabled' };
    }

    // First save to get latest head
    await this.save();

    // Then publish to IPNS
    return this.discovery.publishHead();
  }

  /**
   * Sync from a remote peer via IPNS key.
   * Requires networking to be enabled.
   */
  async syncFromPeer(
    ipnsKey: string
  ): Promise<{ resolve: { success: boolean }; sync?: SyncResult }> {
    if (!this.discovery) {
      return { resolve: { success: false } };
    }

    const applySnapshot = async (snapshot: LedgerSnapshot) => {
      this._ledger = restoreFromSnapshot(snapshot);
    };

    return this.discovery.discoverAndSync(ipnsKey, applySnapshot);
  }

  /**
   * Sync from a raw CID (no IPNS resolution needed).
   */
  async syncFromCid(remoteCid: string): Promise<SyncResult> {
    const applySnapshot = async (snapshot: LedgerSnapshot) => {
      this._ledger = restoreFromSnapshot(snapshot);
    };

    return this.contentSync.syncFrom(remoteCid, applySnapshot);
  }

  /**
   * Compare local state with a remote CID.
   */
  async compare(
    remoteCid: string
  ): Promise<{ relationship: string; heightDiff: number }> {
    const comparison = await this.contentSync.compare(remoteCid);
    return {
      relationship: comparison.relationship,
      heightDiff: comparison.heightDiff,
    };
  }

  // ===========================================================================
  // PEER MANAGEMENT
  // ===========================================================================

  /**
   * Add a known peer for discovery.
   */
  addPeer(peer: KnownPeer): void {
    this.discovery?.addKnownPeer(peer);
  }

  /**
   * Remove a known peer.
   */
  removePeer(ipnsKey: string): boolean {
    return this.discovery?.removeKnownPeer(ipnsKey) ?? false;
  }

  /**
   * Get all known peers.
   */
  getPeers(): KnownPeer[] {
    return this.discovery?.getKnownPeers() ?? [];
  }

  /**
   * Sync from all known peers.
   */
  async syncFromAllPeers(): Promise<Map<string, SyncResult>> {
    if (!this.discovery) {
      return new Map();
    }

    const applySnapshot = async (snapshot: LedgerSnapshot) => {
      this._ledger = restoreFromSnapshot(snapshot);
    };

    const results = await this.discovery.syncFromAllPeers(applySnapshot);

    // Extract just the sync results
    const syncResults = new Map<string, SyncResult>();
    for (const [key, result] of results) {
      if (result.sync) {
        syncResults.set(key, result.sync);
      }
    }
    return syncResults;
  }

  // ===========================================================================
  // INFO / STATUS
  // ===========================================================================

  /**
   * Get node info for display.
   */
  getInfo(): {
    nodeId: string;
    networked: boolean;
    height: number;
    headCid: string | null;
    ipnsName: string | null;
    peerCount: number;
    knownPeers: number;
  } {
    const networkedStore = this.store as NetworkedHeliaStore;

    return {
      nodeId: this.nodeId,
      networked: this.isNetworked,
      height: this.getHeight(),
      headCid: this.getHeadCid(),
      ipnsName: this.discovery?.getOwnName() ?? null,
      peerCount: networkedStore.getPeerCount?.() ?? 0,
      knownPeers: this.discovery?.getKnownPeers().length ?? 0,
    };
  }

  /**
   * Get the discovery URL for sharing.
   */
  getDiscoveryUrl(): string | null {
    const name = this.discovery?.getOwnName();
    if (!name) return null;
    return `omnium://discover/${name}`;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Stop the node gracefully.
   */
  async stop(): Promise<void> {
    // Close the store (handles Helia shutdown)
    if ('close' in this.store) {
      await (this.store as HeliaStore | NetworkedHeliaStore).close();
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create and initialize an OmniumNode.
 *
 * @example Local-only node
 * ```typescript
 * const node = await createOmniumNode({
 *   storagePath: './.omnium-data',
 * });
 * ```
 *
 * @example Networked node
 * ```typescript
 * const node = await createOmniumNode({
 *   storagePath: './.omnium-data',
 *   networked: true,
 *   nodeId: 'my-unique-node-id',
 * });
 * ```
 */
export async function createOmniumNode(
  config: Partial<OmniumNodeConfig> = {}
): Promise<OmniumNode> {
  const fullConfig: OmniumNodeConfig = { ...DEFAULT_NODE_CONFIG, ...config };

  // Create appropriate store based on networking config
  let store: ContentStore;

  if (fullConfig.networked) {
    // Networked store with full Helia
    store = await createNetworkedHeliaStore({
      storagePath: fullConfig.storagePath ?? DEFAULT_PERSISTENCE_CONFIG.storagePath,
      cacheEnabled: fullConfig.cacheEnabled ?? DEFAULT_PERSISTENCE_CONFIG.cacheEnabled,
      cacheMaxSize: fullConfig.cacheMaxSize ?? DEFAULT_PERSISTENCE_CONFIG.cacheMaxSize,
      autoSave: fullConfig.autoSave ?? DEFAULT_PERSISTENCE_CONFIG.autoSave,
      txLogBatchSize: fullConfig.txLogBatchSize ?? DEFAULT_PERSISTENCE_CONFIG.txLogBatchSize,
    });
  } else {
    // Local-only store
    const { createHeliaStore } = await import('./persistence/storage/helia-store.js');
    store = await createHeliaStore({
      storagePath: fullConfig.storagePath ?? DEFAULT_PERSISTENCE_CONFIG.storagePath,
      cacheEnabled: fullConfig.cacheEnabled ?? DEFAULT_PERSISTENCE_CONFIG.cacheEnabled,
      cacheMaxSize: fullConfig.cacheMaxSize ?? DEFAULT_PERSISTENCE_CONFIG.cacheMaxSize,
      autoSave: fullConfig.autoSave ?? DEFAULT_PERSISTENCE_CONFIG.autoSave,
      txLogBatchSize: fullConfig.txLogBatchSize ?? DEFAULT_PERSISTENCE_CONFIG.txLogBatchSize,
    });
  }

  // Create fresh ledger
  const ledger = createLedger();

  // Create node
  const node = new OmniumNode(store, ledger, fullConfig);

  // Initialize networking if enabled
  await node.initializeNetworking();

  return node;
}

/**
 * Create an OmniumNode from an existing snapshot CID.
 */
export async function createOmniumNodeFromCid(
  headCid: string,
  config: Partial<OmniumNodeConfig> = {}
): Promise<OmniumNode> {
  const node = await createOmniumNode(config);
  await node.load(headCid);
  return node;
}
