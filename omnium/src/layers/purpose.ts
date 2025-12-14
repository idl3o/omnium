/**
 * Purpose Channels (Layer 4)
 *
 * OMNIUM can be 'colored' with intent - restricted to specific uses.
 *
 * "Purpose-colored money trades at a discount to base Ω (due to restricted
 *  utility) but carries social information. Receiving Ω-P(education) tells
 *  you something about the sender's values. Spending it tells something
 *  about yours."
 *
 * Purpose channels are defined by registries—open, auditable databases
 * of qualifying recipients. Anyone can propose a new purpose channel;
 * adoption is voluntary. The market decides which purposes matter.
 */

import { v4 as uuid } from 'uuid';
import { PurposeChannel, OmniumUnit, Wallet } from '../core/types.js';

/**
 * Pre-defined purpose channels.
 */
export const STANDARD_PURPOSES = {
  health: {
    name: 'health',
    description: 'Healthcare goods and services',
    conversionDiscount: 0.03,
  },
  education: {
    name: 'education',
    description: 'Educational purposes - tuition, books, courses',
    conversionDiscount: 0.03,
  },
  carbon: {
    name: 'carbon-negative',
    description: 'Verified carbon-negative vendors only',
    conversionDiscount: 0.05,
  },
  creator: {
    name: 'creator',
    description: 'Must flow to original content creators',
    conversionDiscount: 0.02,
  },
  local: {
    name: 'local-business',
    description: 'Small and local businesses only',
    conversionDiscount: 0.03,
  },
  food: {
    name: 'food',
    description: 'Food and groceries only',
    conversionDiscount: 0.02,
  },
  housing: {
    name: 'housing',
    description: 'Rent, mortgage, housing costs',
    conversionDiscount: 0.04,
  },
  charity: {
    name: 'charity',
    description: 'Registered charitable organizations',
    conversionDiscount: 0.01,
  },
};

/**
 * Registry of all purpose channels in the system.
 */
export class PurposeRegistry {
  private purposes: Map<string, PurposeChannel> = new Map();

  constructor() {
    // Initialize with standard purposes
    for (const [key, config] of Object.entries(STANDARD_PURPOSES)) {
      const purpose: PurposeChannel = {
        id: key, // Use the key as ID for standard purposes
        name: config.name,
        description: config.description,
        validRecipients: new Set(),
        conversionDiscount: config.conversionDiscount,
        createdAt: Date.now(),
      };
      this.purposes.set(purpose.id, purpose);
    }
  }

  /**
   * Create a new purpose channel.
   */
  createPurpose(params: {
    name: string;
    description?: string;
    conversionDiscount?: number; // Default 0.03 (3%)
  }): PurposeChannel {
    const discount = params.conversionDiscount ?? 0.03;
    if (discount < 0 || discount > 1) {
      throw new Error('Conversion discount must be between 0 and 1');
    }

    const purpose: PurposeChannel = {
      id: uuid(),
      name: params.name,
      description: params.description,
      validRecipients: new Set(),
      conversionDiscount: discount,
      createdAt: Date.now(),
    };

    this.purposes.set(purpose.id, purpose);
    return purpose;
  }

  /**
   * Get a purpose channel by ID or name.
   */
  getPurpose(idOrName: string): PurposeChannel | undefined {
    // Try by ID first
    const byId = this.purposes.get(idOrName);
    if (byId) return byId;

    // Try by name
    for (const purpose of this.purposes.values()) {
      if (purpose.name.toLowerCase() === idOrName.toLowerCase()) {
        return purpose;
      }
    }
    return undefined;
  }

  /**
   * Get all purpose channels.
   */
  getAllPurposes(): PurposeChannel[] {
    return Array.from(this.purposes.values());
  }

  /**
   * Register a wallet as a valid recipient for a purpose.
   */
  registerRecipient(purposeId: string, walletId: string): void {
    const purpose = this.purposes.get(purposeId);
    if (!purpose) {
      throw new Error(`Purpose channel not found: ${purposeId}`);
    }
    purpose.validRecipients.add(walletId);
  }

  /**
   * Unregister a wallet from a purpose.
   */
  unregisterRecipient(purposeId: string, walletId: string): void {
    const purpose = this.purposes.get(purposeId);
    if (purpose) {
      purpose.validRecipients.delete(walletId);
    }
  }

  /**
   * Check if a wallet can receive purpose-colored money.
   */
  canReceive(wallet: Wallet, unit: OmniumUnit): { valid: boolean; reason?: string } {
    // Unrestricted money can go anywhere
    if (unit.purpose.size === 0) {
      return { valid: true };
    }

    // Check each purpose on the unit
    for (const purposeId of unit.purpose) {
      const purpose = this.purposes.get(purposeId);
      if (!purpose) {
        return { valid: false, reason: `Unknown purpose: ${purposeId}` };
      }

      // Check if wallet is registered for this purpose
      if (!purpose.validRecipients.has(wallet.id)) {
        return {
          valid: false,
          reason: `Wallet not registered for purpose: ${purpose.name}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if a wallet can receive specific purposes.
   */
  canReceivePurposes(wallet: Wallet, purposes: Set<string>): { valid: boolean; reason?: string } {
    for (const purposeId of purposes) {
      const purpose = this.purposes.get(purposeId);
      if (!purpose) {
        return { valid: false, reason: `Unknown purpose: ${purposeId}` };
      }
      if (!purpose.validRecipients.has(wallet.id)) {
        return {
          valid: false,
          reason: `Wallet not registered for purpose: ${purpose.name}`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Calculate total conversion discount for stripping all purposes.
   */
  totalConversionDiscount(purposes: Set<string>): number {
    let totalDiscount = 0;
    for (const purposeId of purposes) {
      const purpose = this.purposes.get(purposeId);
      if (purpose) {
        // Discounts compound: (1-d1) * (1-d2) * ...
        totalDiscount = 1 - (1 - totalDiscount) * (1 - purpose.conversionDiscount);
      }
    }
    return totalDiscount;
  }

  /**
   * Get display info for purpose channels.
   */
  listPurposes(): string {
    const purposes = this.getAllPurposes();
    if (purposes.length === 0) {
      return 'No purpose channels registered.';
    }

    const lines = ['=== Purpose Channels ==='];
    for (const p of purposes) {
      lines.push(
        `${p.name} (${p.id.slice(0, 8)}...)` +
        ` - ${p.validRecipients.size} recipients` +
        ` - ${(p.conversionDiscount * 100).toFixed(1)}% conversion discount`
      );
      if (p.description) {
        lines.push(`  ${p.description}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Export for persistence.
   */
  export(): Map<string, PurposeChannel> {
    return new Map(this.purposes);
  }

  /**
   * Import from persistence.
   */
  import(data: Map<string, PurposeChannel>): void {
    this.purposes = new Map(data);
  }
}

/**
 * Singleton purpose registry.
 */
export const purposeRegistry = new PurposeRegistry();
