/**
 * OMNIUM Pubsub Configuration
 *
 * Defines topics for P2P message broadcasting.
 * Used by libp2p gossipsub for ledger synchronization.
 */

/**
 * Pubsub topic identifiers.
 * Follow the pattern: /omnium/{resource}/{version}
 */
export const PUBSUB_TOPICS = {
  /** New transaction broadcasts */
  TRANSACTIONS: '/omnium/transactions/1.0.0',

  /** Snapshot announcements (new checkpoint available) */
  SNAPSHOTS: '/omnium/snapshots/1.0.0',

  /** Peer discovery and heartbeat */
  PRESENCE: '/omnium/presence/1.0.0',

  /** Sync requests (request specific CIDs) */
  SYNC_REQUESTS: '/omnium/sync/1.0.0',
} as const;

export type PubsubTopic = (typeof PUBSUB_TOPICS)[keyof typeof PUBSUB_TOPICS];

/**
 * Get all topics as an array for subscription.
 */
export function getAllTopics(): PubsubTopic[] {
  return Object.values(PUBSUB_TOPICS);
}

/**
 * Configuration for pubsub behavior.
 */
export interface PubsubConfig {
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval: number;

  /** Message TTL in ms (default: 60000) */
  messageTtl: number;

  /** Max message size in bytes (default: 1MB) */
  maxMessageSize: number;
}

export const DEFAULT_PUBSUB_CONFIG: PubsubConfig = {
  heartbeatInterval: 30000,
  messageTtl: 60000,
  maxMessageSize: 1024 * 1024,
};
