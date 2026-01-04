import { describe, it, expect, beforeEach } from 'vitest';
import {
  ComputeRewardManager,
  DEFAULT_REWARD_RATES,
  createComputeRewardManager,
} from './compute-rewards.js';
import {
  ComputeRegistry,
  ProofMethod,
  ValueType,
  createAnonymousAttestation,
  createRedundantAttestation,
} from './deterministic-compute.js';

describe('Compute Rewards', () => {
  let registry: ComputeRegistry;
  let rewardManager: ComputeRewardManager;

  beforeEach(() => {
    registry = new ComputeRegistry();
    rewardManager = new ComputeRewardManager(registry);
  });

  describe('calculateBaseReward', () => {
    it('should calculate base reward for self-attestation', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const reward = rewardManager.calculateBaseReward(attestation);

      // Base: 1000 units × 0.001 = 1.0Ω
      // Self-attestation multiplier: 1.0
      // First compute bonus: 0.1 (10%)
      // Final multiplier: 1.0 + 0.1 = 1.1
      // Total: 1.0 × 1.1 = 1.1Ω
      expect(reward.amount).toBeCloseTo(1.1);
      expect(reward.breakdown.baseAmount).toBeCloseTo(1.0);
      expect(reward.breakdown.proofMultiplier).toBe(1.0);
      expect(reward.breakdown.firstComputeBonus).toBe(0.1);
    });

    it('should not apply first compute bonus for subsequent computes', () => {
      // First attestation for this input+code pair
      registry.register(
        createAnonymousAttestation('provider-1', 'QmInput', 'QmCode', 'QmOutput', 1000)
      );

      // Second attestation for same input+code
      const second = registry.register(
        createAnonymousAttestation('provider-2', 'QmInput', 'QmCode', 'QmOutput', 1000)
      );

      const reward = rewardManager.calculateBaseReward(second);

      expect(reward.breakdown.firstComputeBonus).toBe(0);
      // No first compute bonus
      expect(reward.amount).toBeCloseTo(1.0);
    });

    it('should apply TEE multiplier', () => {
      const attestation = registry.register({
        providerId: 'provider-1',
        inputCid: 'i1',
        codeCid: 'c1',
        outputCid: 'o1',
        computeUnits: 1000,
        proofMethod: ProofMethod.TEE,
        proof: {
          method: ProofMethod.TEE,
          teeReport: {
            platform: 'sgx',
            report: 'report-data',
            measurements: {},
          },
        },
      });

      const reward = rewardManager.calculateBaseReward(attestation);

      // TEE multiplier: 2.0
      // First compute bonus: 0.1
      // Final: 2.1
      expect(reward.breakdown.proofMultiplier).toBe(2.0);
      expect(reward.amount).toBeCloseTo(2.1);
    });

    it('should apply ZK proof multiplier', () => {
      const attestation = registry.register({
        providerId: 'provider-1',
        inputCid: 'i1',
        codeCid: 'c1',
        outputCid: 'o1',
        computeUnits: 1000,
        proofMethod: ProofMethod.ZKProof,
        proof: {
          method: ProofMethod.ZKProof,
          zkProof: {
            system: 'groth16',
            proof: 'proof-data',
            publicInputs: [],
            verificationKeyCid: 'QmKey',
          },
        },
      });

      const reward = rewardManager.calculateBaseReward(attestation);

      // ZK multiplier: 2.5
      expect(reward.breakdown.proofMultiplier).toBe(2.5);
    });

    it('should apply redundancy bonus', () => {
      const attestation = registry.register(
        createRedundantAttestation(
          'provider-1',
          'i1',
          'c1',
          'o1',
          1000,
          [
            { providerId: 'p2', signature: 'sig2' },
            { providerId: 'p3', signature: 'sig3' },
          ]
        )
      );

      const reward = rewardManager.calculateBaseReward(attestation);

      // Redundant multiplier: 1.5
      // Redundancy bonus: 0.05 × 2 = 0.1
      // First compute: 0.1
      // Final: 1.5 + 0.1 + 0.1 = 1.7
      expect(reward.breakdown.proofMultiplier).toBe(1.5);
      expect(reward.breakdown.redundancyBonus).toBeCloseTo(0.1);
      expect(reward.amount).toBeCloseTo(1.7);
    });

    it('should cap multiplier at maxMultiplier', () => {
      const attestation = registry.register(
        createRedundantAttestation(
          'provider-1',
          'i1',
          'c1',
          'o1',
          1000,
          // Add many redundant attestations to exceed max
          Array(100).fill({ providerId: 'p', signature: 's' })
        )
      );

      const reward = rewardManager.calculateBaseReward(attestation);

      // Should be capped at maxMultiplier (5.0)
      expect(reward.breakdown.finalMultiplier).toBe(5.0);
      expect(reward.amount).toBeCloseTo(5.0); // 1000 × 0.001 × 5.0
    });
  });

  describe('processBaseReward', () => {
    it('should process reward and return event', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const event = rewardManager.processBaseReward(attestation.id);

      expect(event).not.toBeNull();
      expect(event!.type).toBe('base');
      expect(event!.attestationId).toBe(attestation.id);
      expect(event!.providerId).toBe('provider-1');
      expect(event!.amount).toBeGreaterThan(0);
    });

    it('should prevent double rewards', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const first = rewardManager.processBaseReward(attestation.id);
      const second = rewardManager.processBaseReward(attestation.id);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it('should return null for unknown attestation', () => {
      const event = rewardManager.processBaseReward('unknown-id');
      expect(event).toBeNull();
    });
  });

  describe('processValueAttribution', () => {
    it('should process value attribution as reward', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const attribution = registry.attributeValue(
        attestation.id,
        'tipper-1',
        ValueType.Tip,
        5.0,
        'Great work!'
      );

      const event = rewardManager.processValueAttribution(attribution!.id);

      expect(event).not.toBeNull();
      expect(event!.type).toBe('value');
      expect(event!.amount).toBe(5.0);
      expect(event!.providerId).toBe('provider-1');
    });

    it('should prevent double processing of attributions', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const attribution = registry.attributeValue(
        attestation.id,
        'tipper-1',
        ValueType.Tip,
        5.0
      );

      const first = rewardManager.processValueAttribution(attribution!.id);
      const second = rewardManager.processValueAttribution(attribution!.id);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });
  });

  describe('batch processing', () => {
    it('should process all pending base rewards', () => {
      registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 100));
      registry.register(createAnonymousAttestation('p2', 'i2', 'c2', 'o2', 200));
      registry.register(createAnonymousAttestation('p3', 'i3', 'c3', 'o3', 300));

      const events = rewardManager.processAllPendingBaseRewards();

      expect(events).toHaveLength(3);
    });

    it('should process all pending value rewards', () => {
      const att = registry.register(
        createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 100)
      );
      registry.attributeValue(att.id, 't1', ValueType.Tip, 5.0);
      registry.attributeValue(att.id, 't2', ValueType.Boost, 10.0);

      const events = rewardManager.processAllPendingValueRewards();

      expect(events).toHaveLength(2);
    });
  });

  describe('getProviderRewards', () => {
    it('should aggregate rewards by provider', () => {
      const att1 = registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 1000));
      const att2 = registry.register(createAnonymousAttestation('p1', 'i2', 'c2', 'o2', 2000));

      registry.attributeValue(att1.id, 't1', ValueType.Tip, 5.0);
      registry.attributeValue(att2.id, 't2', ValueType.Tip, 10.0);

      rewardManager.processAllPendingBaseRewards();
      rewardManager.processAllPendingValueRewards();

      const rewards = rewardManager.getProviderRewards('p1');

      expect(rewards.events).toHaveLength(4); // 2 base + 2 value
      expect(rewards.baseRewards).toBeGreaterThan(0);
      expect(rewards.valueRewards).toBe(15.0);
      expect(rewards.total).toBe(rewards.baseRewards + rewards.valueRewards);
    });
  });

  describe('getStats', () => {
    it('should return reward statistics', () => {
      const att = registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 1000));
      registry.attributeValue(att.id, 't1', ValueType.Tip, 5.0);

      rewardManager.processAllPendingBaseRewards();
      rewardManager.processAllPendingValueRewards();

      const stats = rewardManager.getStats();

      expect(stats.attestationsRewarded).toBe(1);
      expect(stats.attributionsProcessed).toBe(1);
      expect(stats.totalBaseRewards).toBeGreaterThan(0);
      expect(stats.totalValueRewards).toBe(5.0);
      expect(stats.totalRewardsDistributed).toBe(stats.totalBaseRewards + stats.totalValueRewards);
    });
  });

  describe('rate configuration', () => {
    it('should use custom rates', () => {
      const customRates = {
        ...DEFAULT_REWARD_RATES,
        baseRatePerUnit: 0.01, // 10x higher
      };

      const customManager = createComputeRewardManager(registry, customRates);

      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const reward = customManager.calculateBaseReward(attestation);

      // 1000 × 0.01 = 10.0 base
      expect(reward.breakdown.baseAmount).toBeCloseTo(10.0);
    });

    it('should allow updating rates', () => {
      const attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 1000)
      );

      const before = rewardManager.calculateBaseReward(attestation);

      rewardManager.setRates({ baseRatePerUnit: 0.01 });

      const after = rewardManager.calculateBaseReward(attestation);

      expect(after.breakdown.baseAmount).toBe(10 * before.breakdown.baseAmount);
    });

    it('should get current rates', () => {
      const rates = rewardManager.getRates();

      expect(rates.baseRatePerUnit).toBe(DEFAULT_REWARD_RATES.baseRatePerUnit);
      expect(rates.proofMultipliers[ProofMethod.ZKProof]).toBe(2.5);
    });
  });

  describe('getAllEvents', () => {
    it('should return all reward events for auditing', () => {
      const att = registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 1000));
      registry.attributeValue(att.id, 't1', ValueType.Tip, 5.0);

      rewardManager.processAllPendingBaseRewards();
      rewardManager.processAllPendingValueRewards();

      const events = rewardManager.getAllEvents();

      expect(events).toHaveLength(2);
      expect(events.map(e => e.type)).toContain('base');
      expect(events.map(e => e.type)).toContain('value');
    });
  });
});
