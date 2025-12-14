/**
 * Local Currencies (Layer 3)
 *
 * Community-specific OMNIUM that circulates preferentially within boundaries.
 *
 * "This creates economic membranes—permeable but present—that allow
 *  communities to cultivate local resilience while remaining connected
 *  to the global economy."
 *
 * Key mechanics:
 * - Trade at par within community
 * - Boundary fee when leaving (funds local commons)
 * - Can always dissolve back to base Ω (with fee)
 */

import { v4 as uuid } from 'uuid';
import { Community, OmniumUnit, Wallet } from '../core/types.js';

/**
 * Registry of all communities in the system.
 */
export class CommunityRegistry {
  private communities: Map<string, Community> = new Map();

  /**
   * Create a new community (local currency).
   */
  createCommunity(params: {
    name: string;
    description?: string;
    boundaryFee: number; // 0-1, fee when money leaves
  }): Community {
    if (params.boundaryFee < 0 || params.boundaryFee > 1) {
      throw new Error('Boundary fee must be between 0 and 1');
    }

    const community: Community = {
      id: uuid(),
      name: params.name,
      description: params.description,
      boundaryFee: params.boundaryFee,
      createdAt: Date.now(),
      memberCount: 0,
    };

    this.communities.set(community.id, community);
    return community;
  }

  /**
   * Get a community by ID.
   */
  getCommunity(id: string): Community | undefined {
    return this.communities.get(id);
  }

  /**
   * Get community by name.
   */
  getCommunityByName(name: string): Community | undefined {
    for (const community of this.communities.values()) {
      if (community.name.toLowerCase() === name.toLowerCase()) {
        return community;
      }
    }
    return undefined;
  }

  /**
   * Get all communities.
   */
  getAllCommunities(): Community[] {
    return Array.from(this.communities.values());
  }

  /**
   * Increment member count.
   */
  addMember(communityId: string): void {
    const community = this.communities.get(communityId);
    if (community) {
      community.memberCount++;
    }
  }

  /**
   * Decrement member count.
   */
  removeMember(communityId: string): void {
    const community = this.communities.get(communityId);
    if (community && community.memberCount > 0) {
      community.memberCount--;
    }
  }

  /**
   * Update community settings.
   */
  updateCommunity(
    id: string,
    updates: Partial<Pick<Community, 'name' | 'description' | 'boundaryFee'>>
  ): Community {
    const community = this.communities.get(id);
    if (!community) {
      throw new Error(`Community not found: ${id}`);
    }

    if (updates.boundaryFee !== undefined) {
      if (updates.boundaryFee < 0 || updates.boundaryFee > 1) {
        throw new Error('Boundary fee must be between 0 and 1');
      }
    }

    Object.assign(community, updates);
    return community;
  }

  /**
   * Check if a wallet is a member of a community.
   */
  isMember(wallet: Wallet, communityId: string): boolean {
    return wallet.communities.has(communityId);
  }

  /**
   * Check if a unit can be spent within a community.
   * Units with matching locality trade at par.
   * Global units (no locality) can be spent anywhere.
   */
  canSpendInCommunity(unit: OmniumUnit, communityId: string): boolean {
    // Global money can be spent anywhere
    if (unit.locality.size === 0) return true;
    // Local money can be spent in its communities
    return unit.locality.has(communityId);
  }

  /**
   * Calculate the effective value when spending local money outside its community.
   * Non-local spend incurs the boundary fee.
   */
  effectiveValueOutside(unit: OmniumUnit, targetCommunityId?: string): number {
    // Global money - full value everywhere
    if (unit.locality.size === 0) return unit.magnitude;

    // If spending in a community the money belongs to - full value
    if (targetCommunityId && unit.locality.has(targetCommunityId)) {
      return unit.magnitude;
    }

    // Calculate cumulative boundary fee for leaving all communities
    let value = unit.magnitude;
    for (const communityId of unit.locality) {
      const community = this.communities.get(communityId);
      if (community) {
        value *= (1 - community.boundaryFee);
      }
    }

    return value;
  }

  /**
   * Get display info for communities.
   */
  listCommunities(): string {
    const communities = this.getAllCommunities();
    if (communities.length === 0) {
      return 'No communities registered.';
    }

    const lines = ['=== Communities ==='];
    for (const c of communities) {
      lines.push(
        `${c.name} (${c.id.slice(0, 8)}...)` +
        ` - ${c.memberCount} members` +
        ` - ${(c.boundaryFee * 100).toFixed(1)}% boundary fee`
      );
      if (c.description) {
        lines.push(`  ${c.description}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Export all communities for persistence.
   */
  export(): Map<string, Community> {
    return new Map(this.communities);
  }

  /**
   * Import communities from persistence.
   */
  import(data: Map<string, Community>): void {
    this.communities = new Map(data);
  }
}

/**
 * Singleton community registry.
 */
export const communityRegistry = new CommunityRegistry();
