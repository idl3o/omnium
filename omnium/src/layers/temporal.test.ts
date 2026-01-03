/**
 * Temporal Layer Tests
 *
 * Tests for demurrage, dividends, lock-up periods, and temporal projections.
 */

import { describe, it, expect } from 'vitest';
import {
  applyDemurrage,
  applyDividend,
  tickUnit,
  isUnlocked,
  timeUntilUnlock,
  projectValue,
  describeTemporality,
} from './temporal.js';
import { TemporalStratum, TEMPORAL_CONFIG } from '../core/types.js';
import {
  createTestUnit,
  expectedDemurrage,
  expectedDividend,
  TIME,
} from '../test-utils.js';

describe('Temporal Layer', () => {
  // =========================================================================
  // DEMURRAGE (T0)
  // =========================================================================
  describe('applyDemurrage', () => {
    it('applies 2% annual decay to T0 units', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      // Advance 1 year
      const oneYearLater = startTime + TIME.MS_PER_YEAR;
      const result = applyDemurrage(unit, oneYearLater);

      const expected = expectedDemurrage(100, 1, 0.02);
      expect(result.magnitude).toBeCloseTo(expected, 4);
      expect(result.magnitude).toBeCloseTo(98.02, 2); // ~98.02 after 2% decay
      expect(result.lastTickAt).toBe(oneYearLater);
    });

    it('compounds over multiple years', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      // Advance 5 years
      const fiveYearsLater = startTime + 5 * TIME.MS_PER_YEAR;
      const result = applyDemurrage(unit, fiveYearsLater);

      const expected = expectedDemurrage(100, 5, 0.02);
      expect(result.magnitude).toBeCloseTo(expected, 4);
      // 100 * e^(-0.02*5) ≈ 90.48
      expect(result.magnitude).toBeCloseTo(90.48, 2);
    });

    it('ignores very small demurrage (< 0.0001)', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 0.01, // Very small amount
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      // Advance 1 day (demurrage would be tiny)
      const oneDayLater = startTime + TIME.MS_PER_DAY;
      const result = applyDemurrage(unit, oneDayLater);

      // Should not change (loss is < 0.0001)
      expect(result.magnitude).toBe(0.01);
      expect(result.lastTickAt).toBe(oneDayLater);
    });

    it('does not affect non-T0 units', () => {
      const startTime = Date.now();
      const t1Unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const oneYearLater = startTime + TIME.MS_PER_YEAR;
      const result = applyDemurrage(t1Unit, oneYearLater);

      expect(result.magnitude).toBe(100); // No change
    });

    it('handles zero elapsed time', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      const result = applyDemurrage(unit, startTime);
      expect(result.magnitude).toBe(100);
    });

    it('handles negative elapsed time gracefully', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      // Time before creation (should not happen, but handle gracefully)
      const result = applyDemurrage(unit, startTime - TIME.MS_PER_DAY);
      expect(result.magnitude).toBe(100);
    });
  });

  // =========================================================================
  // DIVIDENDS (T2 and T∞)
  // =========================================================================
  describe('applyDividend', () => {
    it('applies 3% annual growth to T2 units', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      const oneYearLater = startTime + TIME.MS_PER_YEAR;
      const result = applyDividend(unit, oneYearLater);

      const expected = expectedDividend(100, 1, 0.03);
      expect(result.magnitude).toBeCloseTo(expected, 4);
      expect(result.magnitude).toBeCloseTo(103.05, 2); // ~103.05 after 3% growth
    });

    it('applies 1.5% annual yield to T∞ units', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.TInfinity,
        createdAt: startTime,
      });

      const oneYearLater = startTime + TIME.MS_PER_YEAR;
      const result = applyDividend(unit, oneYearLater);

      const expected = expectedDividend(100, 1, 0.015);
      expect(result.magnitude).toBeCloseTo(expected, 4);
      expect(result.magnitude).toBeCloseTo(101.51, 2);
    });

    it('compounds over multiple years', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      const tenYearsLater = startTime + 10 * TIME.MS_PER_YEAR;
      const result = applyDividend(unit, tenYearsLater);

      const expected = expectedDividend(100, 10, 0.03);
      expect(result.magnitude).toBeCloseTo(expected, 4);
      // 100 * e^(0.03*10) ≈ 134.99
      expect(result.magnitude).toBeCloseTo(134.99, 2);
    });

    it('does not affect T0 or T1 units', () => {
      const startTime = Date.now();

      const t0Unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });
      const t1Unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const oneYearLater = startTime + TIME.MS_PER_YEAR;

      expect(applyDividend(t0Unit, oneYearLater).magnitude).toBe(100);
      expect(applyDividend(t1Unit, oneYearLater).magnitude).toBe(100);
    });
  });

  // =========================================================================
  // TICK UNIT (Combined Effects)
  // =========================================================================
  describe('tickUnit', () => {
    it('applies demurrage to T0', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      const result = tickUnit(unit, startTime + TIME.MS_PER_YEAR);
      expect(result.magnitude).toBeLessThan(100);
    });

    it('applies no change to T1 (just updates lastTickAt)', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const result = tickUnit(unit, startTime + TIME.MS_PER_YEAR);
      expect(result.magnitude).toBe(100);
      expect(result.lastTickAt).toBe(startTime + TIME.MS_PER_YEAR);
    });

    it('applies dividend to T2', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      const result = tickUnit(unit, startTime + TIME.MS_PER_YEAR);
      expect(result.magnitude).toBeGreaterThan(100);
    });

    it('applies dividend to T∞', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.TInfinity,
        createdAt: startTime,
      });

      const result = tickUnit(unit, startTime + TIME.MS_PER_YEAR);
      expect(result.magnitude).toBeGreaterThan(100);
    });
  });

  // =========================================================================
  // LOCK-UP PERIODS
  // =========================================================================
  describe('isUnlocked', () => {
    it('T0 is always unlocked', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      expect(isUnlocked(unit, startTime)).toBe(true);
      expect(isUnlocked(unit, startTime + TIME.MS_PER_YEAR)).toBe(true);
    });

    it('T∞ is never unlocked', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.TInfinity,
        createdAt: startTime,
      });

      expect(isUnlocked(unit, startTime)).toBe(false);
      expect(isUnlocked(unit, startTime + 100 * TIME.MS_PER_YEAR)).toBe(false);
    });

    it('T1 unlocks after 365 days', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      // Before unlock
      expect(isUnlocked(unit, startTime + 364 * TIME.MS_PER_DAY)).toBe(false);

      // At unlock
      expect(isUnlocked(unit, startTime + 365 * TIME.MS_PER_DAY)).toBe(true);

      // After unlock
      expect(isUnlocked(unit, startTime + 366 * TIME.MS_PER_DAY)).toBe(true);
    });

    it('T2 unlocks after 20 years', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      // Before unlock (19 years)
      expect(isUnlocked(unit, startTime + 19 * TIME.MS_PER_YEAR)).toBe(false);

      // At unlock (20 years)
      expect(isUnlocked(unit, startTime + 20 * TIME.MS_PER_YEAR)).toBe(true);

      // After unlock
      expect(isUnlocked(unit, startTime + 21 * TIME.MS_PER_YEAR)).toBe(true);
    });
  });

  describe('timeUntilUnlock', () => {
    it('returns 0 for T0', () => {
      const unit = createTestUnit({ temporality: TemporalStratum.T0 });
      expect(timeUntilUnlock(unit, Date.now())).toBe(0);
    });

    it('returns Infinity for T∞', () => {
      const unit = createTestUnit({ temporality: TemporalStratum.TInfinity });
      expect(timeUntilUnlock(unit, Date.now())).toBe(Infinity);
    });

    it('counts down correctly for T1', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const expected = 365 * TIME.MS_PER_DAY;
      expect(timeUntilUnlock(unit, startTime)).toBe(expected);

      // Halfway through
      const halfwayTime = startTime + 182 * TIME.MS_PER_DAY;
      expect(timeUntilUnlock(unit, halfwayTime)).toBeCloseTo(
        183 * TIME.MS_PER_DAY,
        0
      );
    });

    it('returns 0 once unlocked', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const afterUnlock = startTime + 400 * TIME.MS_PER_DAY;
      expect(timeUntilUnlock(unit, afterUnlock)).toBe(0);
    });
  });

  // =========================================================================
  // VALUE PROJECTION
  // =========================================================================
  describe('projectValue', () => {
    it('projects T0 decay accurately', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      const futureTime = startTime + 3 * TIME.MS_PER_YEAR;
      const projected = projectValue(unit, futureTime);

      const expected = expectedDemurrage(100, 3, 0.02);
      expect(projected).toBeCloseTo(expected, 4);
    });

    it('projects T2 growth accurately', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      const futureTime = startTime + 5 * TIME.MS_PER_YEAR;
      const projected = projectValue(unit, futureTime);

      const expected = expectedDividend(100, 5, 0.03);
      expect(projected).toBeCloseTo(expected, 4);
    });

    it('returns unchanged value for T1', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        createdAt: startTime,
      });

      const futureTime = startTime + 10 * TIME.MS_PER_YEAR;
      expect(projectValue(unit, futureTime)).toBe(100);
    });

    it('matches actual tick results', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      const futureTime = startTime + 2 * TIME.MS_PER_YEAR;

      const projected = projectValue(unit, futureTime);
      const ticked = tickUnit(unit, futureTime);

      expect(projected).toBeCloseTo(ticked.magnitude, 6);
    });
  });

  // =========================================================================
  // DESCRIPTION
  // =========================================================================
  describe('describeTemporality', () => {
    it('describes T0', () => {
      const desc = describeTemporality(TemporalStratum.T0);
      expect(desc).toContain('Immediate');
      expect(desc).toContain('2.0% annual decay');
    });

    it('describes T1', () => {
      const desc = describeTemporality(TemporalStratum.T1);
      expect(desc).toContain('Seasonal');
      expect(desc).toContain('1 year lockup');
    });

    it('describes T2', () => {
      const desc = describeTemporality(TemporalStratum.T2);
      expect(desc).toContain('Generational');
      expect(desc).toContain('3.0% annual growth');
      expect(desc).toContain('20 year lockup');
    });

    it('describes T∞', () => {
      const desc = describeTemporality(TemporalStratum.TInfinity);
      expect(desc).toContain('Perpetual');
      expect(desc).toContain('1.5% annual growth');
      expect(desc).toContain('principal locked forever');
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================
  describe('edge cases', () => {
    it('handles very large time deltas', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      // 100 years of demurrage
      const farFuture = startTime + 100 * TIME.MS_PER_YEAR;
      const result = applyDemurrage(unit, farFuture);

      // 100 * e^(-0.02*100) ≈ 13.53
      expect(result.magnitude).toBeCloseTo(13.53, 1);
      expect(result.magnitude).toBeGreaterThan(0);
    });

    it('handles very large dividends', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T2,
        createdAt: startTime,
      });

      // 50 years of dividends
      const farFuture = startTime + 50 * TIME.MS_PER_YEAR;
      const result = applyDividend(unit, farFuture);

      // 100 * e^(0.03*50) ≈ 448.17
      expect(result.magnitude).toBeCloseTo(448.17, 0);
    });

    it('maintains precision with fractional magnitudes', () => {
      const startTime = Date.now();
      const unit = createTestUnit({
        magnitude: 123.456789,
        temporality: TemporalStratum.T0,
        createdAt: startTime,
      });

      const result = applyDemurrage(unit, startTime + TIME.MS_PER_YEAR);
      const expected = expectedDemurrage(123.456789, 1, 0.02);

      expect(result.magnitude).toBeCloseTo(expected, 6);
    });
  });
});
