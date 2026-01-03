/**
 * OmniumUnit Operations Tests
 *
 * Tests for creating, splitting, merging units and reputation scoring.
 */

import { describe, it, expect } from 'vitest';
import {
  createUnit,
  splitUnit,
  mergeUnits,
  addProvenance,
  calculateReputationScore,
  unitSummary,
  isLocked,
} from './omnium.js';
import { TemporalStratum, ProvenanceType } from './types.js';
import { createTestUnit, TIME } from '../test-utils.js';

describe('OmniumUnit Operations', () => {
  // =========================================================================
  // CREATE UNIT
  // =========================================================================
  describe('createUnit', () => {
    it('creates a unit with specified magnitude', () => {
      const unit = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.magnitude).toBe(100);
      expect(unit.walletId).toBe('wallet-1');
    });

    it('defaults to T0 temporality', () => {
      const unit = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.temporality).toBe(TemporalStratum.T0);
    });

    it('creates empty locality and purpose by default', () => {
      const unit = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.locality.size).toBe(0);
      expect(unit.purpose.size).toBe(0);
    });

    it('sets provided temporality', () => {
      const unit = createUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.temporality).toBe(TemporalStratum.T2);
    });

    it('sets locality from array', () => {
      const unit = createUnit({
        magnitude: 100,
        locality: ['comm-1', 'comm-2'],
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.locality.has('comm-1')).toBe(true);
      expect(unit.locality.has('comm-2')).toBe(true);
      expect(unit.locality.size).toBe(2);
    });

    it('sets purpose from array', () => {
      const unit = createUnit({
        magnitude: 100,
        purpose: ['health', 'education'],
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit.purpose.has('health')).toBe(true);
      expect(unit.purpose.has('education')).toBe(true);
    });

    it('creates initial provenance entry', () => {
      const unit = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
        note: 'Initial mint',
      });

      expect(unit.provenance.length).toBe(1);
      expect(unit.provenance[0].type).toBe(ProvenanceType.Minted);
      expect(unit.provenance[0].amount).toBe(100);
      expect(unit.provenance[0].note).toBe('Initial mint');
    });

    it('generates unique IDs', () => {
      const unit1 = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });
      const unit2 = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
      });

      expect(unit1.id).not.toBe(unit2.id);
    });

    it('uses provided currentTime', () => {
      const fixedTime = 1000000;
      const unit = createUnit({
        magnitude: 100,
        walletId: 'wallet-1',
        provenanceType: ProvenanceType.Minted,
        currentTime: fixedTime,
      });

      expect(unit.createdAt).toBe(fixedTime);
      expect(unit.lastTickAt).toBe(fixedTime);
      expect(unit.provenance[0].timestamp).toBe(fixedTime);
    });
  });

  // =========================================================================
  // SPLIT UNIT
  // =========================================================================
  describe('splitUnit', () => {
    it('splits into two units with correct magnitudes', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(remaining.magnitude).toBe(70);
      expect(split.magnitude).toBe(30);
    });

    it('preserves total magnitude', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(remaining.magnitude + split.magnitude).toBe(100);
    });

    it('remaining unit keeps original ID', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(remaining.id).toBe(unit.id);
      expect(split.id).not.toBe(unit.id);
    });

    it('split unit gets new ID', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(split.id).not.toBe(unit.id);
      expect(split.id).not.toBe(remaining.id);
    });

    it('both units inherit dimensions', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        locality: new Set(['comm-1']),
        purpose: new Set(['health']),
      });

      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(remaining.temporality).toBe(TemporalStratum.T2);
      expect(split.temporality).toBe(TemporalStratum.T2);

      expect(remaining.locality.has('comm-1')).toBe(true);
      expect(split.locality.has('comm-1')).toBe(true);

      expect(remaining.purpose.has('health')).toBe(true);
      expect(split.purpose.has('health')).toBe(true);
    });

    it('adds split provenance entry to both units', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const initialLength = unit.provenance.length;

      const [remaining, split] = splitUnit(unit, 30, 'tx-1', Date.now());

      expect(remaining.provenance.length).toBe(initialLength + 1);
      expect(split.provenance.length).toBe(initialLength + 1);

      expect(remaining.provenance[initialLength].type).toBe(
        ProvenanceType.Split
      );
      expect(split.provenance[initialLength].type).toBe(ProvenanceType.Split);
    });

    it('throws for amount <= 0', () => {
      const unit = createTestUnit({ magnitude: 100 });

      expect(() => splitUnit(unit, 0, 'tx-1', Date.now())).toThrow();
      expect(() => splitUnit(unit, -10, 'tx-1', Date.now())).toThrow();
    });

    it('throws for amount >= magnitude', () => {
      const unit = createTestUnit({ magnitude: 100 });

      expect(() => splitUnit(unit, 100, 'tx-1', Date.now())).toThrow();
      expect(() => splitUnit(unit, 150, 'tx-1', Date.now())).toThrow();
    });

    it('handles small fractional splits', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const [remaining, split] = splitUnit(unit, 0.001, 'tx-1', Date.now());

      expect(remaining.magnitude).toBeCloseTo(99.999, 6);
      expect(split.magnitude).toBeCloseTo(0.001, 6);
    });

    it('updates lastTickAt on both units', () => {
      const oldTime = Date.now() - 100000;
      const unit = createTestUnit({ createdAt: oldTime });
      const newTime = Date.now();

      const [remaining, split] = splitUnit(unit, 30, 'tx-1', newTime);

      expect(remaining.lastTickAt).toBe(newTime);
      expect(split.lastTickAt).toBe(newTime);
    });
  });

  // =========================================================================
  // MERGE UNITS
  // =========================================================================
  describe('mergeUnits', () => {
    it('combines magnitudes correctly', () => {
      const unit1 = createTestUnit({ magnitude: 50 });
      const unit2 = createTestUnit({ magnitude: 30 });
      const unit3 = createTestUnit({ magnitude: 20 });

      const merged = mergeUnits(
        [unit1, unit2, unit3],
        'wallet-1',
        'tx-1',
        Date.now()
      );

      expect(merged.magnitude).toBe(100);
    });

    it('creates new ID for merged unit', () => {
      const unit1 = createTestUnit({ magnitude: 50 });
      const unit2 = createTestUnit({ magnitude: 50 });

      const merged = mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now());

      expect(merged.id).not.toBe(unit1.id);
      expect(merged.id).not.toBe(unit2.id);
    });

    it('inherits temporality from source units', () => {
      const unit1 = createTestUnit({
        magnitude: 50,
        temporality: TemporalStratum.T2,
      });
      const unit2 = createTestUnit({
        magnitude: 50,
        temporality: TemporalStratum.T2,
      });

      const merged = mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now());

      expect(merged.temporality).toBe(TemporalStratum.T2);
    });

    it('throws for single unit', () => {
      const unit1 = createTestUnit({ magnitude: 50 });

      expect(() => mergeUnits([unit1], 'wallet-1', 'tx-1', Date.now())).toThrow(
        'at least 2 units'
      );
    });

    it('throws for different temporality', () => {
      const unit1 = createTestUnit({
        magnitude: 50,
        temporality: TemporalStratum.T0,
      });
      const unit2 = createTestUnit({
        magnitude: 50,
        temporality: TemporalStratum.T1,
      });

      expect(() =>
        mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now())
      ).toThrow('different temporality');
    });

    it('throws for different locality', () => {
      const unit1 = createTestUnit({
        magnitude: 50,
        locality: new Set(['comm-1']),
      });
      const unit2 = createTestUnit({
        magnitude: 50,
        locality: new Set(['comm-2']),
      });

      expect(() =>
        mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now())
      ).toThrow('different locality');
    });

    it('throws for different purpose', () => {
      const unit1 = createTestUnit({
        magnitude: 50,
        purpose: new Set(['health']),
      });
      const unit2 = createTestUnit({
        magnitude: 50,
        purpose: new Set(['education']),
      });

      expect(() =>
        mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now())
      ).toThrow('different purpose');
    });

    it('allows merging with same locality and purpose', () => {
      const unit1 = createTestUnit({
        magnitude: 50,
        locality: new Set(['comm-1']),
        purpose: new Set(['health']),
      });
      const unit2 = createTestUnit({
        magnitude: 50,
        locality: new Set(['comm-1']),
        purpose: new Set(['health']),
      });

      const merged = mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now());

      expect(merged.magnitude).toBe(100);
      expect(merged.locality.has('comm-1')).toBe(true);
      expect(merged.purpose.has('health')).toBe(true);
    });

    it('combines provenance chains sorted by timestamp', () => {
      const time1 = Date.now() - 1000;
      const time2 = Date.now();

      const unit1 = createUnit({
        magnitude: 50,
        walletId: 'w1',
        provenanceType: ProvenanceType.Minted,
        currentTime: time1,
      });
      const unit2 = createUnit({
        magnitude: 50,
        walletId: 'w1',
        provenanceType: ProvenanceType.Earned,
        currentTime: time2,
      });

      const merged = mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now());

      // Provenance should include entries from both units plus merge entry
      expect(merged.provenance.length).toBe(3);
      // Should be sorted by timestamp
      expect(merged.provenance[0].timestamp).toBeLessThanOrEqual(
        merged.provenance[1].timestamp
      );
    });

    it('adds merge provenance entry', () => {
      const unit1 = createTestUnit({ magnitude: 50 });
      const unit2 = createTestUnit({ magnitude: 50 });

      const merged = mergeUnits([unit1, unit2], 'wallet-1', 'tx-1', Date.now());

      const lastEntry = merged.provenance[merged.provenance.length - 1];
      expect(lastEntry.type).toBe(ProvenanceType.Merged);
      expect(lastEntry.amount).toBe(100);
      expect(lastEntry.note).toContain('Merged 2 units');
    });
  });

  // =========================================================================
  // ADD PROVENANCE
  // =========================================================================
  describe('addProvenance', () => {
    it('adds entry with current magnitude', () => {
      const unit = createTestUnit({ magnitude: 100 });

      const updated = addProvenance(unit, {
        timestamp: Date.now(),
        type: ProvenanceType.Earned,
        note: 'Payment received',
        transactionId: 'tx-1',
      });

      const lastEntry = updated.provenance[updated.provenance.length - 1];
      expect(lastEntry.type).toBe(ProvenanceType.Earned);
      expect(lastEntry.amount).toBe(100);
      expect(lastEntry.note).toBe('Payment received');
    });

    it('does not mutate original unit', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const originalLength = unit.provenance.length;

      addProvenance(unit, {
        timestamp: Date.now(),
        type: ProvenanceType.Gifted,
        transactionId: 'tx-1',
      });

      expect(unit.provenance.length).toBe(originalLength);
    });
  });

  // =========================================================================
  // REPUTATION SCORE
  // =========================================================================
  describe('calculateReputationScore', () => {
    it('returns 0 for empty provenance', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Override provenance to empty
      const emptyUnit = { ...unit, provenance: [] };

      expect(calculateReputationScore(emptyUnit)).toBe(0);
    });

    it('returns higher score for type diversity', () => {
      const lowDiversity = createTestUnit({ magnitude: 100 });
      // Only minted type

      const highDiversity = createTestUnit({ magnitude: 100 });
      highDiversity.provenance.push(
        {
          timestamp: Date.now(),
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: 'tx-1',
        },
        {
          timestamp: Date.now(),
          type: ProvenanceType.Gifted,
          amount: 100,
          transactionId: 'tx-2',
        }
      );

      expect(calculateReputationScore(highDiversity)).toBeGreaterThan(
        calculateReputationScore(lowDiversity)
      );
    });

    it('returns higher score for longer chains', () => {
      const shortChain = createTestUnit({ magnitude: 100 });

      const longChain = createTestUnit({ magnitude: 100 });
      for (let i = 0; i < 10; i++) {
        longChain.provenance.push({
          timestamp: Date.now() + i,
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: `tx-${i}`,
        });
      }

      expect(calculateReputationScore(longChain)).toBeGreaterThan(
        calculateReputationScore(shortChain)
      );
    });

    it('returns higher score for earned ratio', () => {
      const mostlyMinted = createTestUnit({ magnitude: 100 });
      // Default is minted

      const mostlyEarned = createTestUnit({
        magnitude: 100,
        provenanceType: ProvenanceType.Earned,
      });
      mostlyEarned.provenance.push(
        {
          timestamp: Date.now(),
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: 'tx-1',
        },
        {
          timestamp: Date.now(),
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: 'tx-2',
        }
      );

      expect(calculateReputationScore(mostlyEarned)).toBeGreaterThan(
        calculateReputationScore(mostlyMinted)
      );
    });

    it('caps score at 1', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Add many diverse provenance entries
      for (let i = 0; i < 100; i++) {
        unit.provenance.push({
          timestamp: Date.now() + i,
          type: ProvenanceType.Earned,
          amount: 100,
          transactionId: `tx-${i}`,
        });
      }

      expect(calculateReputationScore(unit)).toBeLessThanOrEqual(1);
    });

    it('returns score between 0 and 1', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const score = calculateReputationScore(unit);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // IS LOCKED
  // =========================================================================
  describe('isLocked', () => {
    it('T0 is never locked', () => {
      const unit = createTestUnit({ temporality: TemporalStratum.T0 });

      expect(isLocked(unit, Date.now())).toBe(false);
      expect(isLocked(unit, Date.now() + TIME.MS_PER_YEAR)).toBe(false);
    });

    it('T∞ is always locked', () => {
      const unit = createTestUnit({ temporality: TemporalStratum.TInfinity });

      expect(isLocked(unit, Date.now())).toBe(true);
      expect(isLocked(unit, Date.now() + 100 * TIME.MS_PER_YEAR)).toBe(true);
    });

    it('T1 is locked for 365 days', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      expect(isLocked(unit, startTime)).toBe(true);
      expect(isLocked(unit, startTime + 364 * TIME.MS_PER_DAY)).toBe(true);
      expect(isLocked(unit, startTime + 365 * TIME.MS_PER_DAY)).toBe(false);
    });

    it('T2 is locked for 20 years', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      expect(isLocked(unit, startTime)).toBe(true);
      expect(isLocked(unit, startTime + 19 * TIME.MS_PER_YEAR)).toBe(true);
      expect(isLocked(unit, startTime + 20 * TIME.MS_PER_YEAR)).toBe(false);
    });
  });

  // =========================================================================
  // UNIT SUMMARY
  // =========================================================================
  describe('unitSummary', () => {
    it('includes magnitude', () => {
      const unit = createTestUnit({ magnitude: 123.45 });
      const summary = unitSummary(unit);

      expect(summary).toContain('123.45');
    });

    it('includes temporality', () => {
      const unit = createTestUnit({ temporality: TemporalStratum.T2 });
      const summary = unitSummary(unit);

      expect(summary).toContain('[T2]');
    });

    it('shows global for empty locality', () => {
      const unit = createTestUnit({ locality: new Set() });
      const summary = unitSummary(unit);

      expect(summary).toContain('global');
    });

    it('shows local for non-empty locality', () => {
      const unit = createTestUnit({ locality: new Set(['comm-1']) });
      const summary = unitSummary(unit);

      expect(summary).toContain('local(comm-1)');
    });

    it('shows unrestricted for empty purpose', () => {
      const unit = createTestUnit({ purpose: new Set() });
      const summary = unitSummary(unit);

      expect(summary).toContain('unrestricted');
    });

    it('shows purpose for non-empty purpose', () => {
      const unit = createTestUnit({ purpose: new Set(['health']) });
      const summary = unitSummary(unit);

      expect(summary).toContain('purpose(health)');
    });

    it('includes reputation score', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const summary = unitSummary(unit);

      expect(summary).toMatch(/rep:\d+\.\d+/);
    });
  });
});
