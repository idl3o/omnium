/**
 * OMNIUM Snapshot Manager
 *
 * Creates and restores complete ledger snapshots.
 * Handles serialization of all state components.
 */

import type { OmniumLedger } from '../../engine/ledger.js';
import { createLedger } from '../../engine/ledger.js';
import type { LedgerSnapshot } from '../types.js';
import { SCHEMA_VERSION } from '../types.js';
import {
  serializeUnit,
  serializeWallet,
  serializePurpose,
  deserializeUnit,
  deserializeWallet,
  deserializePurpose,
} from '../serialization.js';

/**
 * Create a complete snapshot of ledger state.
 * All Sets are converted to Arrays for JSON serialization.
 */
export function createSnapshot(ledger: OmniumLedger): LedgerSnapshot {
  const poolState = ledger.pool.getState();
  const dividendPoolState = ledger.dividendPool.export();

  return {
    version: SCHEMA_VERSION,
    timestamp: Date.now(),

    pool: {
      totalMinted: poolState.totalMinted,
      totalBurned: poolState.totalBurned,
      currentSupply: poolState.currentSupply,
      currentTime: poolState.currentTime,
    },

    dividendPool: {
      balance: dividendPoolState.balance,
      totalDemurrageCollected: dividendPoolState.totalDemurrageCollected,
      totalDividendsDistributed: dividendPoolState.totalDividendsDistributed,
      totalDividendsRequested: dividendPoolState.totalDividendsRequested,
      depositCount: dividendPoolState.depositCount,
      withdrawalCount: dividendPoolState.withdrawalCount,
    },

    units: ledger.wallets.getAllUnits().map(serializeUnit),
    wallets: ledger.wallets.getAllWallets().map(serializeWallet),
    communities: ledger.communities.getAllCommunities(),
    purposes: ledger.purposes.getAllPurposes().map(serializePurpose),
  };
}

/**
 * Restore a ledger from a snapshot.
 * Creates a new OmniumLedger instance with all state restored.
 */
export function restoreFromSnapshot(snapshot: LedgerSnapshot): OmniumLedger {
  // Check schema version (support version 1 for backwards compat)
  if (snapshot.version !== SCHEMA_VERSION && snapshot.version !== 1) {
    throw new Error(
      `Unsupported snapshot version: ${snapshot.version}. Expected: ${SCHEMA_VERSION}`
    );
  }

  // Create fresh ledger with saved time
  const ledger = createLedger(snapshot.pool.currentTime);

  // Restore pool state
  ledger.pool.restoreState({
    totalMinted: snapshot.pool.totalMinted,
    totalBurned: snapshot.pool.totalBurned,
    currentSupply: snapshot.pool.currentSupply,
    currentTime: snapshot.pool.currentTime,
  });

  // Restore dividend pool state (if present - v2+)
  if (snapshot.dividendPool) {
    ledger.dividendPool.import({
      balance: snapshot.dividendPool.balance,
      totalDemurrageCollected: snapshot.dividendPool.totalDemurrageCollected,
      totalDividendsDistributed: snapshot.dividendPool.totalDividendsDistributed,
      totalDividendsRequested: snapshot.dividendPool.totalDividendsRequested,
      depositCount: snapshot.dividendPool.depositCount,
      withdrawalCount: snapshot.dividendPool.withdrawalCount,
    });
  }

  // Clear existing data
  ledger.wallets.clear();

  // Restore communities (before wallets, as wallets may reference them)
  const communityMap = new Map(
    snapshot.communities.map((c) => [c.id, c])
  );
  ledger.communities.import(communityMap);

  // Restore purposes
  const purposeMap = new Map(
    snapshot.purposes.map(deserializePurpose).map((p) => [p.id, p])
  );
  ledger.purposes.import(purposeMap);

  // Restore wallets
  for (const walletData of snapshot.wallets) {
    const wallet = deserializeWallet(walletData);
    ledger.wallets.restoreWallet(wallet);
  }

  // Restore units
  for (const unitData of snapshot.units) {
    const unit = deserializeUnit(unitData);
    ledger.wallets.addUnit(unit);
  }

  return ledger;
}

/**
 * Validate a snapshot structure.
 * Returns true if valid, throws on errors.
 */
export function validateSnapshot(snapshot: unknown): snapshot is LedgerSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Snapshot must be an object');
  }

  const s = snapshot as Record<string, unknown>;

  if (typeof s.version !== 'number') {
    throw new Error('Snapshot missing version');
  }

  if (typeof s.timestamp !== 'number') {
    throw new Error('Snapshot missing timestamp');
  }

  if (!s.pool || typeof s.pool !== 'object') {
    throw new Error('Snapshot missing pool state');
  }

  if (!Array.isArray(s.units)) {
    throw new Error('Snapshot missing units array');
  }

  if (!Array.isArray(s.wallets)) {
    throw new Error('Snapshot missing wallets array');
  }

  if (!Array.isArray(s.communities)) {
    throw new Error('Snapshot missing communities array');
  }

  if (!Array.isArray(s.purposes)) {
    throw new Error('Snapshot missing purposes array');
  }

  return true;
}

/**
 * Get snapshot metadata without full deserialization.
 */
export function getSnapshotMetadata(snapshot: LedgerSnapshot): {
  version: number;
  timestamp: number;
  unitCount: number;
  walletCount: number;
  communityCount: number;
  purposeCount: number;
  totalSupply: number;
} {
  return {
    version: snapshot.version,
    timestamp: snapshot.timestamp,
    unitCount: snapshot.units.length,
    walletCount: snapshot.wallets.length,
    communityCount: snapshot.communities.length,
    purposeCount: snapshot.purposes.length,
    totalSupply: snapshot.pool.currentSupply,
  };
}
