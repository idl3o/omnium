/**
 * OMNIUM Ledger
 *
 * The central engine that coordinates all OMNIUM operations.
 * Ties together the Commons Pool, Wallets, Conversion Engine,
 * and all five layers.
 */

import { v4 as uuid } from 'uuid';
import {
  OmniumUnit,
  Transaction,
  TransactionType,
  ProvenanceType,
  ProvenanceEntry,
  TemporalStratum,
  ConversionRequest,
} from '../core/types.js';
import { CommonsPool } from '../core/pool.js';
import { WalletManager } from '../wallet/wallet.js';
import { ConversionEngine, ConversionContext } from '../core/conversion.js';
import { CommunityRegistry } from '../layers/local.js';
import { PurposeRegistry } from '../layers/purpose.js';
import { tickUnit } from '../layers/temporal.js';
import { createUnit, splitUnit, mergeUnits, addProvenance } from '../core/omnium.js';
import { PersistenceManager } from '../persistence/manager/persistence-manager.js';
import type { PersistenceConfig } from '../persistence/types.js';

export interface TransferResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

/**
 * The OMNIUM Ledger - coordinates all system operations.
 */
export class OmniumLedger {
  readonly pool: CommonsPool;
  readonly wallets: WalletManager;
  readonly conversion: ConversionEngine;
  readonly communities: CommunityRegistry;
  readonly purposes: PurposeRegistry;

  private transactions: Transaction[] = [];
  private persistence: PersistenceManager | null = null;
  private autoSave = false;

  constructor(initialTime?: number) {
    this.pool = new CommonsPool(initialTime);
    this.wallets = new WalletManager();
    this.conversion = new ConversionEngine();
    this.communities = new CommunityRegistry();
    this.purposes = new PurposeRegistry();
  }

  /**
   * Get current simulation time.
   */
  get currentTime(): number {
    return this.pool.getTime();
  }

  /**
   * Create the conversion context for the engine.
   */
  private getContext(): ConversionContext {
    return {
      communities: this.communities.export(),
      purposes: this.purposes.export(),
      currentTime: this.currentTime,
    };
  }

