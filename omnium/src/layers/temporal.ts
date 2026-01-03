/**
 * Temporal Strata (Layer 2)
 *
 * Manages time-bound behavior of OMNIUM:
 * - T0 (Immediate): Demurrage - value decays to encourage spending
 * - T1 (Seasonal): Stable - locked for a year
 * - T2 (Generational): Dividend - grows over 20 years
 * - T∞ (Perpetual): Yield - principal protected, generates returns
 *
 * "Moving between temporal strata has costs and benefits,
 *  creating a natural market for time-preference without
 *  requiring interest rates."
 */

import {
  OmniumUnit,
  TemporalStratum,
  TEMPORAL_CONFIG,
  ProvenanceEntry,
  ProvenanceType,
} from '../core/types.js';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Apply demurrage (decay) to T0 units.
 *
 * Demurrage encourages circulation by slowly reducing value
 * of idle money. "Use it or lose it."
 */
export function applyDemurrage(
  unit: OmniumUnit,
  currentTime: number
): OmniumUnit {
  if (unit.temporality !== TemporalStratum.T0) {
    return unit;
  }

  const config = TEMPORAL_CONFIG[TemporalStratum.T0];
  const elapsed = currentTime - unit.lastTickAt;
  const years = elapsed / MS_PER_YEAR;

  if (years <= 0) return unit;

  // Continuous demurrage: magnitude * e^(-rate * time)
  const decayFactor = Math.exp(-config.demurrageRate * years);
  const newMagnitude = unit.magnitude * decayFactor;
  const lost = unit.magnitude - newMagnitude;

  if (lost < 0.0001) {
    // Too small to bother
    return { ...unit, lastTickAt: currentTime };
  }

  return {
    ...unit,
    magnitude: newMagnitude,
    lastTickAt: currentTime,
  };
}

/**
 * Apply dividend (growth) to T2 and T∞ units.
 *
 * Long-term holdings are rewarded with value growth,
 * encouraging saving and intergenerational transfer.
 */
export function applyDividend(
  unit: OmniumUnit,
  currentTime: number
): OmniumUnit {
  const config = TEMPORAL_CONFIG[unit.temporality];
  if (config.dividendRate <= 0) {
    return unit;
  }

  const elapsed = currentTime - unit.lastTickAt;
  const years = elapsed / MS_PER_YEAR;

  if (years <= 0) return unit;

  // Continuous dividend: magnitude * e^(rate * time)
  const growthFactor = Math.exp(config.dividendRate * years);
  const newMagnitude = unit.magnitude * growthFactor;

  return {
    ...unit,
    magnitude: newMagnitude,
    lastTickAt: currentTime,
  };
}

/**
 * Apply all temporal effects to a unit.
 */
export function tickUnit(unit: OmniumUnit, currentTime: number): OmniumUnit {
  switch (unit.temporality) {
    case TemporalStratum.T0:
      return applyDemurrage(unit, currentTime);
    case TemporalStratum.T1:
      // Seasonal: no change, just update tick time
      return { ...unit, lastTickAt: currentTime };
    case TemporalStratum.T2:
    case TemporalStratum.TInfinity:
      return applyDividend(unit, currentTime);
  }
}

/**
 * Check if a unit's lockup period has expired.
 */
export function isUnlocked(unit: OmniumUnit, currentTime: number): boolean {
  const config = TEMPORAL_CONFIG[unit.temporality];
  if (config.lockupDays === 0) return true;
  if (config.lockupDays === Infinity) return false;

  const lockupMs = config.lockupDays * 24 * 60 * 60 * 1000;
  return currentTime >= unit.createdAt + lockupMs;
}

/**
 * Get time remaining until unlock.
 */
export function timeUntilUnlock(unit: OmniumUnit, currentTime: number): number {
  const config = TEMPORAL_CONFIG[unit.temporality];
  if (config.lockupDays === 0) return 0;
  if (config.lockupDays === Infinity) return Infinity;

  const lockupMs = config.lockupDays * 24 * 60 * 60 * 1000;
  const unlockTime = unit.createdAt + lockupMs;
  return Math.max(0, unlockTime - currentTime);
}

/**
 * Calculate projected value at a future time.
 */
export function projectValue(
  unit: OmniumUnit,
  futureTime: number
): number {
  const config = TEMPORAL_CONFIG[unit.temporality];
  const elapsed = futureTime - unit.lastTickAt;
  const years = elapsed / MS_PER_YEAR;

  if (config.demurrageRate > 0) {
    return unit.magnitude * Math.exp(-config.demurrageRate * years);
  } else if (config.dividendRate > 0) {
    return unit.magnitude * Math.exp(config.dividendRate * years);
  }
  return unit.magnitude;
}

/**
 * Get human-readable description of temporal behavior.
 */
