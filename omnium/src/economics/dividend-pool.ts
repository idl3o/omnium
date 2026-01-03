/**
 * Dividend Pool
 *
 * The temporal arbitrage mechanism at the heart of Omnium economics.
 *
 * Core insight: Those who want liquidity (T0) pay demurrage.
 * Those who lock up (T2/T∞) receive dividends. The pool mediates.
 *
 * Flow:
 * 1. T0 units decay via demurrage → magnitude flows to DividendPool
 * 2. T2/T∞ units grow via dividends ← magnitude flows from DividendPool
 * 3. If pool is insufficient, dividends are proportionally reduced
 *
 * This creates a zero-sum time preference market:
 * - Impatience funds patience
 * - No money created from nothing
 * - System is self-balancing
 */

/**
 * Record of a demurrage deposit into the pool.
 */
export interface DemurrageDeposit {
  /** Amount deposited */
  amount: number;

  /** Source unit ID */
  unitId: string;

  /** When deposited */
  timestamp: number;
}

/**
 * Record of a dividend withdrawal from the pool.
 */
export interface DividendWithdrawal {
  /** Amount withdrawn */
  amount: number;

  /** Recipient unit ID */
  unitId: string;

  /** When withdrawn */
  timestamp: number;

  /** Was the full amount available? */
  fullyFunded: boolean;
}

/**
 * Pool statistics for monitoring.
 */
export interface DividendPoolStats {
  /** Current pool balance */
  balance: number;

  /** Total demurrage collected all time */
  totalDemurrageCollected: number;

  /** Total dividends distributed all time */
  totalDividendsDistributed: number;

  /** Number of deposits */
  depositCount: number;

  /** Number of withdrawals */
  withdrawalCount: number;

  /** Funding ratio (1.0 = all dividends fully funded) */
  fundingRatio: number;
}

/**
 * The Dividend Pool - mediates time preference.
 *
 * Usage:
 * ```typescript
 * const pool = new DividendPool();
 *
 * // When T0 demurrage is applied:
 * pool.depositDemurrage(decayAmount, unitId, timestamp);
 *
 * // When T2/T∞ dividend is needed:
 * const actual = pool.withdrawDividend(requestedAmount, unitId, timestamp);
 * // actual may be less than requested if pool is low
 * ```
 */
export class DividendPool {
  private balance: number = 0;
  private totalDemurrageCollected: number = 0;
  private totalDividendsDistributed: number = 0;
  private totalDividendsRequested: number = 0;
  private depositCount: number = 0;
  private withdrawalCount: number = 0;

  // Recent history for auditing (optional, bounded)
  private recentDeposits: DemurrageDeposit[] = [];
  private recentWithdrawals: DividendWithdrawal[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * Deposit demurrage into the pool.
   * Called when T0 units decay.
   *
   * @param amount - Magnitude lost to demurrage
   * @param unitId - Source unit ID (for auditing)
   * @param timestamp - When the demurrage occurred
   */
  depositDemurrage(amount: number, unitId: string, timestamp: number): void {
    if (amount <= 0) return;

    this.balance += amount;
    this.totalDemurrageCollected += amount;
    this.depositCount++;

    // Record for auditing
    this.recentDeposits.push({ amount, unitId, timestamp });
    if (this.recentDeposits.length > this.maxHistorySize) {
      this.recentDeposits.shift();
    }
  }

  /**
   * Withdraw dividend from the pool.
   * Called when T2/T∞ units should grow.
   *
   * Returns the actual amount available (may be less than requested).
   *
   * @param requestedAmount - Desired dividend amount
   * @param unitId - Recipient unit ID (for auditing)
   * @param timestamp - When the dividend is applied
   * @returns Actual amount available from pool
   */
  withdrawDividend(
    requestedAmount: number,
    unitId: string,
    timestamp: number
  ): number {
    if (requestedAmount <= 0) return 0;

    this.totalDividendsRequested += requestedAmount;

    // Can only withdraw what's available
    const actualAmount = Math.min(requestedAmount, this.balance);
    const fullyFunded = actualAmount >= requestedAmount;

    if (actualAmount > 0) {
      this.balance -= actualAmount;
      this.totalDividendsDistributed += actualAmount;
      this.withdrawalCount++;

      // Record for auditing
      this.recentWithdrawals.push({
        amount: actualAmount,
        unitId,
        timestamp,
        fullyFunded,
      });
      if (this.recentWithdrawals.length > this.maxHistorySize) {
        this.recentWithdrawals.shift();
      }
    }

    return actualAmount;
  }

  /**
   * Get current pool balance.
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Check if pool can fully fund a dividend request.
   */
  canFullyFund(amount: number): boolean {
    return this.balance >= amount;
  }

  /**
   * Get the funding ratio.
   * 1.0 = all dividends have been fully funded
   * < 1.0 = some dividends were reduced due to insufficient funds
   */
  getFundingRatio(): number {
    if (this.totalDividendsRequested === 0) return 1.0;
    return this.totalDividendsDistributed / this.totalDividendsRequested;
  }

  /**
   * Get pool statistics.
   */
  getStats(): DividendPoolStats {
    return {
      balance: this.balance,
      totalDemurrageCollected: this.totalDemurrageCollected,
      totalDividendsDistributed: this.totalDividendsDistributed,
      depositCount: this.depositCount,
      withdrawalCount: this.withdrawalCount,
      fundingRatio: this.getFundingRatio(),
    };
  }

  /**
   * Get recent deposits (for auditing).
   */
  getRecentDeposits(count?: number): DemurrageDeposit[] {
    const n = count ?? this.recentDeposits.length;
    return this.recentDeposits.slice(-n);
  }

  /**
   * Get recent withdrawals (for auditing).
   */
  getRecentWithdrawals(count?: number): DividendWithdrawal[] {
    const n = count ?? this.recentWithdrawals.length;
    return this.recentWithdrawals.slice(-n);
  }

  /**
   * Export state for persistence.
   */
  export(): {
    balance: number;
    totalDemurrageCollected: number;
    totalDividendsDistributed: number;
    totalDividendsRequested: number;
    depositCount: number;
    withdrawalCount: number;
  } {
    return {
      balance: this.balance,
      totalDemurrageCollected: this.totalDemurrageCollected,
      totalDividendsDistributed: this.totalDividendsDistributed,
      totalDividendsRequested: this.totalDividendsRequested,
      depositCount: this.depositCount,
      withdrawalCount: this.withdrawalCount,
    };
  }

  /**
   * Import state from persistence.
   */
  import(state: ReturnType<DividendPool['export']>): void {
    this.balance = state.balance;
    this.totalDemurrageCollected = state.totalDemurrageCollected;
    this.totalDividendsDistributed = state.totalDividendsDistributed;
    this.totalDividendsRequested = state.totalDividendsRequested;
    this.depositCount = state.depositCount;
    this.withdrawalCount = state.withdrawalCount;
  }

  /**
   * Reset the pool (for testing).
   */
  reset(): void {
    this.balance = 0;
    this.totalDemurrageCollected = 0;
    this.totalDividendsDistributed = 0;
    this.totalDividendsRequested = 0;
    this.depositCount = 0;
    this.withdrawalCount = 0;
    this.recentDeposits = [];
    this.recentWithdrawals = [];
  }
}

/**
 * Create a new DividendPool.
 */
export function createDividendPool(): DividendPool {
  return new DividendPool();
}
