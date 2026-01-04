/**
 * Tests for Contribution Pool
 *
 * Pool-based Proof-of-Useful-Compute model:
 * - Simulations define what's useful
 * - Providers contribute surplus capacity
 * - Rewards flow proportionally
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContributionPool,
  createContributionPool,
  SimulationStatus,
  AnonymousComputeBridge,
  createAnonymousComputeBridge,
} from './contribution-pool.js';
import {
  ProofMethod,
  createAnonymousAttestation,
} from './deterministic-compute.js';

describe('ContributionPool', () => {
  let pool: ContributionPool;
  let currentTime: number;
  const timeProvider = () => currentTime;

  beforeEach(() => {
    currentTime = Date.now();
    pool = createContributionPool(timeProvider);
  });

  describe('Simulation Management', () => {
    it('should activate a new simulation', () => {
      const sim = pool.activateSimulation(
        'Climate Model',
        'Global climate simulation',
        'lawset-123',
        'container-456',
        {
          initialFunding: 1000,
          rewardRate: 0.1,
          purpose: 'research',
        }
      );

      expect(sim.id).toBeDefined();
      expect(sim.name).toBe('Climate Model');
      expect(sim.status).toBe(SimulationStatus.Active);
      expect(sim.fundingPool).toBe(1000);
      expect(sim.rewardRate).toBe(0.1);
      expect(sim.purpose).toBe('research');
      expect(sim.activeContributors).toBe(0);
    });

    it('should require positive funding', () => {
      expect(() =>
        pool.activateSimulation('Test', 'desc', 'law', 'container', {
          initialFunding: 0,
          rewardRate: 0.1,
        })
      ).toThrow('Initial funding must be positive');
    });

    it('should add funding to existing simulation', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 100,
        rewardRate: 0.1,
      });

      const result = pool.fundSimulation(sim.id, 50);
      expect(result).toBe(true);

      const updated = pool.getSimulation(sim.id);
      expect(updated?.fundingPool).toBe(150);
    });

    it('should reactivate depleted simulation when funded', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 10,
        rewardRate: 10, // High rate to deplete quickly
      });

      // Contribute and deplete
      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 10);
      pool.endContribution(contrib!.id, 'state-1');

      // Set up mint callback to actually consume funding
      pool.setMintCallback(() => 'minted-unit-id');
      pool.distributeRewards(sim.id);

      expect(pool.getSimulation(sim.id)?.status).toBe(SimulationStatus.Depleted);

      // Re-fund
      pool.fundSimulation(sim.id, 1000);
      expect(pool.getSimulation(sim.id)?.status).toBe(SimulationStatus.Active);
    });

    it('should pause and resume simulations', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 100,
        rewardRate: 0.1,
      });

      expect(pool.pauseSimulation(sim.id)).toBe(true);
      expect(pool.getSimulation(sim.id)?.status).toBe(SimulationStatus.Paused);

      // Can't start contributions on paused simulation
      const contrib = pool.startContribution(sim.id, 'provider', 'state');
      expect(contrib).toBeNull();

      // Resume
      expect(pool.resumeSimulation(sim.id)).toBe(true);
      expect(pool.getSimulation(sim.id)?.status).toBe(SimulationStatus.Active);
    });

    it('should list active simulations', () => {
      pool.activateSimulation('Sim1', 'desc', 'law', 'container', {
        initialFunding: 100,
        rewardRate: 0.1,
      });
      const sim2 = pool.activateSimulation('Sim2', 'desc', 'law', 'container', {
        initialFunding: 100,
        rewardRate: 0.1,
      });
      pool.activateSimulation('Sim3', 'desc', 'law', 'container', {
        initialFunding: 100,
        rewardRate: 0.1,
      });

      pool.pauseSimulation(sim2.id);

      const active = pool.getActiveSimulations();
      expect(active.length).toBe(2);
      expect(active.map((s) => s.name)).toContain('Sim1');
      expect(active.map((s) => s.name)).toContain('Sim3');
    });
  });

  describe('Contribution Flow', () => {
    it('should start and record contributions', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      expect(contrib).not.toBeNull();
      expect(contrib?.simulationId).toBe(sim.id);
      expect(contrib?.providerId).toBe('provider-1');
      expect(contrib?.computeUnits).toBe(0);
      expect(contrib?.endedAt).toBeNull();

      // Simulation shows active contributor
      expect(pool.getSimulation(sim.id)?.activeContributors).toBe(1);

      // Record some compute
      pool.recordContribution(contrib!.id, 50, 100, 'state-50');
      const updated = pool.getContribution(contrib!.id);
      expect(updated?.computeUnits).toBe(50);
      expect(updated?.stepsExecuted).toBe(100);
      expect(updated?.endStateCid).toBe('state-50');

      // Record more
      pool.recordContribution(contrib!.id, 30, 60);
      expect(pool.getContribution(contrib!.id)?.computeUnits).toBe(80);
    });

    it('should end contributions', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 200);

      const result = pool.endContribution(contrib!.id, 'state-final');
      expect(result).toBe(true);

      const ended = pool.getContribution(contrib!.id);
      expect(ended?.endedAt).not.toBeNull();
      expect(ended?.endStateCid).toBe('state-final');

      // Simulation shows no active contributors
      expect(pool.getSimulation(sim.id)?.activeContributors).toBe(0);

      // Can't record to ended contribution
      expect(pool.recordContribution(contrib!.id, 10, 10)).toBe(false);
    });

    it('should track multiple concurrent contributors', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const c1 = pool.startContribution(sim.id, 'provider-1', 'state-0');
      const c2 = pool.startContribution(sim.id, 'provider-2', 'state-0');
      const c3 = pool.startContribution(sim.id, 'provider-3', 'state-0');

      expect(pool.getSimulation(sim.id)?.activeContributors).toBe(3);

      pool.recordContribution(c1!.id, 100, 100);
      pool.recordContribution(c2!.id, 200, 200);
      pool.recordContribution(c3!.id, 50, 50);

      const contributions = pool.getContributionsBySimulation(sim.id);
      expect(contributions.length).toBe(3);
      expect(contributions.reduce((sum, c) => sum + c.computeUnits, 0)).toBe(350);
    });

    it('should get contributions by provider', () => {
      const sim1 = pool.activateSimulation('Sim1', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });
      const sim2 = pool.activateSimulation('Sim2', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const c1 = pool.startContribution(sim1.id, 'provider-1', 'state-0');
      const c2 = pool.startContribution(sim2.id, 'provider-1', 'state-0');

      pool.recordContribution(c1!.id, 100, 100);
      pool.recordContribution(c2!.id, 150, 150);

      const contributions = pool.getContributionsByProvider('provider-1');
      expect(contributions.length).toBe(2);
      expect(contributions.reduce((sum, c) => sum + c.computeUnits, 0)).toBe(250);
    });
  });

  describe('Reward Distribution', () => {
    it('should distribute rewards proportionally', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1, // 0.1 Ω per compute unit
      });

      // Track minted rewards
      const minted: Array<{ amount: number; to: string }> = [];
      pool.setMintCallback((amount, to) => {
        minted.push({ amount, to });
        return 'unit-' + minted.length;
      });

      // Two providers contribute
      const c1 = pool.startContribution(sim.id, 'provider-1', 'state-0');
      const c2 = pool.startContribution(sim.id, 'provider-2', 'state-0');

      pool.recordContribution(c1!.id, 100, 100); // Should earn 10 Ω
      pool.recordContribution(c2!.id, 200, 200); // Should earn 20 Ω

      pool.endContribution(c1!.id);
      pool.endContribution(c2!.id);

      const result = pool.distributeRewards(sim.id);

      expect(result.contributionsRewarded).toBe(2);
      expect(result.totalDistributed).toBe(30); // 10 + 20 Ω
      expect(result.rewards.length).toBe(2);

      // Check individual rewards
      const r1 = result.rewards.find((r) => r.providerId === 'provider-1');
      const r2 = result.rewards.find((r) => r.providerId === 'provider-2');
      expect(r1?.amount).toBe(10);
      expect(r2?.amount).toBe(20);

      // Simulation funding reduced
      expect(pool.getSimulation(sim.id)?.fundingPool).toBe(970);
    });

    it('should cap rewards at available funding', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 15, // Limited funding
        rewardRate: 0.1,
      });

      pool.setMintCallback(() => 'minted-unit');

      // Contribute more than funding can support
      const c1 = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(c1!.id, 100, 100); // Would earn 10 Ω
      pool.endContribution(c1!.id);

      const c2 = pool.startContribution(sim.id, 'provider-2', 'state-0');
      pool.recordContribution(c2!.id, 100, 100); // Would earn 10 Ω
      pool.endContribution(c2!.id);

      const result = pool.distributeRewards(sim.id);

      // First provider gets full 10, second gets remaining 5
      expect(result.totalDistributed).toBe(15);
      expect(pool.getSimulation(sim.id)?.status).toBe(SimulationStatus.Depleted);
    });

    it('should not reward ongoing contributions', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      pool.setMintCallback(() => 'minted-unit');

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 100);
      // Don't end contribution

      const result = pool.distributeRewards(sim.id);
      expect(result.contributionsRewarded).toBe(0);
    });

    it('should not double-reward contributions', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      pool.setMintCallback(() => 'minted-unit');

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 100);
      pool.endContribution(contrib!.id);

      pool.distributeRewards(sim.id);
      const result2 = pool.distributeRewards(sim.id);

      expect(result2.contributionsRewarded).toBe(0);
      expect(pool.getContribution(contrib!.id)?.rewarded).toBe(true);
    });

    it('should include purpose and locality in minted rewards', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
        purpose: 'climate-research',
        locality: 'science-community',
      });

      let mintedPurpose: string | undefined;
      let mintedLocality: string | undefined;
      pool.setMintCallback((_amount, _to, purpose, locality) => {
        mintedPurpose = purpose;
        mintedLocality = locality;
        return 'minted-unit';
      });

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 100);
      pool.endContribution(contrib!.id);

      pool.distributeRewards(sim.id);

      expect(mintedPurpose).toBe('climate-research');
      expect(mintedLocality).toBe('science-community');
    });
  });

  describe('Provider Summary', () => {
    it('should summarize provider contributions', () => {
      const sim1 = pool.activateSimulation('Sim1', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });
      const sim2 = pool.activateSimulation('Sim2', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.2,
      });

      pool.setMintCallback(() => 'minted-unit');

      // Provider contributes to both simulations
      const c1 = pool.startContribution(sim1.id, 'provider-1', 'state-0');
      const c2 = pool.startContribution(sim2.id, 'provider-1', 'state-0');

      pool.recordContribution(c1!.id, 100, 100);
      pool.recordContribution(c2!.id, 50, 50);

      pool.endContribution(c1!.id);
      pool.endContribution(c2!.id);

      pool.distributeRewards(sim1.id);
      pool.distributeRewards(sim2.id);

      const summary = pool.getProviderSummary('provider-1');
      expect(summary.totalComputeUnits).toBe(150);
      expect(summary.totalRewardsEarned).toBe(20); // 10 + 10
      expect(summary.simulationsContributed).toBe(2);
      expect(summary.activeContributions).toBe(0);
    });

    it('should track active contributions', () => {
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.startContribution(sim.id, 'provider-1', 'state-0');

      const summary = pool.getProviderSummary('provider-1');
      expect(summary.activeContributions).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should track pool statistics', () => {
      pool.setMintCallback(() => 'minted-unit');

      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const c1 = pool.startContribution(sim.id, 'provider-1', 'state-0');
      const c2 = pool.startContribution(sim.id, 'provider-2', 'state-0');

      pool.recordContribution(c1!.id, 100, 100);
      pool.recordContribution(c2!.id, 200, 200);

      const stats1 = pool.getStats();
      expect(stats1.activeSimulations).toBe(1);
      expect(stats1.activeProviders).toBe(2);
      expect(stats1.totalComputeContributed).toBe(300);
      expect(stats1.totalFundingDeposited).toBe(1000);

      pool.endContribution(c1!.id);
      pool.endContribution(c2!.id);
      pool.distributeRewards(sim.id);
      pool.completeSimulation(sim.id);

      const stats2 = pool.getStats();
      expect(stats2.completedSimulations).toBe(1);
      expect(stats2.activeSimulations).toBe(0);
      expect(stats2.totalRewardsDistributed).toBe(30);
    });
  });

  describe('Persistence', () => {
    it('should export and import state', () => {
      pool.setMintCallback(() => 'minted-unit');

      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
        purpose: 'research',
      });

      const contrib = pool.startContribution(sim.id, 'provider-1', 'state-0');
      pool.recordContribution(contrib!.id, 100, 100);

      const exported = pool.export();

      // Create new pool and import
      const newPool = createContributionPool(timeProvider);
      newPool.import(exported);

      // Verify state restored
      const restoredSim = newPool.getSimulation(sim.id);
      expect(restoredSim?.name).toBe('Test');
      expect(restoredSim?.fundingPool).toBe(1000);
      expect(restoredSim?.purpose).toBe('research');

      const restoredContrib = newPool.getContribution(contrib!.id);
      expect(restoredContrib?.computeUnits).toBe(100);
      expect(restoredContrib?.endedAt).toBeNull();

      expect(newPool.getStats().totalComputeContributed).toBe(100);
    });
  });
});

// =============================================================================
// ANONYMOUS COMPUTE BRIDGE TESTS
// =============================================================================

describe('AnonymousComputeBridge', () => {
  let pool: ContributionPool;
  let bridge: AnonymousComputeBridge;

  beforeEach(() => {
    pool = createContributionPool();
    bridge = createAnonymousComputeBridge(pool);
  });

  describe('Anonymous Attestations', () => {
    it('should submit anonymous attestation and get base reward', () => {
      const result = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      expect(result.attestation).toBeDefined();
      expect(result.attestation.id).toBeDefined();
      expect(result.attestation.providerId).toBe('provider-1');
      expect(result.reward).not.toBeNull();
      expect(result.reward!.type).toBe('base');
      expect(result.reward!.amount).toBeGreaterThan(0);
    });

    it('should handle fully anonymous attestation (no metadata)', () => {
      const result = bridge.submitAnonymousAttestation({
        providerId: 'provider-1',
        inputCid: 'QmInput',
        codeCid: 'QmCode',
        outputCid: 'QmOutput',
        computeUnits: 500,
        proofMethod: ProofMethod.SelfAttestation,
        proof: { method: ProofMethod.SelfAttestation },
        // No metadata - fully private
      });

      expect(result.attestation.metadata).toBeUndefined();
      expect(result.reward).not.toBeNull();
    });

    it('should retrieve attestation by ID', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const retrieved = bridge.getAttestation(attestation.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(attestation.id);
    });
  });

  describe('Value Attribution', () => {
    it('should attribute tip to attestation', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const result = bridge.attributeValue(
        attestation.id,
        'tipper-1',
        'tip',
        5.0,
        'Great work!'
      );

      expect(result.attribution).not.toBeNull();
      expect(result.attribution!.amount).toBe(5.0);
      expect(result.reward).not.toBeNull();
      expect(result.reward!.type).toBe('value');
      expect(result.reward!.amount).toBe(5.0);
    });

    it('should attribute boost to attestation', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const result = bridge.attributeValue(attestation.id, 'booster-1', 'boost', 10.0);

      expect(result.attribution).not.toBeNull();
      expect(result.reward!.amount).toBe(10.0);
    });

    it('should attribute citation to attestation', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const result = bridge.attributeValue(
        attestation.id,
        'researcher-1',
        'citation',
        2.0,
        'Used in paper'
      );

      expect(result.attribution).not.toBeNull();
    });

    it('should return null for unknown attestation', () => {
      const result = bridge.attributeValue('unknown-id', 'tipper', 'tip', 5.0);

      expect(result.attribution).toBeNull();
      expect(result.reward).toBeNull();
    });
  });

  describe('Bound Attestations', () => {
    it('should submit attestation bound to simulation', () => {
      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const result = bridge.submitBoundAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000),
        sim.id
      );

      expect(result.attestation).toBeDefined();
      expect(result.contribution).not.toBeNull();
      expect(result.contribution!.simulationId).toBe(sim.id);
      expect(result.contribution!.computeUnits).toBe(1000);
      expect(result.reward).not.toBeNull();
    });

    it('should return null contribution for non-existent simulation', () => {
      const result = bridge.submitBoundAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000),
        'non-existent-sim'
      );

      expect(result.attestation).toBeDefined(); // Attestation still registered
      expect(result.contribution).toBeNull(); // But not linked to simulation
    });

    it('should get linked contribution', () => {
      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const { attestation, contribution } = bridge.submitBoundAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000),
        sim.id
      );

      const linkedContribution = bridge.getLinkedContribution(attestation.id);
      expect(linkedContribution).toBeDefined();
      expect(linkedContribution!.id).toBe(contribution!.id);
    });

    it('should get linked attestation from contribution', () => {
      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const { attestation, contribution } = bridge.submitBoundAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000),
        sim.id
      );

      const linkedAttestation = bridge.getLinkedAttestation(contribution!.id);
      expect(linkedAttestation).toBeDefined();
      expect(linkedAttestation!.id).toBe(attestation.id);
    });
  });

  describe('Retroactive Binding', () => {
    it('should bind anonymous attestation to simulation retroactively', () => {
      // First submit anonymous
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      // Later, discover it's useful for a simulation
      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const contribution = bridge.bindToSimulation(attestation.id, sim.id);

      expect(contribution).not.toBeNull();
      expect(contribution!.simulationId).toBe(sim.id);
      expect(contribution!.computeUnits).toBe(1000);
    });

    it('should prevent double binding', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const first = bridge.bindToSimulation(attestation.id, sim.id);
      const second = bridge.bindToSimulation(attestation.id, sim.id);

      expect(first).not.toBeNull();
      expect(second).toBeNull(); // Already bound
    });

    it('should return null for unknown attestation', () => {
      const sim = pool.activateSimulation('Test Sim', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });

      const result = bridge.bindToSimulation('unknown-id', sim.id);
      expect(result).toBeNull();
    });
  });

  describe('Provider Statistics', () => {
    it('should track provider statistics', () => {
      // Submit some anonymous attestations
      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 500)
      );
      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i2', 'c2', 'o2', 500)
      );

      // Submit bound attestation
      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });
      bridge.submitBoundAttestation(
        createAnonymousAttestation('provider-1', 'i3', 'c3', 'o3', 1000),
        sim.id
      );

      const stats = bridge.getProviderStats('provider-1');

      expect(stats.attestations).toBe(3);
      expect(stats.boundAttestations).toBe(1);
      expect(stats.totalBaseRewards).toBeGreaterThan(0);
    });

    it('should track value rewards', () => {
      const { attestation } = bridge.submitAnonymousAttestation(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      bridge.attributeValue(attestation.id, 'tipper', 'tip', 5.0);
      bridge.attributeValue(attestation.id, 'booster', 'boost', 10.0);

      const stats = bridge.getProviderStats('provider-1');

      expect(stats.totalValueRewards).toBe(15.0);
      expect(stats.totalValue).toBe(stats.totalBaseRewards + stats.totalValueRewards);
    });
  });

  describe('Bridge Statistics', () => {
    it('should track overall statistics', () => {
      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 500)
      );
      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('p2', 'i2', 'c2', 'o2', 500)
      );

      const sim = pool.activateSimulation('Test', 'desc', 'law', 'container', {
        initialFunding: 1000,
        rewardRate: 0.1,
      });
      bridge.submitBoundAttestation(
        createAnonymousAttestation('p1', 'i3', 'c3', 'o3', 1000),
        sim.id
      );

      const stats = bridge.getStats();

      expect(stats.totalAttestations).toBe(3);
      expect(stats.boundAttestations).toBe(1);
      expect(stats.unboundAttestations).toBe(2);
      expect(stats.uniqueProviders).toBe(2);
      expect(stats.totalBaseRewards).toBeGreaterThan(0);
    });
  });

  describe('Registry and Manager Access', () => {
    it('should provide access to registry', () => {
      const registry = bridge.getRegistry();
      expect(registry).toBeDefined();

      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 1000)
      );

      const stats = registry.getStats();
      expect(stats.totalAttestations).toBe(1);
    });

    it('should provide access to reward manager', () => {
      const rewardManager = bridge.getRewardManager();
      expect(rewardManager).toBeDefined();

      bridge.submitAnonymousAttestation(
        createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 1000)
      );

      const stats = rewardManager.getStats();
      expect(stats.attestationsRewarded).toBe(1);
    });
  });
});
