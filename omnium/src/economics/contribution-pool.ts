/**
 * Contribution Pool
 *
 * Pool-based Proof-of-Useful-Compute: Seamless surplus compute → Simulators
 *
 * Core insight: Value flows from connecting idle compute to ongoing simulations.
 * Providers contribute surplus capacity. Simulations define what's useful.
 * No job matching, no bidding - just seamless pooling.
 *
 * Flow:
 * 1. Simulation is activated with funding and rules (LawSet)
 * 2. Providers contribute surplus compute capacity
 * 3. Contributions are metered per simulation
 * 4. Rewards distributed proportionally from simulation's funding pool
 *
 * This is simpler than job-based:
 * - No claim/complete lifecycle
 * - No market-making friction
 * - Providers just run a daemon
 * - Simulations pull from the pool
 */

import { v4 as uuid } from 'uuid';
import type { LawSet, DeterministicContainer } from './simulation.js';
import type { ComputeAttestation, ValueAttribution } from './deterministic-compute.js';
import { ComputeRegistry, ValueType } from './deterministic-compute.js';
import { ComputeRewardManager, type RewardEvent } from './compute-rewards.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Status of an active simulation.
 */
export enum SimulationStatus {
  /** Accepting contributions */
  Active = 'active',
  /** Temporarily paused (no new contributions) */
  Paused = 'paused',
  /** Completed - no more contributions accepted */
  Completed = 'completed',
  /** Ran out of funding */
  Depleted = 'depleted',
}

/**
 * An active simulation that providers can contribute to.
 */
export interface ActiveSimulation {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the simulation's purpose */
  description: string;

  /** The rules governing this simulation */
  lawSetId: string;

  /** The execution environment */
  containerId: string;

  /** Current status */
  status: SimulationStatus;

  /** Ω available to reward contributors */
  fundingPool: number;

  /** Ω per compute unit */
  rewardRate: number;

  /** Optional: purpose-coloring for minted rewards */
  purpose?: string;

  /** Optional: locality for minted rewards */
  locality?: string;

  /** When simulation was activated */
  activatedAt: number;

  /** Total compute units contributed so far */
  totalComputeContributed: number;

  /** Total Ω distributed so far */
  totalRewardsDistributed: number;

  /** Current simulation step/state reference */
  currentStateCid?: string;

  /** Number of active contributors */
  activeContributors: number;
}

/**
 * A provider's contribution of compute to a simulation.
 */
export interface ComputeContribution {
  /** Unique identifier */
  id: string;

  /** Which simulation this contributes to */
  simulationId: string;

  /** Provider wallet ID */
  providerId: string;

  /** Compute units contributed */
  computeUnits: number;

  /** When contribution started */
  startedAt: number;

  /** When contribution ended (null if ongoing) */
  endedAt: number | null;

  /** Steps/iterations executed */
  stepsExecuted: number;

  /** State CID at start */
  startStateCid: string;

  /** State CID at end (for verification) */
  endStateCid?: string;

  /** Whether this contribution has been rewarded */
  rewarded: boolean;

  /** Ω earned from this contribution */
  rewardAmount?: number;
}

/**
 * Summary of a provider's contributions.
 */
export interface ProviderContributionSummary {
  /** Provider wallet ID */
  providerId: string;

  /** Total compute units contributed across all simulations */
  totalComputeUnits: number;

  /** Total Ω earned */
  totalRewardsEarned: number;

  /** Number of simulations contributed to */
  simulationsContributed: number;

  /** Active contributions (ongoing) */
  activeContributions: number;
}

/**
 * Options for activating a simulation.
 */
export interface ActivateSimulationOptions {
  /** Initial funding pool */
  initialFunding: number;

  /** Reward rate (Ω per compute unit) */
  rewardRate: number;

  /** Optional purpose-coloring */
  purpose?: string;

  /** Optional locality */
  locality?: string;

