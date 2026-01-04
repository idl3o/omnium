/**
 * Omnium Client - Browser-side Omnium integration
 *
 * For demo/MVP, this simulates the Omnium ledger in-browser.
 * State is persisted to localStorage.
 */

import { v4 as uuid } from 'uuid';

// =============================================================================
// TYPES (simplified from omnium core)
// =============================================================================

export type TemporalStratum = 'T0' | 'T1' | 'T2' | 'TInfinity';

export interface OmniumUnit {
  id: string;
  magnitude: number;
  temporality: TemporalStratum;
  locality: string[];
  purpose: string[];
  provenance: ProvenanceEntry[];
  walletId: string;
  createdAt: number;
  lastTickAt: number;
}

export interface ProvenanceEntry {
  timestamp: number;
  type: 'mint' | 'transfer' | 'tip' | 'convert' | 'join';
  fromWallet?: string;
  toWallet?: string;
  amount: number;
  note?: string;
}

export interface Wallet {
  id: string;
  name: string;
  createdAt: number;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  members: string[];
  fundBalance: number;
  entryFee: number;
  exitFee: number;
}

export interface Activity {
  id: string;
  type: 'tip' | 'join' | 'convert' | 'mint' | 'dividend' | 'attention' | 'interact';
  timestamp: number;
  actorName: string;
  description: string;
  amount?: number;
  purpose?: string;
  temporality?: TemporalStratum;
}

// Earning rates (Ω per action)
export const EARNING_RATES = {
  watchPerMinute: 0.01,    // Passive watching
  chatMessage: 0.02,       // Sending a chat message
  pollVote: 0.05,          // Voting in a poll
  predictionCorrect: 0.5,  // Correct prediction bonus
  challengeCreate: 0.1,    // Creating a challenge for streamer
} as const;

// Spending rates (Ω per action) - micro-tips to streamer
export const SPENDING_RATES = {
  reaction: 0.01,          // Emoji reaction (micro-tip)
} as const;

export type InteractionType = keyof typeof EARNING_RATES;

// Deposit/withdrawal types
export type PaymentMethod = 'card' | 'eth' | 'usdc' | 'demo';

export interface DepositResult {
  success: boolean;
  unit?: OmniumUnit;
  transactionId?: string;
  error?: string;
}

export interface WithdrawResult {
  success: boolean;
  amount?: number;
  fee?: number;
  transactionId?: string;
  error?: string;
}

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY = 'omnium-stream-state';

interface StoredState {
  wallets: Record<string, Wallet>;
  units: OmniumUnit[];
  community: Community;
  activities: Activity[];
  streamerWalletId: string;
}

