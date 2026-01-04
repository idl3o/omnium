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
import {
  BlockchainAnchor,
  createBlockchainAnchor,
  type BlockchainProvider,
  type AnchorConfig,
  type CheckpointResult,
  type LockResult,
  type MerkleProof,
  cidToBytes32,
} from './anchor/index.js';

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

  /** Blockchain anchor configuration (optional) */
  anchor?: {
    /** RPC URL for the blockchain */
    rpcUrl: string;
    /** Contract address */
    contractAddress: string;
    /** Private key for signing transactions */
    privateKey?: string;
    /** Chain ID */
    chainId: number;
    /** Auto-checkpoint interval (in saves) */
    checkpointInterval?: number;
  };
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
  private _anchor: BlockchainAnchor | null = null;
  private savesSinceCheckpoint = 0;

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
   * Check if blockchain anchoring is enabled.
   */
  get isAnchored(): boolean {
    return this._anchor !== null;
  }

  /**
   * Get the blockchain anchor instance.
   */
  get anchor(): BlockchainAnchor | null {
    return this._anchor;
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
  // BLOCKCHAIN ANCHORING
  // ===========================================================================

  /**
   * Initialize blockchain anchor.
   * Call this with a provider to enable on-chain anchoring.
   */
  async initializeAnchor(provider: BlockchainProvider): Promise<void> {
    if (!this.config.anchor) {
      throw new Error('Anchor config not provided');
    }

    const nodeIdBytes = this.nodeIdToBytes32();

    this._anchor = createBlockchainAnchor(
      {
        rpcUrl: this.config.anchor.rpcUrl,
        contractAddress: this.config.anchor.contractAddress,
        privateKey: this.config.anchor.privateKey,
        chainId: this.config.anchor.chainId,
        nodeId: nodeIdBytes,
        checkpointInterval: this.config.anchor.checkpointInterval,
      },
      provider
    );

    // Check if node is registered
    const isRegistered = await this._anchor.isNodeRegistered();
    if (!isRegistered) {
      // Auto-register if we have write access
      const result = await this._anchor.registerNode();
      if (!result.success) {
        console.warn('[OmniumNode] Failed to register node on-chain:', result.error);
      }
    }
  }

  /**
   * Convert node ID to bytes32 for contract.
   */
  private nodeIdToBytes32(): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(this.nodeId);
    // Pad or truncate to 32 bytes
    const padded = new Uint8Array(32);
    padded.set(bytes.slice(0, 32));
    return '0x' + Array.from(padded).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Anchor current state to blockchain.
   * Creates a checkpoint with provenance Merkle root.
   */
  async anchorState(): Promise<CheckpointResult> {
    if (!this._anchor) {
      return { success: false, error: 'Anchor not initialized' };
    }

    // Get current head CID
    const headCid = this.getHeadCid();
    if (!headCid) {
      return { success: false, error: 'No head CID - save first' };
    }

    // Get snapshot
    const snapshot = createSnapshot(this._ledger);

    // Store snapshot to get its CID
    const snapshotCid = await this.store.store(snapshot);

    // Create checkpoint
    return this._anchor.createCheckpoint(
      CID.parse(headCid),
      snapshotCid,
      {
        height: this.getHeight(),
        totalSupply: snapshot.pool?.reserve ?? 0,
        unitCount: snapshot.units?.length ?? 0,
        units: (snapshot.units ?? []).map(u => ({
          id: u.id,
          provenance: u.provenance.map(p => ({
            unitId: u.id,
            timestamp: p.timestamp,
            type: p.type,
            fromWallet: p.fromWallet,
            toWallet: p.toWallet,
            amount: p.amount,
            note: p.note,
          })),
        })),
      }
    );
  }

  /**
   * Update head CID on-chain (lightweight, no checkpoint).
   */
  async anchorHead(): Promise<{ success: boolean; error?: string }> {
    if (!this._anchor) {
      return { success: false, error: 'Anchor not initialized' };
    }

    const headCid = this.getHeadCid();
    if (!headCid) {
      return { success: false, error: 'No head CID' };
    }

    return this._anchor.updateHead(CID.parse(headCid), this.getHeight());
  }

  /**
   * Resolve head CID from on-chain (trustless IPNS alternative).
   */
  async resolveAnchoredHead(nodeId?: string): Promise<string | null> {
    if (!this._anchor) {
      return null;
    }
    return this._anchor.resolveHead(nodeId);
  }

  /**
   * Create a temporal lock on-chain (T0 → T2/T∞).
   */
  async createTemporalLock(
    unitId: string,
    amount: number,
    toStratum: 'T2' | 'TInfinity',
    lockDurationYears?: number
  ): Promise<LockResult> {
    if (!this._anchor) {
      return { success: false, error: 'Anchor not initialized' };
    }

    // Get unit CID
    const unit = this._ledger.getUnit(unitId);
    if (!unit) {
      return { success: false, error: 'Unit not found' };
    }

    // Store unit to get CID
    const unitCid = await this.store.store(unit);

    return this._anchor.createTemporalLock(
      unitCid,
      amount,
      toStratum,
      lockDurationYears
    );
  }

  /**
   * Release a temporal lock on-chain.
   */
  async releaseTemporalLock(lockId: string): Promise<{ success: boolean; error?: string }> {
    if (!this._anchor) {
      return { success: false, error: 'Anchor not initialized' };
    }

    return this._anchor.releaseTemporalLock(lockId);
  }

  /**
   * Generate a provenance proof for a unit.
   */
  generateProvenanceProof(unitId: string, provenanceIndex: number): MerkleProof | null {
    if (!this._anchor) {
      return null;
    }

    // The anchor builds the tree during checkpointing
    // This returns a proof from the last checkpoint's tree
    return this._anchor.generateProvenanceProof(provenanceIndex);
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
    anchored: boolean;
    height: number;
    headCid: string | null;
    ipnsName: string | null;
    peerCount: number;
    knownPeers: number;
    anchorContract: string | null;
  } {
    const networkedStore = this.store as NetworkedHeliaStore;

    return {
      nodeId: this.nodeId,
      networked: this.isNetworked,
      anchored: this.isAnchored,
      height: this.getHeight(),
      headCid: this.getHeadCid(),
      ipnsName: this.discovery?.getOwnName() ?? null,
      peerCount: networkedStore.getPeerCount?.() ?? 0,
      knownPeers: this.discovery?.getKnownPeers().length ?? 0,
      anchorContract: this.config.anchor?.contractAddress ?? null,
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