  /** Initial state CID */
  initialStateCid?: string;
}

/**
 * Result of distributing rewards.
 */
export interface RewardDistribution {
  /** Simulation ID */
  simulationId: string;

  /** Number of contributions rewarded */
  contributionsRewarded: number;

  /** Total Ω distributed */
  totalDistributed: number;

  /** Individual rewards */
  rewards: Array<{
    contributionId: string;
    providerId: string;
    computeUnits: number;
    amount: number;
  }>;
}

/**
 * Pool statistics.
 */
export interface ContributionPoolStats {
  /** Total active simulations */
  activeSimulations: number;

  /** Total completed simulations */
  completedSimulations: number;

  /** Total compute units contributed */
  totalComputeContributed: number;

  /** Total Ω distributed */
  totalRewardsDistributed: number;

  /** Total funding deposited */
  totalFundingDeposited: number;

  /** Active providers (with ongoing contributions) */
  activeProviders: number;
}

// =============================================================================
// CONTRIBUTION POOL
// =============================================================================

/**
 * The Contribution Pool - seamless surplus compute for simulations.
 *
 * This replaces the job-based ComputePool with a simpler model:
 * - Simulations are ongoing, not discrete jobs
 * - Providers contribute surplus capacity, not claim work
 * - Rewards flow proportionally, no bidding
 */
export class ContributionPool {
  private simulations: Map<string, ActiveSimulation> = new Map();
  private contributions: Map<string, ComputeContribution> = new Map();
  private contributionsBySimulation: Map<string, Set<string>> = new Map();
  private contributionsByProvider: Map<string, Set<string>> = new Map();
  private activeContributionsByProvider: Map<string, Set<string>> = new Map();

  // Statistics
  private totalFundingDeposited: number = 0;
  private totalRewardsDistributed: number = 0;
  private totalComputeContributed: number = 0;

  // Callback for minting rewards
  private mintCallback?: (
    amount: number,
    toWallet: string,
    purpose?: string,
    locality?: string,
    note?: string
  ) => string | null;

  // Time provider (for testing)
  private timeProvider: () => number;

  constructor(timeProvider?: () => number) {
    this.timeProvider = timeProvider ?? (() => Date.now());
  }

  /**
   * Set the mint callback for ledger integration.
   */
  setMintCallback(
    callback: (
      amount: number,
      toWallet: string,
      purpose?: string,
      locality?: string,
      note?: string
    ) => string | null
  ): void {
    this.mintCallback = callback;
  }

  // ---------------------------------------------------------------------------
  // Simulation Management
  // ---------------------------------------------------------------------------

  /**
   * Activate a new simulation that providers can contribute to.
   */
  activateSimulation(
    name: string,
    description: string,
    lawSetId: string,
    containerId: string,
    options: ActivateSimulationOptions
  ): ActiveSimulation {
    if (options.initialFunding <= 0) {
      throw new Error('Initial funding must be positive');
    }
    if (options.rewardRate <= 0) {
      throw new Error('Reward rate must be positive');
    }

    const now = this.timeProvider();
    const simulation: ActiveSimulation = {
      id: uuid(),
      name,
      description,
      lawSetId,
      containerId,
      status: SimulationStatus.Active,
      fundingPool: options.initialFunding,
      rewardRate: options.rewardRate,
      purpose: options.purpose,
      locality: options.locality,
      activatedAt: now,
      totalComputeContributed: 0,
      totalRewardsDistributed: 0,
      currentStateCid: options.initialStateCid,
      activeContributors: 0,
    };

    this.simulations.set(simulation.id, simulation);
    this.contributionsBySimulation.set(simulation.id, new Set());
    this.totalFundingDeposited += options.initialFunding;

    return simulation;
  }

