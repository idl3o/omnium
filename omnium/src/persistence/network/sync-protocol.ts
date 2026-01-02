/**
 * OMNIUM Sync Protocol
 *
 * Skeleton for P2P ledger synchronization.
 * This is a placeholder for future implementation.
 *
 * Future features:
 * - Subscribe to transaction broadcasts
 * - Announce new snapshots to peers
 * - Request missing CIDs from peers
 * - Handle conflict resolution
 * - Merkle-based state verification
 */

import type { Helia } from 'helia';
import { PUBSUB_TOPICS } from './pubsub-config.js';
import {
  NetworkMessageType,
  type NetworkMessage,
  type SnapshotAnnouncementMessage,
  type PeerAnnounceMessage,
  createBaseMessage,
} from './message-types.js';

/**
 * Peer info for tracking connected nodes.
 */
export interface PeerInfo {
  peerId: string;
  lastSeen: number;
  latestSnapshotCid?: string;
  blockHeight: number;
}

/**
 * Sync protocol configuration.
 */
export interface SyncConfig {
  /** Enable automatic sync on new peer connection */
  autoSync: boolean;

  /** Announce presence interval in ms */
  announceInterval: number;

  /** Max peers to track */
  maxPeers: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSync: true,
  announceInterval: 60000,
  maxPeers: 50,
};

/**
 * P2P sync protocol for OMNIUM ledger.
 *
 * PLACEHOLDER IMPLEMENTATION
 *
 * Future implementation will:
 * 1. Subscribe to transaction broadcasts
 * 2. Announce new snapshots to peers
 * 3. Request missing CIDs from peers
 * 4. Handle conflict resolution via CRDT merging
 */
export class SyncProtocol {
  private helia: Helia | null = null;
  private peerId: string = '';
  private peers: Map<string, PeerInfo> = new Map();
  private config: SyncConfig;
  private running = false;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  /**
   * Initialize with Helia instance.
   * Call this when networking is enabled.
   */
  async initialize(helia: Helia): Promise<void> {
    this.helia = helia;
    this.peerId = helia.libp2p.peerId.toString();
  }

  /**
   * Start the sync protocol.
   * Subscribes to topics and begins peer discovery.
   */
  async start(): Promise<void> {
    if (!this.helia) {
      throw new Error('SyncProtocol not initialized. Call initialize() first.');
    }

    if (this.running) return;

    // TODO: Subscribe to all topics
    // TODO: Set up message handlers
    // TODO: Start announce interval

    this.running = true;
  }

  /**
   * Stop the sync protocol.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    // TODO: Unsubscribe from topics
    // TODO: Stop intervals
    // TODO: Announce departure

    this.running = false;
  }

  /**
   * Check if protocol is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get connected peer count.
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Get all known peers.
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Broadcast a new transaction to peers.
   */
  async broadcastTransaction(/* tx: Transaction */): Promise<void> {
    // TODO: Implement pubsub publish
    throw new Error('Not implemented: broadcastTransaction');
  }

  /**
   * Announce a new snapshot to peers.
   */
  async announceSnapshot(
    snapshotCid: string,
    blockHeight: number,
    totalSupply: number,
    unitCount: number
  ): Promise<void> {
    if (!this.helia || !this.running) return;

    const _message: SnapshotAnnouncementMessage = {
      ...createBaseMessage(NetworkMessageType.SNAPSHOT_ANNOUNCEMENT, this.peerId),
      type: NetworkMessageType.SNAPSHOT_ANNOUNCEMENT,
      snapshotCid,
      blockHeight,
      totalSupply,
      unitCount,
    };

    // TODO: Publish to PUBSUB_TOPICS.SNAPSHOTS
  }

  /**
   * Request sync from a peer.
   */
  async requestSync(_targetPeerId: string): Promise<void> {
    // TODO: Implement sync request
    throw new Error('Not implemented: requestSync');
  }

  /**
   * Announce presence to the network.
   */
  async announcePresence(
    latestSnapshotCid?: string,
    blockHeight: number = 0
  ): Promise<void> {
    if (!this.helia || !this.running) return;

    const _message: PeerAnnounceMessage = {
      ...createBaseMessage(NetworkMessageType.PEER_ANNOUNCE, this.peerId),
      type: NetworkMessageType.PEER_ANNOUNCE,
      capabilities: ['omnium-v1'],
      latestSnapshotCid,
      blockHeight,
    };

    // TODO: Publish to PUBSUB_TOPICS.PRESENCE
  }

  // --- Event Handlers (to be implemented) ---

  private async handleMessage(_topic: string, _message: NetworkMessage): Promise<void> {
    // TODO: Route to appropriate handler based on message type
  }

  private async handleNewTransaction(_message: NetworkMessage): Promise<void> {
    // TODO: Validate and apply transaction
  }

  private async handleSnapshotAnnouncement(_message: NetworkMessage): Promise<void> {
    // TODO: Compare with local state, request sync if behind
  }

  private async handlePeerAnnounce(_message: NetworkMessage): Promise<void> {
    // TODO: Track peer info
  }
}

/**
 * Create a sync protocol instance.
 * Does not initialize or start - caller must do that.
 */
export function createSyncProtocol(
  config: Partial<SyncConfig> = {}
): SyncProtocol {
  return new SyncProtocol(config);
}
