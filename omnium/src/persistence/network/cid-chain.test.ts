/**
 * CID Chain Tests
 *
 * Tests for the content-addressed state chain.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CID } from 'multiformats/cid';
import { ChainStore, StatePointer } from './cid-chain.js';
import type { ContentStore, LedgerSnapshot } from '../types.js';

/**
 * In-memory content store for testing.
 */
class MockContentStore implements ContentStore {
  private data = new Map<string, unknown>();
  private counter = 0;

  async store<T>(data: T): Promise<CID> {
    // Create a fake CID based on counter
    const bytes = new TextEncoder().encode(`mock-${this.counter++}`);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = new Uint8Array(hash);

    // Create CID manually (version 1, raw codec 0x55, sha256 0x12)
    const cidBytes = new Uint8Array(36);
    cidBytes[0] = 0x01; // version
    cidBytes[1] = 0x55; // raw codec
    cidBytes[2] = 0x12; // sha256
    cidBytes[3] = 32; // hash length
    cidBytes.set(hashArray, 4);

    const cid = CID.decode(cidBytes);
    this.data.set(cid.toString(), data);
    return cid;
  }

  async retrieve<T>(cid: CID): Promise<T | null> {
    return (this.data.get(cid.toString()) as T) ?? null;
  }

  async has(cid: CID): Promise<boolean> {
    return this.data.has(cid.toString());
  }

  async pin(_cid: CID): Promise<void> {}
  async unpin(_cid: CID): Promise<void> {}
}