  /**
   * Mint new OMNIUM from the Commons Pool.
   */
  mint(amount: number, toWalletId: string, note?: string): OmniumUnit {
    const wallet = this.wallets.getWallet(toWalletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${toWalletId}`);
    }

    const unit = this.pool.mint(amount, toWalletId, note);
    this.wallets.addUnit(unit);

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return unit;
  }

  /**
   * Convert a unit to different dimensions.
   */
  convert(unitId: string, request: Omit<ConversionRequest, 'unitId'>): OmniumUnit {
    const unit = this.wallets.getUnit(unitId);
    if (!unit) {
      throw new Error(`Unit not found: ${unitId}`);
    }

    const result = this.conversion.convert(
      unit,
      { ...request, unitId },
      this.getContext()
    );

    if (!result.success || !result.newUnit) {
      throw new Error(result.error ?? 'Conversion failed');
    }

    // Remove old unit, add new unit
    this.wallets.removeUnit(unitId);
    this.wallets.addUnit(result.newUnit);

    // Burn the fees
    if (result.fees.total > 0) {
      this.pool.collectFee(unit, result.fees.total);
    }

    // Record transaction
    const tx: Transaction = {
      id: uuid(),
      type: TransactionType.Convert,
      timestamp: this.currentTime,
      inputUnits: [unitId],
      outputUnits: [result.newUnit.id],
      fees: result.fees.total,
      description: `Converted ${unit.magnitude.toFixed(2)}Ω → ${result.newUnit.magnitude.toFixed(2)}Ω`,
    };
    this.transactions.push(tx);

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return result.newUnit;
  }

  /**
   * Transfer OMNIUM between wallets.
   */
  transfer(
    unitId: string,
    toWalletId: string,
    amount?: number,
    note?: string
  ): TransferResult {
    const unit = this.wallets.getUnit(unitId);
    if (!unit) {
      return { success: false, error: `Unit not found: ${unitId}` };
    }

    const toWallet = this.wallets.getWallet(toWalletId);
    if (!toWallet) {
      return { success: false, error: `Destination wallet not found: ${toWalletId}` };
    }

    // Check purpose restrictions
    const purposeCheck = this.purposes.canReceive(toWallet, unit);
    if (!purposeCheck.valid) {
      return { success: false, error: purposeCheck.reason };
    }

    const txId = uuid();
    const transferAmount = amount ?? unit.magnitude;

    if (transferAmount > unit.magnitude) {
      return { success: false, error: 'Insufficient balance' };
    }

    let transferUnit: OmniumUnit;
    let remainingUnit: OmniumUnit | null = null;

    if (transferAmount < unit.magnitude) {
      // Split the unit
      const [remaining, split] = splitUnit(
        unit,
        transferAmount,
        txId,
        this.currentTime
      );
      remainingUnit = remaining;
      transferUnit = split;
    } else {
      transferUnit = unit;
    }

    // Add transfer provenance
    const transferEntry: ProvenanceEntry = {
      timestamp: this.currentTime,
      type: note ? ProvenanceType.Earned : ProvenanceType.Gifted,
      fromWallet: unit.walletId,
      toWallet: toWalletId,
      amount: transferAmount,
      note,
      transactionId: txId,
    };

    // Update the transferred unit
    const newUnit: OmniumUnit = {
      ...transferUnit,
      walletId: toWalletId,
      provenance: [...transferUnit.provenance, transferEntry],
    };

    // Update storage
    this.wallets.removeUnit(unitId);
    this.wallets.addUnit(newUnit);
    if (remainingUnit) {
      this.wallets.addUnit(remainingUnit);
    }

    // Record transaction
    const tx: Transaction = {
      id: txId,
      type: TransactionType.Transfer,
      timestamp: this.currentTime,
      inputUnits: [unitId],
      outputUnits: remainingUnit
        ? [newUnit.id, remainingUnit.id]
        : [newUnit.id],
      fees: 0,
      description: `Transfer ${transferAmount.toFixed(2)}Ω to ${toWallet.name}`,
    };
    this.transactions.push(tx);

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return { success: true, transaction: tx };
  }

  /**
   * Advance time and apply temporal effects (demurrage/dividends).
   */
  tick(daysToAdvance: number = 1): { updated: number; totalDemurrage: number; totalDividend: number } {
    const msToAdvance = daysToAdvance * 24 * 60 * 60 * 1000;
    this.pool.advanceTime(msToAdvance);

    let updated = 0;
    let totalDemurrage = 0;
    let totalDividend = 0;

    for (const unit of this.wallets.getAllUnits()) {
      const oldMagnitude = unit.magnitude;
      const newUnit = tickUnit(unit, this.currentTime);

      if (newUnit.magnitude !== oldMagnitude) {
        const diff = newUnit.magnitude - oldMagnitude;
        if (diff < 0) {
          totalDemurrage += Math.abs(diff);
        } else {
          totalDividend += diff;
        }
        this.wallets.updateUnit(newUnit);
        updated++;
      }
    }

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return { updated, totalDemurrage, totalDividend };
  }

  /**
   * Set simulation time to a specific date.
   */
  setTime(time: number): void {
    this.pool.setTime(time);
  }

  /**
   * Get all transactions.
   */
  getTransactions(): readonly Transaction[] {
    return this.transactions;
  }

  /**
   * Get system status summary.
   */
  status(): string {
    const poolState = this.pool.getState();
    const wallets = this.wallets.getAllWallets();
    const units = this.wallets.getAllUnits();
    const communities = this.communities.getAllCommunities();
    const purposes = this.purposes.getAllPurposes();

    const totalByStratum: Record<TemporalStratum, number> = {
      [TemporalStratum.T0]: 0,
      [TemporalStratum.T1]: 0,
      [TemporalStratum.T2]: 0,
      [TemporalStratum.TInfinity]: 0,
    };

    for (const unit of units) {
      totalByStratum[unit.temporality] += unit.magnitude;
    }

    return [
      '╔══════════════════════════════════════╗',
      '║         OMNIUM LEDGER STATUS         ║',
      '╠══════════════════════════════════════╣',
      `║ Current Supply: ${poolState.currentSupply.toFixed(2).padStart(15)}Ω ║`,
      `║ Total Minted:   ${poolState.totalMinted.toFixed(2).padStart(15)}Ω ║`,
      `║ Total Burned:   ${poolState.totalBurned.toFixed(2).padStart(15)}Ω ║`,
      '╠══════════════════════════════════════╣',
      '║ By Temporality:                      ║',
      `║   T0 (Immediate):   ${totalByStratum[TemporalStratum.T0].toFixed(2).padStart(11)}Ω ║`,
      `║   T1 (Seasonal):    ${totalByStratum[TemporalStratum.T1].toFixed(2).padStart(11)}Ω ║`,
      `║   T2 (Generational):${totalByStratum[TemporalStratum.T2].toFixed(2).padStart(11)}Ω ║`,
      `║   T∞ (Perpetual):   ${totalByStratum[TemporalStratum.TInfinity].toFixed(2).padStart(11)}Ω ║`,
      '╠══════════════════════════════════════╣',
      `║ Wallets:      ${wallets.length.toString().padStart(20)} ║`,
      `║ Units:        ${units.length.toString().padStart(20)} ║`,
      `║ Communities:  ${communities.length.toString().padStart(20)} ║`,
      `║ Purposes:     ${purposes.length.toString().padStart(20)} ║`,
      `║ Transactions: ${this.transactions.length.toString().padStart(20)} ║`,
      '╠══════════════════════════════════════╣',
      `║ Sim Time: ${new Date(poolState.currentTime).toISOString().slice(0, 10)}              ║`,
      '╚══════════════════════════════════════╝',
    ].join('\n');
  }

  // ==========================================================================
  // PERSISTENCE METHODS
  // ==========================================================================

  /**
   * Enable persistence with optional configuration.
   * If a saved state exists, it will be loaded.
   */
  async enablePersistence(config?: Partial<PersistenceConfig>): Promise<boolean> {
    if (this.persistence) {
      return true; // Already enabled
    }

    this.persistence = new PersistenceManager(config);
    await this.persistence.initialize();

    // Check if saved state exists and load it
    if (this.persistence.hasSavedState()) {
      const snapshot = await this.persistence.loadSnapshot();
      if (snapshot) {
        // Restore state from snapshot
        this.pool.restoreState({
          totalMinted: snapshot.pool.totalMinted,
          totalBurned: snapshot.pool.totalBurned,
          currentSupply: snapshot.pool.currentSupply,
          currentTime: snapshot.pool.currentTime,
        });

        this.wallets.clear();

        // Restore communities
        const communityMap = new Map(
          snapshot.communities.map((c) => [c.id, c])
        );
        this.communities.import(communityMap);

        // Restore purposes (need to deserialize Sets)
        const { deserializePurpose } = await import('../persistence/serialization.js');
        const purposeMap = new Map(
          snapshot.purposes.map(deserializePurpose).map((p) => [p.id, p])
        );
        this.purposes.import(purposeMap);

        // Restore wallets
        const { deserializeWallet, deserializeUnit } = await import('../persistence/serialization.js');
        for (const walletData of snapshot.wallets) {
          const wallet = deserializeWallet(walletData);
          this.wallets.restoreWallet(wallet);
        }

        // Restore units
        for (const unitData of snapshot.units) {
          const unit = deserializeUnit(unitData);
          this.wallets.addUnit(unit);
        }

        return true;
      }
    }

    this.autoSave = config?.autoSave ?? true;
    return false; // No existing state loaded
  }

  /**
   * Save current state to persistence.
   * Returns the CID of the snapshot.
   */
  async save(): Promise<string> {
    if (!this.persistence) {
      throw new Error('Persistence not enabled. Call enablePersistence() first.');
    }

    const cid = await this.persistence.saveSnapshot(this);
    return cid.toString();
  }

  /**
   * Check if persistence is enabled.
   */
  isPersistenceEnabled(): boolean {
    return this.persistence !== null;
  }

  /**
   * Get persistence statistics.
   */
  getPersistenceStats(): ReturnType<PersistenceManager['getStats']> | null {
    return this.persistence?.getStats() ?? null;
  }

  /**
   * Disable persistence and cleanup.
   */
  async disablePersistence(): Promise<void> {
    if (this.persistence) {
      await this.persistence.close();
      this.persistence = null;
      this.autoSave = false;
    }
  }

  /**
   * Auto-save if enabled.
   * Called internally after mutating operations.
   */
  private async autoSaveIfEnabled(): Promise<void> {
    if (this.autoSave && this.persistence) {
      try {
        await this.persistence.saveSnapshot(this);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }
  }
}

/**
 * Create a new OMNIUM ledger instance.
 */
export function createLedger(initialTime?: number): OmniumLedger {
  return new OmniumLedger(initialTime);
}