function loadState(): StoredState | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveState(state: StoredState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// =============================================================================
// CLIENT
// =============================================================================

export class OmniumClient {
  private wallets: Map<string, Wallet> = new Map();
  private units: OmniumUnit[] = [];
  private community: Community;
  private activities: Activity[] = [];
  private streamerWalletId: string;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Initialize with default state or load from storage
    const stored = loadState();

    if (stored) {
      this.wallets = new Map(Object.entries(stored.wallets));
      this.units = stored.units;
      this.community = stored.community;
      this.activities = stored.activities;
      this.streamerWalletId = stored.streamerWalletId;
    } else {
      // Create default state
      const streamer: Wallet = {
        id: uuid(),
        name: 'Sam',
        createdAt: Date.now(),
      };
      this.wallets.set(streamer.id, streamer);
      this.streamerWalletId = streamer.id;

      this.community = {
        id: 'stream-community',
        name: 'Stream Community',
        description: 'The Omnium stream community',
        members: [streamer.id],
        fundBalance: 0,
        entryFee: 1,
        exitFee: 0.03, // 3%
      };

      this.activities = [];
      this.persist();
    }
  }

  private persist(): void {
    const state: StoredState = {
      wallets: Object.fromEntries(this.wallets),
      units: this.units,
      community: this.community,
      activities: this.activities,
      streamerWalletId: this.streamerWalletId,
    };
    saveState(state);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Wallet operations
  // ---------------------------------------------------------------------------

  createWallet(name: string): Wallet {
    const wallet: Wallet = {
      id: uuid(),
      name,
      createdAt: Date.now(),
    };
    this.wallets.set(wallet.id, wallet);
    this.persist();
    return wallet;
  }

  getWallet(id: string): Wallet | undefined {
    return this.wallets.get(id);
  }

  getStreamerWallet(): Wallet {
    return this.wallets.get(this.streamerWalletId)!;
  }

  getWalletUnits(walletId: string): OmniumUnit[] {
    return this.units.filter((u) => u.walletId === walletId);
  }

  getWalletBalance(walletId: string): number {
    return this.getWalletUnits(walletId).reduce((sum, u) => sum + u.magnitude, 0);
  }

  // ---------------------------------------------------------------------------
  // Minting (for demo onboarding)
  // ---------------------------------------------------------------------------

  mint(walletId: string, amount: number, note?: string): OmniumUnit {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const unit: OmniumUnit = {
      id: uuid(),
      magnitude: amount,
      temporality: 'T0',
      locality: [],
      purpose: [],
      provenance: [
        {
          timestamp: Date.now(),
          type: 'mint',
          toWallet: walletId,
          amount,
          note: note || 'Welcome to Omnium!',
        },
      ],
      walletId,
      createdAt: Date.now(),
      lastTickAt: Date.now(),
    };

    this.units.push(unit);
    this.addActivity({
      type: 'mint',
      actorName: wallet.name,
      description: `received ${amount}Ω`,
      amount,
    });
    this.persist();
    return unit;
  }

  // ---------------------------------------------------------------------------
  // Tipping
  // ---------------------------------------------------------------------------

  tip(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    options: {
      purpose?: string;
      temporality?: TemporalStratum;
      note?: string;
    } = {}
  ): OmniumUnit | null {
    const fromWallet = this.wallets.get(fromWalletId);
    const toWallet = this.wallets.get(toWalletId);
    if (!fromWallet || !toWallet) return null;

    // Find units to spend from
    const availableUnits = this.getWalletUnits(fromWalletId)
      .filter((u) => u.temporality === 'T0') // Can only spend T0
      .sort((a, b) => a.magnitude - b.magnitude);

    let remaining = amount;
    const unitsToSpend: OmniumUnit[] = [];

    for (const unit of availableUnits) {
      if (remaining <= 0) break;
      unitsToSpend.push(unit);
      remaining -= unit.magnitude;
    }

    if (remaining > 0) return null; // Insufficient balance

    // Remove spent units
    for (const unit of unitsToSpend) {
      const idx = this.units.findIndex((u) => u.id === unit.id);
      if (idx !== -1) this.units.splice(idx, 1);
    }

    // Create change if needed
    const totalSpent = unitsToSpend.reduce((s, u) => s + u.magnitude, 0);
    const change = totalSpent - amount;

    if (change > 0) {
      const changeUnit: OmniumUnit = {
        id: uuid(),
        magnitude: change,
        temporality: 'T0',
        locality: [],
        purpose: [],
        provenance: [
          {
            timestamp: Date.now(),
            type: 'transfer',
            fromWallet: fromWalletId,
            toWallet: fromWalletId,
            amount: change,
            note: 'Change from tip',
          },
        ],
        walletId: fromWalletId,
        createdAt: Date.now(),
        lastTickAt: Date.now(),
      };
      this.units.push(changeUnit);
    }

    // Create tipped unit
    const tippedUnit: OmniumUnit = {
      id: uuid(),
      magnitude: amount,
      temporality: options.temporality || 'T0',
      locality: ['stream-community'],
      purpose: options.purpose ? [options.purpose] : [],
      provenance: [
        {
          timestamp: Date.now(),
          type: 'tip',
          fromWallet: fromWalletId,
          toWallet: toWalletId,
          amount,
          note: options.note || `Tip from ${fromWallet.name}`,
        },
      ],
      walletId: toWalletId,
      createdAt: Date.now(),
      lastTickAt: Date.now(),
    };

    this.units.push(tippedUnit);

    // Activity
    const purposeText = options.purpose ? ` for ${options.purpose}` : '';
    const temporalText = options.temporality && options.temporality !== 'T0'
      ? ` (${options.temporality})`
      : '';
    this.addActivity({
      type: 'tip',
      actorName: fromWallet.name,
      description: `tipped ${amount}Ω${purposeText}${temporalText}`,
      amount,
      purpose: options.purpose,
      temporality: options.temporality,
    });

    this.persist();
    return tippedUnit;
  }

  // ---------------------------------------------------------------------------
  // Community
  // ---------------------------------------------------------------------------

  getCommunity(): Community {
    return this.community;
  }

  joinCommunity(walletId: string): boolean {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return false;
    if (this.community.members.includes(walletId)) return false;

    // Pay entry fee
    const fee = this.community.entryFee;
    const balance = this.getWalletBalance(walletId);
    if (balance < fee) return false;

    // Deduct fee (simplified - just reduce first unit)
    const units = this.getWalletUnits(walletId);
    if (units.length > 0) {
      units[0].magnitude -= fee;
      if (units[0].magnitude <= 0) {
        const idx = this.units.findIndex((u) => u.id === units[0].id);
        if (idx !== -1) this.units.splice(idx, 1);
      }
    }

    // Add to community
    this.community.members.push(walletId);
    this.community.fundBalance += fee;

    this.addActivity({
      type: 'join',
      actorName: wallet.name,
      description: 'joined the stream community',
      amount: fee,
    });

    this.persist();
    return true;
  }

  isMember(walletId: string): boolean {
    return this.community.members.includes(walletId);
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  private addActivity(activity: Omit<Activity, 'id' | 'timestamp'>): void {
    this.activities.unshift({
      id: uuid(),
      timestamp: Date.now(),
      ...activity,
    });
    // Keep last 50
    if (this.activities.length > 50) {
      this.activities = this.activities.slice(0, 50);
    }
  }

  getActivities(): Activity[] {
    return this.activities;
  }

  // ---------------------------------------------------------------------------
  // Reactions (micro-tips to streamer)
  // ---------------------------------------------------------------------------

  /**
   * Send a reaction - costs Ω, goes to streamer as micro-tip.
   */
  react(fromWalletId: string, emoji: string): boolean {
    const fromWallet = this.wallets.get(fromWalletId);
    if (!fromWallet) return false;

    const cost = SPENDING_RATES.reaction;
    const balance = this.getWalletBalance(fromWalletId);
    if (balance < cost) return false;

    // Tip the streamer
    const result = this.tip(fromWalletId, this.streamerWalletId, cost, {
      purpose: 'reaction',
      note: `Reacted with ${emoji}`,
    });

    if (result) {
      this.addActivity({
        type: 'interact',
        actorName: fromWallet.name,
        description: `reacted ${emoji} (${cost}Ω)`,
        amount: cost,
      });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Attention-based earning
  // ---------------------------------------------------------------------------

  /**
   * Earn Ω from watching the stream.
   * Called periodically (e.g., every minute) while engaged.
   */
  earnFromAttention(walletId: string, minutesWatched: number): OmniumUnit | null {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return null;

    const amount = EARNING_RATES.watchPerMinute;

    // Find existing attention-earned unit to add to, or create new one
    const existingUnit = this.units.find(
      (u) => u.walletId === walletId &&
             u.purpose.includes('attention') &&
             u.temporality === 'T0'
    );

    if (existingUnit) {
      existingUnit.magnitude += amount;
      existingUnit.provenance.push({
        timestamp: Date.now(),
        type: 'mint',
        toWallet: walletId,
        amount,
        note: `Minute ${minutesWatched} watched`,
      });
      this.persist();
      return existingUnit;
    }

    // Create new unit
    const unit: OmniumUnit = {
      id: uuid(),
      magnitude: amount,
      temporality: 'T0',
      locality: ['stream-community'],
      purpose: ['attention'],
      provenance: [
        {
          timestamp: Date.now(),
          type: 'mint',
          toWallet: walletId,
          amount,
          note: 'Earned from watching',
        },
      ],
      walletId,
      createdAt: Date.now(),
      lastTickAt: Date.now(),
    };

    this.units.push(unit);

    // Only add activity occasionally to avoid spam
    if (minutesWatched % 5 === 0) {
      this.addActivity({
        type: 'attention',
        actorName: wallet.name,
        description: `earned ${(minutesWatched * EARNING_RATES.watchPerMinute).toFixed(2)}Ω from watching`,
        amount: minutesWatched * EARNING_RATES.watchPerMinute,
      });
    }

    this.persist();
    return unit;
  }

  /**
   * Earn Ω from an interaction.
   */
  earnFromInteraction(
    walletId: string,
    interactionType: InteractionType,
    description?: string
  ): OmniumUnit | null {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return null;

    const amount = EARNING_RATES[interactionType];

    const unit: OmniumUnit = {
      id: uuid(),
      magnitude: amount,
      temporality: 'T0',
      locality: ['stream-community'],
      purpose: ['interaction', interactionType],
      provenance: [
        {
          timestamp: Date.now(),
          type: 'mint',
          toWallet: walletId,
          amount,
          note: description || `Earned from ${interactionType}`,
        },
      ],
      walletId,
      createdAt: Date.now(),
      lastTickAt: Date.now(),
    };

    this.units.push(unit);

    this.addActivity({
      type: 'interact',
      actorName: wallet.name,
      description: `earned ${amount}Ω from ${interactionType.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
      amount,
    });

    this.persist();
    return unit;
  }

  /**
   * Get total earned from attention this session.
   */
  getAttentionEarnings(walletId: string): number {
    return this.units
      .filter((u) => u.walletId === walletId && u.purpose.includes('attention'))
      .reduce((sum, u) => sum + u.magnitude, 0);
  }

  // ---------------------------------------------------------------------------
  // Currency deposits (external value → Ω)
  // ---------------------------------------------------------------------------

  /**
   * Deposit external currency to receive T0 Ω.
   * For MVP/demo, 'demo' method is instant with fake transaction.
   * Real implementations would integrate payment processors.
   */
  deposit(
    walletId: string,
    amount: number,
    method: PaymentMethod
  ): DepositResult {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return { success: false, error: 'Wallet not found' };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    // For demo mode, instantly mint Ω
    // Real implementation would:
    // - 'card': Stripe/payment processor integration
    // - 'eth': Web3 transaction verification
    // - 'usdc': USDC contract interaction
    if (method === 'demo') {
      const unit: OmniumUnit = {
        id: uuid(),
        magnitude: amount,
        temporality: 'T0',
        locality: [],
        purpose: [],
        provenance: [
          {
            timestamp: Date.now(),
            type: 'mint',
            toWallet: walletId,
            amount,
            note: `Demo deposit: ${amount} USD → ${amount}Ω`,
          },
        ],
        walletId,
        createdAt: Date.now(),
        lastTickAt: Date.now(),
      };

      this.units.push(unit);
      this.addActivity({
        type: 'mint',
        actorName: wallet.name,
        description: `deposited $${amount} → ${amount}Ω`,
        amount,
      });
      this.persist();

      return {
        success: true,
        unit,
        transactionId: `demo-${uuid().slice(0, 8)}`,
      };
    }

    // Placeholder for real payment methods
    return {
      success: false,
      error: `Payment method '${method}' not yet implemented`,
    };
  }

  /**
   * Withdraw Ω back to external currency.
   * Applies a 3% withdrawal fee.
   */
  withdraw(
    walletId: string,
    amount: number,
    method: PaymentMethod
  ): WithdrawResult {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return { success: false, error: 'Wallet not found' };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    const balance = this.getWalletBalance(walletId);
    if (balance < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Withdrawal fee (3%)
    const feeRate = 0.03;
    const fee = amount * feeRate;
    const netAmount = amount - fee;

    // For demo mode, instantly burn Ω
    if (method === 'demo') {
      // Find units to burn
      const availableUnits = this.getWalletUnits(walletId)
        .filter((u) => u.temporality === 'T0')
        .sort((a, b) => a.magnitude - b.magnitude);

      let remaining = amount;
      const unitsToBurn: OmniumUnit[] = [];

      for (const unit of availableUnits) {
        if (remaining <= 0) break;
        unitsToBurn.push(unit);
        remaining -= unit.magnitude;
      }

      if (remaining > 0) {
        return { success: false, error: 'Insufficient T0 balance' };
      }

      // Remove burned units
      for (const unit of unitsToBurn) {
        const idx = this.units.findIndex((u) => u.id === unit.id);
        if (idx !== -1) this.units.splice(idx, 1);
      }

      // Handle change (if we burned more than needed)
      const totalBurned = unitsToBurn.reduce((s, u) => s + u.magnitude, 0);
      const change = totalBurned - amount;

      if (change > 0) {
        const changeUnit: OmniumUnit = {
          id: uuid(),
          magnitude: change,
          temporality: 'T0',
          locality: [],
          purpose: [],
          provenance: [
            {
              timestamp: Date.now(),
              type: 'transfer',
              fromWallet: walletId,
              toWallet: walletId,
              amount: change,
              note: 'Change from withdrawal',
            },
          ],
          walletId,
          createdAt: Date.now(),
          lastTickAt: Date.now(),
        };
        this.units.push(changeUnit);
      }

      // Fee goes to community fund
      this.community.fundBalance += fee;

      this.addActivity({
        type: 'convert',
        actorName: wallet.name,
        description: `withdrew ${amount}Ω → $${netAmount.toFixed(2)} (${(feeRate * 100).toFixed(0)}% fee)`,
        amount: netAmount,
      });
      this.persist();

      return {
        success: true,
        amount: netAmount,
        fee,
        transactionId: `demo-${uuid().slice(0, 8)}`,
      };
    }

    return {
      success: false,
      error: `Payment method '${method}' not yet implemented`,
    };
  }

  // ---------------------------------------------------------------------------
  // Streaming Compute Integration
  // ---------------------------------------------------------------------------
  //
  // This section demonstrates how streaming maps to the anonymous compute layer:
  //
  // CONCEPT MAPPING:
  // - Stream session → Compute attestation
  // - Content segments → Deterministic output (same encoder = same output)
  // - Viewer reactions → Value attributions (retroactive discovery)
  // - Tips/boosts → Direct value flow to creator
  //
  // The streamer doesn't declare their content is "useful" - viewers do.
  // Value is DISCOVERED through engagement, not DECLARED upfront.

  /**
   * Record a content segment as a compute attestation.
   *
   * In the full Omnium system, this would create a ComputeAttestation
   * with the content CID as output. Here we track it for analytics.
   */
  recordContentSegment(
    streamerId: string,
    segmentCid: string,
    durationSeconds: number
  ): { segmentId: string; computeUnits: number } {
    // In production: This would call StreamingComputeBridge.updateSession()
    // For now, we just track it locally

    const computeUnits = durationSeconds; // 1 compute unit per second
    const segmentId = uuid();

    // Log activity
    const wallet = this.wallets.get(streamerId);
    if (wallet) {
      this.addActivity({
        type: 'mint', // Content creation is a form of value creation
        actorName: wallet.name,
        description: `produced ${durationSeconds}s content segment`,
        amount: computeUnits * 0.001, // Base reward rate
      });
      this.persist();
    }

    return { segmentId, computeUnits };
  }

  /**
   * Get a summary of how reactions map to value attributions.
   *
   * This demonstrates the retroactive value discovery pattern:
   * - Each reaction is a micro-tip (0.01Ω)
   * - The value flows to the content creator
   * - No upfront "usefulness" declaration needed
   */
  getValueAttributionSummary(streamerId: string): {
    totalReactions: number;
    totalTips: number;
    totalBoosts: number;
    totalValueDiscovered: number;
    pattern: string;
  } {
    // Count activities that represent value attributions
    const streamerUnits = this.getWalletUnits(streamerId);

    let totalReactions = 0;
    let totalTips = 0;
    let totalBoosts = 0;

    for (const unit of streamerUnits) {
      for (const entry of unit.provenance) {
        if (entry.type === 'tip') {
          if (entry.note?.includes('reaction')) {
            totalReactions++;
          } else if (unit.temporality === 'T2' || unit.temporality === 'TInfinity') {
            totalBoosts++;
          } else {
            totalTips++;
          }
        }
      }
    }

    const totalValueDiscovered =
      totalReactions * SPENDING_RATES.reaction +
      streamerUnits.reduce((sum, u) => {
        // Count tips (not reactions)
        const tipValue = u.provenance
          .filter(p => p.type === 'tip' && !p.note?.includes('reaction'))
          .reduce((s, p) => s + p.amount, 0);
        return sum + tipValue;
      }, 0);

    return {
      totalReactions,
      totalTips,
      totalBoosts,
      totalValueDiscovered,
      pattern: `
        STREAMING AS ANONYMOUS COMPUTE:

        1. CONTENT CREATION (Compute)
           Streamer produces content segments
           → Each segment is a deterministic output
           → No "usefulness" judgment required

        2. VIEWER ENGAGEMENT (Value Discovery)
           Reactions: ${totalReactions} × ${SPENDING_RATES.reaction}Ω = ${(totalReactions * SPENDING_RATES.reaction).toFixed(2)}Ω
           Tips: ${totalTips} instances
           Boosts: ${totalBoosts} instances (T2/T∞ locked)

        3. VALUE FLOWS RETROACTIVELY
           Total value discovered: ${totalValueDiscovered.toFixed(2)}Ω

        This is the core pattern: Create → Discover → Reward
      `.trim(),
    };
  }

  // ---------------------------------------------------------------------------
  // Demurrage simulation
  // ---------------------------------------------------------------------------

  applyDemurrage(days: number = 1): void {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const annualRate = 0.02; // 2% annual for T0

    for (const unit of this.units) {
      if (unit.temporality !== 'T0') continue;

      const daysSinceLastTick = (now - unit.lastTickAt) / msPerDay;
      if (daysSinceLastTick < days) continue;

      // Apply demurrage
      const decayFactor = Math.pow(1 - annualRate, days / 365);
      const oldMagnitude = unit.magnitude;
      unit.magnitude *= decayFactor;
      unit.lastTickAt = now;

      // Could add demurrage to dividend pool here
    }

    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Reset (for testing)
  // ---------------------------------------------------------------------------

  reset(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Re-initialize
    this.wallets.clear();
    this.units = [];

    const streamer: Wallet = {
      id: uuid(),
      name: 'Sam',
      createdAt: Date.now(),
    };
    this.wallets.set(streamer.id, streamer);
    this.streamerWalletId = streamer.id;

    this.community = {
      id: 'stream-community',
      name: 'Stream Community',
      description: 'The Omnium stream community',
      members: [streamer.id],
      fundBalance: 0,
      entryFee: 1,
      exitFee: 0.03,
    };

    this.activities = [];
    this.persist();
  }
}

// Singleton instance
let client: OmniumClient | null = null;

export function getOmniumClient(): OmniumClient {
  if (!client) {
    client = new OmniumClient();
  }
  return client;
}