  /**
   * Add funding to an existing simulation.
   */
  fundSimulation(simulationId: string, amount: number): boolean {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return false;
    if (amount <= 0) return false;

    simulation.fundingPool += amount;
    this.totalFundingDeposited += amount;

    // Reactivate if depleted
    if (simulation.status === SimulationStatus.Depleted) {
      simulation.status = SimulationStatus.Active;
    }

    return true;
  }

  /**
   * Pause a simulation (stop accepting new contributions).
   */
  pauseSimulation(simulationId: string): boolean {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return false;
    if (simulation.status !== SimulationStatus.Active) return false;

    simulation.status = SimulationStatus.Paused;
    return true;
  }

  /**
   * Resume a paused simulation.
   */
  resumeSimulation(simulationId: string): boolean {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return false;
    if (simulation.status !== SimulationStatus.Paused) return false;

    simulation.status = SimulationStatus.Active;
    return true;
  }

  /**
   * Complete a simulation (finalize, no more contributions).
   */
  completeSimulation(simulationId: string): boolean {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return false;

    // Distribute any pending rewards first
    this.distributeRewards(simulationId);

    simulation.status = SimulationStatus.Completed;
    return true;
  }

  /**
   * Get a simulation by ID.
   */
  getSimulation(simulationId: string): ActiveSimulation | undefined {
    return this.simulations.get(simulationId);
  }

  /**
   * Get all active simulations.
   */
  getActiveSimulations(): ActiveSimulation[] {
    return Array.from(this.simulations.values()).filter(
      (s) => s.status === SimulationStatus.Active
    );
  }

  // ---------------------------------------------------------------------------
  // Contribution Management
  // ---------------------------------------------------------------------------

  /**
   * Start contributing compute to a simulation.
   *
   * Called when a provider's daemon begins working on a simulation.
   */
  startContribution(
    simulationId: string,
    providerId: string,
    startStateCid: string
  ): ComputeContribution | null {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return null;
    if (simulation.status !== SimulationStatus.Active) return null;

    const now = this.timeProvider();
    const contribution: ComputeContribution = {
      id: uuid(),
      simulationId,
      providerId,
      computeUnits: 0,
      startedAt: now,
      endedAt: null,
      stepsExecuted: 0,
      startStateCid,
      rewarded: false,
    };

    this.contributions.set(contribution.id, contribution);
    this.addToIndex(this.contributionsBySimulation, simulationId, contribution.id);
    this.addToIndex(this.contributionsByProvider, providerId, contribution.id);
    this.addToIndex(this.activeContributionsByProvider, providerId, contribution.id);

    simulation.activeContributors++;

    return contribution;
  }

  /**
   * Record compute units contributed.
   *
   * Called periodically by provider daemon to report progress.
   */
  recordContribution(
    contributionId: string,
    computeUnits: number,
    stepsExecuted: number,
    currentStateCid?: string
  ): boolean {
    const contribution = this.contributions.get(contributionId);
    if (!contribution) return false;
    if (contribution.endedAt !== null) return false;

    const simulation = this.simulations.get(contribution.simulationId);
    if (!simulation) return false;

    contribution.computeUnits += computeUnits;
    contribution.stepsExecuted += stepsExecuted;
    if (currentStateCid) {
      contribution.endStateCid = currentStateCid;
      simulation.currentStateCid = currentStateCid;
    }

    simulation.totalComputeContributed += computeUnits;
    this.totalComputeContributed += computeUnits;

    return true;
  }

  /**
   * End a contribution.
   *
   * Called when provider's daemon stops working on a simulation.
   */
  endContribution(contributionId: string, finalStateCid?: string): boolean {
    const contribution = this.contributions.get(contributionId);
    if (!contribution) return false;
    if (contribution.endedAt !== null) return false;

    const simulation = this.simulations.get(contribution.simulationId);
    if (!simulation) return false;

    const now = this.timeProvider();
    contribution.endedAt = now;
    if (finalStateCid) {
      contribution.endStateCid = finalStateCid;
    }

    simulation.activeContributors = Math.max(0, simulation.activeContributors - 1);
    this.removeFromIndex(this.activeContributionsByProvider, contribution.providerId, contributionId);

    return true;
  }

