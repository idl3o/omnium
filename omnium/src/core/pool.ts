/**
 * Commons Pool (Layer 1)
 *
 * The base layer of OMNIUM - a global, undifferentiated reserve.
 * Pure potential value with no intent, locality, or temporality.
 * It simply is. It can become anything.
 *
 * "The Commons Pool is governed by a protocol, not a committee."
 */

import { v4 as uuid } from 'uuid';
import {
  OmniumUnit,
  TemporalStratum,
  ProvenanceType,
  Transaction,
  TransactionType,
} from './types.js';
import { createUnit } from './omnium.js';

export interface PoolState {
  /** Total Ω ever minted */
  totalMinted: number;
  /** Total Ω burned (returned to pool) */
  totalBurned: number;
  /** Current supply = minted - burned */
  currentSupply: number;
  /** Simulation time */
  currentTime: number;
}

/**
 * The Commons Pool manages the creation and destruction of base OMNIUM.
 */
export class CommonsPool {
  private state: PoolState;
  private transactions: Transaction[] = [];

  constructor(initialTime: number = Date.now()) {
    this.state = {
      totalMinted: 0,
      totalBurned: 0,
      currentSupply: 0,
      currentTime: initialTime,
    };
  }

  /**
   * Mint new OMNIUM from the Commons Pool.
   *
   * In a real system, this would follow algorithmic rules based on
   * global economic activity, population, and resource availability.
   * For the prototype, it's admin-controlled.
   */
  mint(amount: number, toWalletId: string, note?: string): OmniumUnit {
    if (amount <= 0) {
      throw new Error('Mint amount must be positive');
    }

    const txId = uuid();

    const unit = createUnit({
      magnitude: amount,
      temporality: TemporalStratum.T0, // Always starts as immediate
      locality: [],                     // Global (no locality)
      purpose: [],                      // Unrestricted (no purpose)
      walletId: toWalletId,
      provenanceType: ProvenanceType.Minted,
      note: note ?? 'Minted from Commons Pool',
      transactionId: txId,
      currentTime: this.state.currentTime,
    });

    // Record transaction
    const tx: Transaction = {
      id: txId,
      type: TransactionType.Mint,
      timestamp: this.state.currentTime,
      inputUnits: [],
      outputUnits: [unit.id],
      fees: 0,
      description: `Minted ${amount}Ω to wallet ${toWalletId}`,
    };
    this.transactions.push(tx);

    // Update pool state
    this.state.totalMinted += amount;
    this.state.currentSupply += amount;

    return unit;
  }

  /**
   * Burn OMNIUM back to the Commons Pool.
   *
   * This removes the unit from circulation. The value returns
   * to the undifferentiated reserve.
   */
  burn(unit: OmniumUnit, note?: string): Transaction {
    const txId = uuid();

    const tx: Transaction = {
      id: txId,
      type: TransactionType.Burn,
      timestamp: this.state.currentTime,
      inputUnits: [unit.id],
      outputUnits: [],
      fees: 0,
      description: note ?? `Burned ${unit.magnitude}Ω`,
    };
    this.transactions.push(tx);

    // Update pool state
    this.state.totalBurned += unit.magnitude;
    this.state.currentSupply -= unit.magnitude;

    return tx;
  }

  /**
   * Collect fees by burning a portion of a unit.
   * Returns the remaining unit with reduced magnitude.
   */
  collectFee(unit: OmniumUnit, feeAmount: number): OmniumUnit {
    if (feeAmount <= 0) return unit;
    if (feeAmount >= unit.magnitude) {
      throw new Error('Fee cannot exceed unit magnitude');
    }

    // Burn the fee portion
    this.state.totalBurned += feeAmount;
    this.state.currentSupply -= feeAmount;

    // Return reduced unit
    return {
      ...unit,
      magnitude: unit.magnitude - feeAmount,
    };
  }

  /**
   * Advance simulation time.
   */
  advanceTime(ms: number): void {
    this.state.currentTime += ms;
  }

  /**
   * Set simulation time to a specific value.
   */
  setTime(time: number): void {
    this.state.currentTime = time;
  }

  /**
   * Get current simulation time.
   */
  getTime(): number {
    return this.state.currentTime;
  }

  /**
   * Get pool statistics.
   */
  getState(): Readonly<PoolState> {
    return { ...this.state };
  }

  /**
   * Get all transactions.
   */
  getTransactions(): readonly Transaction[] {
    return this.transactions;
  }

  /**
   * Display pool status.
   */
  status(): string {
    const { totalMinted, totalBurned, currentSupply } = this.state;
    return [
      '=== Commons Pool ===',
      `Total Minted:  ${totalMinted.toFixed(2)}Ω`,
      `Total Burned:  ${totalBurned.toFixed(2)}Ω`,
      `Current Supply: ${currentSupply.toFixed(2)}Ω`,
      `Sim Time: ${new Date(this.state.currentTime).toISOString()}`,
    ].join('\n');
  }
}
