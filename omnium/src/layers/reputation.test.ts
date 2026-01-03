/**
 * Reputation Layer Tests
 *
 * Tests for reputation scoring, provenance analysis, and money quality.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeReputation,
  getReputationScore,
  isCleanMoney,
  isWellCirculated,
  getProvenanceStory,
  stripReputation,
} from './reputation.js';
import { ProvenanceType, ProvenanceEntry } from '../core/types.js';
import { createTestUnit, TIME } from '../test-utils.js';

describe('Reputation Layer', () => {
  // =========================================================================
  // ANALYZE REPUTATION
  // =========================================================================
  describe('analyzeReputation', () => {
    it('returns zeros for empty provenance', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const emptyUnit = { ...unit, provenance: [] };

      const breakdown = analyzeReputation(emptyUnit);

      expect(breakdown.total).toBe(0);
      expect(breakdown.diversity).toBe(0);
      expect(breakdown.depth).toBe(0);
      expect(breakdown.earnedRatio).toBe(0);
      expect(breakdown.socialBreadth).toBe(0);
      expect(breakdown.maturity).toBe(0);
    });

    it('calculates diversity based on provenance types', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Add different types
      unit.provenance.push(
        { timestamp: Date.now(), type: ProvenanceType.Earned, amount: 100, transactionId: 't1' },
        { timestamp: Date.now(), type: ProvenanceType.Gifted, amount: 100, transactionId: 't2' },
        { timestamp: Date.now(), type: ProvenanceType.Invested, amount: 100, transactionId: 't3' }
      );

      const breakdown = analyzeReputation(unit);

      // 4 types out of 8 total = 0.5, capped contribution
      expect(breakdown.diversity).toBeGreaterThan(0);
    });

    it('calculates depth based on chain length', () => {
      const shortUnit = createTestUnit({ magnitude: 100 });
      const longUnit = createTestUnit({ magnitude: 100 });

      // Add many entries to longUnit
      for (let i = 0; i < 50; i++) {
        longUnit.provenance.push({
          timestamp: Date.now() + i,
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: `t${i}`,
        });
      }

      expect(analyzeReputation(longUnit).depth).toBeGreaterThan(
        analyzeReputation(shortUnit).depth
      );
    });

    it('calculates earned ratio', () => {
      const unit = createTestUnit({
        magnitude: 100,
        provenanceType: ProvenanceType.Earned, // Start as earned
      });
      unit.provenance.push(
        { timestamp: Date.now(), type: ProvenanceType.Earned, amount: 100, transactionId: 't1' },
        { timestamp: Date.now(), type: ProvenanceType.Earned, amount: 100, transactionId: 't2' }
      );

      const breakdown = analyzeReputation(unit);
      // 3 earned out of 3 total = 100%
      expect(breakdown.earnedRatio).toBe(1);
    });

    it('calculates social breadth from unique wallets', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Add transfers involving multiple wallets
      for (let i = 0; i < 5; i++) {
        unit.provenance.push({
          timestamp: Date.now() + i,
          type: ProvenanceType.Gifted,
          fromWallet: `wallet-${i}`,
          toWallet: `wallet-${i + 1}`,
          amount: 100,
          transactionId: `t${i}`,
        });
      }

      const breakdown = analyzeReputation(unit);
      expect(breakdown.socialBreadth).toBeGreaterThan(0);
    });

    it('caps total score at 1', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Add lots of diverse history
      for (let i = 0; i < 100; i++) {
        unit.provenance.push({
          timestamp: Date.now() - i * TIME.MS_PER_DAY * 100,
          type: ProvenanceType.Earned,
          fromWallet: `wallet-${i}`,
          toWallet: `wallet-${i + 1}`,
          amount: 100,
          transactionId: `t${i}`,
        });
      }

      const breakdown = analyzeReputation(unit);
      expect(breakdown.total).toBeLessThanOrEqual(1);
    });

    it('uses correct weights', () => {
      // The weights are: diversity 0.15, depth 0.2, earnedRatio 0.3, socialBreadth 0.2, maturity 0.15
      const unit = createTestUnit({ magnitude: 100 });
      // Fresh unit with just minted provenance
      const breakdown = analyzeReputation(unit);

      // Total should be weighted sum
      const expectedTotal =
        breakdown.diversity * 0.15 +
        breakdown.depth * 0.2 +
        breakdown.earnedRatio * 0.3 +
        breakdown.socialBreadth * 0.2 +
        breakdown.maturity * 0.15;

      expect(breakdown.total).toBeCloseTo(Math.min(expectedTotal, 1), 6);
    });
  });

  // =========================================================================
  // GET REPUTATION SCORE
  // =========================================================================
  describe('getReputationScore', () => {
    it('returns total from analyzeReputation', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const score = getReputationScore(unit);
      const breakdown = analyzeReputation(unit);

      expect(score).toBe(breakdown.total);
    });

    it('is between 0 and 1', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const score = getReputationScore(unit);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // IS CLEAN MONEY
  // =========================================================================
  describe('isCleanMoney', () => {
    it('returns true for mostly earned money', () => {
      const unit = createTestUnit({
        magnitude: 100,
        provenanceType: ProvenanceType.Earned,
      });
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Earned,
        amount: 100,
        transactionId: 't1',
      });

      expect(isCleanMoney(unit)).toBe(true);
    });

    it('returns false for mostly minted money', () => {
      const unit = createTestUnit({ magnitude: 100 }); // Default is minted
      expect(isCleanMoney(unit)).toBe(false);
    });

    it('uses custom threshold', () => {
      const unit = createTestUnit({
        magnitude: 100,
        provenanceType: ProvenanceType.Earned,
      });
      // 1 earned entry = 100% earned ratio

      expect(isCleanMoney(unit, 0.5)).toBe(true);
      expect(isCleanMoney(unit, 1.0)).toBe(true);
    });

    it('returns false when below threshold', () => {
      const unit = createTestUnit({ magnitude: 100 }); // Minted
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Earned,
        amount: 100,
        transactionId: 't1',
      });
      // 1 minted, 1 earned = 50% earned

      expect(isCleanMoney(unit, 0.6)).toBe(false);
    });
  });

  // =========================================================================
  // IS WELL CIRCULATED
  // =========================================================================
  describe('isWellCirculated', () => {
    it('returns true for many unique wallets', () => {
      const unit = createTestUnit({ magnitude: 100 });
      for (let i = 0; i < 5; i++) {
        unit.provenance.push({
          timestamp: Date.now() + i,
          type: ProvenanceType.Gifted,
          fromWallet: `wallet-${i * 2}`,
          toWallet: `wallet-${i * 2 + 1}`,
          amount: 100,
          transactionId: `t${i}`,
        });
      }

      expect(isWellCirculated(unit, 5)).toBe(true);
    });

    it('returns false for few wallets', () => {
      const unit = createTestUnit({ magnitude: 100 });
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Gifted,
        fromWallet: 'wallet-1',
        toWallet: 'wallet-2',
        amount: 100,
        transactionId: 't1',
      });

      expect(isWellCirculated(unit, 5)).toBe(false);
    });

    it('uses custom minimum', () => {
      const unit = createTestUnit({ magnitude: 100 });
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Gifted,
        fromWallet: 'wallet-1',
        toWallet: 'wallet-2',
        amount: 100,
        transactionId: 't1',
      });

      expect(isWellCirculated(unit, 2)).toBe(true);
      expect(isWellCirculated(unit, 5)).toBe(false);
    });
  });

  // =========================================================================
  // GET PROVENANCE STORY
  // =========================================================================
  describe('getProvenanceStory', () => {
    it('formats minted entry', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const story = getProvenanceStory(unit);

      expect(story[0]).toContain('Minted');
      expect(story[0]).toContain('Commons Pool');
    });

    it('formats earned entry with note', () => {
      const unit = createTestUnit({ magnitude: 100 });
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Earned,
        amount: 50,
        note: 'Payment for work',
        transactionId: 't1',
      });

      const story = getProvenanceStory(unit);
      expect(story[1]).toContain('Earned');
      expect(story[1]).toContain('Payment for work');
    });

    it('formats gifted entry with sender', () => {
      const unit = createTestUnit({ magnitude: 100 });
      unit.provenance.push({
        timestamp: Date.now(),
        type: ProvenanceType.Gifted,
        fromWallet: 'wallet-abc123',
        amount: 50,
        transactionId: 't1',
      });

      const story = getProvenanceStory(unit);
      expect(story[1]).toContain('Gifted');
      expect(story[1]).toContain('wallet-a'); // First 8 chars
    });

    it('formats all provenance types', () => {
      const types = [
        ProvenanceType.Invested,
        ProvenanceType.Inherited,
        ProvenanceType.Converted,
        ProvenanceType.Merged,
        ProvenanceType.Split,
      ];

      const unit = createTestUnit({ magnitude: 100 });
      types.forEach((type, i) => {
        unit.provenance.push({
          timestamp: Date.now() + i,
          type,
          amount: 100,
          transactionId: `t${i}`,
        });
      });

      const story = getProvenanceStory(unit);
      expect(story.length).toBe(6); // 1 initial + 5 added
    });
  });

  // =========================================================================
  // STRIP REPUTATION
  // =========================================================================
  describe('stripReputation', () => {
    it('clears provenance', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Add some history
      unit.provenance.push(
        { timestamp: Date.now(), type: ProvenanceType.Earned, amount: 100, transactionId: 't1' },
        { timestamp: Date.now(), type: ProvenanceType.Gifted, amount: 100, transactionId: 't2' }
      );

      const stripped = stripReputation(unit, Date.now());

      expect(stripped.provenance.length).toBe(1);
    });

    it('adds stripped entry', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const stripped = stripReputation(unit, Date.now());

      expect(stripped.provenance[0].type).toBe(ProvenanceType.Converted);
      expect(stripped.provenance[0].note).toContain('stripped');
    });

    it('preserves magnitude', () => {
      const unit = createTestUnit({ magnitude: 123.45 });
      const stripped = stripReputation(unit, Date.now());

      expect(stripped.magnitude).toBe(123.45);
    });

    it('preserves other dimensions', () => {
      const unit = createTestUnit({
        magnitude: 100,
        locality: new Set(['comm-1']),
        purpose: new Set(['health']),
      });

      const stripped = stripReputation(unit, Date.now());

      expect(stripped.locality.has('comm-1')).toBe(true);
      expect(stripped.purpose.has('health')).toBe(true);
    });

    it('uses provided timestamp', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const timestamp = 1234567890;

      const stripped = stripReputation(unit, timestamp);

      expect(stripped.provenance[0].timestamp).toBe(timestamp);
    });
  });
});