  /**
   * Get a contribution by ID.
   */
  getContribution(contributionId: string): ComputeContribution | undefined {
    return this.contributions.get(contributionId);
  }

  /**
   * Get all contributions to a simulation.
   */
  getContributionsBySimulation(simulationId: string): ComputeContribution[] {
    const ids = this.contributionsBySimulation.get(simulationId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.contributions.get(id))
      .filter((c): c is ComputeContribution => c !== undefined);
  }

  /**
   * Get all contributions by a provider.
   */
  getContributionsByProvider(providerId: string): ComputeContribution[] {
    const ids = this.contributionsByProvider.get(providerId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.contributions.get(id))
      .filter((c): c is ComputeContribution => c !== undefined);
  }

  /**
   * Get provider contribution summary.
   */
  getProviderSummary(providerId: string): ProviderContributionSummary {
    const contributions = this.getContributionsByProvider(providerId);
    const activeIds = this.activeContributionsByProvider.get(providerId);

    return {
      providerId,
      totalComputeUnits: contributions.reduce((sum, c) => sum + c.computeUnits, 0),
      totalRewardsEarned: contributions.reduce((sum, c) => sum + (c.rewardAmount ?? 0), 0),
      simulationsContributed: new Set(contributions.map((c) => c.simulationId)).size,
      activeContributions: activeIds?.size ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Reward Distribution
  // ---------------------------------------------------------------------------

  /**
   * Distribute rewards for completed contributions to a simulation.
   *
   * Rewards are proportional to compute units contributed.
   */
  distributeRewards(simulationId: string): RewardDistribution {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      return { simulationId, contributionsRewarded: 0, totalDistributed: 0, rewards: [] };
    }

    // Find unrewarded, completed contributions
    const contributions = this.getContributionsBySimulation(simulationId).filter(
      (c) => !c.rewarded && c.endedAt !== null && c.computeUnits > 0
    );

    if (contributions.length === 0) {
      return { simulationId, contributionsRewarded: 0, totalDistributed: 0, rewards: [] };
    }

    const rewards: RewardDistribution['rewards'] = [];
    let totalDistributed = 0;

    for (const contribution of contributions) {
      // Calculate reward based on compute units and rate
      const potentialReward = contribution.computeUnits * simulation.rewardRate;

      // Cap at available funding
      const actualReward = Math.min(potentialReward, simulation.fundingPool);

      if (actualReward <= 0) {
        // Funding depleted, can't reward anymore
        simulation.status = SimulationStatus.Depleted;
        break;
      }

      // Check if this will deplete the pool
      const willDeplete = actualReward >= simulation.fundingPool;

      // Mint reward
      if (this.mintCallback) {
        const note = `Contribution reward: ${simulation.name} (${contribution.computeUnits} units)`;
        const unitId = this.mintCallback(
          actualReward,
          contribution.providerId,
          simulation.purpose,
          simulation.locality,
          note
        );

        if (unitId) {
          contribution.rewarded = true;
          contribution.rewardAmount = actualReward;
          simulation.fundingPool -= actualReward;
          simulation.totalRewardsDistributed += actualReward;
          this.totalRewardsDistributed += actualReward;
          totalDistributed += actualReward;

          rewards.push({
            contributionId: contribution.id,
            providerId: contribution.providerId,
            computeUnits: contribution.computeUnits,
            amount: actualReward,
          });

          // Mark depleted if we used all remaining funding
          if (willDeplete) {
            simulation.status = SimulationStatus.Depleted;
          }
        }
      } else {
        // No mint callback - mark as rewarded but with 0 amount
        contribution.rewarded = true;
        contribution.rewardAmount = 0;
      }
    }

    return {
      simulationId,
      contributionsRewarded: rewards.length,
      totalDistributed,
      rewards,
    };
  }

  /**
   * Distribute rewards for all simulations with pending contributions.
   */
  distributeAllRewards(): RewardDistribution[] {
    const results: RewardDistribution[] = [];
    for (const simulation of this.simulations.values()) {
      if (simulation.status !== SimulationStatus.Completed) {
        const result = this.distributeRewards(simulation.id);
        if (result.contributionsRewarded > 0) {
          results.push(result);
        }
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  /**
   * Get pool statistics.
   */
  getStats(): ContributionPoolStats {
    let activeSimulations = 0;
    let completedSimulations = 0;

    for (const simulation of this.simulations.values()) {
      if (simulation.status === SimulationStatus.Active) activeSimulations++;
      if (simulation.status === SimulationStatus.Completed) completedSimulations++;
    }

    // Count unique active providers
    const activeProviders = new Set<string>();
    for (const contribution of this.contributions.values()) {
      if (contribution.endedAt === null) {
        activeProviders.add(contribution.providerId);
      }
    }

    return {
      activeSimulations,
      completedSimulations,
      totalComputeContributed: this.totalComputeContributed,
      totalRewardsDistributed: this.totalRewardsDistributed,
      totalFundingDeposited: this.totalFundingDeposited,
      activeProviders: activeProviders.size,
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Export state for persistence.
   */
  export(): {
    simulations: ActiveSimulation[];
    contributions: ComputeContribution[];
    totalFundingDeposited: number;
    totalRewardsDistributed: number;
    totalComputeContributed: number;
  } {
    return {
      simulations: Array.from(this.simulations.values()),
      contributions: Array.from(this.contributions.values()),
      totalFundingDeposited: this.totalFundingDeposited,
      totalRewardsDistributed: this.totalRewardsDistributed,
      totalComputeContributed: this.totalComputeContributed,
    };
  }

  /**
   * Import state from persistence.
   */
  import(state: ReturnType<ContributionPool['export']>): void {
    this.simulations.clear();
    this.contributions.clear();
    this.contributionsBySimulation.clear();
    this.contributionsByProvider.clear();
    this.activeContributionsByProvider.clear();

    for (const simulation of state.simulations) {
      this.simulations.set(simulation.id, simulation);
      this.contributionsBySimulation.set(simulation.id, new Set());
    }

    for (const contribution of state.contributions) {
      this.contributions.set(contribution.id, contribution);
      this.addToIndex(this.contributionsBySimulation, contribution.simulationId, contribution.id);
      this.addToIndex(this.contributionsByProvider, contribution.providerId, contribution.id);
      if (contribution.endedAt === null) {
        this.addToIndex(this.activeContributionsByProvider, contribution.providerId, contribution.id);
      }
    }

    this.totalFundingDeposited = state.totalFundingDeposited;
    this.totalRewardsDistributed = state.totalRewardsDistributed;
    this.totalComputeContributed = state.totalComputeContributed;
  }

  /**
   * Reset pool (for testing).
   */
  reset(): void {
    this.simulations.clear();
    this.contributions.clear();
    this.contributionsBySimulation.clear();
    this.contributionsByProvider.clear();
    this.activeContributionsByProvider.clear();
    this.totalFundingDeposited = 0;
    this.totalRewardsDistributed = 0;
    this.totalComputeContributed = 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(value);
  }

  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
    }
  }
}

/**
 * Create a new ContributionPool.
 */
export function createContributionPool(timeProvider?: () => number): ContributionPool {
  return new ContributionPool(timeProvider);
}

// =============================================================================
// ANONYMOUS COMPUTE BRIDGE
// =============================================================================

/**
 * Bridge between anonymous ComputeAttestations and the ContributionPool.
 *
 * Allows providers to submit deterministic compute attestations without
 * declaring which simulation they're contributing to. Value can be
 * attributed retroactively through tips, boosts, and citations.
 *
 * Two reward paths:
 * 1. ANONYMOUS: Submit attestation → Get base reward → Optional retroactive value
 * 2. BOUND: Submit attestation + bind to simulation → Get base + simulation rewards
 */
export class AnonymousComputeBridge {
  private registry: ComputeRegistry;
  private rewardManager: ComputeRewardManager;
  private contributionPool: ContributionPool;

  // Map attestations to contributions (for bound mode)
  private attestationToContribution: Map<string, string> = new Map();
  private contributionToAttestation: Map<string, string> = new Map();

  constructor(contributionPool: ContributionPool) {
    this.contributionPool = contributionPool;
    this.registry = new ComputeRegistry();
    this.rewardManager = new ComputeRewardManager(this.registry);
  }

  // ---------------------------------------------------------------------------
  // Anonymous Compute (no simulation binding)
  // ---------------------------------------------------------------------------

  /**
   * Submit an anonymous compute attestation.
   *
   * Provider proves they did deterministic work but doesn't declare
   * what simulation it's for. Gets base reward immediately.
   */
  submitAnonymousAttestation(
    attestation: Omit<ComputeAttestation, 'id' | 'timestamp'>
  ): { attestation: ComputeAttestation; reward: RewardEvent | null } {
    // Register the attestation
    const registered = this.registry.register(attestation);

    // Process base reward immediately
    const reward = this.rewardManager.processBaseReward(registered.id);

    return { attestation: registered, reward };
  }

  /**
   * Attribute value to an existing attestation.
   *
   * This is the retroactive value discovery mechanism:
   * - Someone tips an attestation (direct appreciation)
   * - Someone boosts an attestation (amplification)
   * - Someone cites an attestation (academic/research value)
   */
  attributeValue(
    attestationId: string,
    attributorId: string,
    type: 'tip' | 'boost' | 'citation',
    amount: number,
    note?: string
  ): { attribution: ValueAttribution | null; reward: RewardEvent | null } {
    // Map string types to enum values
    const typeMap: Record<'tip' | 'boost' | 'citation', ValueType> = {
      tip: ValueType.Tip,
      boost: ValueType.Boost,
      citation: ValueType.Citation,
    };

    // Add attribution to registry
    const attribution = this.registry.attributeValue(
      attestationId,
      attributorId,
      typeMap[type],
      amount,
      note
    );

    if (!attribution) {
      return { attribution: null, reward: null };
    }

    // Process value reward
    const reward = this.rewardManager.processValueAttribution(attribution.id);

    return { attribution, reward };
  }

  // ---------------------------------------------------------------------------
  // Bound Compute (linked to simulation)
  // ---------------------------------------------------------------------------

  /**
   * Submit an attestation bound to a simulation.
   *
   * Provider proves deterministic work AND declares which simulation
   * it contributes to. Gets both base reward and simulation rewards.
   */
  submitBoundAttestation(
    attestation: Omit<ComputeAttestation, 'id' | 'timestamp'>,
    simulationId: string
  ): {
    attestation: ComputeAttestation;
    contribution: ComputeContribution | null;
    reward: RewardEvent | null;
  } {
    // Register the attestation
    const registered = this.registry.register(attestation);

    // Process base reward
    const reward = this.rewardManager.processBaseReward(registered.id);

    // Create a contribution in the pool
    const contribution = this.contributionPool.startContribution(
      simulationId,
      attestation.providerId,
      attestation.inputCid
    );

    if (contribution) {
      // Record the compute units
      this.contributionPool.recordContribution(
        contribution.id,
        attestation.computeUnits,
        1, // Single step for this attestation
        attestation.outputCid
      );

      // End the contribution (it's a single attestation)
      this.contributionPool.endContribution(contribution.id, attestation.outputCid);

      // Track mapping
      this.attestationToContribution.set(registered.id, contribution.id);
      this.contributionToAttestation.set(contribution.id, registered.id);
    }

    return { attestation: registered, contribution, reward };
  }

  /**
   * Retroactively bind an anonymous attestation to a simulation.
   *
   * This allows attestations to be "discovered" as useful for a
   * simulation after the fact, earning additional rewards.
   */
  bindToSimulation(
    attestationId: string,
    simulationId: string
  ): ComputeContribution | null {
    const attestation = this.registry.get(attestationId);
    if (!attestation) return null;

    // Check if already bound
    if (this.attestationToContribution.has(attestationId)) {
      return null; // Already bound
    }

    // Create contribution
    const contribution = this.contributionPool.startContribution(
      simulationId,
      attestation.providerId,
      attestation.inputCid
    );

    if (contribution) {
      this.contributionPool.recordContribution(
        contribution.id,
        attestation.computeUnits,
        1,
        attestation.outputCid
      );
      this.contributionPool.endContribution(contribution.id, attestation.outputCid);

      this.attestationToContribution.set(attestationId, contribution.id);
      this.contributionToAttestation.set(contribution.id, attestationId);
    }

    return contribution;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Get the compute registry.
   */
  getRegistry(): ComputeRegistry {
    return this.registry;
  }

  /**
   * Get the reward manager.
   */
  getRewardManager(): ComputeRewardManager {
    return this.rewardManager;
  }

  /**
   * Get attestation by ID.
   */
  getAttestation(attestationId: string): ComputeAttestation | undefined {
    return this.registry.get(attestationId);
  }

  /**
   * Get contribution linked to an attestation.
   */
  getLinkedContribution(attestationId: string): ComputeContribution | undefined {
    const contributionId = this.attestationToContribution.get(attestationId);
    if (!contributionId) return undefined;
    return this.contributionPool.getContribution(contributionId);
  }

  /**
   * Get attestation linked to a contribution.
   */
  getLinkedAttestation(contributionId: string): ComputeAttestation | undefined {
    const attestationId = this.contributionToAttestation.get(contributionId);
    if (!attestationId) return undefined;
    return this.registry.get(attestationId);
  }

  /**
   * Get provider's anonymous compute statistics.
   */
  getProviderStats(providerId: string): {
    attestations: number;
    boundAttestations: number;
    totalBaseRewards: number;
    totalValueRewards: number;
    totalValue: number;
  } {
    const attestations = this.registry.findByProvider(providerId);
    const rewardStats = this.rewardManager.getProviderRewards(providerId);

    let boundCount = 0;
    for (const att of attestations) {
      if (this.attestationToContribution.has(att.id)) {
        boundCount++;
      }
    }

    return {
      attestations: attestations.length,
      boundAttestations: boundCount,
      totalBaseRewards: rewardStats.baseRewards,
      totalValueRewards: rewardStats.valueRewards,
      totalValue: rewardStats.total,
    };
  }

  /**
   * Get bridge statistics.
   */
  getStats(): {
    totalAttestations: number;
    boundAttestations: number;
    unboundAttestations: number;
    totalBaseRewards: number;
    totalValueRewards: number;
    uniqueProviders: number;
  } {
    const registryStats = this.registry.getStats();
    const rewardStats = this.rewardManager.getStats();

    return {
      totalAttestations: registryStats.totalAttestations,
      boundAttestations: this.attestationToContribution.size,
      unboundAttestations: registryStats.totalAttestations - this.attestationToContribution.size,
      totalBaseRewards: rewardStats.totalBaseRewards,
      totalValueRewards: rewardStats.totalValueRewards,
      uniqueProviders: registryStats.totalProviders,
    };
  }
}

/**
 * Create an anonymous compute bridge for a contribution pool.
 */
export function createAnonymousComputeBridge(
  contributionPool: ContributionPool
): AnonymousComputeBridge {
  return new AnonymousComputeBridge(contributionPool);
}
