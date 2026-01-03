/**
 * IPNS Discovery Tests
 *
 * Tests for the IPNS-based discovery layer.
 * Uses mocks since IPNS requires a full Helia node.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CID } from 'multiformats/cid';
import {
  IPNSDiscovery,
  createIPNSDiscovery,
  createDiscoveryUrl,
  parseDiscoveryUrl,
} from './ipns-discovery.js';
import { ChainStore } from './cid-chain.js';
import { ContentSync } from './content-sync.js';
import type { ContentStore, LedgerSnapshot } from '../types.js';
import type { IPNS, IPNSPublishResult, IPNSResolveResult } from '@helia/ipns';
import type { PublicKey } from '@libp2p/interface';

/**
 * In-memory content store for testing.
 */
class MockContentStore implements ContentStore {
  private data = new Map<string, unknown>();
  private counter = 0;

  async store<T>(data: T): Promise<CID> {
    const bytes = new TextEncoder().encode(`mock-${this.counter++}`);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = new Uint8Array(hash);

    const cidBytes = new Uint8Array(36);
    cidBytes[0] = 0x01;
    cidBytes[1] = 0x55;
    cidBytes[2] = 0x12;
    cidBytes[3] = 32;
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

/**
 * Create a mock snapshot.
 */
function createMockSnapshot(version: number): LedgerSnapshot {
  return {
    version: 1,
    timestamp: Date.now(),
    pool: {
      totalMinted: version * 100,
      totalBurned: 0,
      currentSupply: version * 100,
      currentTime: Date.now(),
    },
    units: [],
    wallets: [],
    communities: [],
    purposes: [],
  };
}

/**
 * Create a mock CID for testing.
 */
async function createMockCid(index: number): Promise<CID> {
  const bytes = new TextEncoder().encode(`mock-cid-${index}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = new Uint8Array(hash);

  const cidBytes = new Uint8Array(36);
  cidBytes[0] = 0x01;
  cidBytes[1] = 0x55;
  cidBytes[2] = 0x12;
  cidBytes[3] = 32;
  cidBytes.set(hashArray, 4);

  return CID.decode(cidBytes);
}

/**
 * Create a mock public key.
 */
function createMockPublicKey(name: string): PublicKey {
  const mockCid = CID.parse(
    'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
  );
  return {
    type: 'Ed25519',
    raw: new Uint8Array(32),
    equals: () => false,
    toMultihash: () => mockCid.multihash,
    toCID: () => mockCid,
    toString: () => name,
    verify: async () => true,
  } as unknown as PublicKey;
}

/**
 * Create a mock IPNS instance.
 */
function createMockIPNS() {
  const published = new Map<string, CID>();
  const mockPublicKey = createMockPublicKey('test-key');

  const publishFn = vi.fn(
    async (
      keyName: string,
      cid: CID
    ): Promise<IPNSPublishResult> => {
      published.set(keyName, cid);
      return {
        record: {} as never,
        publicKey: mockPublicKey,
      };
    }
  );

  const resolveFn = vi.fn(async (key: unknown): Promise<IPNSResolveResult> => {
    const keyStr = String(key);
    const cid = published.get('omnium-head');
    if (!cid) {
      throw new Error(`IPNS name not found: ${keyStr}`);
    }
    return {
      cid,
      record: {} as never,
    };
  });

  const ipns: IPNS = {
    routers: [],
    publish: publishFn as IPNS['publish'],
    resolve: resolveFn as IPNS['resolve'],
    unpublish: vi.fn(),
  };

  return { ipns, published, publishFn, resolveFn };
}

describe('IPNSDiscovery', () => {
  let store: MockContentStore;
  let chain: ChainStore;
  let sync: ContentSync;

  beforeEach(() => {
    store = new MockContentStore();
    chain = new ChainStore(store);
    sync = new ContentSync(store, chain, { nodeId: 'test-node' });
  });

  // ===========================================================================
  // PUBLISH HEAD
  // ===========================================================================
  describe('publishHead', () => {
    it('returns error when no state to publish', async () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      const result = await discovery.publishHead();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No state to publish');
    });

    it('publishes head CID to IPNS', async () => {
      const { ipns, publishFn } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      // First publish some state
      await sync.publish(createMockSnapshot(1));

      const result = await discovery.publishHead();

      expect(result.success).toBe(true);
      expect(result.cid).toBeDefined();
      expect(publishFn).toHaveBeenCalled();
    });

    it('uses configured key name', async () => {
      const { ipns, publishFn } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync, {
        keyName: 'my-custom-key',
      });

      await sync.publish(createMockSnapshot(1));
      await discovery.publishHead();

      expect(publishFn).toHaveBeenCalledWith(
        'my-custom-key',
        expect.anything(),
        expect.anything()
      );
    });

    it('updates lastPublish info', async () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      await sync.publish(createMockSnapshot(1));
      await discovery.publishHead();

      const lastPublish = discovery.getLastPublish();
      expect(lastPublish).not.toBeNull();
      expect(lastPublish?.cid).toBe(sync.getHeadCid());
      expect(lastPublish?.timestamp).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // RESOLVE HEAD
  // ===========================================================================
  describe('resolveHead', () => {
    it('resolves IPNS name to CID', async () => {
      const { ipns, published } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      // Publish something first
      await sync.publish(createMockSnapshot(1));
      const headCid = sync.getHeadCid()!;
      published.set('omnium-head', CID.parse(headCid));

      const mockKey = CID.parse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
      const result = await discovery.resolveHead(mockKey);

      expect(result.success).toBe(true);
      expect(result.cid).toBe(headCid);
    });

    it('returns error for unknown IPNS name', async () => {
      const { ipns, resolveFn } = createMockIPNS();
      resolveFn.mockRejectedValueOnce(new Error('Name not found'));

      const discovery = new IPNSDiscovery(ipns, sync);
      const mockKey = CID.parse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      const result = await discovery.resolveHead(mockKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Name not found');
    });
  });

  // ===========================================================================
  // DISCOVER AND SYNC
  // ===========================================================================
  describe('discoverAndSync', () => {
    it('resolves and syncs from peer', async () => {
      const { ipns, published } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      // Local state at height 1
      const head1 = await sync.publish(createMockSnapshot(1));

      // Create "remote" state at height 2 (extending local)
      const snap2 = await store.store(createMockSnapshot(2));
      const pointer2 = {
        snapshot: snap2.toString(),
        height: 2,
        previous: head1,
        timestamp: Date.now(),
      };
      const remoteCid = await store.store(pointer2);
      published.set('omnium-head', remoteCid);

      const applySnapshot = vi.fn();
      const mockKey = CID.parse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      const result = await discovery.discoverAndSync(mockKey, applySnapshot);

      expect(result.resolve.success).toBe(true);
      expect(result.sync?.success).toBe(true);
      expect(result.sync?.action).toBe('fast-forward');
      expect(applySnapshot).toHaveBeenCalled();
    });

    it('returns resolve error without syncing', async () => {
      const { ipns, resolveFn } = createMockIPNS();
      resolveFn.mockRejectedValueOnce(new Error('Resolution failed'));

      const discovery = new IPNSDiscovery(ipns, sync);
      const applySnapshot = vi.fn();
      const mockKey = CID.parse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      const result = await discovery.discoverAndSync(mockKey, applySnapshot);

      expect(result.resolve.success).toBe(false);
      expect(result.sync).toBeUndefined();
      expect(applySnapshot).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // KNOWN PEERS
  // ===========================================================================
  describe('known peers', () => {
    it('adds and retrieves known peers', () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      discovery.addKnownPeer({
        name: 'Alice',
        ipnsKey: 'alice-key',
      });
      discovery.addKnownPeer({
        name: 'Bob',
        ipnsKey: 'bob-key',
      });

      const peers = discovery.getKnownPeers();
      expect(peers.length).toBe(2);
      expect(peers.map((p) => p.name)).toContain('Alice');
      expect(peers.map((p) => p.name)).toContain('Bob');
    });

    it('removes known peers', () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      discovery.addKnownPeer({
        name: 'Alice',
        ipnsKey: 'alice-key',
      });
      discovery.addKnownPeer({
        name: 'Bob',
        ipnsKey: 'bob-key',
      });

      const removed = discovery.removeKnownPeer('alice-key');
      expect(removed).toBe(true);

      const peers = discovery.getKnownPeers();
      expect(peers.length).toBe(1);
      expect(peers[0].name).toBe('Bob');
    });

    it('returns false when removing unknown peer', () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      const removed = discovery.removeKnownPeer('unknown-key');
      expect(removed).toBe(false);
    });
  });

  // ===========================================================================
  // GET INFO
  // ===========================================================================
  describe('getInfo', () => {
    it('returns discovery info', async () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync, {
        keyName: 'test-key',
      });

      discovery.addKnownPeer({ name: 'Peer1', ipnsKey: 'key1' });

      const info = discovery.getInfo();

      expect(info.keyName).toBe('test-key');
      expect(info.knownPeers).toBe(1);
      expect(info.ownName).toBeNull();
      expect(info.lastPublish).toBeNull();
    });

    it('includes publish info after publishing', async () => {
      const { ipns } = createMockIPNS();
      const discovery = new IPNSDiscovery(ipns, sync);

      await sync.publish(createMockSnapshot(1));
      await discovery.publishHead();

      const info = discovery.getInfo();

      expect(info.ownName).not.toBeNull();
      expect(info.lastPublish).not.toBeNull();
      expect(info.lastPublish?.cid).toBe(sync.getHeadCid());
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
describe('Discovery URL helpers', () => {
  describe('createDiscoveryUrl', () => {
    it('creates valid discovery URL', () => {
      const key =
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const url = createDiscoveryUrl(key);
      expect(url).toBe(`omnium://discover/${key}`);
    });
  });

  describe('parseDiscoveryUrl', () => {
    it('parses valid discovery URL', () => {
      const key =
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const url = `omnium://discover/${key}`;
      const parsed = parseDiscoveryUrl(url);
      expect(parsed).toBe(key);
    });

    it('returns null for invalid URL', () => {
      expect(parseDiscoveryUrl('https://example.com')).toBeNull();
      expect(parseDiscoveryUrl('omnium://other/thing')).toBeNull();
      expect(parseDiscoveryUrl('')).toBeNull();
    });
  });
});

// =============================================================================
// FACTORY FUNCTION
// =============================================================================
describe('createIPNSDiscovery', () => {
  it('creates IPNSDiscovery instance', () => {
    const store = new MockContentStore();
    const chain = new ChainStore(store);
    const sync = new ContentSync(store, chain);
    const { ipns } = createMockIPNS();

    const discovery = createIPNSDiscovery(ipns, sync, {
      keyName: 'custom-key',
    });

    expect(discovery).toBeInstanceOf(IPNSDiscovery);
  });
});
