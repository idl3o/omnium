/**
 * Reputation Gradients (Layer 5)
 *
 * OMNIUM carries—optionally—reputation information:
 * - How was this earned? (labor, gift, investment, inheritance)
 * - What has it accomplished? (transactions in its history)
 * - Who vouches for it? (social graph of previous holders)
 *
 * "This is entirely opt-in. You can strip reputation at any time
 *  by dissolving to base Ω (with a fee). But reputation-rich money
 *  may be accepted more readily, at better rates, by those who
 *  value the signal."
 *
 * Semantic Liquidity: "money flows between meanings, but meaning
 * accretes rather than vanishes. Over time, frequently-converted
 * money develops a rich history."
 */

import {
  OmniumUnit,
  ProvenanceChain,
  ProvenanceEntry,
  ProvenanceType,
} from '../core/types.js';

/**
 * Reputation score components.
 */
export interface ReputationBreakdown {
  /** Overall score 0-1 */
  total: number;
  /** Diversity of provenance types */
  diversity: number;
  /** Length/richness of history */
  depth: number;
  /** Ratio of earned vs other sources */
  earnedRatio: number;
  /** Number of unique wallets in history */
  socialBreadth: number;
  /** Age of the provenance chain */
  maturity: number;
}

/**
 * Calculate detailed reputation breakdown for a unit.
 */
export function analyzeReputation(unit: OmniumUnit): ReputationBreakdown {
  const { provenance } = unit;

  if (provenance.length === 0) {
    return {
      total: 0,
      diversity: 0,
      depth: 0,
      earnedRatio: 0,
      socialBreadth: 0,
      maturity: 0,
    };
  }

  // Diversity: how many different provenance types
  const types = new Set(provenance.map((p) => p.type));
  const diversity = Math.min(types.size / Object.keys(ProvenanceType).length, 1);

  // Depth: logarithmic scale of chain length
  const depth = Math.min(Math.log10(provenance.length + 1) / 2, 1);

  // Earned ratio: earned transactions vs total
  const earnedCount = provenance.filter(
    (p) => p.type === ProvenanceType.Earned
  ).length;
  const earnedRatio = earnedCount / provenance.length;

  // Social breadth: unique wallets involved
  const wallets = new Set<string>();
  for (const entry of provenance) {
    if (entry.fromWallet) wallets.add(entry.fromWallet);
    if (entry.toWallet) wallets.add(entry.toWallet);
  }
  const socialBreadth = Math.min(wallets.size / 10, 1);

  // Maturity: age of oldest entry
  const oldest = Math.min(...provenance.map((p) => p.timestamp));
  const ageMs = Date.now() - oldest;
  const ageYears = ageMs / (365 * 24 * 60 * 60 * 1000);
  const maturity = Math.min(ageYears / 5, 1); // Max at 5 years

  // Weighted total
  const total =
    diversity * 0.15 +
    depth * 0.2 +
    earnedRatio * 0.3 +
    socialBreadth * 0.2 +
    maturity * 0.15;

  return {
    total: Math.min(total, 1),
    diversity,
    depth,
    earnedRatio,
    socialBreadth,
    maturity,
  };
}

/**
 * Get a simple reputation score (0-1).
 */
export function getReputationScore(unit: OmniumUnit): number {
  return analyzeReputation(unit).total;
}

/**
 * Check if money has "clean" provenance (primarily earned).
 */
export function isCleanMoney(unit: OmniumUnit, threshold = 0.5): boolean {
  const breakdown = analyzeReputation(unit);
  return breakdown.earnedRatio >= threshold;
}

/**
 * Check if money has been through many hands (well-circulated).
 */
export function isWellCirculated(unit: OmniumUnit, minWallets = 5): boolean {
  const wallets = new Set<string>();
  for (const entry of unit.provenance) {
    if (entry.fromWallet) wallets.add(entry.fromWallet);
    if (entry.toWallet) wallets.add(entry.toWallet);
  }
  return wallets.size >= minWallets;
}

/**
 * Get the provenance story - a human-readable history.
 */
export function getProvenanceStory(unit: OmniumUnit): string[] {
  return unit.provenance.map((entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const amount = entry.amount.toFixed(2);

    switch (entry.type) {
      case ProvenanceType.Minted:
        return `[${date}] Minted ${amount}Ω from Commons Pool`;
      case ProvenanceType.Earned:
        return `[${date}] Earned ${amount}Ω${entry.note ? `: ${entry.note}` : ''}`;
      case ProvenanceType.Gifted:
        return `[${date}] Gifted ${amount}Ω${entry.fromWallet ? ` from ${entry.fromWallet.slice(0, 8)}...` : ''}`;
      case ProvenanceType.Invested:
        return `[${date}] Investment return: ${amount}Ω`;
      case ProvenanceType.Inherited:
        return `[${date}] Inherited ${amount}Ω`;
      case ProvenanceType.Converted:
        return `[${date}] Converted: ${entry.note ?? `${amount}Ω`}`;
      case ProvenanceType.Merged:
        return `[${date}] Merged into ${amount}Ω`;
      case ProvenanceType.Split:
        return `[${date}] Split: ${amount}Ω`;
      default:
        return `[${date}] ${entry.type}: ${amount}Ω`;
    }
  });
}

/**
 * Summarize provenance for display.
 */
export function summarizeProvenance(unit: OmniumUnit): string {
  const breakdown = analyzeReputation(unit);
  const story = getProvenanceStory(unit);

  const lines = [
    `=== Provenance ===`,
    `Reputation Score: ${(breakdown.total * 100).toFixed(0)}/100`,
    ``,
    `Breakdown:`,
    `  Diversity:      ${(breakdown.diversity * 100).toFixed(0)}%`,
    `  Depth:          ${(breakdown.depth * 100).toFixed(0)}%`,
    `  Earned Ratio:   ${(breakdown.earnedRatio * 100).toFixed(0)}%`,
    `  Social Breadth: ${(breakdown.socialBreadth * 100).toFixed(0)}%`,
    `  Maturity:       ${(breakdown.maturity * 100).toFixed(0)}%`,
    ``,
    `History (${unit.provenance.length} entries):`,
    ...story.slice(-10).map((s) => `  ${s}`),
  ];

  if (story.length > 10) {
    lines.push(`  ... and ${story.length - 10} earlier entries`);
  }

  return lines.join('\n');
}

/**
 * Create a "stripped" unit with empty provenance.
 * The stripping itself is recorded but history is lost.
 */
export function stripReputation(
  unit: OmniumUnit,
  currentTime: number
): OmniumUnit {
  const strippedEntry: ProvenanceEntry = {
    timestamp: currentTime,
    type: ProvenanceType.Converted,
    amount: unit.magnitude,
    note: 'Reputation stripped - history cleared',
    transactionId: `strip-${unit.id}`,
  };

  return {
    ...unit,
    provenance: [strippedEntry],
  };
}
