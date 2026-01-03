/**
 * Community Fund
 *
 * The locality-based economic sovereignty mechanism.
 *
 * Core insight: When money leaves a community (locality conversion),
 * the exit fee doesn't vanish - it stays with the community.
 *
 * Flow:
 * 1. Money enters community freely (small entry fee to commons)
 * 2. Money exits community → exit fee deposited to CommunityFund
 * 3. Community can allocate funds for local purposes
 *
 * This creates:
 * - Economic incentive for money to circulate locally
 * - Community sovereignty over their economic resources
 * - Natural boundary that doesn't trap (can always leave, just costs)
 */

/**
 * Record of an exit fee deposit.
 */
export interface ExitFeeDeposit {
  /** Amount deposited */
  amount: number;

  /** Source unit ID */
  unitId: string;

  /** Wallet that paid the fee */
  fromWallet: string;

  /** When deposited */
  timestamp: number;
}

/**
 * Record of a fund disbursement.
 */
export interface FundDisbursement {
  /** Amount disbursed */
  amount: number;

  /** Recipient (wallet, purpose, or external) */
  recipient: string;

  /** Reason/purpose for disbursement */
  reason: string;

  /** When disbursed */
  timestamp: number;

  /** Who authorized (if governance exists) */
  authorizedBy?: string;
}

/**
 * Community fund statistics.
 */
export interface CommunityFundStats {
  /** Current fund balance */
  balance: number;

  /** Total exit fees collected all time */
  totalFeesCollected: number;

  /** Total funds disbursed all time */
  totalDisbursed: number;

  /** Number of exit fee deposits */
  depositCount: number;

  /** Number of disbursements */
  disbursementCount: number;
}

/**
 * A single community's treasury.
 */
export class CommunityFund {
  readonly communityId: string;
  readonly communityName: string;

  private balance: number = 0;
  private totalFeesCollected: number = 0;
  private totalDisbursed: number = 0;
  private depositCount: number = 0;
  private disbursementCount: number = 0;

  // Recent history for auditing (bounded)
  private recentDeposits: ExitFeeDeposit[] = [];
  private recentDisbursements: FundDisbursement[] = [];
  private readonly maxHistorySize = 500;

  constructor(communityId: string, communityName: string) {
    this.communityId = communityId;
    this.communityName = communityName;
  }

  /**
   * Deposit an exit fee into the fund.
   * Called when money leaves this community.
   */
  depositExitFee(
    amount: number,
    unitId: string,
    fromWallet: string,
    timestamp: number
  ): void {
    if (amount <= 0) return;

    this.balance += amount;
    this.totalFeesCollected += amount;
    this.depositCount++;

    // Record for auditing
    this.recentDeposits.push({ amount, unitId, fromWallet, timestamp });
    if (this.recentDeposits.length > this.maxHistorySize) {
      this.recentDeposits.shift();
    }
  }

  /**
   * Disburse funds from the community treasury.
   * Returns the actual amount disbursed (may be less if insufficient).
   */
  disburse(
    requestedAmount: number,
    recipient: string,
    reason: string,
    timestamp: number,
    authorizedBy?: string
  ): number {
    if (requestedAmount <= 0) return 0;

    const actualAmount = Math.min(requestedAmount, this.balance);
    if (actualAmount <= 0) return 0;

    this.balance -= actualAmount;
    this.totalDisbursed += actualAmount;
    this.disbursementCount++;

    // Record for auditing
    this.recentDisbursements.push({
      amount: actualAmount,
      recipient,
      reason,
      timestamp,
      authorizedBy,
    });
    if (this.recentDisbursements.length > this.maxHistorySize) {
      this.recentDisbursements.shift();
    }

    return actualAmount;
  }

  /**
   * Get current fund balance.
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Check if fund can cover an amount.
   */
  canCover(amount: number): boolean {
    return this.balance >= amount;
  }

  /**
   * Get fund statistics.
   */
  getStats(): CommunityFundStats {
    return {
      balance: this.balance,
      totalFeesCollected: this.totalFeesCollected,
      totalDisbursed: this.totalDisbursed,
      depositCount: this.depositCount,
      disbursementCount: this.disbursementCount,
    };
  }

  /**
   * Get recent deposits for auditing.
   */
  getRecentDeposits(count?: number): ExitFeeDeposit[] {
    const n = count ?? this.recentDeposits.length;
    return this.recentDeposits.slice(-n);
  }

