/**
 * CommunityFund Tests
 *
 * Tests for the locality-based economic sovereignty mechanism.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommunityFund,
  CommunityFundManager,
  createCommunityFundManager,
} from './community-fund.js';

describe('CommunityFund', () => {
  let fund: CommunityFund;

  beforeEach(() => {
    fund = new CommunityFund('community-1', 'Test Community');
  });

  // ===========================================================================
  // BASIC PROPERTIES
  // ===========================================================================
  describe('basic properties', () => {
    it('has correct community ID and name', () => {
      expect(fund.communityId).toBe('community-1');
      expect(fund.communityName).toBe('Test Community');
    });

    it('starts with zero balance', () => {
      expect(fund.getBalance()).toBe(0);
    });
  });

  // ===========================================================================
  // EXIT FEE DEPOSITS
  // ===========================================================================
  describe('exit fee deposits', () => {
    it('accepts exit fee deposits', () => {
      fund.depositExitFee(100, 'unit-1', 'wallet-1', Date.now());
      expect(fund.getBalance()).toBe(100);
    });

    it('accumulates multiple deposits', () => {
      fund.depositExitFee(100, 'unit-1', 'wallet-1', Date.now());
      fund.depositExitFee(50, 'unit-2', 'wallet-2', Date.now());
      fund.depositExitFee(25, 'unit-3', 'wallet-1', Date.now());
      expect(fund.getBalance()).toBe(175);
    });

    it('ignores zero or negative deposits', () => {
      fund.depositExitFee(0, 'unit-1', 'wallet-1', Date.now());
      fund.depositExitFee(-10, 'unit-2', 'wallet-2', Date.now());
      expect(fund.getBalance()).toBe(0);
    });

    it('tracks deposit count', () => {
      fund.depositExitFee(100, 'unit-1', 'wallet-1', Date.now());
      fund.depositExitFee(100, 'unit-2', 'wallet-2', Date.now());
      fund.depositExitFee(100, 'unit-3', 'wallet-3', Date.now());

      const stats = fund.getStats();
      expect(stats.depositCount).toBe(3);
    });
  });

  // ===========================================================================
  // DISBURSEMENTS
  // ===========================================================================
  describe('disbursements', () => {
    beforeEach(() => {
      fund.depositExitFee(1000, 'source', 'wallet-1', Date.now());
    });

    it('allows full disbursement when funds available', () => {
      const actual = fund.disburse(100, 'recipient', 'Grant', Date.now());
      expect(actual).toBe(100);
      expect(fund.getBalance()).toBe(900);
    });

    it('caps disbursement to available balance', () => {
      const actual = fund.disburse(1500, 'recipient', 'Grant', Date.now());
      expect(actual).toBe(1000); // Only 1000 available
      expect(fund.getBalance()).toBe(0);
    });

    it('returns zero for empty fund', () => {
      fund.disburse(1000, 'drain', 'Drain', Date.now());
      const actual = fund.disburse(100, 'recipient', 'Grant', Date.now());
      expect(actual).toBe(0);
    });

    it('handles multiple disbursements correctly', () => {
      fund.disburse(300, 'recipient-1', 'Grant 1', Date.now());
      fund.disburse(300, 'recipient-2', 'Grant 2', Date.now());
      fund.disburse(300, 'recipient-3', 'Grant 3', Date.now());
      expect(fund.getBalance()).toBe(100);
    });

    it('tracks disbursement count', () => {
      fund.disburse(100, 'recipient-1', 'Grant 1', Date.now());
      fund.disburse(100, 'recipient-2', 'Grant 2', Date.now());

      const stats = fund.getStats();
      expect(stats.disbursementCount).toBe(2);
    });

    it('records authorization if provided', () => {
      fund.disburse(100, 'recipient', 'Grant', Date.now(), 'council');
      const disbursements = fund.getRecentDisbursements();
      expect(disbursements[0].authorizedBy).toBe('council');
    });
  });

  // ===========================================================================
  // CAN COVER
  // ===========================================================================
  describe('canCover', () => {
    it('returns true when balance sufficient', () => {
      fund.depositExitFee(100, 'source', 'wallet', Date.now());
      expect(fund.canCover(50)).toBe(true);
      expect(fund.canCover(100)).toBe(true);
    });

    it('returns false when balance insufficient', () => {
      fund.depositExitFee(100, 'source', 'wallet', Date.now());
      expect(fund.canCover(101)).toBe(false);
    });

    it('returns false for empty fund', () => {
      expect(fund.canCover(1)).toBe(false);
    });
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================
  describe('statistics', () => {
    it('tracks total fees collected', () => {
      fund.depositExitFee(100, 'unit-1', 'wallet-1', Date.now());
      fund.depositExitFee(200, 'unit-2', 'wallet-2', Date.now());
      fund.disburse(50, 'recipient', 'Grant', Date.now());

      const stats = fund.getStats();
      expect(stats.totalFeesCollected).toBe(300);
    });

    it('tracks total disbursed', () => {
      fund.depositExitFee(1000, 'source', 'wallet', Date.now());
      fund.disburse(100, 'recipient-1', 'Grant 1', Date.now());
      fund.disburse(200, 'recipient-2', 'Grant 2', Date.now());

      const stats = fund.getStats();
      expect(stats.totalDisbursed).toBe(300);
    });

    it('provides complete stats object', () => {
      fund.depositExitFee(500, 'source', 'wallet', Date.now());
      fund.disburse(200, 'recipient', 'Grant', Date.now());

      const stats = fund.getStats();
      expect(stats).toEqual({
        balance: 300,
        totalFeesCollected: 500,
        totalDisbursed: 200,
        depositCount: 1,
        disbursementCount: 1,
      });
    });
  });

  // ===========================================================================
  // HISTORY / AUDITING
  // ===========================================================================
  describe('history', () => {
    it('records recent deposits', () => {
      const now = Date.now();
      fund.depositExitFee(100, 'unit-1', 'wallet-1', now);
      fund.depositExitFee(200, 'unit-2', 'wallet-2', now + 1000);

      const deposits = fund.getRecentDeposits();
      expect(deposits.length).toBe(2);
      expect(deposits[0].amount).toBe(100);
      expect(deposits[0].fromWallet).toBe('wallet-1');
      expect(deposits[1].amount).toBe(200);
    });

    it('records recent disbursements', () => {
      fund.depositExitFee(1000, 'source', 'wallet', Date.now());

      const now = Date.now();
      fund.disburse(100, 'recipient-1', 'Grant 1', now);
      fund.disburse(200, 'recipient-2', 'Grant 2', now + 1000);

      const disbursements = fund.getRecentDisbursements();
      expect(disbursements.length).toBe(2);
      expect(disbursements[0].amount).toBe(100);
      expect(disbursements[0].recipient).toBe('recipient-1');
      expect(disbursements[1].amount).toBe(200);
    });

    it('limits history by count', () => {
      fund.depositExitFee(1000, 'source', 'wallet', Date.now());
      for (let i = 0; i < 10; i++) {
        fund.disburse(10, `recipient-${i}`, `Grant ${i}`, Date.now());
      }

      const recent = fund.getRecentDisbursements(3);
      expect(recent.length).toBe(3);
    });
  });

  // ===========================================================================
  // EXPORT / IMPORT
  // ===========================================================================
  describe('persistence', () => {
    it('exports state correctly', () => {
      fund.depositExitFee(500, 'source', 'wallet', Date.now());
      fund.disburse(200, 'recipient', 'Grant', Date.now());

      const exported = fund.export();

      expect(exported.communityId).toBe('community-1');
      expect(exported.communityName).toBe('Test Community');
      expect(exported.balance).toBe(300);
      expect(exported.totalFeesCollected).toBe(500);
      expect(exported.totalDisbursed).toBe(200);
    });

    it('imports state correctly', () => {
      const state = {
        communityId: 'community-1',
        communityName: 'Test Community',
        balance: 1000,
        totalFeesCollected: 5000,
        totalDisbursed: 4000,
        depositCount: 100,
        disbursementCount: 80,
      };

      fund.import(state);

      expect(fund.getBalance()).toBe(1000);
      expect(fund.getStats().totalFeesCollected).toBe(5000);
      expect(fund.getStats().totalDisbursed).toBe(4000);
    });
  });

  // ===========================================================================
  // RESET
  // ===========================================================================
  describe('reset', () => {
    it('clears all state', () => {
      fund.depositExitFee(1000, 'source', 'wallet', Date.now());
      fund.disburse(500, 'recipient', 'Grant', Date.now());

      fund.reset();

      expect(fund.getBalance()).toBe(0);
      expect(fund.getStats().totalFeesCollected).toBe(0);
      expect(fund.getStats().depositCount).toBe(0);
      expect(fund.getRecentDeposits().length).toBe(0);
    });
  });
});

// =============================================================================
// COMMUNITY FUND MANAGER
// =============================================================================

describe('CommunityFundManager', () => {
  let manager: CommunityFundManager;

  beforeEach(() => {
    manager = createCommunityFundManager();
  });

  // ===========================================================================
  // FUND MANAGEMENT
  // ===========================================================================
  describe('fund management', () => {
    it('creates funds on demand', () => {
      const fund = manager.getFund('community-1', 'Community One');
      expect(fund).toBeDefined();
      expect(fund.communityId).toBe('community-1');
      expect(fund.communityName).toBe('Community One');
    });

    it('returns existing fund if already created', () => {
      const fund1 = manager.getFund('community-1', 'Community One');
      fund1.depositExitFee(100, 'unit-1', 'wallet-1', Date.now());

      const fund2 = manager.getFund('community-1');
      expect(fund2.getBalance()).toBe(100); // Same fund
    });

    it('tracks whether fund exists', () => {
      expect(manager.hasFund('community-1')).toBe(false);
      manager.getFund('community-1');
      expect(manager.hasFund('community-1')).toBe(true);
    });

    it('uses community ID as name if not provided', () => {
      const fund = manager.getFund('my-community');
      expect(fund.communityName).toBe('my-community');
    });
  });

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================
  describe('convenience methods', () => {
    it('deposits exit fee directly', () => {
      manager.depositExitFee(
        'community-1',
        100,
        'unit-1',
        'wallet-1',
        Date.now(),
        'Community One'
      );

      const fund = manager.getFund('community-1');
      expect(fund.getBalance()).toBe(100);
    });

    it('creates fund if needed when depositing', () => {
      expect(manager.hasFund('new-community')).toBe(false);

      manager.depositExitFee(
        'new-community',
        100,
        'unit-1',
        'wallet-1',
        Date.now(),
        'New Community'
      );

      expect(manager.hasFund('new-community')).toBe(true);
    });
  });

  // ===========================================================================
  // AGGREGATE OPERATIONS
  // ===========================================================================
  describe('aggregate operations', () => {
    beforeEach(() => {
      manager.depositExitFee('community-1', 100, 'u1', 'w1', Date.now());
      manager.depositExitFee('community-2', 200, 'u2', 'w2', Date.now());
      manager.depositExitFee('community-3', 300, 'u3', 'w3', Date.now());
    });

    it('gets all funds', () => {
      const funds = manager.getAllFunds();
      expect(funds.length).toBe(3);
    });

    it('calculates total balance', () => {
      expect(manager.getTotalBalance()).toBe(600);
    });

    it('provides aggregate statistics', () => {
      // Disburse from one community
      manager.getFund('community-1').disburse(50, 'recipient', 'Grant', Date.now());

      const stats = manager.getAggregateStats();
      expect(stats.communityCount).toBe(3);
      expect(stats.totalBalance).toBe(550);
      expect(stats.totalFeesCollected).toBe(600);
      expect(stats.totalDisbursed).toBe(50);
    });
  });

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================
  describe('persistence', () => {
    it('exports all funds', () => {
      manager.depositExitFee('community-1', 100, 'u1', 'w1', Date.now());
      manager.depositExitFee('community-2', 200, 'u2', 'w2', Date.now());

      const exported = manager.export();
      expect(exported.length).toBe(2);
      expect(exported.find((f) => f.communityId === 'community-1')?.balance).toBe(100);
      expect(exported.find((f) => f.communityId === 'community-2')?.balance).toBe(200);
    });

    it('imports all funds', () => {
      const states = [
        {
          communityId: 'c1',
          communityName: 'Community 1',
          balance: 100,
          totalFeesCollected: 500,
          totalDisbursed: 400,
          depositCount: 10,
          disbursementCount: 8,
        },
        {
          communityId: 'c2',
          communityName: 'Community 2',
          balance: 200,
          totalFeesCollected: 300,
          totalDisbursed: 100,
          depositCount: 5,
          disbursementCount: 2,
        },
      ];

      manager.import(states);

      expect(manager.getAllFunds().length).toBe(2);
      expect(manager.getFund('c1').getBalance()).toBe(100);
      expect(manager.getFund('c2').getBalance()).toBe(200);
    });

    it('clears existing funds on import', () => {
      manager.depositExitFee('old-community', 1000, 'u1', 'w1', Date.now());

      manager.import([
        {
          communityId: 'new-community',
          communityName: 'New',
          balance: 100,
          totalFeesCollected: 100,
          totalDisbursed: 0,
          depositCount: 1,
          disbursementCount: 0,
        },
      ]);

      expect(manager.hasFund('old-community')).toBe(false);
      expect(manager.hasFund('new-community')).toBe(true);
    });
  });

  // ===========================================================================
  // RESET
  // ===========================================================================
  describe('reset', () => {
    it('clears all funds', () => {
      manager.depositExitFee('community-1', 100, 'u1', 'w1', Date.now());
      manager.depositExitFee('community-2', 200, 'u2', 'w2', Date.now());

      manager.reset();

      expect(manager.getAllFunds().length).toBe(0);
      expect(manager.getTotalBalance()).toBe(0);
    });
  });

  // ===========================================================================
  // ECONOMIC SCENARIOS
  // ===========================================================================
  describe('economic scenarios', () => {
    it('community accumulates exit fees over time', () => {
      const now = Date.now();

      // Multiple people exit the community over time
      manager.depositExitFee('local-economy', 50, 'u1', 'w1', now);
      manager.depositExitFee('local-economy', 30, 'u2', 'w2', now + 1000);
      manager.depositExitFee('local-economy', 70, 'u3', 'w3', now + 2000);

      const fund = manager.getFund('local-economy');
      expect(fund.getBalance()).toBe(150);
      expect(fund.getStats().depositCount).toBe(3);
    });

    it('community uses funds for local grants', () => {
      // Community accumulates exit fees
      manager.depositExitFee('village', 1000, 'u1', 'w1', Date.now());

      const fund = manager.getFund('village');

      // Community council decides to fund local projects
      fund.disburse(200, 'local-school', 'Education grant', Date.now(), 'village-council');
      fund.disburse(300, 'community-garden', 'Green spaces', Date.now(), 'village-council');

      expect(fund.getBalance()).toBe(500);
      expect(fund.getStats().totalDisbursed).toBe(500);

      const disbursements = fund.getRecentDisbursements();
      expect(disbursements[0].recipient).toBe('local-school');
      expect(disbursements[0].authorizedBy).toBe('village-council');
    });

    it('multiple communities maintain independent funds', () => {
      manager.depositExitFee('urban', 1000, 'u1', 'w1', Date.now());
      manager.depositExitFee('rural', 500, 'u2', 'w2', Date.now());
      manager.depositExitFee('coastal', 750, 'u3', 'w3', Date.now());

      expect(manager.getFund('urban').getBalance()).toBe(1000);
      expect(manager.getFund('rural').getBalance()).toBe(500);
      expect(manager.getFund('coastal').getBalance()).toBe(750);

      const stats = manager.getAggregateStats();
      expect(stats.communityCount).toBe(3);
      expect(stats.totalBalance).toBe(2250);
    });
  });
});
