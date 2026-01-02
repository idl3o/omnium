/**
 * OMNIUM Network Message Types
 *
 * Defines the structure of messages broadcast over pubsub.
 * All messages are JSON-serializable.
 */

import type { Transaction } from '../../core/types.js';

/**
 * Message type identifiers.
 */
export enum NetworkMessageType {
  // Transaction messages
  NEW_TRANSACTION = 'NEW_TRANSACTION',
  TRANSACTION_BATCH = 'TRANSACTION_BATCH',

  // Snapshot messages
  SNAPSHOT_ANNOUNCEMENT = 'SNAPSHOT_ANNOUNCEMENT',
  SNAPSHOT_REQUEST = 'SNAPSHOT_REQUEST',

  // Sync messages
  SYNC_REQUEST = 'SYNC_REQUEST',
  SYNC_RESPONSE = 'SYNC_RESPONSE',

  // Presence messages
  PEER_ANNOUNCE = 'PEER_ANNOUNCE',
  PEER_LEAVE = 'PEER_LEAVE',
  HEARTBEAT = 'HEARTBEAT',
}

/**
 * Base message structure.
 * All network messages extend this.
 */
export interface BaseNetworkMessage {
  /** Message type identifier */
  type: NetworkMessageType;

  /** Sender peer ID */
  peerId: string;

  /** Message timestamp */
  timestamp: number;

  /** Optional signature for verification */
  signature?: string;
}

/**
 * New transaction broadcast.
 */
export interface NewTransactionMessage extends BaseNetworkMessage {
  type: NetworkMessageType.NEW_TRANSACTION;
  transaction: Transaction;
}

/**
 * Batch of transactions.
 */
export interface TransactionBatchMessage extends BaseNetworkMessage {
  type: NetworkMessageType.TRANSACTION_BATCH;
  transactions: Transaction[];
  blockCid?: string;
}

/**
 * Snapshot announcement.
 */
export interface SnapshotAnnouncementMessage extends BaseNetworkMessage {
  type: NetworkMessageType.SNAPSHOT_ANNOUNCEMENT;
  snapshotCid: string;
  blockHeight: number;
  totalSupply: number;
  unitCount: number;
}

/**
 * Request for a snapshot.
 */
export interface SnapshotRequestMessage extends BaseNetworkMessage {
  type: NetworkMessageType.SNAPSHOT_REQUEST;
  snapshotCid: string;
}

/**
 * Sync request for specific CIDs.
 */
export interface SyncRequestMessage extends BaseNetworkMessage {
  type: NetworkMessageType.SYNC_REQUEST;
  requestedCids: string[];
}

/**
 * Sync response with data.
 */
export interface SyncResponseMessage extends BaseNetworkMessage {
  type: NetworkMessageType.SYNC_RESPONSE;
  requestId: string;
  data: Record<string, unknown>;
}

/**
 * Peer announcement for discovery.
 */
export interface PeerAnnounceMessage extends BaseNetworkMessage {
  type: NetworkMessageType.PEER_ANNOUNCE;
  capabilities: string[];
  latestSnapshotCid?: string;
  blockHeight: number;
}

/**
 * Peer leaving network.
 */
export interface PeerLeaveMessage extends BaseNetworkMessage {
  type: NetworkMessageType.PEER_LEAVE;
  reason?: string;
}

/**
 * Heartbeat for liveness.
 */
export interface HeartbeatMessage extends BaseNetworkMessage {
  type: NetworkMessageType.HEARTBEAT;
  blockHeight: number;
  peerCount: number;
}

/**
 * Union of all network message types.
 */
export type NetworkMessage =
  | NewTransactionMessage
  | TransactionBatchMessage
  | SnapshotAnnouncementMessage
  | SnapshotRequestMessage
  | SyncRequestMessage
  | SyncResponseMessage
  | PeerAnnounceMessage
  | PeerLeaveMessage
  | HeartbeatMessage;

/**
 * Create a base message with common fields.
 */
export function createBaseMessage(
  type: NetworkMessageType,
  peerId: string
): BaseNetworkMessage {
  return {
    type,
    peerId,
    timestamp: Date.now(),
  };
}

/**
 * Validate a network message structure.
 */
export function isValidNetworkMessage(msg: unknown): msg is NetworkMessage {
  if (!msg || typeof msg !== 'object') return false;

  const m = msg as Record<string, unknown>;

  return (
    typeof m.type === 'string' &&
    typeof m.peerId === 'string' &&
    typeof m.timestamp === 'number'
  );
}
