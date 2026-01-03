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
import { tickUnitWithPool, PoolTickResult } from '../layers/temporal.js';
import { createUnit, splitUnit, mergeUnits, addProvenance } from '../core/omnium.js';
import { DividendPool, DividendPoolStats } from '../economics/dividend-pool.js';
import { CommunityFundManager } from '../economics/community-fund.js';
import {
  ComputePool,
  ComputePoolStats,
  JobSpec,
  SubmitJobOptions,
  ComputeJob,
  ComputeResult,
  MintResult,
} from '../economics/compute-pool.js';
import { SimulationRegistry } from '../economics/simulation.js';
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
  readonly dividendPool: DividendPool;
  readonly communityFunds: CommunityFundManager;
  readonly computePool: ComputePool;
  readonly simulations: SimulationRegistry;

  private transactions: Transaction[] = [];
  private persistence: PersistenceManager | null = null;
  private autoSave = false;

  constructor(initialTime?: number) {
    this.pool = new CommonsPool(initialTime);
    this.wallets = new WalletManager();
    this.conversion = new ConversionEngine();
    this.communities = new CommunityRegistry();
    this.purposes = new PurposeRegistry();
    this.dividendPool = new DividendPool();
    this.communityFunds = new CommunityFundManager();
    this.computePool = new ComputePool(() => this.currentTime);
    this.simulations = new SimulationRegistry();

    // Wire compute pool to mint rewards through the ledger
    this.computePool.setMintCallback(
      (amount, toWallet, purpose, locality, note) => {
        try {
          const unit = this.mintCompute(amount, toWallet, purpose, locality, note);
          return unit.id;
        } catch {
          return null;
        }
      }
    );
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
   * Mint from compute rewards with optional purpose/locality.
   * Called by ComputePool when a job is completed.
   */
  private mintCompute(
    amount: number,
    toWalletId: string,
    purpose?: string,
    locality?: string,
    note?: string
  ): OmniumUnit {
    const wallet = this.wallets.getWallet(toWalletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${toWalletId}`);
    }

    // Mint base T0 unit
    const unit = this.pool.mint(amount, toWalletId, note);

    // Add purpose if specified
    if (purpose) {
      const purposeObj = this.purposes.getPurpose(purpose);
      if (purposeObj) {
        unit.purpose.add(purpose);
      }
    }

    // Add locality if specified
    if (locality) {
      const community = this.communities.getCommunity(locality);
      if (community) {
        unit.locality.add(locality);
      }
    }

    this.wallets.addUnit(unit);

    // Record transaction
    const tx: Transaction = {
      id: uuid(),
      type: TransactionType.Mint,
      timestamp: this.currentTime,
      inputUnits: [],
      outputUnits: [unit.id],
      fees: 0,
      description: `Compute reward: ${amount.toFixed(2)}Ω to ${wallet.name}`,
    };
    this.transactions.push(tx);

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return unit;
  }

  // ===========================================================================
  // COMPUTE METHODS
  // ===========================================================================

  /**
   * Submit a compute job.
   * External requestors pay for useful computation.
   */
  submitComputeJob(
    requestor: string,
    spec: JobSpec,
    payment: number,
    options?: SubmitJobOptions
  ): ComputeJob {
    return this.computePool.submitJob(requestor, spec, payment, options);
  }

  /**
   * Provider claims a compute job.
   */
  claimComputeJob(jobId: string, provider: string): boolean {
    // Ensure provider has a wallet
    const wallet = this.wallets.getWallet(provider);
    if (!wallet) {
      return false;
    }
    return this.computePool.claimJob(jobId, provider);
  }

  /**
   * Provider submits completed work.
   * On success, mints reward to provider wallet.
   */
  completeComputeJob(
    jobId: string,
    provider: string,
    result: ComputeResult
  ): MintResult {
    return this.computePool.submitResult(jobId, provider, result);
  }

  /**
   * Get available compute jobs.
   */
  getAvailableComputeJobs(): ComputeJob[] {
    return this.computePool.getAvailableJobs();
  }

  /**
   * Get compute pool statistics.
   */
  getComputeStats(): ComputePoolStats {
    return this.computePool.getStats();
  }

  /**
   * Convert a unit to different dimensions.
   *
   * Fees are routed appropriately:
   * - Locality exit fees → Community Funds (economic sovereignty)
   * - Other fees (temporal, purpose, reputation) → Burned (supply contraction)
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

    // Route locality exit fees to community funds
    let exitFeesTotal = 0;
    if (result.localityExitFees) {
      for (const [communityId, fee] of result.localityExitFees) {
        const community = this.communities.getCommunity(communityId);
        this.communityFunds.depositExitFee(
          communityId,
          fee,
          unitId,
          unit.walletId,
          this.currentTime,
          community?.name
        );
        exitFeesTotal += fee;
      }
    }

    // Entry fees (locality fees minus exit fees) go to commons pool
    const entryFees = result.fees.locality - exitFeesTotal;

    // Burn temporal, purpose, reputation, and entry fees
    const feesToBurn = result.fees.temporal + result.fees.purpose + result.fees.reputation + entryFees;
    if (feesToBurn > 0) {
      this.pool.collectFee(unit, feesToBurn);
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
   *
   * Uses the DividendPool to mediate time preference:
   * - T0 demurrage is deposited into the pool
   * - T2/T∞ dividends are funded from the pool
   *
   * Returns statistics including pool funding ratio.
   */
  tick(daysToAdvance: number = 1): {
    updated: number;
    totalDemurrage: number;
    totalDividend: number;
    dividendRequested: number;
    dividendFunded: number;
    poolBalance: number;
  } {
    const msToAdvance = daysToAdvance * 24 * 60 * 60 * 1000;
    this.pool.advanceTime(msToAdvance);

    let updated = 0;
    let totalDemurrage = 0;
    let totalDividend = 0;
    let dividendRequested = 0;
    let dividendFunded = 0;

    for (const unit of this.wallets.getAllUnits()) {
      const oldMagnitude = unit.magnitude;
      const result = tickUnitWithPool(unit, this.currentTime, this.dividendPool);

      // Track demurrage deposited to pool
      if (result.demurrageDeposited > 0) {
        totalDemurrage += result.demurrageDeposited;
      }

      // Track dividend flow
      if (result.dividendRequested > 0) {
        dividendRequested += result.dividendRequested;
        dividendFunded += result.dividendReceived;
        totalDividend += result.dividendReceived;
      }

      if (result.unit.magnitude !== oldMagnitude || result.unit.lastTickAt !== unit.lastTickAt) {
        this.wallets.updateUnit(result.unit);
        updated++;
      }
    }

    // Auto-save (fire and forget)
    this.autoSaveIfEnabled();

    return {
      updated,
      totalDemurrage,
      totalDividend,
      dividendRequested,
      dividendFunded,
      poolBalance: this.dividendPool.getBalance(),
    };
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
   * Get dividend pool statistics.
   */
  getDividendPoolStats(): DividendPoolStats {
    return this.dividendPool.getStats();
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
    const divPoolStats = this.dividendPool.getStats();
    const computeStats = this.computePool.getStats();

    const totalByStratum: Record<TemporalStratum, number> = {
      [TemporalStratum.T0]: 0,
      [TemporalStratum.T1]: 0,
      [TemporalStratum.T2]: 0,
      [TemporalStratum.TInfinity]: 0,
    };

    for (const unit of units) {
      totalByStratum[unit.temporality] += unit.magnitude;
    }

    const fundingPct = (divPoolStats.fundingRatio * 100).toFixed(1);

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
      '║ Dividend Pool:                       ║',
      `║   Balance:          ${divPoolStats.balance.toFixed(2).padStart(11)}Ω ║`,
      `║   Demurrage In:     ${divPoolStats.totalDemurrageCollected.toFixed(2).padStart(11)}Ω ║`,
      `║   Dividends Out:    ${divPoolStats.totalDividendsDistributed.toFixed(2).padStart(11)}Ω ║`,
      `║   Funding Ratio:    ${fundingPct.padStart(11)}% ║`,
      '╠══════════════════════════════════════╣',
      '║ Compute Pool (Bootstrap):            ║',
      `║   Jobs Pending:     ${computeStats.pendingJobs.toString().padStart(11)} ║`,
      `║   Jobs Completed:   ${computeStats.completedJobs.toString().padStart(11)} ║`,
      `║   Payments In:      ${computeStats.totalPaymentReceived.toFixed(2).padStart(11)}$ ║`,
      `║   Rewards Minted:   ${computeStats.totalRewardsMinted.toFixed(2).padStart(11)}Ω ║`,
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

        // Restore dividend pool state (v2+ snapshots)
        if (snapshot.dividendPool) {
          this.dividendPool.import({
            balance: snapshot.dividendPool.balance,
            totalDemurrageCollected: snapshot.dividendPool.totalDemurrageCollected,
            totalDividendsDistributed: snapshot.dividendPool.totalDividendsDistributed,
            totalDividendsRequested: snapshot.dividendPool.totalDividendsRequested,
            depositCount: snapshot.dividendPool.depositCount,
            withdrawalCount: snapshot.dividendPool.withdrawalCount,
          });
        }

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
