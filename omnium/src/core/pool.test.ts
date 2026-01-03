/**
 * Commons Pool Tests
 *
 * Tests for minting, burning, and supply invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommonsPool } from './pool.js';
import { TemporalStratum } from './types.js';
import { createTestUnit } from '../test-utils.js';

describe('CommonsPool', () => {
  let pool: CommonsPool;

  beforeEach(() => {
    pool = new CommonsPool();
  });

  // =========================================================================
  // MINTING
  // =========================================================================
  describe('mint', () => {
    it('creates a unit with specified magnitude', () => {
      const unit = pool.mint(100, 'wallet-1');
      expect(unit.magnitude).toBe(100);
    });

    it('assigns unit to specified wallet', () => {
      const unit = pool.mint(100, 'wallet-1');
      expect(unit.walletId).toBe('wallet-1');
    });

    it('creates T0 (immediate) units', () => {
      const unit = pool.mint(100, 'wallet-1');
      expect(unit.temporality).toBe(TemporalStratum.T0);
    });

    it('creates global units (no locality)', () => {
      const unit = pool.mint(100, 'wallet-1');
      expect(unit.locality.size).toBe(0);
    });

    it('creates unrestricted units (no purpose)', () => {
      const unit = pool.mint(100, 'wallet-1');
      expect(unit.purpose.size).toBe(0);
    });

    it('updates totalMinted', () => {
      pool.mint(100, 'wallet-1');
      expect(pool.getState().totalMinted).toBe(100);

      pool.mint(50, 'wallet-1');
      expect(pool.getState().totalMinted).toBe(150);
    });

    it('updates currentSupply', () => {
      pool.mint(100, 'wallet-1');
      expect(pool.getState().currentSupply).toBe(100);

      pool.mint(50, 'wallet-1');
      expect(pool.getState().currentSupply).toBe(150);
    });

    it('records transaction', () => {
      pool.mint(100, 'wallet-1');
      const txs = pool.getTransactions();

      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe('mint');
    });

    it('throws for zero amount', () => {
      expect(() => pool.mint(0, 'wallet-1')).toThrow('positive');
    });

    it('throws for negative amount', () => {
      expect(() => pool.mint(-10, 'wallet-1')).toThrow('positive');
    });

    it('includes note in provenance', () => {
      const unit = pool.mint(100, 'wallet-1', 'Test mint');
      expect(unit.provenance[0].note).toBe('Test mint');
    });

    it('uses current simulation time', () => {
      const fixedTime = 1000000;
      pool.setTime(fixedTime);

      const unit = pool.mint(100, 'wallet-1');
      expect(unit.createdAt).toBe(fixedTime);
    });
  });

  // =========================================================================
  // BURNING
  // =========================================================================
  describe('burn', () => {
    it('updates totalBurned', () => {
      const unit = pool.mint(100, 'wallet-1');
      pool.burn(unit);

      expect(pool.getState().totalBurned).toBe(100);
    });

    it('reduces currentSupply', () => {
      const unit = pool.mint(100, 'wallet-1');
      pool.burn(unit);

      expect(pool.getState().currentSupply).toBe(0);
    });

    it('records transaction', () => {
      const unit = pool.mint(100, 'wallet-1');
      pool.burn(unit);

      const txs = pool.getTransactions();
      expect(txs.length).toBe(2); // mint + burn
      expect(txs[1].type).toBe('burn');
    });

    it('returns transaction with unit ID', () => {
      const unit = pool.mint(100, 'wallet-1');
      const tx = pool.burn(unit);

      expect(tx.inputUnits).toContain(unit.id);
    });
  });

  // =========================================================================
  // SUPPLY INVARIANT
  // =========================================================================
  describe('supply invariant', () => {
    it('currentSupply = totalMinted - totalBurned', () => {
      pool.mint(100, 'wallet-1');
      pool.mint(50, 'wallet-2');

      const unit1 = pool.mint(30, 'wallet-1');
      pool.burn(unit1);

      const state = pool.getState();
      expect(state.currentSupply).toBe(state.totalMinted - state.totalBurned);
    });

    it('maintains invariant after multiple operations', () => {
      // Mint some
      pool.mint(100, 'wallet-1');
      pool.mint(200, 'wallet-2');
      pool.mint(300, 'wallet-3');

      // Burn some
      const unit = pool.mint(50, 'wallet-1');
      pool.burn(unit);

      // Fee collection
      const unit2 = pool.mint(100, 'wallet-1');
      pool.collectFee(unit2, 10);

      const state = pool.getState();
      expect(state.currentSupply).toBe(state.totalMinted - state.totalBurned);
    });
  });

  // =========================================================================
  // FEE COLLECTION
  // =========================================================================
  describe('collectFee', () => {
    it('reduces unit magnitude', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const result = pool.collectFee(unit, 10);

      expect(result.magnitude).toBe(90);
    });

    it('updates totalBurned', () => {
      const unit = createTestUnit({ magnitude: 100 });
      pool.collectFee(unit, 10);

      expect(pool.getState().totalBurned).toBe(10);
    });

    it('reduces currentSupply', () => {
      pool.mint(100, 'wallet-1'); // Start with supply
      const unit = createTestUnit({ magnitude: 50 });
      pool.collectFee(unit, 5);

      expect(pool.getState().currentSupply).toBe(95);
    });

    it('returns unchanged unit for zero fee', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const result = pool.collectFee(unit, 0);

      expect(result.magnitude).toBe(100);
    });

    it('throws when fee exceeds magnitude', () => {
      const unit = createTestUnit({ magnitude: 100 });
      expect(() => pool.collectFee(unit, 100)).toThrow('cannot exceed');
      expect(() => pool.collectFee(unit, 150)).toThrow('cannot exceed');
    });
  });

  // =========================================================================
  // TIME MANAGEMENT
  // =========================================================================
  describe('time management', () => {
    it('setTime updates currentTime', () => {
      pool.setTime(1000000);
      expect(pool.getTime()).toBe(1000000);
    });

    it('advanceTime increments currentTime', () => {
      pool.setTime(1000000);
      pool.advanceTime(5000);

      expect(pool.getTime()).toBe(1005000);
    });

    it('advanceTime accumulates', () => {
      pool.setTime(0);
      pool.advanceTime(1000);
      pool.advanceTime(2000);
      pool.advanceTime(3000);

      expect(pool.getTime()).toBe(6000);
    });
  });

  // =========================================================================
  // STATE RESTORE
  // =========================================================================
  describe('restoreState', () => {
    it('restores all state values', () => {
      pool.restoreState({
        totalMinted: 1000,
        totalBurned: 200,
        currentSupply: 800,
        currentTime: 12345,
      });

      const state = pool.getState();
      expect(state.totalMinted).toBe(1000);
      expect(state.totalBurned).toBe(200);
      expect(state.currentSupply).toBe(800);
      expect(state.currentTime).toBe(12345);
    });
  });

  // =========================================================================
  // STATUS
  // =========================================================================
  describe('status', () => {
    it('includes all metrics', () => {
      pool.mint(100, 'wallet-1');
      const status = pool.status();

      expect(status).toContain('Minted');
      expect(status).toContain('Burned');
      expect(status).toContain('Supply');
    });
  });
});
