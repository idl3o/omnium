/**
 * DividendPool Tests
 *
 * Tests for the time preference arbitrage mechanism.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DividendPool, createDividendPool } from './dividend-pool.js';

describe('DividendPool', () => {
  let pool: DividendPool;

  beforeEach(() => {
    pool = new DividendPool();
  });

  // ===========================================================================
  // BASIC OPERATIONS
  // ===========================================================================
  describe('basic operations', () => {
    it('starts with zero balance', () => {
      expect(pool.getBalance()).toBe(0);
    });

    it('accepts demurrage deposits', () => {
      pool.depositDemurrage(100, 'unit-1', Date.now());
      expect(pool.getBalance()).toBe(100);
    });

    it('accumulates multiple deposits', () => {
      pool.depositDemurrage(100, 'unit-1', Date.now());
      pool.depositDemurrage(50, 'unit-2', Date.now());
      pool.depositDemurrage(25, 'unit-3', Date.now());
      expect(pool.getBalance()).toBe(175);
    });

    it('ignores zero or negative deposits', () => {
      pool.depositDemurrage(0, 'unit-1', Date.now());
      pool.depositDemurrage(-10, 'unit-2', Date.now());
      expect(pool.getBalance()).toBe(0);
    });
  });

  // ===========================================================================
  // DIVIDEND WITHDRAWALS
  // ===========================================================================
  describe('dividend withdrawals', () => {
    beforeEach(() => {
      // Start with 1000 in the pool
      pool.depositDemurrage(1000, 'source', Date.now());
    });

    it('allows full withdrawal when funds available', () => {
      const actual = pool.withdrawDividend(100, 'unit-1', Date.now());
      expect(actual).toBe(100);
      expect(pool.getBalance()).toBe(900);
    });

    it('caps withdrawal to available balance', () => {
      const actual = pool.withdrawDividend(1500, 'unit-1', Date.now());
      expect(actual).toBe(1000); // Only 1000 available
      expect(pool.getBalance()).toBe(0);
    });

    it('returns zero for empty pool', () => {
      pool.withdrawDividend(1000, 'drain', Date.now()); // Drain the pool
      const actual = pool.withdrawDividend(100, 'unit-1', Date.now());
      expect(actual).toBe(0);
    });

    it('handles multiple withdrawals correctly', () => {
      pool.withdrawDividend(300, 'unit-1', Date.now());
      pool.withdrawDividend(300, 'unit-2', Date.now());
      pool.withdrawDividend(300, 'unit-3', Date.now());
      expect(pool.getBalance()).toBe(100);
    });

    it('ignores zero or negative withdrawal requests', () => {
      const actual1 = pool.withdrawDividend(0, 'unit-1', Date.now());
      const actual2 = pool.withdrawDividend(-10, 'unit-2', Date.now());
      expect(actual1).toBe(0);
      expect(actual2).toBe(0);
      expect(pool.getBalance()).toBe(1000);
    });
  });

  // ===========================================================================
  // FUNDING RATIO
  // ===========================================================================
  describe('funding ratio', () => {
    it('returns 1.0 when no withdrawals requested', () => {
      expect(pool.getFundingRatio()).toBe(1.0);
    });

    it('returns 1.0 when all withdrawals fully funded', () => {
      pool.depositDemurrage(1000, 'source', Date.now());
      pool.withdrawDividend(100, 'unit-1', Date.now());
      pool.withdrawDividend(200, 'unit-2', Date.now());
      expect(pool.getFundingRatio()).toBe(1.0);
    });

    it('returns < 1.0 when some withdrawals underfunded', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      pool.withdrawDividend(200, 'unit-1', Date.now()); // Requested 200, got 100
      expect(pool.getFundingRatio()).toBe(0.5);
    });

    it('tracks cumulative funding ratio', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      pool.withdrawDividend(100, 'unit-1', Date.now()); // 100/100 = 1.0
      pool.withdrawDividend(100, 'unit-2', Date.now()); // 0/100 = 0.0
      // Total: 100 distributed / 200 requested = 0.5
      expect(pool.getFundingRatio()).toBe(0.5);
    });
  });

  // ===========================================================================
  // CAN FULLY FUND
  // ===========================================================================
  describe('canFullyFund', () => {
    it('returns true when balance sufficient', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      expect(pool.canFullyFund(50)).toBe(true);
      expect(pool.canFullyFund(100)).toBe(true);
    });

    it('returns false when balance insufficient', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      expect(pool.canFullyFund(101)).toBe(false);
    });

    it('returns false for empty pool', () => {
      expect(pool.canFullyFund(1)).toBe(false);
    });
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================
  describe('statistics', () => {
    it('tracks deposit count', () => {
      pool.depositDemurrage(100, 'unit-1', Date.now());
      pool.depositDemurrage(100, 'unit-2', Date.now());
      pool.depositDemurrage(100, 'unit-3', Date.now());

      const stats = pool.getStats();
      expect(stats.depositCount).toBe(3);
    });

    it('tracks withdrawal count', () => {
      pool.depositDemurrage(1000, 'source', Date.now());
      pool.withdrawDividend(100, 'unit-1', Date.now());
      pool.withdrawDividend(100, 'unit-2', Date.now());

      const stats = pool.getStats();
      expect(stats.withdrawalCount).toBe(2);
    });

    it('tracks total demurrage collected', () => {
      pool.depositDemurrage(100, 'unit-1', Date.now());
      pool.depositDemurrage(200, 'unit-2', Date.now());
      pool.withdrawDividend(50, 'out', Date.now());

      const stats = pool.getStats();
      expect(stats.totalDemurrageCollected).toBe(300);
    });

    it('tracks total dividends distributed', () => {
      pool.depositDemurrage(1000, 'source', Date.now());
      pool.withdrawDividend(100, 'unit-1', Date.now());
      pool.withdrawDividend(200, 'unit-2', Date.now());

      const stats = pool.getStats();
      expect(stats.totalDividendsDistributed).toBe(300);
    });

    it('provides complete stats object', () => {
      pool.depositDemurrage(500, 'source', Date.now());
      pool.withdrawDividend(200, 'unit-1', Date.now());

      const stats = pool.getStats();
      expect(stats).toEqual({
        balance: 300,
        totalDemurrageCollected: 500,
        totalDividendsDistributed: 200,
        depositCount: 1,
        withdrawalCount: 1,
        fundingRatio: 1.0,
      });
    });
  });

  // ===========================================================================
  // HISTORY / AUDITING
  // ===========================================================================
  describe('history', () => {
    it('records recent deposits', () => {
      const now = Date.now();
      pool.depositDemurrage(100, 'unit-1', now);
      pool.depositDemurrage(200, 'unit-2', now + 1000);

      const deposits = pool.getRecentDeposits();
      expect(deposits.length).toBe(2);
      expect(deposits[0].amount).toBe(100);
      expect(deposits[1].amount).toBe(200);
    });

    it('records recent withdrawals', () => {
      pool.depositDemurrage(1000, 'source', Date.now());

      const now = Date.now();
      pool.withdrawDividend(100, 'unit-1', now);
      pool.withdrawDividend(200, 'unit-2', now + 1000);

      const withdrawals = pool.getRecentWithdrawals();
      expect(withdrawals.length).toBe(2);
      expect(withdrawals[0].amount).toBe(100);
      expect(withdrawals[1].amount).toBe(200);
    });

    it('tracks whether withdrawals were fully funded', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      pool.withdrawDividend(50, 'unit-1', Date.now()); // Fully funded
      pool.withdrawDividend(100, 'unit-2', Date.now()); // Underfunded (only 50 left)

      const withdrawals = pool.getRecentWithdrawals();
      expect(withdrawals[0].fullyFunded).toBe(true);
      expect(withdrawals[1].fullyFunded).toBe(false);
    });

    it('limits history by count', () => {
      pool.depositDemurrage(1000, 'source', Date.now());
      for (let i = 0; i < 10; i++) {
        pool.withdrawDividend(10, `unit-${i}`, Date.now());
      }

      const recent = pool.getRecentWithdrawals(3);
      expect(recent.length).toBe(3);
    });
  });

  // ===========================================================================
  // EXPORT / IMPORT
  // ===========================================================================
  describe('persistence', () => {
    it('exports state correctly', () => {
      pool.depositDemurrage(500, 'source', Date.now());
      pool.withdrawDividend(200, 'unit-1', Date.now());

      const exported = pool.export();

      expect(exported.balance).toBe(300);
      expect(exported.totalDemurrageCollected).toBe(500);
      expect(exported.totalDividendsDistributed).toBe(200);
    });

    it('imports state correctly', () => {
      const state = {
        balance: 1000,
        totalDemurrageCollected: 5000,
        totalDividendsDistributed: 4000,
        totalDividendsRequested: 4500,
        depositCount: 100,
        withdrawalCount: 80,
      };

      pool.import(state);

      expect(pool.getBalance()).toBe(1000);
      expect(pool.getStats().totalDemurrageCollected).toBe(5000);
      expect(pool.getStats().totalDividendsDistributed).toBe(4000);
    });

    it('preserves funding ratio through export/import', () => {
      pool.depositDemurrage(100, 'source', Date.now());
      pool.withdrawDividend(200, 'unit-1', Date.now()); // 100/200 = 0.5

      const exported = pool.export();
      const pool2 = new DividendPool();
      pool2.import(exported);

      expect(pool2.getFundingRatio()).toBe(0.5);
    });
  });

  // ===========================================================================
  // RESET
  // ===========================================================================
  describe('reset', () => {
    it('clears all state', () => {
      pool.depositDemurrage(1000, 'source', Date.now());
      pool.withdrawDividend(500, 'unit-1', Date.now());

      pool.reset();

      expect(pool.getBalance()).toBe(0);
      expect(pool.getStats().totalDemurrageCollected).toBe(0);
      expect(pool.getStats().depositCount).toBe(0);
      expect(pool.getRecentDeposits().length).toBe(0);
    });
  });

  // ===========================================================================
  // FACTORY
  // ===========================================================================
  describe('createDividendPool', () => {
    it('creates a new pool', () => {
      const newPool = createDividendPool();
      expect(newPool).toBeInstanceOf(DividendPool);
      expect(newPool.getBalance()).toBe(0);
    });
  });

  // ===========================================================================
  // ECONOMIC SCENARIOS
  // ===========================================================================
  describe('economic scenarios', () => {
    it('balances demurrage and dividends over time', () => {
      // Simulate: 100 T0 units paying 2% demurrage, 50 T2 units earning 3%
      const t0Supply = 100 * 100; // 100 units * 100 magnitude
      const t2Supply = 50 * 100; // 50 units * 100 magnitude

      const demurrageRate = 0.02;
      const dividendRate = 0.03;

      // One year of demurrage
      const demurrageCollected = t0Supply * demurrageRate;
      pool.depositDemurrage(demurrageCollected, 'all-t0', Date.now());

      // One year of dividends
      const dividendsRequested = t2Supply * dividendRate;
      const actual = pool.withdrawDividend(dividendsRequested, 'all-t2', Date.now());

      // In this scenario: 200 demurrage, 150 dividends requested
      // All dividends should be funded with 50 left over
      expect(pool.getBalance()).toBe(50);
      expect(actual).toBe(150);
      expect(pool.getFundingRatio()).toBe(1.0);
    });

    it('underfunds dividends when insufficient demurrage', () => {
      // More dividend demand than demurrage supply
      const demurrageCollected = 100;
      const dividendsRequested = 150;

      pool.depositDemurrage(demurrageCollected, 'all-t0', Date.now());
      const actual = pool.withdrawDividend(dividendsRequested, 'all-t2', Date.now());

      expect(actual).toBe(100); // Capped at available
      expect(pool.getBalance()).toBe(0);
      expect(pool.getFundingRatio()).toBeCloseTo(100 / 150, 4);
    });

    it('accumulates surplus for future dividends', () => {
      // Year 1: High demurrage, low dividend demand
      pool.depositDemurrage(200, 'year-1', Date.now());
      pool.withdrawDividend(100, 'year-1-div', Date.now());

      // Year 2: Low demurrage, high dividend demand
      pool.depositDemurrage(50, 'year-2', Date.now());
      const actual = pool.withdrawDividend(150, 'year-2-div', Date.now());

      // Should be able to fund from accumulated surplus
      expect(actual).toBe(150); // 100 surplus + 50 new = 150
      expect(pool.getFundingRatio()).toBe(1.0);
    });
  });
});
