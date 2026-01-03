/**
 * OmniumNode Integration Tests
 *
 * Tests for the unified OmniumNode entry point.
 * These tests use local-only mode to avoid networking overhead.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OmniumNode, createOmniumNode } from './node.js';
import { TemporalStratum } from './core/types.js';

const TEST_STORAGE_PATH = './.omnium-test-data';

describe('OmniumNode', () => {
  let node: OmniumNode;

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      await fs.rm(TEST_STORAGE_PATH, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Stop node if running
    if (node) {
      await node.stop();
    }

    // Clean up test data
    try {
      await fs.rm(TEST_STORAGE_PATH, { recursive: true });
    } catch {
      // Ignore
    }
  });

  // ===========================================================================
  // CREATION
  // ===========================================================================
  describe('creation', () => {
    it('creates a local-only node', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        networked: false,
        nodeId: 'test-node',
      });

      expect(node).toBeDefined();
      expect(node.nodeId).toBe('test-node');
      expect(node.isNetworked).toBe(false);
    });

    it('starts with empty ledger', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
      });

      const poolState = node.ledger.pool.getState();
      expect(poolState.currentSupply).toBe(0);
      expect(node.ledger.wallets.getAllWallets().length).toBe(0);
    });

    it('starts with no state (height 0)', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
      });

      expect(node.getHeight()).toBe(0);
      expect(node.getHeadCid()).toBeNull();
    });
  });

  // ===========================================================================
  // LEDGER OPERATIONS
  // ===========================================================================
  describe('ledger operations', () => {
    beforeEach(async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'ledger-test',
      });
    });

    it('creates wallets via ledger', () => {
      const wallet = node.ledger.wallets.createWallet('Alice');
      expect(wallet.name).toBe('Alice');
    });

    it('mints currency via ledger', () => {
      const wallet = node.ledger.wallets.createWallet('Alice');
      const unit = node.ledger.mint(1000, wallet.id);

      expect(unit.magnitude).toBe(1000);
      expect(unit.temporality).toBe(TemporalStratum.T0);

      const balance = node.ledger.wallets.getBalance(wallet.id);
      expect(balance.total).toBe(1000);
    });

    it('transfers between wallets', () => {
      const alice = node.ledger.wallets.createWallet('Alice');
      const bob = node.ledger.wallets.createWallet('Bob');

      const unit = node.ledger.mint(1000, alice.id);
      node.ledger.transfer(unit.id, bob.id);

      const aliceBalance = node.ledger.wallets.getBalance(alice.id);
      const bobBalance = node.ledger.wallets.getBalance(bob.id);

      expect(aliceBalance.total).toBe(0);
      expect(bobBalance.total).toBe(1000);
    });
  });

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================
  describe('persistence', () => {
    beforeEach(async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'persistence-test',
      });
    });

    it('saves state and returns CID', async () => {
      const wallet = node.ledger.wallets.createWallet('Alice');
      node.ledger.mint(500, wallet.id);

      const headCid = await node.save();

      expect(headCid).toBeDefined();
      expect(typeof headCid).toBe('string');
      expect(node.getHeadCid()).toBe(headCid);
    });

    it('increments height on each save', async () => {
      node.ledger.wallets.createWallet('Alice');

      await node.save();
      expect(node.getHeight()).toBe(1);

      await node.save();
      expect(node.getHeight()).toBe(2);

      await node.save();
      expect(node.getHeight()).toBe(3);
    });

    it('loads state from CID', async () => {
      // Create initial state
      const alice = node.ledger.wallets.createWallet('Alice');
      node.ledger.mint(1000, alice.id);
      const headCid = await node.save();

      // Create new node and load from CID
      const node2 = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'load-test',
      });

      await node2.load(headCid);

      const wallets = node2.ledger.wallets.getAllWallets();
      expect(wallets.length).toBe(1);
      expect(wallets[0].name).toBe('Alice');

      const balance = node2.ledger.wallets.getBalance(wallets[0].id);
      expect(balance.total).toBe(1000);

      await node2.stop();
    });
  });

  // ===========================================================================
  // SYNC (CID-based)
  // ===========================================================================
  describe('sync', () => {
    it('compares with remote CID', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'sync-test',
      });

      node.ledger.wallets.createWallet('Alice');
      const headCid = await node.save();

      // Compare with ourselves (should be equal)
      const comparison = await node.compare(headCid);
      expect(comparison.relationship).toBe('equal');
      expect(comparison.heightDiff).toBe(0);
    });

    it('syncs from remote CID when behind', async () => {
      // Create first node with state
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'source-node',
      });

      const alice = node.ledger.wallets.createWallet('Alice');
      node.ledger.mint(1000, alice.id);
      const remoteCid = await node.save();

      // Stop first node to release storage lock
      await node.stop();

      // Create second node using SAME storage (simulates shared content store)
      // In production, this would be network-based content fetching
      const node2 = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'target-node',
      });

      // Sync from the first node's CID
      const result = await node2.syncFromCid(remoteCid);

      expect(result.success).toBe(true);
      expect(result.action).toBe('fast-forward');
      expect(result.statesApplied).toBe(1);

      // Verify state was applied
      const wallets = node2.ledger.wallets.getAllWallets();
      expect(wallets.length).toBe(1);

      // Reassign node for cleanup
      node = node2;
    });
  });

  // ===========================================================================
  // INFO
  // ===========================================================================
  describe('getInfo', () => {
    it('returns node info', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'info-test',
        networked: false,
      });

      const info = node.getInfo();

      expect(info.nodeId).toBe('info-test');
      expect(info.networked).toBe(false);
      expect(info.height).toBe(0);
      expect(info.headCid).toBeNull();
    });

    it('updates info after save', async () => {
      node = await createOmniumNode({
        storagePath: TEST_STORAGE_PATH,
        nodeId: 'info-update-test',
      });

      node.ledger.wallets.createWallet('Test');
      await node.save();

      const info = node.getInfo();
      expect(info.height).toBe(1);
      expect(info.headCid).not.toBeNull();
    });
  });
});