export function describeTemporality(stratum: TemporalStratum): string {
  const config = TEMPORAL_CONFIG[stratum];
  const parts = [config.name];

  if (config.demurrageRate > 0) {
    parts.push(`${(config.demurrageRate * 100).toFixed(1)}% annual decay`);
  }
  if (config.dividendRate > 0) {
    parts.push(`${(config.dividendRate * 100).toFixed(1)}% annual growth`);
  }
  if (config.lockupDays > 0 && config.lockupDays < Infinity) {
    const years = config.lockupDays / 365;
    parts.push(`${years} year lockup`);
  }
  if (config.lockupDays === Infinity) {
    parts.push('principal locked forever');
  }

  return parts.join(', ');
}

// =============================================================================
// POOL-AWARE TEMPORAL EFFECTS
// =============================================================================

import type { DividendPool } from '../economics/dividend-pool.js';

/**
 * Result of a pool-aware tick operation.
 */
export interface PoolTickResult {
  /** Updated unit */
  unit: OmniumUnit;

  /** Demurrage deposited to pool (if T0) */
  demurrageDeposited: number;

  /** Dividend requested from pool (if T2/T∞) */
  dividendRequested: number;

  /** Dividend actually received from pool */
  dividendReceived: number;
}

/**
 * Apply demurrage and deposit to DividendPool.
 *
 * This is the pool-aware version of applyDemurrage.
 * The magnitude lost to decay is deposited into the pool
 * to fund dividends for T2/T∞ holders.
 */
export function applyDemurrageWithPool(
  unit: OmniumUnit,
  currentTime: number,
  pool: DividendPool
): PoolTickResult {
  if (unit.temporality !== TemporalStratum.T0) {
    return {
      unit,
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  const config = TEMPORAL_CONFIG[TemporalStratum.T0];
  const elapsed = currentTime - unit.lastTickAt;
  const years = elapsed / MS_PER_YEAR;

  if (years <= 0) {
    return {
      unit,
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  // Continuous demurrage: magnitude * e^(-rate * time)
  const decayFactor = Math.exp(-config.demurrageRate * years);
  const newMagnitude = unit.magnitude * decayFactor;
  const lost = unit.magnitude - newMagnitude;

  if (lost < 0.0001) {
    return {
      unit: { ...unit, lastTickAt: currentTime },
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  // Deposit the demurrage into the pool
  pool.depositDemurrage(lost, unit.id, currentTime);

  return {
    unit: {
      ...unit,
      magnitude: newMagnitude,
      lastTickAt: currentTime,
    },
    demurrageDeposited: lost,
    dividendRequested: 0,
    dividendReceived: 0,
  };
}

/**
 * Apply dividend funded by DividendPool.
 *
 * This is the pool-aware version of applyDividend.
 * The growth is funded by withdrawing from the pool.
 * If the pool is insufficient, growth is proportionally reduced.
 */
export function applyDividendWithPool(
  unit: OmniumUnit,
  currentTime: number,
  pool: DividendPool
): PoolTickResult {
  const config = TEMPORAL_CONFIG[unit.temporality];
  if (config.dividendRate <= 0) {
    return {
      unit,
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  const elapsed = currentTime - unit.lastTickAt;
  const years = elapsed / MS_PER_YEAR;

  if (years <= 0) {
    return {
      unit,
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  // Calculate desired growth
  const growthFactor = Math.exp(config.dividendRate * years);
  const desiredMagnitude = unit.magnitude * growthFactor;
  const dividendRequested = desiredMagnitude - unit.magnitude;

  if (dividendRequested < 0.0001) {
    return {
      unit: { ...unit, lastTickAt: currentTime },
      demurrageDeposited: 0,
      dividendRequested: 0,
      dividendReceived: 0,
    };
  }

  // Withdraw from pool (may get less than requested)
  const dividendReceived = pool.withdrawDividend(
    dividendRequested,
    unit.id,
    currentTime
  );

  const newMagnitude = unit.magnitude + dividendReceived;

  return {
    unit: {
      ...unit,
      magnitude: newMagnitude,
      lastTickAt: currentTime,
    },
    demurrageDeposited: 0,
    dividendRequested,
    dividendReceived,
  };
}

/**
 * Apply all temporal effects using the DividendPool.
 *
 * This is the pool-aware version of tickUnit.
 * Use this in the ledger to ensure demurrage funds dividends.
 */
export function tickUnitWithPool(
  unit: OmniumUnit,
  currentTime: number,
  pool: DividendPool
): PoolTickResult {
  switch (unit.temporality) {
    case TemporalStratum.T0:
      return applyDemurrageWithPool(unit, currentTime, pool);
    case TemporalStratum.T1:
      // Seasonal: no change, just update tick time
      return {
        unit: { ...unit, lastTickAt: currentTime },
        demurrageDeposited: 0,
        dividendRequested: 0,
        dividendReceived: 0,
      };
    case TemporalStratum.T2:
    case TemporalStratum.TInfinity:
      return applyDividendWithPool(unit, currentTime, pool);
  }
}
