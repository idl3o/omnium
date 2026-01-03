/**
 * OMNIUM Network Layer
 *
 * Content-addressed synchronization for OMNIUM.
 *
 * Core concept: Instead of maintaining peer connections and pushing state,
 * we build chains of content-addressed pointers. Sync is just "fetch by CID."
 *
 * New architecture (content-addressed):
 * - ChainStore: Manages the linked list of StatePointers
 * - ContentSync: High-level sync operations (publish, compare, sync)
 *
 * Legacy architecture (pubsub-based, deprecated):
 * - SyncProtocol: Peer-to-peer sync via pubsub (stub implementation)
 */

// Content-addressed sync (primary)
export * from './cid-chain.js';
export * from './content-sync.js';
export * from './ipns-discovery.js';

// Legacy pubsub (deprecated, kept for reference)
export * from './pubsub-config.js';
export * from './message-types.js';
export * from './sync-protocol.js';
