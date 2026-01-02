/**
 * OMNIUM Persistence Layer Types
 *
 * Defines serializable versions of core types and persistence interfaces.
 * Sets are converted to Arrays for JSON compatibility.
 */

import type { CID } from 'multiformats/cid';
import type {
  ProvenanceEntry,
  Community,
  Transaction,
} from '../core/types.js';

// =============================================================================
// SERIALIZED TYPES (Sets → Arrays for JSON compatibility)
// =============================================================================

/**
 * Serializable version of OmniumUnit.
 * Sets converted to Arrays.
 */
export interface SerializedOmniumUnit {
  id: string;
  magnitude: number;
  temporality: string; // TemporalStratum enum value as string
  locality: string[]; // Set<string> → string[]
  purpose: string[]; // Set<string> → string[]
  provenance: ProvenanceEntry[];
  createdAt: number;
  lastTickAt: number;
  walletId: string;
}

/**
 * Serializable version of Wallet.
 * Sets converted to Arrays.
 */
export interface SerializedWallet {
  id: string;
  name: string;
  createdAt: number;
  communities: string[]; // Set<string> → string[]
  validPurposes: string[]; // Set<string> → string[]
}

/**
 * Serializable version of PurposeChannel.
 * Set converted to Array.
 */
export interface SerializedPurposeChannel {
  id: string;
  name: string;
  description?: string;
  validRecipients: string[]; // Set<string> → string[]
  conversionDiscount: number;
  createdAt: number;
}

// =============================================================================
// POOL STATE
// =============================================================================

/**
 * Serializable pool state.
 */
export interface SerializedPoolState {
  totalMinted: number;
  totalBurned: number;
  currentSupply: number;
  currentTime: number;
}

// =============================================================================
// LEDGER SNAPSHOT
// =============================================================================

/**
 * Complete ledger snapshot for persistence.
 * This is the primary data structure stored in Helia.
 */
export interface LedgerSnapshot {
  /** Schema version for migrations */
  version: number;

  /** Timestamp when snapshot was created */
  timestamp: number;

  /** Commons Pool state */
  pool: SerializedPoolState;

  /** All OmniumUnits (serialized) */
  units: SerializedOmniumUnit[];

  /** All Wallets (serialized) */
  wallets: SerializedWallet[];

  /** All Communities (already serializable) */
  communities: Community[];

  /** All PurposeChannels (serialized) */
  purposes: SerializedPurposeChannel[];

  /** Transaction log head CID (stored separately) */
  transactionLogCid?: string;
}

/** Current schema version */
export const SCHEMA_VERSION = 1;

// =============================================================================
// PERSISTENCE MANIFEST
// =============================================================================

/**
 * Manifest file tracking the latest snapshot.
 * Stored at a well-known location for bootstrapping.
 */
export interface PersistenceManifest {
  /** Schema version */
  version: number;

  /** CID of the latest snapshot */
  lastSnapshotCid: string;

  /** Timestamp of last snapshot */
  lastSnapshotTimestamp: number;

  /** CID of transaction log head */
  transactionLogCid?: string;

  /** Number of snapshots created */
  checkpointCount: number;
}

// =============================================================================
// TRANSACTION LOG
// =============================================================================

/**
 * A block of transactions forming a linked list.
 */
export interface TransactionBlock {
  /** Transactions in this block */
  transactions: Transaction[];

  /** CID of previous block (null for genesis) */
  previousBlockCid: string | null;

  /** Block creation timestamp */
  timestamp: number;

  /** Sequential block number */
  blockNumber: number;
}

// =============================================================================
// STORAGE INTERFACE
// =============================================================================

/**
 * Generic content-addressed storage interface.
 * Abstracts Helia operations for testability.
 */
export interface ContentStore {
  /** Store data and return its content identifier */
  store<T>(data: T): Promise<CID>;

  /** Retrieve data by its content identifier */
  retrieve<T>(cid: CID): Promise<T | null>;

  /** Check if a CID exists in storage */
  has(cid: CID): Promise<boolean>;

  /** Pin a CID to prevent garbage collection */
  pin(cid: CID): Promise<void>;

  /** Unpin a CID (allows garbage collection) */
  unpin(cid: CID): Promise<void>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuration for the persistence layer.
 */
export interface PersistenceConfig {
  /** Path to storage directory (default: .omnium-data) */
  storagePath: string;

  /** Enable in-memory caching (default: true) */
  cacheEnabled: boolean;

  /** Maximum cache entries (default: 1000) */
  cacheMaxSize: number;

  /** Auto-save after operations (default: true) */
  autoSave: boolean;

  /** Transaction log batch size before flush (default: 50) */
  txLogBatchSize: number;
}

/**
 * Default persistence configuration.
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  storagePath: './.omnium-data',
  cacheEnabled: true,
  cacheMaxSize: 1000,
  autoSave: true,
  txLogBatchSize: 50,
};

// Network types are defined in ./network/message-types.ts and ./network/pubsub-config.ts
