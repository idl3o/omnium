/**
 * Conversion Engine
 *
 * The heart of OMNIUM - transforms currency between dimensions.
 *
 * Conversion Formula: Ω' = Ω × f(ΔT) × f(ΔL) × f(ΔP) × f(ΔR)
 *
 * Where f(Δx) represents the conversion function for each dimensional shift.
 * These functions are:
 * - Publicly known and auditable
 * - Algorithmically determined (no discretion)
 * - Always reversible (though not always at the same rate)
 */

import { v4 as uuid } from 'uuid';
import {
  OmniumUnit,
  TemporalStratum,
  ConversionRequest,
  ConversionResult,
  ProvenanceType,
  ProvenanceEntry,
  Community,
  PurposeChannel,
} from './types.js';

// =============================================================================
// CONVERSION FEE CONFIGURATION
// =============================================================================

/**
 * Temporal conversion fees.
 * Moving "up" (T0 → T∞) is free or rewarded.
 * Moving "down" (T∞ → T0) costs fees.
 */
const TEMPORAL_FEES: Record<TemporalStratum, Record<TemporalStratum, number>> = {
  [TemporalStratum.T0]: {
    [TemporalStratum.T0]: 0,
    [TemporalStratum.T1]: 0,      // Free to lock up
    [TemporalStratum.T2]: 0,      // Free to lock up long-term
    [TemporalStratum.TInfinity]: 0, // Free to become perpetual
  },
  [TemporalStratum.T1]: {
    [TemporalStratum.T0]: 0.02,   // 2% to unlock early
    [TemporalStratum.T1]: 0,
    [TemporalStratum.T2]: 0,
    [TemporalStratum.TInfinity]: 0,
  },
  [TemporalStratum.T2]: {
    [TemporalStratum.T0]: 0.05,   // 5% to unlock generational
    [TemporalStratum.T1]: 0.03,   // 3% to reduce lockup
    [TemporalStratum.T2]: 0,
    [TemporalStratum.TInfinity]: 0,
  },
  [TemporalStratum.TInfinity]: {
    [TemporalStratum.T0]: 0.10,   // 10% to break perpetual (principal only)
    [TemporalStratum.T1]: 0.08,
    [TemporalStratum.T2]: 0.05,
    [TemporalStratum.TInfinity]: 0,
  },
};

/** Fee to add locality (enter a community) */
const LOCALITY_ENTRY_FEE = 0.01;  // 1%

/** Fee to strip reputation (lose provenance) */
const REPUTATION_STRIP_FEE = 0.05;  // 5%

/** Base fee to remove purpose coloring */
const PURPOSE_REMOVAL_FEE = 0.03;  // 3%

// =============================================================================
// CONVERSION ENGINE
// =============================================================================

export interface ConversionContext {
  communities: Map<string, Community>;
  purposes: Map<string, PurposeChannel>;
  currentTime: number;
}

/**
 * The Conversion Engine transforms OMNIUM between dimensional states.
 */
