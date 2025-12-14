/**
 * Wallet
 *
 * Holds OmniumUnits and provides dimensional views of balance.
 * A wallet can belong to individuals, communities, or purposes.
 */

import { v4 as uuid } from 'uuid';
import {
  Wallet,
  OmniumUnit,
  TemporalStratum,
} from '../core/types.js';
import { unitSummary, calculateReputationScore } from '../core/omnium.js';

export interface WalletBalance {
  total: number;
  byTemporality: Record<TemporalStratum, number>;
  byLocality: Map<string, number>;  // community -> amount
  byPurpose: Map<string, number>;   // purpose -> amount
  global: number;                    // Amount with no locality
  unrestricted: number;              // Amount with no purpose
}

/**
 * WalletManager handles wallet creation and unit storage.
 */
export class WalletManager {
  private wallets: Map<string, Wallet> = new Map();
  private units: Map<string, OmniumUnit> = new Map();
  private unitsByWallet: Map<string, Set<string>> = new Map();

  /**
   * Create a new wallet.
   */
  createWallet(name: string): Wallet {
    const wallet: Wallet = {
      id: uuid(),
      name,
      createdAt: Date.now(),
      communities: new Set(),
      validPurposes: new Set(),
    };
    this.wallets.set(wallet.id, wallet);
    this.unitsByWallet.set(wallet.id, new Set());
    return wallet;
  }

  /**
   * Get a wallet by ID.
   */
  getWallet(id: string): Wallet | undefined {
    return this.wallets.get(id);
  }

  /**
   * Get all wallets.
   */
  getAllWallets(): Wallet[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Add a unit to a wallet.
   */
  addUnit(unit: OmniumUnit): void {
    this.units.set(unit.id, unit);

    let walletUnits = this.unitsByWallet.get(unit.walletId);
    if (!walletUnits) {
      walletUnits = new Set();
      this.unitsByWallet.set(unit.walletId, walletUnits);
    }
    walletUnits.add(unit.id);
  }

  /**
   * Remove a unit from the system.
   */
  removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (unit) {
      this.unitsByWallet.get(unit.walletId)?.delete(unitId);
      this.units.delete(unitId);
    }
  }

  /**
   * Get a unit by ID.
   */
  getUnit(id: string): OmniumUnit | undefined {
    return this.units.get(id);
  }

  /**
   * Update a unit (e.g., after conversion or tick).
   */
  updateUnit(unit: OmniumUnit): void {
    const existing = this.units.get(unit.id);
    if (existing && existing.walletId !== unit.walletId) {
      // Moving to different wallet
      this.unitsByWallet.get(existing.walletId)?.delete(unit.id);
      let newWalletUnits = this.unitsByWallet.get(unit.walletId);
      if (!newWalletUnits) {
        newWalletUnits = new Set();
        this.unitsByWallet.set(unit.walletId, newWalletUnits);
      }
      newWalletUnits.add(unit.id);
    }
    this.units.set(unit.id, unit);
  }

  /**
   * Get all units in a wallet.
   */
  getUnits(walletId: string): OmniumUnit[] {
    const unitIds = this.unitsByWallet.get(walletId);
    if (!unitIds) return [];
    return Array.from(unitIds)
      .map((id) => this.units.get(id))
      .filter((u): u is OmniumUnit => u !== undefined);
  }

  /**
   * Get all units in the system.
   */
  getAllUnits(): OmniumUnit[] {
    return Array.from(this.units.values());
  }

  /**
   * Calculate dimensional balance for a wallet.
   */
  getBalance(walletId: string): WalletBalance {
    const units = this.getUnits(walletId);

    const balance: WalletBalance = {
      total: 0,
      byTemporality: {
        [TemporalStratum.T0]: 0,
        [TemporalStratum.T1]: 0,
        [TemporalStratum.T2]: 0,
        [TemporalStratum.TInfinity]: 0,
      },
      byLocality: new Map(),
      byPurpose: new Map(),
      global: 0,
      unrestricted: 0,
    };

    for (const unit of units) {
      balance.total += unit.magnitude;
      balance.byTemporality[unit.temporality] += unit.magnitude;

      if (unit.locality.size === 0) {
        balance.global += unit.magnitude;
      } else {
        for (const loc of unit.locality) {
          balance.byLocality.set(
            loc,
            (balance.byLocality.get(loc) ?? 0) + unit.magnitude
          );
        }
      }

      if (unit.purpose.size === 0) {
        balance.unrestricted += unit.magnitude;
      } else {
        for (const purp of unit.purpose) {
          balance.byPurpose.set(
            purp,
            (balance.byPurpose.get(purp) ?? 0) + unit.magnitude
          );
        }
      }
    }

    return balance;
  }

  /**
   * Join a community.
   */
  joinCommunity(walletId: string, communityId: string): void {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error(`Wallet not found: ${walletId}`);
    wallet.communities.add(communityId);
  }

  /**
   * Register to receive a purpose channel.
   */
  registerPurpose(walletId: string, purposeId: string): void {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error(`Wallet not found: ${walletId}`);
    wallet.validPurposes.add(purposeId);
  }

  /**
   * Display wallet status.
   */
  walletStatus(walletId: string): string {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return `Wallet not found: ${walletId}`;

    const balance = this.getBalance(walletId);
    const units = this.getUnits(walletId);

    const lines = [
      `=== Wallet: ${wallet.name} ===`,
      `ID: ${wallet.id}`,
      ``,
      `Total Balance: ${balance.total.toFixed(2)}Ω`,
      ``,
      `By Temporality:`,
      `  T0 (Immediate):     ${balance.byTemporality[TemporalStratum.T0].toFixed(2)}Ω`,
      `  T1 (Seasonal):      ${balance.byTemporality[TemporalStratum.T1].toFixed(2)}Ω`,
      `  T2 (Generational):  ${balance.byTemporality[TemporalStratum.T2].toFixed(2)}Ω`,
      `  T∞ (Perpetual):     ${balance.byTemporality[TemporalStratum.TInfinity].toFixed(2)}Ω`,
      ``,
      `Global (no locality): ${balance.global.toFixed(2)}Ω`,
      `Unrestricted (no purpose): ${balance.unrestricted.toFixed(2)}Ω`,
    ];

    if (balance.byLocality.size > 0) {
      lines.push(``, `By Locality:`);
      for (const [loc, amt] of balance.byLocality) {
        lines.push(`  ${loc}: ${amt.toFixed(2)}Ω`);
      }
    }

    if (balance.byPurpose.size > 0) {
      lines.push(``, `By Purpose:`);
      for (const [purp, amt] of balance.byPurpose) {
        lines.push(`  ${purp}: ${amt.toFixed(2)}Ω`);
      }
    }

    if (units.length > 0) {
      lines.push(``, `Units (${units.length}):`);
      for (const unit of units.slice(0, 10)) {
        lines.push(`  ${unit.id.slice(0, 8)}... ${unitSummary(unit)}`);
      }
      if (units.length > 10) {
        lines.push(`  ... and ${units.length - 10} more`);
      }
    }

    return lines.join('\n');
  }
}
