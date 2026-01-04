/**
 * Compute Rewards
 *
 * Connects deterministic compute attestations to the Omnium reward system.
 *
 * Two reward mechanisms:
 * 1. BASE REWARD: Paid for deterministic compute (compute units × rate)
 * 2. VALUE REWARD: Paid retroactively when value is attributed
 *
 * This separates "doing work" from "creating value" - you get paid for both,
 * but the amounts are determined differently.
 */

import { v4 as uuid } from 'uuid';
import {
  ComputeRegistry,
  ComputeAttestation,
  ValueAttribution,
  ValueType,
  ProofMethod,
} from './deterministic-compute.js';

// =============================================================================
// REWARD CONFIGURATION
// =============================================================================

/**
 * Reward rates for different proof methods.
 * Higher trust = higher rate (incentivizes better proofs).
 */
export interface RewardRates {
  /** Base rate per compute unit (Ω) */
  baseRatePerUnit: number;

  /** Multipliers by proof method */
  proofMultipliers: Record<ProofMethod, number>;

  /** Bonus for being first to compute (input+code pair) */
  firstComputeBonus: number;

  /** Bonus for redundant verification (per additional provider) */
  redundancyBonus: number;

  /** Maximum total multiplier */
  maxMultiplier: number;
}

export const DEFAULT_REWARD_RATES: RewardRates = {
  baseRatePerUnit: 0.001, // 0.001Ω per compute unit

  proofMultipliers: {
    [ProofMethod.SelfAttestation]: 1.0,   // Base rate
    [ProofMethod.Redundant]: 1.5,          // 50% bonus for redundancy
    [ProofMethod.SpotCheck]: 1.3,          // 30% bonus for spot-check
    [ProofMethod.Optimistic]: 1.1,         // 10% bonus for optimistic
    [ProofMethod.TEE]: 2.0,                // 2x for TEE
    [ProofMethod.ZKProof]: 2.5,            // 2.5x for ZK (hardest to fake)
  },

  firstComputeBonus: 0.1,    // 10% bonus for novel computation
  redundancyBonus: 0.05,     // 5% per additional verifier
  maxMultiplier: 5.0,        // Cap at 5x base
};

// =============================================================================
// REWARD EVENTS
// =============================================================================

export interface RewardEvent {
  id: string;
  timestamp: number;
  type: 'base' | 'value' | 'bonus';
  attestationId: string;
  providerId: string;
  amount: number;
  reason: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// COMPUTE REWARD MANAGER
// =============================================================================

/**
 * Manages rewards for compute attestations.
 *
 * Tracks what's been rewarded to prevent double-payment.
 * Calculates rewards based on proof method and value attributions.
 */
export class ComputeRewardManager {
  private registry: ComputeRegistry;
  private rates: RewardRates;
  private rewardedAttestations: Set<string> = new Set();
  private processedAttributions: Set<string> = new Set();
  private rewardEvents: RewardEvent[] = [];

  constructor(registry: ComputeRegistry, rates: RewardRates = DEFAULT_REWARD_RATES) {
    this.registry = registry;
    this.rates = rates;
  }

  // =========================================================================
  // BASE REWARDS (for doing compute)
  // =========================================================================

  /**
   * Calculate base reward for an attestation.
   */
  calculateBaseReward(attestation: ComputeAttestation): {
    amount: number;
    breakdown: {
      baseAmount: number;
      proofMultiplier: number;
      firstComputeBonus: number;
      redundancyBonus: number;
      finalMultiplier: number;
    };
  } {
    const baseAmount = attestation.computeUnits * this.rates.baseRatePerUnit;

    // Proof method multiplier
    const proofMultiplier = this.rates.proofMultipliers[attestation.proofMethod];

    // First compute bonus
    const existingComputes = this.registry.verifyDeterminism(
      attestation.inputCid,
      attestation.codeCid
    );
    const isFirst = existingComputes.attestationCount <= 1; // This one or none
    const firstComputeBonus = isFirst ? this.rates.firstComputeBonus : 0;

    // Redundancy bonus (for redundant proofs)
    let redundancyBonus = 0;
    if (attestation.proofMethod === ProofMethod.Redundant && attestation.proof.redundantAttestations) {
      redundancyBonus = this.rates.redundancyBonus * attestation.proof.redundantAttestations.length;
    }

    // Calculate final multiplier (capped)
    const rawMultiplier = proofMultiplier + firstComputeBonus + redundancyBonus;
    const finalMultiplier = Math.min(rawMultiplier, this.rates.maxMultiplier);

    const amount = baseAmount * finalMultiplier;

    return {
      amount,
      breakdown: {
        baseAmount,
        proofMultiplier,
        firstComputeBonus,
        redundancyBonus,
        finalMultiplier,
      },
    };
  }