export class ConversionEngine {
  /**
   * Convert a unit according to the request.
   *
   * Returns a new unit with the requested dimensional changes,
   * minus any applicable fees.
   */
  convert(
    unit: OmniumUnit,
    request: ConversionRequest,
    context: ConversionContext
  ): ConversionResult {
    let magnitude = unit.magnitude;
    const fees = {
      temporal: 0,
      locality: 0,
      purpose: 0,
      reputation: 0,
      total: 0,
    };

    // 1. Temporal conversion
    let newTemporality = unit.temporality;
    if (request.targetTemporality && request.targetTemporality !== unit.temporality) {
      const fee = this.calculateTemporalFee(
        unit.temporality,
        request.targetTemporality,
        magnitude
      );
      fees.temporal = fee;
      magnitude -= fee;
      newTemporality = request.targetTemporality;
    }

    // 2. Locality conversion
    let newLocality = new Set(unit.locality);
    if (request.targetLocality) {
      // Adding localities (entering communities)
      if (request.targetLocality.add) {
        for (const communityId of request.targetLocality.add) {
          const community = context.communities.get(communityId);
          if (!community) {
            return {
              success: false,
              fees,
              error: `Community not found: ${communityId}`,
            };
          }
          if (!newLocality.has(communityId)) {
            const fee = magnitude * LOCALITY_ENTRY_FEE;
            fees.locality += fee;
            magnitude -= fee;
            newLocality.add(communityId);
          }
        }
      }

      // Removing localities (leaving communities)
      if (request.targetLocality.remove) {
        for (const communityId of request.targetLocality.remove) {
          if (newLocality.has(communityId)) {
            const community = context.communities.get(communityId);
            const boundaryFee = community?.boundaryFee ?? 0.03;
            const fee = magnitude * boundaryFee;
            fees.locality += fee;
            magnitude -= fee;
            newLocality.delete(communityId);
          }
        }
      }
    }

    // 3. Purpose conversion
    let newPurpose = new Set(unit.purpose);
    if (request.targetPurpose) {
      // Adding purposes (coloring money)
      if (request.targetPurpose.add) {
        for (const purposeId of request.targetPurpose.add) {
          const purpose = context.purposes.get(purposeId);
          if (!purpose) {
            return {
              success: false,
              fees,
              error: `Purpose channel not found: ${purposeId}`,
            };
          }
          // Adding purpose is free (it restricts utility)
          newPurpose.add(purposeId);
        }
      }

      // Removing purposes (stripping color)
      if (request.targetPurpose.remove) {
        for (const purposeId of request.targetPurpose.remove) {
          if (newPurpose.has(purposeId)) {
            const purpose = context.purposes.get(purposeId);
            const discount = purpose?.conversionDiscount ?? PURPOSE_REMOVAL_FEE;
            const fee = magnitude * discount;
            fees.purpose += fee;
            magnitude -= fee;
            newPurpose.delete(purposeId);
          }
        }
      }
    }

    // 4. Reputation stripping
    let newProvenance = [...unit.provenance];
    if (request.stripReputation) {
      const fee = magnitude * REPUTATION_STRIP_FEE;
      fees.reputation = fee;
      magnitude -= fee;
      // Clear provenance but add a "stripped" entry
      newProvenance = [];
    }

    // Calculate total fees
    fees.total = fees.temporal + fees.locality + fees.purpose + fees.reputation;

    // Sanity check
    if (magnitude <= 0) {
      return {
        success: false,
        fees,
        error: 'Conversion fees exceed unit value',
      };
    }

    // Create conversion provenance entry
    const conversionEntry: ProvenanceEntry = {
      timestamp: context.currentTime,
      type: ProvenanceType.Converted,
      amount: magnitude,
      note: this.describeConversion(unit, request, fees),
      transactionId: uuid(),
    };

    // Create the new unit
    const newUnit: OmniumUnit = {
      id: uuid(),
      magnitude,
      temporality: newTemporality,
      locality: newLocality,
      purpose: newPurpose,
      provenance: [...newProvenance, conversionEntry],
      createdAt: context.currentTime, // Reset for new temporal behavior
      lastTickAt: context.currentTime,
      walletId: unit.walletId,
    };

    return {
      success: true,
      newUnit,
      fees,
    };
  }

  /**
   * Calculate fee for temporal stratum change.
   */
  private calculateTemporalFee(
    from: TemporalStratum,
    to: TemporalStratum,
    magnitude: number
  ): number {
    const rate = TEMPORAL_FEES[from][to];
    return magnitude * rate;
  }

  /**
   * Generate human-readable description of conversion.
   */
  private describeConversion(
    unit: OmniumUnit,
    request: ConversionRequest,
    fees: ConversionResult['fees']
  ): string {
    const changes: string[] = [];

    if (request.targetTemporality) {
      changes.push(`${unit.temporality} → ${request.targetTemporality}`);
    }
    if (request.targetLocality?.add?.length) {
      changes.push(`+locality(${request.targetLocality.add.join(', ')})`);
    }
    if (request.targetLocality?.remove?.length) {
      changes.push(`-locality(${request.targetLocality.remove.join(', ')})`);
    }
    if (request.targetPurpose?.add?.length) {
      changes.push(`+purpose(${request.targetPurpose.add.join(', ')})`);
    }
    if (request.targetPurpose?.remove?.length) {
      changes.push(`-purpose(${request.targetPurpose.remove.join(', ')})`);
    }
    if (request.stripReputation) {
      changes.push('stripped reputation');
    }

    return `Converted: ${changes.join(', ')}. Fees: ${fees.total.toFixed(4)}Ω`;
  }

  /**
   * Preview conversion without executing it.
   */
  preview(
    unit: OmniumUnit,
    request: ConversionRequest,
    context: ConversionContext
  ): { newMagnitude: number; fees: ConversionResult['fees'] } {
    const result = this.convert(unit, request, context);
    return {
      newMagnitude: result.newUnit?.magnitude ?? 0,
      fees: result.fees,
    };
  }

  /**
   * Check if a conversion is valid without executing it.
   */
  validate(
    unit: OmniumUnit,
    request: ConversionRequest,
    context: ConversionContext
  ): { valid: boolean; error?: string } {
    const result = this.convert(unit, request, context);
    return {
      valid: result.success,
      error: result.error,
    };
  }
}

/**
 * Singleton conversion engine instance.
 */
export const conversionEngine = new ConversionEngine();
