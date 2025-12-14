/**
 * OmniumUnit Operations
 *
 * Core operations for creating, splitting, and merging OMNIUM units.
 */

import { v4 as uuid } from 'uuid';
import {
  OmniumUnit,
  TemporalStratum,
  ProvenanceType,
  ProvenanceEntry,
} from './types.js';

/**
 * Create a new OmniumUnit with the specified properties.
 */
export function createUnit(params: {
  magnitude: number;
  temporality?: TemporalStratum;
  locality?: string[];
  purpose?: string[];
  walletId: string;
  provenanceType: ProvenanceType;
  fromWallet?: string;
  note?: string;
  transactionId?: string;
  currentTime?: number;
}): OmniumUnit {
  const now = params.currentTime ?? Date.now();
  const txId = params.transactionId ?? uuid();

  const initialProvenance: ProvenanceEntry = {
    timestamp: now,
    type: params.provenanceType,
    fromWallet: params.fromWallet,
    toWallet: params.walletId,
    amount: params.magnitude,
    note: params.note,
    transactionId: txId,
  };

  return {
    id: uuid(),
    magnitude: params.magnitude,
    temporality: params.temporality ?? TemporalStratum.T0,
    locality: new Set(params.locality ?? []),
    purpose: new Set(params.purpose ?? []),
    provenance: [initialProvenance],
    createdAt: now,
    lastTickAt: now,
    walletId: params.walletId,
  };
}

/**
 * Split a unit into two parts.
 * Returns [remaining, split] where split has the requested amount.
 */
export function splitUnit(
  unit: OmniumUnit,
  amount: number,
  transactionId: string,
  currentTime: number
): [OmniumUnit, OmniumUnit] {
  if (amount <= 0 || amount >= unit.magnitude) {
    throw new Error(
      `Invalid split amount: ${amount}. Must be between 0 and ${unit.magnitude}`
    );
  }

  const splitEntry: ProvenanceEntry = {
    timestamp: currentTime,
    type: ProvenanceType.Split,
    amount: amount,
    transactionId,
  };

  // The remaining portion keeps the original ID
  const remaining: OmniumUnit = {
    ...unit,
    magnitude: unit.magnitude - amount,
    provenance: [...unit.provenance, { ...splitEntry, amount: unit.magnitude - amount }],
    lastTickAt: currentTime,
  };

  // The split portion gets a new ID but inherits provenance
  const split: OmniumUnit = {
    ...unit,
    id: uuid(),
    magnitude: amount,
    locality: new Set(unit.locality),
    purpose: new Set(unit.purpose),
    provenance: [...unit.provenance, splitEntry],
    lastTickAt: currentTime,
  };

  return [remaining, split];
}

/**
 * Merge multiple units into one.
 * All units must have compatible dimensions (same temporality, locality, purpose).
 */
export function mergeUnits(
  units: OmniumUnit[],
  walletId: string,
  transactionId: string,
  currentTime: number
): OmniumUnit {
  if (units.length < 2) {
    throw new Error('Need at least 2 units to merge');
  }

  // Verify compatibility
  const first = units[0];
  for (const unit of units.slice(1)) {
    if (unit.temporality !== first.temporality) {
      throw new Error('Cannot merge units with different temporality');
    }
    if (!setsEqual(unit.locality, first.locality)) {
      throw new Error('Cannot merge units with different locality');
    }
    if (!setsEqual(unit.purpose, first.purpose)) {
      throw new Error('Cannot merge units with different purpose');
    }
  }

  const totalMagnitude = units.reduce((sum, u) => sum + u.magnitude, 0);

  // Combine all provenance chains (interleaved by timestamp)
  const allProvenance = units
    .flatMap((u) => u.provenance)
    .sort((a, b) => a.timestamp - b.timestamp);

  const mergeEntry: ProvenanceEntry = {
    timestamp: currentTime,
    type: ProvenanceType.Merged,
    amount: totalMagnitude,
    note: `Merged ${units.length} units`,
    transactionId,
  };

  return {
    id: uuid(),
    magnitude: totalMagnitude,
    temporality: first.temporality,
    locality: new Set(first.locality),
    purpose: new Set(first.purpose),
    provenance: [...allProvenance, mergeEntry],
    createdAt: currentTime,
    lastTickAt: currentTime,
    walletId,
  };
}

/**
 * Add a provenance entry to a unit.
 */
export function addProvenance(
  unit: OmniumUnit,
  entry: Omit<ProvenanceEntry, 'amount'>
): OmniumUnit {
  return {
    ...unit,
    provenance: [
      ...unit.provenance,
      { ...entry, amount: unit.magnitude },
    ],
  };
}

/**
 * Calculate the reputation score from provenance.
 * Score is 0-1 based on the richness and quality of history.
 */
export function calculateReputationScore(unit: OmniumUnit): number {
  const { provenance } = unit;

  if (provenance.length === 0) return 0;

  let score = 0;

  // Diversity of provenance types
  const types = new Set(provenance.map((p) => p.type));
  score += Math.min(types.size / 5, 0.3); // Up to 0.3 for type diversity

  // Chain length (logarithmic)
  score += Math.min(Math.log10(provenance.length + 1) / 3, 0.3); // Up to 0.3 for length

  // Earned vs minted ratio (earned is "better")
  const earnedCount = provenance.filter(
    (p) => p.type === ProvenanceType.Earned
  ).length;
  score += (earnedCount / provenance.length) * 0.4; // Up to 0.4 for earned ratio

  return Math.min(score, 1);
}

/**
 * Get a human-readable summary of a unit.
 */
export function unitSummary(unit: OmniumUnit): string {
  const locality =
    unit.locality.size === 0
      ? 'global'
      : `local(${Array.from(unit.locality).join(', ')})`;
  const purpose =
    unit.purpose.size === 0
      ? 'unrestricted'
      : `purpose(${Array.from(unit.purpose).join(', ')})`;
  const rep = calculateReputationScore(unit).toFixed(2);

  return `Ω${unit.magnitude.toFixed(2)} [${unit.temporality}] ${locality} ${purpose} rep:${rep}`;
}

/**
 * Check if a unit is currently locked (cannot be spent).
 */
export function isLocked(unit: OmniumUnit, currentTime: number): boolean {
  if (unit.temporality === TemporalStratum.T0) return false;
  if (unit.temporality === TemporalStratum.TInfinity) return true; // Principal always locked

  const lockupMs = getLockupMs(unit.temporality);
  return currentTime < unit.createdAt + lockupMs;
}

function getLockupMs(stratum: TemporalStratum): number {
  const daysPerMs = 24 * 60 * 60 * 1000;
  switch (stratum) {
    case TemporalStratum.T0:
      return 0;
    case TemporalStratum.T1:
      return 365 * daysPerMs;
    case TemporalStratum.T2:
      return 365 * 20 * daysPerMs;
    case TemporalStratum.TInfinity:
      return Infinity;
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
