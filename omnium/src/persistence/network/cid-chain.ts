/**
 * CID Chain - Content-Addressed State Linking
 *
 * Instead of peers pushing state to each other, we build a chain of
 * content-addressed pointers. Each StatePointer contains:
 * - A CID to the full snapshot
 * - A height (monotonic counter)
 * - A link to the previous StatePointer
 *
 * Sync becomes: "give me your head CID, I'll walk the chain and catch up."
 *
 * No peer connections. No heartbeats. Just content and addresses.
 */

import { CID } from 'multiformats/cid';
import type { ContentStore, LedgerSnapshot } from '../types.js';

/**
 * A pointer to a specific ledger state.
 * Forms a linked list via `previous`.
 */
export interface StatePointer {
  /** CID of the LedgerSnapshot this points to */
  snapshot: string;

  /** Monotonic height - increases with each state change */
  height: number;

  /** CID of the previous StatePointer (null for genesis) */
  previous: string | null;

  /** When this pointer was created */
  timestamp: number;

  /** Optional: identifier of the node that created this */
  origin?: string;
}

/**
 * Result of comparing two chains.
 */
export interface ChainComparison {
  /** Relationship between local and remote */
  relationship: 'equal' | 'ahead' | 'behind' | 'diverged';

  /** Common ancestor CID (if any) */
  commonAncestor: string | null;

  /** Height difference (positive = remote is ahead) */
  heightDiff: number;

  /** StatePointers we're missing (if behind) */
  missing: StatePointer[];
}

/**
 * ChainStore manages the CID chain of state pointers.
 *
 * Core operations:
 * - append: Add a new state to the chain
 * - resolve: Walk back through the chain
 * - compare: Find relationship between two chains
 */
export class ChainStore {
  private store: ContentStore;
  private head: CID | null = null;
  private headPointer: StatePointer | null = null;

  constructor(store: ContentStore) {
    this.store = store;
  }

  /**
   * Get the current head CID.
   */
  getHead(): CID | null {
    return this.head;
  }

  /**
   * Get the current head pointer.
   */
  getHeadPointer(): StatePointer | null {
    return this.headPointer;
  }

  /**
   * Get current height (0 if no chain exists).
   */
  getHeight(): number {
    return this.headPointer?.height ?? 0;
  }

  /**
   * Append a new snapshot to the chain.
   * Creates a StatePointer linking to the previous head.
   * Returns the CID of the new head.
   */
  async append(snapshotCid: CID, origin?: string): Promise<CID> {
    const pointer: StatePointer = {
      snapshot: snapshotCid.toString(),
      height: (this.headPointer?.height ?? 0) + 1,
      previous: this.head?.toString() ?? null,
      timestamp: Date.now(),
      origin,
    };

    const pointerCid = await this.store.store(pointer);

    this.head = pointerCid;
    this.headPointer = pointer;

    return pointerCid;
  }

  /**
   * Set the head directly (used when syncing from remote).
   */
  async setHead(cid: CID): Promise<void> {
    const pointer = await this.store.retrieve<StatePointer>(cid);
    if (!pointer) {
      throw new Error(`StatePointer not found: ${cid}`);
    }

    this.head = cid;
    this.headPointer = pointer;
  }

  /**
   * Resolve a StatePointer by CID.
   */
  async resolve(cid: CID): Promise<StatePointer | null> {
    return this.store.retrieve<StatePointer>(cid);
  }

  /**
   * Walk the chain backwards from a given CID.
   * Returns pointers in reverse order (newest first).
   *
   * @param startCid - Where to start walking
   * @param limit - Maximum pointers to return (0 = unlimited)
   * @param stopAt - Stop when reaching this CID (exclusive)
   */
  async walk(
    startCid: CID,
    limit: number = 0,
    stopAt?: CID
  ): Promise<StatePointer[]> {
    const pointers: StatePointer[] = [];
    let currentCid: CID | null = startCid;
    const stopAtStr = stopAt?.toString();

    while (currentCid) {
      // Stop if we've reached the target
      if (stopAtStr && currentCid.toString() === stopAtStr) {
        break;
      }

      const pointer = await this.resolve(currentCid);
      if (!pointer) break;

      pointers.push(pointer);

      // Check limit
      if (limit > 0 && pointers.length >= limit) {
        break;
      }

      // Move to previous
      if (pointer.previous) {
        currentCid = CID.parse(pointer.previous);
      } else {
        currentCid = null;
      }
    }

    return pointers;
  }

