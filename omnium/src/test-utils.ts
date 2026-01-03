/**
 * Test Utilities for OMNIUM
 *
 * Shared helpers for creating test data and assertions.
 */

import { createLedger, OmniumLedger } from './engine/ledger.js';
import { createUnit as _createUnit } from './core/omnium.js';
import { OmniumUnit, TemporalStratum, ProvenanceType } from './core/types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365 * MS_PER_DAY;

/**
 * Create a fresh ledger for testing with a fixed starting time.
 */
export function createTestLedger(startTime: number = Date.now()): OmniumLedger {
  return createLedger(startTime);
}

/**
 * Create a test unit with sensible defaults.
 */
export function createTestUnit(
  overrides: Partial<{
    magnitude: number;
    temporality: TemporalStratum;
    locality: Set<string>;
    purpose: Set<string>;
    walletId: string;
    createdAt: number;
    lastTickAt: number;
    provenanceType: ProvenanceType;
  }> = {}
): OmniumUnit {
  const now = overrides.createdAt ?? Date.now();
  return _createUnit({
    magnitude: overrides.magnitude ?? 100,
    temporality: overrides.temporality ?? TemporalStratum.T0,
    locality: overrides.locality ? Array.from(overrides.locality) : [],
    purpose: overrides.purpose ? Array.from(overrides.purpose) : [],
    walletId: overrides.walletId ?? 'test-wallet',
    provenanceType: overrides.provenanceType ?? ProvenanceType.Minted,
    currentTime: now,
  });
}

// Re-export for direct use in tests
export { _createUnit as createUnit };

/**
 * Advance time on a ledger by a number of days.
 */
export function advanceDays(ledger: OmniumLedger, days: number): void {
  ledger.setTime(ledger.currentTime + days * MS_PER_DAY);
}

/**
 * Advance time on a ledger by a number of years.
 */
export function advanceYears(ledger: OmniumLedger, years: number): void {
  ledger.setTime(ledger.currentTime + years * MS_PER_YEAR);
}

/**
 * Assert two numbers are approximately equal (for floating point).
 */
export function assertApproxEqual(
  actual: number,
  expected: number,
  tolerance: number = 0.0001,
  message?: string
): void {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      message ??
        `Expected ${expected} ± ${tolerance}, got ${actual} (diff: ${diff})`
    );
  }
}

/**
 * Calculate expected demurrage after N years.
 * Formula: magnitude * e^(-rate * years)
 */
export function expectedDemurrage(
  magnitude: number,
  years: number,
  rate: number = 0.02
): number {
  return magnitude * Math.exp(-rate * years);
}

/**
 * Calculate expected dividend after N years.
 * Formula: magnitude * e^(rate * years)
 */
export function expectedDividend(
  magnitude: number,
  years: number,
  rate: number
): number {
  return magnitude * Math.exp(rate * years);
}

/**
 * Time constants for convenience.
 */
export const TIME = {
  MS_PER_DAY,
  MS_PER_YEAR,
  DAYS_PER_YEAR: 365,
} as const;
