/**
 * OMNIUM Persistence Manager
 *
 * Coordinates saving and loading of complete ledger state.
 * Manages snapshots, transaction logs, and the manifest.
 */

import { CID } from 'multiformats/cid';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { OmniumLedger } from '../../engine/ledger.js';
import type { Transaction } from '../../core/types.js';
import { HeliaStore } from '../storage/helia-store.js';
import { createSnapshot, restoreFromSnapshot, validateSnapshot } from './snapshot.js';
import { TransactionLog } from './transaction-log.js';
import type {
  PersistenceConfig,
  PersistenceManifest,
  LedgerSnapshot,
} from '../types.js';
import { DEFAULT_PERSISTENCE_CONFIG } from '../types.js';

const MANIFEST_FILENAME = 'manifest.json';

/**
 * PersistenceManager coordinates all persistence operations.
 *
 * Responsibilities:
 * - Initialize/shutdown Helia storage
 * - Create and restore ledger snapshots
 * - Manage append-only transaction log
 * - Maintain manifest for bootstrapping
 */
export class PersistenceManager {
  private store: HeliaStore;
  private txLog: TransactionLog;
  private config: PersistenceConfig;
  private manifest: PersistenceManifest | null = null;
  private initialized = false;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
    this.store = new HeliaStore(this.config);
    this.txLog = new TransactionLog(this.store, this.config.txLogBatchSize);
  }

  /**
   * Initialize the persistence layer.
   * Must be called before any operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure storage directory exists
    await fs.mkdir(this.config.storagePath, { recursive: true });

    // Initialize Helia store
    await this.store.initialize();

    // Load manifest if exists
    await this.loadManifest();

    // Restore transaction log state from manifest
    if (this.manifest?.transactionLogCid) {
      const headCid = CID.parse(this.manifest.transactionLogCid);
      this.txLog.restore(headCid, this.manifest.checkpointCount);
    }

    this.initialized = true;
  }

  /**
   * Check if persistence is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Save the current ledger state as a snapshot.
   * Returns the CID of the snapshot.
   */
  async saveSnapshot(ledger: OmniumLedger): Promise<CID> {
    this.ensureInitialized();

    // Create snapshot
    const snapshot = createSnapshot(ledger);

    // Include transaction log CID if available
    if (this.txLog.getHeadCid()) {
      snapshot.transactionLogCid = this.txLog.getHeadCid()!.toString();
    }

    // Store snapshot
    const snapshotCid = await this.store.store(snapshot);

    // Pin to prevent GC
    await this.store.pin(snapshotCid);

    // Unpin previous snapshot (keep storage bounded)
    if (this.manifest?.lastSnapshotCid) {
      try {
        const prevCid = CID.parse(this.manifest.lastSnapshotCid);
        await this.store.unpin(prevCid);
      } catch {
        // Ignore unpin errors
      }
    }

    // Update manifest
    this.manifest = {
      version: 1,
      lastSnapshotCid: snapshotCid.toString(),
      lastSnapshotTimestamp: Date.now(),
      transactionLogCid: this.txLog.getHeadCid()?.toString(),
      checkpointCount: (this.manifest?.checkpointCount ?? 0) + 1,
    };

    await this.saveManifest();

    return snapshotCid;
  }

  /**
   * Load the latest snapshot.
   * Returns null if no snapshot exists.
   */
  async loadSnapshot(): Promise<LedgerSnapshot | null> {
    this.ensureInitialized();

    if (!this.manifest?.lastSnapshotCid) {
      return null;
    }

    const cid = CID.parse(this.manifest.lastSnapshotCid);
    const snapshot = await this.store.retrieve<LedgerSnapshot>(cid);

    if (snapshot) {
      validateSnapshot(snapshot);
    }

    return snapshot;
  }

  /**
   * Restore a ledger from the latest snapshot.
   * Returns null if no snapshot exists.
   */
  async restoreLedger(): Promise<OmniumLedger | null> {
    const snapshot = await this.loadSnapshot();
    if (!snapshot) return null;

    return restoreFromSnapshot(snapshot);
  }

  /**
   * Check if a saved state exists.
   */
  hasSavedState(): boolean {
    return this.manifest !== null && this.manifest.lastSnapshotCid !== undefined;
  }

  /**
   * Append a transaction to the log.
   * Transactions are batched and flushed periodically.
   */
  async appendTransaction(tx: Transaction): Promise<void> {
    this.ensureInitialized();
    await this.txLog.append(tx);
  }

  /**
   * Flush pending transactions to storage.
   */
  async flushTransactions(): Promise<CID | null> {
    this.ensureInitialized();
    const cid = await this.txLog.flush();

    if (cid && this.manifest) {
      this.manifest.transactionLogCid = cid.toString();
      await this.saveManifest();
    }

    return cid;
  }

  /**
   * Get all transactions from the log.
   */
  async getTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();
    return this.txLog.getAllTransactions();
  }

  /**
   * Get recent transactions.
   */
  async getRecentTransactions(count: number): Promise<Transaction[]> {
    this.ensureInitialized();
    return this.txLog.getRecentTransactions(count);
  }

  /**
   * Get the current manifest.
   */
  getManifest(): PersistenceManifest | null {
    return this.manifest;
  }

  /**
   * Get persistence statistics.
   */
  getStats(): {
    initialized: boolean;
    snapshotCount: number;
    lastSaveTime: number | null;
    storagePath: string;
    transactionBlockCount: number;
    pendingTransactions: number;
    cacheStats: ReturnType<HeliaStore['getCacheStats']>;
  } {
    return {
      initialized: this.initialized,
      snapshotCount: this.manifest?.checkpointCount ?? 0,
      lastSaveTime: this.manifest?.lastSnapshotTimestamp ?? null,
      storagePath: this.config.storagePath,
      transactionBlockCount: this.txLog.getBlockCount(),
      pendingTransactions: this.txLog.getPendingCount(),
      cacheStats: this.store.getCacheStats(),
    };
  }

  /**
   * Get the underlying Helia store.
   * Useful for network layer integration.
   */
  getStore(): HeliaStore {
    return this.store;
  }

  /**
   * Graceful shutdown.
   */
  async close(): Promise<void> {
    if (!this.initialized) return;

    // Flush any pending transactions
    await this.txLog.flush();

    // Update manifest
    if (this.manifest) {
      this.manifest.transactionLogCid = this.txLog.getHeadCid()?.toString();
      await this.saveManifest();
    }

    // Close Helia store
    await this.store.close();

    this.initialized = false;
  }

  // --- Private Methods ---

  private getManifestPath(): string {
    return path.join(this.config.storagePath, MANIFEST_FILENAME);
  }

  private async loadManifest(): Promise<void> {
    try {
      const manifestPath = this.getManifestPath();
      const data = await fs.readFile(manifestPath, 'utf-8');
      this.manifest = JSON.parse(data);
    } catch {
      // No manifest exists yet
      this.manifest = null;
    }
  }

  private async saveManifest(): Promise<void> {
    if (!this.manifest) return;

    const manifestPath = this.getManifestPath();
    await fs.writeFile(
      manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf-8'
    );
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('PersistenceManager not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create and initialize a PersistenceManager.
 * Convenience function for one-step setup.
 */
export async function createPersistenceManager(
  config: Partial<PersistenceConfig> = {}
): Promise<PersistenceManager> {
  const manager = new PersistenceManager(config);
  await manager.initialize();
  return manager;
}