  /**
   * Get recent disbursements for auditing.
   */
  getRecentDisbursements(count?: number): FundDisbursement[] {
    const n = count ?? this.recentDisbursements.length;
    return this.recentDisbursements.slice(-n);
  }

  /**
   * Export state for persistence.
   */
  export(): {
    communityId: string;
    communityName: string;
    balance: number;
    totalFeesCollected: number;
    totalDisbursed: number;
    depositCount: number;
    disbursementCount: number;
  } {
    return {
      communityId: this.communityId,
      communityName: this.communityName,
      balance: this.balance,
      totalFeesCollected: this.totalFeesCollected,
      totalDisbursed: this.totalDisbursed,
      depositCount: this.depositCount,
      disbursementCount: this.disbursementCount,
    };
  }

  /**
   * Import state from persistence.
   */
  import(state: ReturnType<CommunityFund['export']>): void {
    this.balance = state.balance;
    this.totalFeesCollected = state.totalFeesCollected;
    this.totalDisbursed = state.totalDisbursed;
    this.depositCount = state.depositCount;
    this.disbursementCount = state.disbursementCount;
  }

  /**
   * Reset the fund (for testing).
   */
  reset(): void {
    this.balance = 0;
    this.totalFeesCollected = 0;
    this.totalDisbursed = 0;
    this.depositCount = 0;
    this.disbursementCount = 0;
    this.recentDeposits = [];
    this.recentDisbursements = [];
  }
}

/**
 * Manager for all community funds.
 * Coordinates multiple community treasuries.
 */
export class CommunityFundManager {
  private funds: Map<string, CommunityFund> = new Map();

  /**
   * Get or create a fund for a community.
   */
  getFund(communityId: string, communityName?: string): CommunityFund {
    let fund = this.funds.get(communityId);
    if (!fund) {
      fund = new CommunityFund(communityId, communityName ?? communityId);
      this.funds.set(communityId, fund);
    }
    return fund;
  }

  /**
   * Check if a fund exists for a community.
   */
  hasFund(communityId: string): boolean {
    return this.funds.has(communityId);
  }

  /**
   * Deposit exit fee to a community's fund.
   * Convenience method that creates fund if needed.
   */
  depositExitFee(
    communityId: string,
    amount: number,
    unitId: string,
    fromWallet: string,
    timestamp: number,
    communityName?: string
  ): void {
    const fund = this.getFund(communityId, communityName);
    fund.depositExitFee(amount, unitId, fromWallet, timestamp);
  }

  /**
   * Get all funds.
   */
  getAllFunds(): CommunityFund[] {
    return Array.from(this.funds.values());
  }

  /**
   * Get total balance across all community funds.
   */
  getTotalBalance(): number {
    let total = 0;
    for (const fund of this.funds.values()) {
      total += fund.getBalance();
    }
    return total;
  }

  /**
   * Get aggregate statistics.
   */
  getAggregateStats(): {
    communityCount: number;
    totalBalance: number;
    totalFeesCollected: number;
    totalDisbursed: number;
  } {
    let totalBalance = 0;
    let totalFeesCollected = 0;
    let totalDisbursed = 0;

    for (const fund of this.funds.values()) {
      const stats = fund.getStats();
      totalBalance += stats.balance;
      totalFeesCollected += stats.totalFeesCollected;
      totalDisbursed += stats.totalDisbursed;
    }

    return {
      communityCount: this.funds.size,
      totalBalance,
      totalFeesCollected,
      totalDisbursed,
    };
  }

  /**
   * Export all funds for persistence.
   */
  export(): ReturnType<CommunityFund['export']>[] {
    return this.getAllFunds().map((f) => f.export());
  }

  /**
   * Import funds from persistence.
   */
  import(states: ReturnType<CommunityFund['export']>[]): void {
    this.funds.clear();
    for (const state of states) {
      const fund = new CommunityFund(state.communityId, state.communityName);
      fund.import(state);
      this.funds.set(state.communityId, fund);
    }
  }

  /**
   * Reset all funds (for testing).
   */
  reset(): void {
    this.funds.clear();
  }
}

/**
 * Create a new CommunityFundManager.
 */
export function createCommunityFundManager(): CommunityFundManager {
  return new CommunityFundManager();
}