  /**
   * Process base reward for an attestation.
   * Returns the reward amount, or 0 if already rewarded.
   */
  processBaseReward(attestationId: string): RewardEvent | null {
    // Check if already rewarded
    if (this.rewardedAttestations.has(attestationId)) {
      return null;
    }

    const attestation = this.registry.get(attestationId);
    if (!attestation) {
      return null;
    }

    const reward = this.calculateBaseReward(attestation);

    // Mark as rewarded
    this.rewardedAttestations.add(attestationId);

    // Create event
    const event: RewardEvent = {
      id: uuid(),
      timestamp: Date.now(),
      type: 'base',
      attestationId,
      providerId: attestation.providerId,
      amount: reward.amount,
      reason: `Base reward for ${attestation.computeUnits} compute units`,
      details: reward.breakdown,
    };

    this.rewardEvents.push(event);
    return event;
  }

  // =========================================================================
  // VALUE REWARDS (retroactive)
  // =========================================================================

  /**
   * Process a value attribution as a reward.
   * Tips/boosts flow to the original provider.
   */
  processValueAttribution(attributionId: string): RewardEvent | null {
    // Check if already processed
    if (this.processedAttributions.has(attributionId)) {
      return null;
    }

    // Find the attribution
    // (We need to get it from the registry somehow - for now, search)
    let attribution: ValueAttribution | null = null;
    let attestation: ComputeAttestation | null = null;

    for (const att of this.registry['attestations'].values()) {
      const attributions = this.registry.getAttributions(att.id);
      const found = attributions.find(a => a.id === attributionId);
      if (found) {
        attribution = found;
        attestation = att;
        break;
      }
    }

    if (!attribution || !attestation) {
      return null;
    }

    // Mark as processed
    this.processedAttributions.add(attributionId);

    // Calculate value reward (100% of attribution goes to provider)
    const event: RewardEvent = {
      id: uuid(),
      timestamp: Date.now(),
      type: 'value',
      attestationId: attestation.id,
      providerId: attestation.providerId,
      amount: attribution.amount,
      reason: `${attribution.type} from ${attribution.attributorId}`,
      details: {
        attributionId,
        attributorId: attribution.attributorId,
        type: attribution.type,
        note: attribution.note,
      },
    };

    this.rewardEvents.push(event);
    return event;
  }

  // =========================================================================
  // BATCH PROCESSING
  // =========================================================================

  /**
   * Process all pending base rewards.
   * Returns list of reward events.
   */
  processAllPendingBaseRewards(): RewardEvent[] {
    const events: RewardEvent[] = [];

    for (const attestation of this.registry['attestations'].values()) {
      const event = this.processBaseReward(attestation.id);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Process all pending value attributions.
   */
  processAllPendingValueRewards(): RewardEvent[] {
    const events: RewardEvent[] = [];

    for (const attestation of this.registry['attestations'].values()) {
      const attributions = this.registry.getAttributions(attestation.id);
      for (const attr of attributions) {
        const event = this.processValueAttribution(attr.id);
        if (event) {
          events.push(event);
        }
      }
    }

    return events;
  }

  // =========================================================================
  // QUERIES
  // =========================================================================

  /**
   * Get all rewards for a provider.
   */
  getProviderRewards(providerId: string): {
    total: number;
    baseRewards: number;
    valueRewards: number;
    events: RewardEvent[];
  } {
    const events = this.rewardEvents.filter(e => e.providerId === providerId);
    let baseRewards = 0;
    let valueRewards = 0;

    for (const event of events) {
      if (event.type === 'base') {
        baseRewards += event.amount;
      } else if (event.type === 'value') {
        valueRewards += event.amount;
      }
    }

    return {
      total: baseRewards + valueRewards,
      baseRewards,
      valueRewards,
      events,
    };
  }

  /**
   * Get reward statistics.
   */
  getStats(): {
    totalRewardsDistributed: number;
    totalBaseRewards: number;
    totalValueRewards: number;
    attestationsRewarded: number;
    attributionsProcessed: number;
    averageBaseReward: number;
    averageValueReward: number;
  } {
    let totalBaseRewards = 0;
    let totalValueRewards = 0;
    let baseCount = 0;
    let valueCount = 0;

    for (const event of this.rewardEvents) {
      if (event.type === 'base') {
        totalBaseRewards += event.amount;
        baseCount++;
      } else if (event.type === 'value') {
        totalValueRewards += event.amount;
        valueCount++;
      }
    }

    return {
      totalRewardsDistributed: totalBaseRewards + totalValueRewards,
      totalBaseRewards,
      totalValueRewards,
      attestationsRewarded: this.rewardedAttestations.size,
      attributionsProcessed: this.processedAttributions.size,
      averageBaseReward: baseCount > 0 ? totalBaseRewards / baseCount : 0,
      averageValueReward: valueCount > 0 ? totalValueRewards / valueCount : 0,
    };
  }

  /**
   * Get all reward events (for auditing).
   */
  getAllEvents(): RewardEvent[] {
    return [...this.rewardEvents];
  }

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  /**
   * Update reward rates.
   */
  setRates(rates: Partial<RewardRates>): void {
    this.rates = { ...this.rates, ...rates };
  }

  /**
   * Get current rates.
   */
  getRates(): RewardRates {
    return { ...this.rates };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createComputeRewardManager(
  registry: ComputeRegistry,
  rates?: Partial<RewardRates>
): ComputeRewardManager {
  const fullRates = rates ? { ...DEFAULT_REWARD_RATES, ...rates } : DEFAULT_REWARD_RATES;
  return new ComputeRewardManager(registry, fullRates);
}
