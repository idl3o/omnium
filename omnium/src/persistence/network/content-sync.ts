/**
 * Content-Addressed Sync
 *
 * Peerless synchronization via CID chains.
 *
 * Instead of maintaining peer connections and pushing/pulling state,
 * we simply publish our head CID and let others fetch what they need.
 *
 * Sync flow:
 * 1. Obtain remote head CID (via any channel: IPNS, URL, QR, paste)
 * 2. Compare chains to find relationship
 * 3. If behind: walk missing pointers, fetch snapshots, apply
 * 4. If diverged: merge (CRDT-style) or choose canonical branch
 *
 * No sockets. No connections. Just content.
 */

import { CID } from 'multiformats/cid';
import { ChainStore, StatePointer, ChainComparison } from './cid-chain.js';
import type { ContentStore, LedgerSnapshot } from '../types.js';

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean;

  /** What happened */
  action: 'none' | 'fast-forward' | 'already-ahead' | 'merged' | 'failed';

  /** Number of states applied */
  statesApplied: number;

  /** New head CID after sync (if changed) */
  newHead?: string;

  /** Error message if failed */
  error?: string;

  /** Details about the comparison */
  comparison?: ChainComparison;
}

/**
 * Handler for applying a snapshot to the local ledger.
 * Provided by the caller since ContentSync doesn't know about ledger internals.
 */
export type SnapshotApplier = (snapshot: LedgerSnapshot) => Promise<void>;

/**
 * Handler for creating a snapshot from the current ledger state.
 */
export type SnapshotCreator = () => Promise<LedgerSnapshot>;

/**
 * Handler for merging diverged states.
 * Returns the merged snapshot.
 */
export type SnapshotMerger = (
  local: LedgerSnapshot,
  remote: LedgerSnapshot,
  commonAncestor: LedgerSnapshot | null
) => Promise<LedgerSnapshot>;

/**
 * Configuration for ContentSync.
 */
export interface ContentSyncConfig {
  /** Identifier for this node (optional, for tracking origin) */
  nodeId?: string;
}

/**
 * Content-addressed synchronization engine.
 *
 * Usage:
 * ```typescript
 * const sync = new ContentSync(store, chain, {
 *   nodeId: 'my-node'
 * });
 *
 * // When local state changes:
 * const snapshot = await createSnapshot(ledger);
 * await sync.publish(snapshot);
 *
 * // When you learn of a remote head:
 * const result = await sync.syncFrom(remoteCid, applySnapshot);
 * ```
 */
export class ContentSync {
  private store: ContentStore;
  private chain: ChainStore;
  private config: ContentSyncConfig;

  constructor(
    store: ContentStore,
    chain: ChainStore,
    config: ContentSyncConfig = {}
  ) {
    this.store = store;
    this.chain = chain;
    this.config = config;
  }

  /**
   * Get current head CID.
   * This is what you share with others.
   */
  getHeadCid(): string | null {
    return this.chain.getHead()?.toString() ?? null;
  }

  /**
   * Get current height.
   */
  getHeight(): number {
    return this.chain.getHeight();
  }

  /**
   * Publish a new snapshot to the chain.
   * Returns the new head CID.
   */
  async publish(snapshot: LedgerSnapshot): Promise<string> {
    // Store the snapshot
    const snapshotCid = await this.store.store(snapshot);

    // Append to chain
    const headCid = await this.chain.append(snapshotCid, this.config.nodeId);

    return headCid.toString();
  }

  /**
   * Compare local state with a remote head.
   * Doesn't apply anything, just tells you the relationship.
   */
  async compare(remoteCidStr: string): Promise<ChainComparison> {
    const remoteCid = CID.parse(remoteCidStr);
    return this.chain.compare(remoteCid);
  }