  /**
   * Find common ancestor between local chain and a remote CID.
   */
  async findCommonAncestor(remoteCid: CID): Promise<string | null> {
    if (!this.head) return null;

    // Build set of local chain CIDs
    const localCids = new Set<string>();
    const localPointers = await this.walk(this.head);
    for (const p of localPointers) {
      // Add the CID of each pointer (we need to compute it)
      // For now, use previous links
      if (p.previous) localCids.add(p.previous);
    }
    localCids.add(this.head.toString());

    // Walk remote chain looking for match
    let currentCid: CID | null = remoteCid;
    while (currentCid) {
      if (localCids.has(currentCid.toString())) {
        return currentCid.toString();
      }

      const pointer = await this.resolve(currentCid);
      if (!pointer || !pointer.previous) break;

      currentCid = CID.parse(pointer.previous);
    }

    return null;
  }

  /**
   * Compare local chain with a remote head.
   * Determines sync relationship and what's missing.
   */
  async compare(remoteCid: CID): Promise<ChainComparison> {
    const remotePointer = await this.resolve(remoteCid);
    if (!remotePointer) {
      throw new Error(`Cannot resolve remote CID: ${remoteCid}`);
    }

    const localHeight = this.getHeight();
    const remoteHeight = remotePointer.height;
    const heightDiff = remoteHeight - localHeight;

    // Same head = equal
    if (this.head && remoteCid.toString() === this.head.toString()) {
      return {
        relationship: 'equal',
        commonAncestor: this.head.toString(),
        heightDiff: 0,
        missing: [],
      };
    }

    // No local state = we're at genesis, everything is missing
    if (!this.head) {
      const missing = await this.walk(remoteCid);
      return {
        relationship: 'behind',
        commonAncestor: null,
        heightDiff: remoteHeight,
        missing,
      };
    }

    // Find common ancestor
    const commonAncestor = await this.findCommonAncestor(remoteCid);

    if (!commonAncestor) {
      // No common ancestor = completely diverged chains
      return {
        relationship: 'diverged',
        commonAncestor: null,
        heightDiff,
        missing: [],
      };
    }

    // Common ancestor is our head = we're behind
    if (commonAncestor === this.head.toString()) {
      const stopCid = CID.parse(commonAncestor);
      const missing = await this.walk(remoteCid, 0, stopCid);
      return {
        relationship: 'behind',
        commonAncestor,
        heightDiff,
        missing,
      };
    }

    // Common ancestor is remote head = we're ahead
    if (commonAncestor === remoteCid.toString()) {
      return {
        relationship: 'ahead',
        commonAncestor,
        heightDiff,
        missing: [],
      };
    }

    // Common ancestor is somewhere else = diverged
    return {
      relationship: 'diverged',
      commonAncestor,
      heightDiff,
      missing: [],
    };
  }

  /**
   * Get the snapshot CID for a given state pointer.
   */
  async getSnapshotCid(pointerCid: CID): Promise<CID | null> {
    const pointer = await this.resolve(pointerCid);
    if (!pointer) return null;
    return CID.parse(pointer.snapshot);
  }

  /**
   * Initialize from an existing head CID.
   * Used when bootstrapping from persisted state.
   */
  async initializeFrom(headCid: CID): Promise<void> {
    await this.setHead(headCid);
  }

  /**
   * Check if the chain has any state.
   */
  hasState(): boolean {
    return this.head !== null;
  }

  /**
   * Get chain info for display/debugging.
   */
  getInfo(): { head: string | null; height: number; timestamp: number | null } {
    return {
      head: this.head?.toString() ?? null,
      height: this.getHeight(),
      timestamp: this.headPointer?.timestamp ?? null,
    };
  }
}

/**
 * Create a new ChainStore.
 */
export function createChainStore(store: ContentStore): ChainStore {
  return new ChainStore(store);
}
