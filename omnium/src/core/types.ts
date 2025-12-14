/**
 * OMNIUM Core Types
 *
 * The fundamental data structures for dimensional money.
 * Each OmniumUnit is a vector: Ω = (m, T, L, P, R)
 */

// =============================================================================
// TEMPORAL STRATA (Layer 2)
// =============================================================================

export enum TemporalStratum {
  /** Immediate: Spendable now, 2% annual demurrage */
  T0 = 'T0',
  /** Seasonal: Stable value, 1-year lockup */
  T1 = 'T1',
  /** Generational: 20-year lock, 3% annual dividend */
  T2 = 'T2',
  /** Perpetual: Never depletes principal, 1.5% yield */
  TInfinity = 'T∞',
}

export const TEMPORAL_CONFIG: Record<TemporalStratum, TemporalConfig> = {
  [TemporalStratum.T0]: {
    name: 'Immediate',
    demurrageRate: 0.02,    // 2% annual decay
    dividendRate: 0,
    lockupDays: 0,
  },
  [TemporalStratum.T1]: {
    name: 'Seasonal',
    demurrageRate: 0,
    dividendRate: 0,
    lockupDays: 365,
  },
  [TemporalStratum.T2]: {
    name: 'Generational',
    demurrageRate: 0,
    dividendRate: 0.03,     // 3% annual growth
    lockupDays: 365 * 20,
  },
  [TemporalStratum.TInfinity]: {
    name: 'Perpetual',
    demurrageRate: 0,
    dividendRate: 0.015,    // 1.5% yield (principal protected)
    lockupDays: Infinity,
  },
};

export interface TemporalConfig {
  name: string;
  demurrageRate: number;  // Annual rate of decay (0-1)
  dividendRate: number;   // Annual rate of growth (0-1)
  lockupDays: number;     // Days before withdrawal allowed
}

// =============================================================================
// PROVENANCE / REPUTATION (Layer 5)
// =============================================================================

export enum ProvenanceType {
  Minted = 'minted',           // Created from Commons Pool
  Earned = 'earned',           // Payment for goods/services
  Gifted = 'gifted',           // Voluntary transfer without exchange
  Invested = 'invested',       // Return on investment
  Inherited = 'inherited',     // Intergenerational transfer
  Converted = 'converted',     // Dimensional transformation
  Merged = 'merged',           // Combined from multiple units
  Split = 'split',             // Divided from larger unit
}

export interface ProvenanceEntry {
  timestamp: number;
  type: ProvenanceType;
  fromWallet?: string;         // Source wallet (if transfer)
  toWallet?: string;           // Destination wallet (if transfer)
  amount: number;              // Magnitude at this point
  note?: string;               // Optional human-readable note
  transactionId: string;       // Links related operations
}

export type ProvenanceChain = ProvenanceEntry[];

// =============================================================================
// COMMUNITY (Layer 3)
// =============================================================================

export interface Community {
  id: string;
  name: string;
  description?: string;
  boundaryFee: number;         // Fee % when leaving community (0-1)
  createdAt: number;
  memberCount: number;
}

// =============================================================================
// PURPOSE CHANNEL (Layer 4)
// =============================================================================

export interface PurposeChannel {
  id: string;
  name: string;
  description?: string;
  /** Wallet IDs that can receive this purpose-colored money */
  validRecipients: Set<string>;
  /** Discount when converting back to base Ω (0-1) */
  conversionDiscount: number;
  createdAt: number;
}

// =============================================================================
// THE OMNIUM UNIT - Core Vector
// =============================================================================

/**
 * The fundamental unit of OMNIUM: a multi-dimensional value vector.
 *
 * Ω = (m, T, L, P, R)
 *
 * Where:
 * - m: magnitude (quantity)
 * - T: temporality (time-binding)
 * - L: locality (community set)
 * - P: purpose (intent set)
 * - R: reputation (provenance chain)
 */
export interface OmniumUnit {
  /** Unique identifier for this unit */
  id: string;

  /** m ∈ ℝ⁺: The quantity of value */
  magnitude: number;

  /** T: The temporal stratum (when/how it ages) */
  temporality: TemporalStratum;

  /** L ∈ 𝒫(Communities): Set of community IDs (empty = global) */
  locality: Set<string>;

  /** P ∈ 𝒫(Purposes): Set of purpose channel IDs (empty = unrestricted) */
  purpose: Set<string>;

  /** R: The history chain (how it was earned, what it accomplished) */
  provenance: ProvenanceChain;

  /** Creation timestamp (for demurrage/dividend calculations) */
  createdAt: number;

  /** Last time demurrage/dividend was applied */
  lastTickAt: number;

  /** Owner wallet ID */
  walletId: string;
}

// =============================================================================
// WALLET
// =============================================================================

export interface Wallet {
  id: string;
  name: string;
  createdAt: number;
  /** Community memberships */
  communities: Set<string>;
  /** Purpose channels this wallet is registered to receive */
  validPurposes: Set<string>;
}

// =============================================================================
// TRANSACTIONS
// =============================================================================

export enum TransactionType {
  Mint = 'mint',
  Burn = 'burn',
  Transfer = 'transfer',
  Convert = 'convert',
  Split = 'split',
  Merge = 'merge',
}

export interface Transaction {
  id: string;
  type: TransactionType;
  timestamp: number;
  /** Units involved (input) */
  inputUnits: string[];
  /** Units created (output) */
  outputUnits: string[];
  /** Fees collected (burned or redistributed) */
  fees: number;
  /** Human-readable description */
  description?: string;
}

// =============================================================================
// CONVERSION
// =============================================================================

export interface ConversionRequest {
  unitId: string;
  targetTemporality?: TemporalStratum;
  targetLocality?: {
    add?: string[];      // Communities to add
    remove?: string[];   // Communities to remove
  };
  targetPurpose?: {
    add?: string[];      // Purposes to add
    remove?: string[];   // Purposes to remove (costs fee)
  };
  stripReputation?: boolean;  // Remove provenance (costs fee)
}

export interface ConversionResult {
  success: boolean;
  newUnit?: OmniumUnit;
  fees: {
    temporal: number;
    locality: number;
    purpose: number;
    reputation: number;
    total: number;
  };
  error?: string;
}

// =============================================================================
// SYSTEM STATE
// =============================================================================

export interface SystemState {
  /** Total Ω in existence */
  totalSupply: number;
  /** Commons Pool reserve */
  commonsPool: number;
  /** Current simulated time (for demurrage/dividend) */
  currentTime: number;
  /** All units in the system */
  units: Map<string, OmniumUnit>;
  /** All wallets */
  wallets: Map<string, Wallet>;
  /** All communities */
  communities: Map<string, Community>;
  /** All purpose channels */
  purposes: Map<string, PurposeChannel>;
  /** Transaction history */
  transactions: Transaction[];
}