  /**
   * Sync from a remote head CID.
   *
   * @param remoteCidStr - The remote head CID to sync from
   * @param applySnapshot - Function to apply a snapshot to local state
   * @param mergeSnapshots - Optional function to merge diverged states
   */
  async syncFrom(
    remoteCidStr: string,
    applySnapshot: SnapshotApplier,
    mergeSnapshots?: SnapshotMerger
  ): Promise<SyncResult> {
    try {
      const remoteCid = CID.parse(remoteCidStr);
      const comparison = await this.chain.compare(remoteCid);

      switch (comparison.relationship) {
        case 'equal':
          return {
            success: true,
            action: 'none',
            statesApplied: 0,
            comparison,
          };

        case 'ahead':
          // We're ahead, nothing to do
          return {
            success: true,
            action: 'already-ahead',
            statesApplied: 0,
            comparison,
          };

        case 'behind':
          // Fast-forward: apply missing states
          return this.fastForward(comparison.missing, applySnapshot, remoteCid);

        case 'diverged':
          // Need to merge
          if (!mergeSnapshots) {
            return {
              success: false,
              action: 'failed',
              statesApplied: 0,
              error: 'Chains diverged and no merge function provided',
              comparison,
            };
          }
          return this.merge(
            remoteCid,
            comparison.commonAncestor,
            applySnapshot,
            mergeSnapshots
          );
      }
    } catch (err) {
      return {
        success: false,
        action: 'failed',
        statesApplied: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Fast-forward by applying missing states.
   */
  private async fastForward(
    missing: StatePointer[],
    applySnapshot: SnapshotApplier,
    newHead: CID
  ): Promise<SyncResult> {
    // Apply in order (oldest first)
    const ordered = [...missing].reverse();

    let applied = 0;
    for (const pointer of ordered) {
      const snapshotCid = CID.parse(pointer.snapshot);
      const snapshot = await this.store.retrieve<LedgerSnapshot>(snapshotCid);

      if (!snapshot) {
        return {
          success: false,
          action: 'failed',
          statesApplied: applied,
          error: `Missing snapshot: ${pointer.snapshot}`,
        };
      }

      await applySnapshot(snapshot);
      applied++;
    }

    // Update our head to the remote head
    await this.chain.setHead(newHead);

    return {
      success: true,
      action: 'fast-forward',
      statesApplied: applied,
      newHead: newHead.toString(),
    };
  }

  /**
   * Merge diverged chains.
   */
  private async merge(
    remoteCid: CID,
    commonAncestorCid: string | null,
    applySnapshot: SnapshotApplier,
    mergeSnapshots: SnapshotMerger
  ): Promise<SyncResult> {
    // Get local snapshot
    const localHead = this.chain.getHead();
    if (!localHead) {
      return {
        success: false,
        action: 'failed',
        statesApplied: 0,
        error: 'No local state to merge',
      };
    }

    const localPointer = await this.chain.resolve(localHead);
    if (!localPointer) {
      return {
        success: false,
        action: 'failed',
        statesApplied: 0,
        error: 'Cannot resolve local head',
      };
    }

    const localSnapshot = await this.store.retrieve<LedgerSnapshot>(
      CID.parse(localPointer.snapshot)
    );

    // Get remote snapshot
    const remotePointer = await this.chain.resolve(remoteCid);
    if (!remotePointer) {
      return {
        success: false,
        action: 'failed',
        statesApplied: 0,
        error: 'Cannot resolve remote head',
      };
    }

    const remoteSnapshot = await this.store.retrieve<LedgerSnapshot>(
      CID.parse(remotePointer.snapshot)
    );

    if (!localSnapshot || !remoteSnapshot) {
      return {
        success: false,
        action: 'failed',
        statesApplied: 0,
        error: 'Cannot retrieve snapshots for merge',
      };
    }

    // Get common ancestor snapshot (if any)
    let ancestorSnapshot: LedgerSnapshot | null = null;
    if (commonAncestorCid) {
      const ancestorPointer = await this.chain.resolve(
        CID.parse(commonAncestorCid)
      );
      if (ancestorPointer) {
        ancestorSnapshot = await this.store.retrieve<LedgerSnapshot>(
          CID.parse(ancestorPointer.snapshot)
        );
      }
    }

    // Merge
    const mergedSnapshot = await mergeSnapshots(
      localSnapshot,
      remoteSnapshot,
      ancestorSnapshot
    );

    // Apply merged state
    await applySnapshot(mergedSnapshot);

    // Publish the merge as a new state
    const newHeadCid = await this.publish(mergedSnapshot);

    return {
      success: true,
      action: 'merged',
      statesApplied: 1,
      newHead: newHeadCid,
    };
  }

  /**
   * Fetch a snapshot by its CID.
   */
  async fetchSnapshot(cidStr: string): Promise<LedgerSnapshot | null> {
    const cid = CID.parse(cidStr);
    return this.store.retrieve<LedgerSnapshot>(cid);
  }

  /**
   * Fetch a snapshot via a state pointer CID.
   */
  async fetchSnapshotFromPointer(
    pointerCidStr: string
  ): Promise<LedgerSnapshot | null> {
    const pointerCid = CID.parse(pointerCidStr);
    const pointer = await this.chain.resolve(pointerCid);
    if (!pointer) return null;

    return this.store.retrieve<LedgerSnapshot>(CID.parse(pointer.snapshot));
  }

  /**
   * Get chain info for debugging/display.
   */
  getInfo(): {
    head: string | null;
    height: number;
    nodeId?: string;
  } {
    return {
      ...this.chain.getInfo(),
      nodeId: this.config.nodeId,
    };
  }

  /**
   * Initialize from a known head CID.
   * Used when bootstrapping.
   */
  async initializeFrom(headCidStr: string): Promise<void> {
    const headCid = CID.parse(headCidStr);
    await this.chain.initializeFrom(headCid);
  }

  /**
   * Check if we have any state.
   */
  hasState(): boolean {
    return this.chain.hasState();
  }
}

/**
 * Create a ContentSync instance.
 */
export function createContentSync(
  store: ContentStore,
  chain: ChainStore,
  config: ContentSyncConfig = {}
): ContentSync {
  return new ContentSync(store, chain, config);
}
