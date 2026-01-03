/**
 * Wallet Tests
 *
 * Tests for wallet management and balance calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WalletManager } from './wallet.js';
import { TemporalStratum } from '../core/types.js';
import { createTestUnit } from '../test-utils.js';

describe('WalletManager', () => {
  let manager: WalletManager;

  beforeEach(() => {
    manager = new WalletManager();
  });

  // =========================================================================
  // CREATE WALLET
  // =========================================================================
  describe('createWallet', () => {
    it('creates wallet with specified name', () => {
      const wallet = manager.createWallet('Alice');
      expect(wallet.name).toBe('Alice');
    });

    it('generates unique ID', () => {
      const w1 = manager.createWallet('Alice');
      const w2 = manager.createWallet('Bob');
      expect(w1.id).not.toBe(w2.id);
    });

    it('initializes with empty communities', () => {
      const wallet = manager.createWallet('Alice');
      expect(wallet.communities.size).toBe(0);
    });

    it('initializes with empty validPurposes', () => {
      const wallet = manager.createWallet('Alice');
      expect(wallet.validPurposes.size).toBe(0);
    });

    it('records createdAt', () => {
      const before = Date.now();
      const wallet = manager.createWallet('Alice');
      const after = Date.now();

      expect(wallet.createdAt).toBeGreaterThanOrEqual(before);
      expect(wallet.createdAt).toBeLessThanOrEqual(after);
    });
  });

  // =========================================================================
  // GET WALLET
  // =========================================================================
  describe('getWallet', () => {
    it('returns wallet by ID', () => {
      const created = manager.createWallet('Alice');
      const found = manager.getWallet(created.id);
      expect(found).toEqual(created);
    });

    it('returns undefined for unknown ID', () => {
      expect(manager.getWallet('unknown')).toBeUndefined();
    });
  });

  describe('getAllWallets', () => {
    it('returns all wallets', () => {
      manager.createWallet('Alice');
      manager.createWallet('Bob');
      manager.createWallet('Carol');

      expect(manager.getAllWallets().length).toBe(3);
    });

    it('returns empty array when no wallets', () => {
      expect(manager.getAllWallets().length).toBe(0);
    });
  });

  // =========================================================================
  // UNIT MANAGEMENT
  // =========================================================================
  describe('addUnit', () => {
    it('stores unit', () => {
      const wallet = manager.createWallet('Alice');
      const unit = createTestUnit({ walletId: wallet.id });

      manager.addUnit(unit);

      expect(manager.getUnit(unit.id)).toEqual(unit);
    });

    it('associates unit with wallet', () => {
      const wallet = manager.createWallet('Alice');
      const unit = createTestUnit({ walletId: wallet.id });

      manager.addUnit(unit);

      expect(manager.getUnits(wallet.id)).toContainEqual(unit);
    });
  });

  describe('removeUnit', () => {
    it('removes unit from storage', () => {
      const wallet = manager.createWallet('Alice');
      const unit = createTestUnit({ walletId: wallet.id });
      manager.addUnit(unit);

      manager.removeUnit(unit.id);

      expect(manager.getUnit(unit.id)).toBeUndefined();
    });

    it('removes unit from wallet association', () => {
      const wallet = manager.createWallet('Alice');
      const unit = createTestUnit({ walletId: wallet.id });
      manager.addUnit(unit);

      manager.removeUnit(unit.id);

      expect(manager.getUnits(wallet.id)).not.toContainEqual(unit);
    });

    it('handles removing non-existent unit', () => {
      expect(() => manager.removeUnit('unknown')).not.toThrow();
    });
  });

  describe('updateUnit', () => {
    it('updates unit in storage', () => {
      const wallet = manager.createWallet('Alice');
      const unit = createTestUnit({ walletId: wallet.id, magnitude: 100 });
      manager.addUnit(unit);

      const updated = { ...unit, magnitude: 50 };
      manager.updateUnit(updated);

      expect(manager.getUnit(unit.id)?.magnitude).toBe(50);
    });

    it('updates wallet association when walletId changes', () => {
      const alice = manager.createWallet('Alice');
      const bob = manager.createWallet('Bob');
      const unit = createTestUnit({ walletId: alice.id });
      manager.addUnit(unit);

      const moved = { ...unit, walletId: bob.id };
      manager.updateUnit(moved);

      expect(manager.getUnits(alice.id)).not.toContainEqual(moved);
      expect(manager.getUnits(bob.id)).toContainEqual(moved);
    });
  });

  describe('getUnits', () => {
    it('returns only units for specified wallet', () => {
      const alice = manager.createWallet('Alice');
      const bob = manager.createWallet('Bob');

      const unit1 = createTestUnit({ walletId: alice.id, magnitude: 100 });
      const unit2 = createTestUnit({ walletId: bob.id, magnitude: 200 });

      manager.addUnit(unit1);
      manager.addUnit(unit2);

      const aliceUnits = manager.getUnits(alice.id);
      expect(aliceUnits.length).toBe(1);
      expect(aliceUnits[0].magnitude).toBe(100);
    });

    it('returns empty array for wallet with no units', () => {
      const wallet = manager.createWallet('Alice');
      expect(manager.getUnits(wallet.id)).toEqual([]);
    });
  });

  describe('getAllUnits', () => {
    it('returns all units across wallets', () => {
      const alice = manager.createWallet('Alice');
      const bob = manager.createWallet('Bob');

      manager.addUnit(createTestUnit({ walletId: alice.id }));
      manager.addUnit(createTestUnit({ walletId: bob.id }));
      manager.addUnit(createTestUnit({ walletId: alice.id }));

      expect(manager.getAllUnits().length).toBe(3);
    });
  });

  // =========================================================================
  // BALANCE CALCULATIONS
  // =========================================================================
  describe('getBalance', () => {
    it('calculates total correctly', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(createTestUnit({ walletId: wallet.id, magnitude: 100 }));
      manager.addUnit(createTestUnit({ walletId: wallet.id, magnitude: 50 }));

      const balance = manager.getBalance(wallet.id);
      expect(balance.total).toBe(150);
    });

    it('breaks down by temporality', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 100,
          temporality: TemporalStratum.T0,
        })
      );
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 50,
          temporality: TemporalStratum.T2,
        })
      );

      const balance = manager.getBalance(wallet.id);
      expect(balance.byTemporality[TemporalStratum.T0]).toBe(100);
      expect(balance.byTemporality[TemporalStratum.T2]).toBe(50);
      expect(balance.byTemporality[TemporalStratum.T1]).toBe(0);
    });

    it('calculates global correctly', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 100,
          locality: new Set(), // Global
        })
      );
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 50,
          locality: new Set(['comm-1']), // Local
        })
      );

      const balance = manager.getBalance(wallet.id);
      expect(balance.global).toBe(100);
    });

    it('breaks down by locality', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 100,
          locality: new Set(['comm-1']),
        })
      );
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 50,
          locality: new Set(['comm-1', 'comm-2']),
        })
      );

      const balance = manager.getBalance(wallet.id);
      expect(balance.byLocality.get('comm-1')).toBe(150); // Both units
      expect(balance.byLocality.get('comm-2')).toBe(50); // Second unit only
    });

    it('calculates unrestricted correctly', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 100,
          purpose: new Set(), // Unrestricted
        })
      );
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 50,
          purpose: new Set(['health']), // Restricted
        })
      );

      const balance = manager.getBalance(wallet.id);
      expect(balance.unrestricted).toBe(100);
    });

    it('breaks down by purpose', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 100,
          purpose: new Set(['health']),
        })
      );
      manager.addUnit(
        createTestUnit({
          walletId: wallet.id,
          magnitude: 50,
          purpose: new Set(['health', 'education']),
        })
      );

      const balance = manager.getBalance(wallet.id);
      expect(balance.byPurpose.get('health')).toBe(150);
      expect(balance.byPurpose.get('education')).toBe(50);
    });

    it('returns zeros for empty wallet', () => {
      const wallet = manager.createWallet('Alice');
      const balance = manager.getBalance(wallet.id);

      expect(balance.total).toBe(0);
      expect(balance.global).toBe(0);
      expect(balance.unrestricted).toBe(0);
    });
  });

  // =========================================================================
  // COMMUNITY AND PURPOSE MEMBERSHIP
  // =========================================================================
  describe('joinCommunity', () => {
    it('adds community to wallet', () => {
      const wallet = manager.createWallet('Alice');
      manager.joinCommunity(wallet.id, 'comm-1');

      expect(manager.getWallet(wallet.id)?.communities.has('comm-1')).toBe(
        true
      );
    });

    it('throws for unknown wallet', () => {
      expect(() => manager.joinCommunity('unknown', 'comm-1')).toThrow(
        'not found'
      );
    });
  });

  describe('registerPurpose', () => {
    it('adds purpose to wallet', () => {
      const wallet = manager.createWallet('Alice');
      manager.registerPurpose(wallet.id, 'health');

      expect(manager.getWallet(wallet.id)?.validPurposes.has('health')).toBe(
        true
      );
    });

    it('throws for unknown wallet', () => {
      expect(() => manager.registerPurpose('unknown', 'health')).toThrow(
        'not found'
      );
    });
  });

  // =========================================================================
  // CLEAR AND RESTORE
  // =========================================================================
  describe('clear', () => {
    it('removes all wallets and units', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(createTestUnit({ walletId: wallet.id }));

      manager.clear();

      expect(manager.getAllWallets().length).toBe(0);
      expect(manager.getAllUnits().length).toBe(0);
    });
  });

  describe('restoreWallet', () => {
    it('restores wallet from object', () => {
      const wallet = {
        id: 'restored-id',
        name: 'Restored',
        createdAt: 1234567890,
        communities: new Set<string>(),
        validPurposes: new Set<string>(),
      };

      manager.restoreWallet(wallet);

      expect(manager.getWallet('restored-id')?.name).toBe('Restored');
    });
  });

  // =========================================================================
  // WALLET STATUS
  // =========================================================================
  describe('walletStatus', () => {
    it('includes wallet name', () => {
      const wallet = manager.createWallet('Alice');
      const status = manager.walletStatus(wallet.id);

      expect(status).toContain('Alice');
    });

    it('includes balance', () => {
      const wallet = manager.createWallet('Alice');
      manager.addUnit(createTestUnit({ walletId: wallet.id, magnitude: 100 }));

      const status = manager.walletStatus(wallet.id);
      expect(status).toContain('100.00');
    });

    it('returns error for unknown wallet', () => {
      const status = manager.walletStatus('unknown');
      expect(status).toContain('not found');
    });
  });
});
