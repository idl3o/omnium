/**
 * Conversion Engine Tests
 *
 * Tests for dimensional conversions and fee calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversionEngine, ConversionContext } from './conversion.js';
import { TemporalStratum, Community, PurposeChannel } from './types.js';
import { createTestUnit } from '../test-utils.js';

describe('ConversionEngine', () => {
  let engine: ConversionEngine;
  let context: ConversionContext;

  // Test communities
  const community1: Community = {
    id: 'comm-1',
    name: 'Local Village',
    boundaryFee: 0.03, // 3%
    createdAt: Date.now(),
    memberCount: 10,
  };

  const community2: Community = {
    id: 'comm-2',
    name: 'City',
    boundaryFee: 0.05, // 5%
    createdAt: Date.now(),
    memberCount: 100,
  };

  // Test purposes
  const purpose1: PurposeChannel = {
    id: 'purpose-1',
    name: 'health',
    conversionDiscount: 0.03, // 3%
    validRecipients: new Set(),
    createdAt: Date.now(),
  };

  const purpose2: PurposeChannel = {
    id: 'purpose-2',
    name: 'education',
    conversionDiscount: 0.05, // 5%
    validRecipients: new Set(),
    createdAt: Date.now(),
  };

  beforeEach(() => {
    engine = new ConversionEngine();
    context = {
      communities: new Map([
        [community1.id, community1],
        [community2.id, community2],
      ]),
      purposes: new Map([
        [purpose1.id, purpose1],
        [purpose2.id, purpose2],
      ]),
      currentTime: Date.now(),
    };
  });

  // =========================================================================
  // TEMPORAL CONVERSIONS
  // =========================================================================
  describe('temporal conversions', () => {
    describe('locking up (free)', () => {
      it('T0 → T1 is free', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T0,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
        expect(result.newUnit?.temporality).toBe(TemporalStratum.T1);
      });

      it('T0 → T2 is free', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T0,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T2 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
      });

      it('T0 → T∞ is free', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T0,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.TInfinity },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
      });

      it('T1 → T2 is free', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T1,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T2 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(0);
      });
    });

    describe('unlocking (costs fees)', () => {
      it('T1 → T0 costs 2%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T1,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T0 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(2); // 2% of 100
        expect(result.newUnit?.magnitude).toBe(98);
      });

      it('T2 → T0 costs 5%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T2,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T0 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(5);
        expect(result.newUnit?.magnitude).toBe(95);
      });

      it('T2 → T1 costs 3%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.T2,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(3);
        expect(result.newUnit?.magnitude).toBe(97);
      });

      it('T∞ → T0 costs 10%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.TInfinity,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T0 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(10);
        expect(result.newUnit?.magnitude).toBe(90);
      });

      it('T∞ → T1 costs 8%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.TInfinity,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(8);
        expect(result.newUnit?.magnitude).toBe(92);
      });

      it('T∞ → T2 costs 5%', () => {
        const unit = createTestUnit({
          magnitude: 100,
          temporality: TemporalStratum.TInfinity,
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetTemporality: TemporalStratum.T2 },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.temporal).toBe(5);
        expect(result.newUnit?.magnitude).toBe(95);
      });
    });

    it('same stratum has no fee', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
      });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.fees.temporal).toBe(0);
      expect(result.newUnit?.magnitude).toBe(100);
    });
  });

  // =========================================================================
  // LOCALITY CONVERSIONS
  // =========================================================================
  describe('locality conversions', () => {
    describe('entering communities (1% per community)', () => {
      it('adds locality with 1% fee', () => {
        const unit = createTestUnit({ magnitude: 100 });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetLocality: { add: [community1.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.locality).toBe(1); // 1% of 100
        expect(result.newUnit?.magnitude).toBe(99);
        expect(result.newUnit?.locality.has(community1.id)).toBe(true);
      });

      it('adds multiple localities with compounding 1% fees', () => {
        const unit = createTestUnit({ magnitude: 100 });

        const result = engine.convert(
          unit,
          {
            unitId: unit.id,
            targetLocality: { add: [community1.id, community2.id] },
          },
          context
        );

        expect(result.success).toBe(true);
        // First: 100 * 0.01 = 1, remaining = 99
        // Second: 99 * 0.01 = 0.99, remaining = 98.01
        expect(result.fees.locality).toBeCloseTo(1.99, 4);
        expect(result.newUnit?.magnitude).toBeCloseTo(98.01, 4);
        expect(result.newUnit?.locality.size).toBe(2);
      });

      it('does not charge fee for already-present locality', () => {
        const unit = createTestUnit({
          magnitude: 100,
          locality: new Set([community1.id]),
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetLocality: { add: [community1.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.locality).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
      });
    });

    describe('leaving communities (boundary fee)', () => {
      it('removes locality with community boundary fee', () => {
        const unit = createTestUnit({
          magnitude: 100,
          locality: new Set([community1.id]),
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetLocality: { remove: [community1.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.locality).toBe(3); // 3% boundary fee
        expect(result.newUnit?.magnitude).toBe(97);
        expect(result.newUnit?.locality.has(community1.id)).toBe(false);
      });

      it('uses different boundary fees per community', () => {
        const unit = createTestUnit({
          magnitude: 100,
          locality: new Set([community2.id]), // 5% fee
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetLocality: { remove: [community2.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.locality).toBe(5); // 5% boundary fee
        expect(result.newUnit?.magnitude).toBe(95);
      });

      it('compounds fees when leaving multiple communities', () => {
        const unit = createTestUnit({
          magnitude: 100,
          locality: new Set([community1.id, community2.id]),
        });

        const result = engine.convert(
          unit,
          {
            unitId: unit.id,
            targetLocality: { remove: [community1.id, community2.id] },
          },
          context
        );

        expect(result.success).toBe(true);
        // First: 100 * 0.03 = 3, remaining = 97
        // Second: 97 * 0.05 = 4.85, remaining = 92.15
        expect(result.fees.locality).toBeCloseTo(7.85, 4);
        expect(result.newUnit?.magnitude).toBeCloseTo(92.15, 4);
      });
    });

    it('fails for unknown community', () => {
      const unit = createTestUnit({ magnitude: 100 });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetLocality: { add: ['unknown-community'] } },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Community not found');
    });
  });

  // =========================================================================
  // PURPOSE CONVERSIONS
  // =========================================================================
  describe('purpose conversions', () => {
    describe('adding purpose (free)', () => {
      it('adds purpose for free', () => {
        const unit = createTestUnit({ magnitude: 100 });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetPurpose: { add: [purpose1.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.purpose).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
        expect(result.newUnit?.purpose.has(purpose1.id)).toBe(true);
      });

      it('adds multiple purposes for free', () => {
        const unit = createTestUnit({ magnitude: 100 });

        const result = engine.convert(
          unit,
          {
            unitId: unit.id,
            targetPurpose: { add: [purpose1.id, purpose2.id] },
          },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.purpose).toBe(0);
        expect(result.newUnit?.magnitude).toBe(100);
        expect(result.newUnit?.purpose.size).toBe(2);
      });
    });

    describe('removing purpose (costs fee)', () => {
      it('removes purpose with conversion discount fee', () => {
        const unit = createTestUnit({
          magnitude: 100,
          purpose: new Set([purpose1.id]),
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetPurpose: { remove: [purpose1.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.purpose).toBe(3); // 3% conversion discount
        expect(result.newUnit?.magnitude).toBe(97);
        expect(result.newUnit?.purpose.has(purpose1.id)).toBe(false);
      });

      it('uses purpose-specific discount rates', () => {
        const unit = createTestUnit({
          magnitude: 100,
          purpose: new Set([purpose2.id]), // 5% discount
        });

        const result = engine.convert(
          unit,
          { unitId: unit.id, targetPurpose: { remove: [purpose2.id] } },
          context
        );

        expect(result.success).toBe(true);
        expect(result.fees.purpose).toBe(5);
        expect(result.newUnit?.magnitude).toBe(95);
      });

      it('compounds fees when removing multiple purposes', () => {
        const unit = createTestUnit({
          magnitude: 100,
          purpose: new Set([purpose1.id, purpose2.id]),
        });

        const result = engine.convert(
          unit,
          {
            unitId: unit.id,
            targetPurpose: { remove: [purpose1.id, purpose2.id] },
          },
          context
        );

        expect(result.success).toBe(true);
        // First: 100 * 0.03 = 3, remaining = 97
        // Second: 97 * 0.05 = 4.85, remaining = 92.15
        expect(result.fees.purpose).toBeCloseTo(7.85, 4);
        expect(result.newUnit?.magnitude).toBeCloseTo(92.15, 4);
      });
    });

    it('fails for unknown purpose', () => {
      const unit = createTestUnit({ magnitude: 100 });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetPurpose: { add: ['unknown-purpose'] } },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Purpose channel not found');
    });
  });

  // =========================================================================
  // REPUTATION STRIPPING
  // =========================================================================
  describe('reputation stripping', () => {
    it('strips reputation with 5% fee', () => {
      const unit = createTestUnit({ magnitude: 100 });

      const result = engine.convert(
        unit,
        { unitId: unit.id, stripReputation: true },
        context
      );

      expect(result.success).toBe(true);
      expect(result.fees.reputation).toBe(5);
      expect(result.newUnit?.magnitude).toBe(95);
    });

    it('clears provenance when stripping', () => {
      const unit = createTestUnit({ magnitude: 100 });
      // Unit starts with 1 provenance entry

      const result = engine.convert(
        unit,
        { unitId: unit.id, stripReputation: true },
        context
      );

      expect(result.success).toBe(true);
      // Should have 1 entry (the conversion entry)
      expect(result.newUnit?.provenance.length).toBe(1);
      expect(result.newUnit?.provenance[0].type).toBe('converted');
    });
  });

  // =========================================================================
  // COMBINED CONVERSIONS
  // =========================================================================
  describe('combined conversions', () => {
    it('applies all dimension changes at once', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        locality: new Set([community1.id]),
        purpose: new Set([purpose1.id]),
      });

      const result = engine.convert(
        unit,
        {
          unitId: unit.id,
          targetTemporality: TemporalStratum.T0, // 2% fee
          targetLocality: { remove: [community1.id] }, // 3% fee
          targetPurpose: { remove: [purpose1.id] }, // 3% fee
          stripReputation: true, // 5% fee
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.fees.temporal).toBe(2);
      // After temporal: 98
      expect(result.fees.locality).toBeCloseTo(98 * 0.03, 4);
      // After locality: 98 * 0.97 = 95.06
      expect(result.fees.purpose).toBeCloseTo(95.06 * 0.03, 2);
      // After purpose: 95.06 * 0.97 = 92.2082
      expect(result.fees.reputation).toBeCloseTo(92.21 * 0.05, 1);
      // Final: ~87.60

      expect(result.fees.total).toBeCloseTo(
        result.fees.temporal +
          result.fees.locality +
          result.fees.purpose +
          result.fees.reputation,
        4
      );
      expect(result.newUnit?.magnitude).toBeLessThan(90);
    });

    it('calculates total fees correctly', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.TInfinity,
      });

      const result = engine.convert(
        unit,
        {
          unitId: unit.id,
          targetTemporality: TemporalStratum.T0, // 10%
          stripReputation: true, // 5%
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.fees.temporal).toBe(10);
      expect(result.fees.reputation).toBe(90 * 0.05); // 4.5
      expect(result.fees.total).toBeCloseTo(14.5, 4);
      expect(result.newUnit?.magnitude).toBeCloseTo(85.5, 4);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================
  describe('edge cases', () => {
    it('fails when fees exceed unit value', () => {
      // Create a community with 100% boundary fee
      const highFeeComm: Community = {
        id: 'high-fee',
        name: 'High Fee',
        boundaryFee: 1.0, // 100% fee - will consume entire value
        createdAt: Date.now(),
        memberCount: 1,
      };
      context.communities.set(highFeeComm.id, highFeeComm);

      const unit = createTestUnit({
        magnitude: 100,
        locality: new Set([highFeeComm.id]),
      });

      const result = engine.convert(
        unit,
        {
          unitId: unit.id,
          targetLocality: { remove: [highFeeComm.id] },
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('fees exceed unit value');
    });

    it('handles zero-fee conversions correctly', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T0,
      });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.fees.total).toBe(0);
      expect(result.newUnit?.magnitude).toBe(100);
    });

    it('preserves wallet ID after conversion', () => {
      const unit = createTestUnit({
        magnitude: 100,
        walletId: 'my-wallet',
      });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.newUnit?.walletId).toBe('my-wallet');
    });

    it('resets createdAt for new temporal behavior', () => {
      const oldTime = Date.now() - 1000000;
      const unit = createTestUnit({
        magnitude: 100,
        createdAt: oldTime,
      });

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T2 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.newUnit?.createdAt).toBe(context.currentTime);
      expect(result.newUnit?.lastTickAt).toBe(context.currentTime);
    });

    it('adds conversion provenance entry', () => {
      const unit = createTestUnit({ magnitude: 100 });
      const initialProvenanceLength = unit.provenance.length;

      const result = engine.convert(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.newUnit?.provenance.length).toBe(
        initialProvenanceLength + 1
      );
      expect(
        result.newUnit?.provenance[result.newUnit.provenance.length - 1].type
      ).toBe('converted');
    });
  });

  // =========================================================================
  // PREVIEW AND VALIDATE
  // =========================================================================
  describe('preview', () => {
    it('returns same fees as actual conversion', () => {
      const unit = createTestUnit({
        magnitude: 100,
        temporality: TemporalStratum.T1,
        locality: new Set([community1.id]),
      });

      const preview = engine.preview(
        unit,
        {
          unitId: unit.id,
          targetTemporality: TemporalStratum.T0,
          targetLocality: { remove: [community1.id] },
        },
        context
      );

      const actual = engine.convert(
        unit,
        {
          unitId: unit.id,
          targetTemporality: TemporalStratum.T0,
          targetLocality: { remove: [community1.id] },
        },
        context
      );

      expect(preview.fees.total).toBe(actual.fees.total);
      expect(preview.newMagnitude).toBe(actual.newUnit?.magnitude);
    });
  });

  describe('validate', () => {
    it('returns valid for valid conversions', () => {
      const unit = createTestUnit({ magnitude: 100 });

      const result = engine.validate(
        unit,
        { unitId: unit.id, targetTemporality: TemporalStratum.T1 },
        context
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns invalid with error for invalid conversions', () => {
      const unit = createTestUnit({ magnitude: 1 });

      const result = engine.validate(
        unit,
        {
          unitId: unit.id,
          targetTemporality: TemporalStratum.T0,
          stripReputation: true, // Would reduce below 0 with combined fees
          targetLocality: { add: ['unknown'] },
        },
        context
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