describe('ChainStore', () => {
  let store: MockContentStore;
  let chain: ChainStore;

  beforeEach(() => {
    store = new MockContentStore();
    chain = new ChainStore(store);
  });

  // =========================================================================
  // BASIC OPERATIONS
  // =========================================================================
  describe('basic operations', () => {
    it('starts with no state', () => {
      expect(chain.getHead()).toBeNull();
      expect(chain.getHeadPointer()).toBeNull();
      expect(chain.getHeight()).toBe(0);
      expect(chain.hasState()).toBe(false);
    });

    it('appends first state at height 1', async () => {
      const snapshotCid = await store.store({ test: 'snapshot' });
      const headCid = await chain.append(snapshotCid);

      expect(chain.getHead()).toEqual(headCid);
      expect(chain.getHeight()).toBe(1);
      expect(chain.hasState()).toBe(true);
    });

    it('increments height on each append', async () => {
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      await chain.append(snap1);
      expect(chain.getHeight()).toBe(1);

      await chain.append(snap2);
      expect(chain.getHeight()).toBe(2);

      await chain.append(snap3);
      expect(chain.getHeight()).toBe(3);
    });

    it('links to previous pointer', async () => {
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });

      const head1 = await chain.append(snap1);
      await chain.append(snap2);

      const pointer = chain.getHeadPointer();
      expect(pointer?.previous).toBe(head1.toString());
    });

    it('records origin if provided', async () => {
      const snap = await store.store({ test: true });
      await chain.append(snap, 'my-node');

      const pointer = chain.getHeadPointer();
      expect(pointer?.origin).toBe('my-node');
    });
  });

  // =========================================================================
  // RESOLVE
  // =========================================================================
  describe('resolve', () => {
    it('resolves valid CID to pointer', async () => {
      const snap = await store.store({ test: true });
      const headCid = await chain.append(snap);

      const pointer = await chain.resolve(headCid);

      expect(pointer).not.toBeNull();
      expect(pointer?.height).toBe(1);
      expect(pointer?.snapshot).toBe(snap.toString());
    });

    it('returns null for unknown CID', async () => {
      const fakeCid = await store.store({ fake: true });
      // Don't append, just try to resolve
      const pointer = await chain.resolve(fakeCid);

      // Actually this will find it since we stored it
      // Let me create a truly unknown CID
      const bytes = new Uint8Array(36);
      bytes[0] = 0x01;
      bytes[1] = 0x55;
      bytes[2] = 0x12;
      bytes[3] = 32;
      const unknownCid = CID.decode(bytes);

      const result = await chain.resolve(unknownCid);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // WALK
  // =========================================================================
  describe('walk', () => {
    it('walks chain in reverse order', async () => {
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      await chain.append(snap1);
      await chain.append(snap2);
      const head = await chain.append(snap3);

      const pointers = await chain.walk(head);

      expect(pointers.length).toBe(3);
      expect(pointers[0].height).toBe(3); // Newest first
      expect(pointers[1].height).toBe(2);
      expect(pointers[2].height).toBe(1);
    });

    it('respects limit parameter', async () => {
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      await chain.append(snap1);
      await chain.append(snap2);
      const head = await chain.append(snap3);

      const pointers = await chain.walk(head, 2);

      expect(pointers.length).toBe(2);
      expect(pointers[0].height).toBe(3);
      expect(pointers[1].height).toBe(2);
    });

    it('stops at specified CID', async () => {
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      const cid1 = await chain.append(snap1);
      await chain.append(snap2);
      const head = await chain.append(snap3);

      const pointers = await chain.walk(head, 0, cid1);

      expect(pointers.length).toBe(2); // height 3 and 2, stops before 1
    });
  });

  // =========================================================================
  // COMPARE
  // =========================================================================
  describe('compare', () => {
    it('returns equal for same head', async () => {
      const snap = await store.store({ v: 1 });
      const head = await chain.append(snap);

      const comparison = await chain.compare(head);

      expect(comparison.relationship).toBe('equal');
      expect(comparison.heightDiff).toBe(0);
    });

    it('returns behind when remote is ahead', async () => {
      // Build local chain
      const snap1 = await store.store({ v: 1 });
      const localHead = await chain.append(snap1);

      // Build "remote" chain (extend from local)
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      // Simulate remote being ahead by creating pointers manually
      const pointer2: StatePointer = {
        snapshot: snap2.toString(),
        height: 2,
        previous: localHead.toString(),
        timestamp: Date.now(),
      };
      const cid2 = await store.store(pointer2);

      const pointer3: StatePointer = {
        snapshot: snap3.toString(),
        height: 3,
        previous: cid2.toString(),
        timestamp: Date.now(),
      };
      const remoteCid = await store.store(pointer3);

      const comparison = await chain.compare(remoteCid);

      expect(comparison.relationship).toBe('behind');
      expect(comparison.heightDiff).toBe(2);
      expect(comparison.missing.length).toBe(2);
    });

    it('returns ahead when local is ahead', async () => {
      // Build chain with 3 states
      const snap1 = await store.store({ v: 1 });
      const snap2 = await store.store({ v: 2 });
      const snap3 = await store.store({ v: 3 });

      const cid1 = await chain.append(snap1);
      await chain.append(snap2);
      await chain.append(snap3);

      // Compare against earlier state
      const comparison = await chain.compare(cid1);

      expect(comparison.relationship).toBe('ahead');
    });

    it('returns behind when no local state', async () => {
      // Create a remote chain without local
      const snap = await store.store({ v: 1 });
      const pointer: StatePointer = {
        snapshot: snap.toString(),
        height: 1,
        previous: null,
        timestamp: Date.now(),
      };
      const remoteCid = await store.store(pointer);

      const comparison = await chain.compare(remoteCid);

      expect(comparison.relationship).toBe('behind');
      expect(comparison.missing.length).toBe(1);
    });
  });

  // =========================================================================
  // SET HEAD
  // =========================================================================
  describe('setHead', () => {
    it('updates head to specified CID', async () => {
      // Create a pointer directly
      const snap = await store.store({ v: 1 });
      const pointer: StatePointer = {
        snapshot: snap.toString(),
        height: 5,
        previous: null,
        timestamp: Date.now(),
      };
      const cid = await store.store(pointer);

      await chain.setHead(cid);

      expect(chain.getHead()?.toString()).toBe(cid.toString());
      expect(chain.getHeight()).toBe(5);
    });

    it('throws for unknown CID', async () => {
      const bytes = new Uint8Array(36);
      bytes[0] = 0x01;
      bytes[1] = 0x55;
      bytes[2] = 0x12;
      bytes[3] = 32;
      const unknownCid = CID.decode(bytes);

      await expect(chain.setHead(unknownCid)).rejects.toThrow('not found');
    });
  });

  // =========================================================================
  // GET INFO
  // =========================================================================
  describe('getInfo', () => {
    it('returns info about empty chain', () => {
      const info = chain.getInfo();

      expect(info.head).toBeNull();
      expect(info.height).toBe(0);
      expect(info.timestamp).toBeNull();
    });

    it('returns info about populated chain', async () => {
      const snap = await store.store({ v: 1 });
      await chain.append(snap);

      const info = chain.getInfo();

      expect(info.head).not.toBeNull();
      expect(info.height).toBe(1);
      expect(info.timestamp).not.toBeNull();
    });
  });
});
