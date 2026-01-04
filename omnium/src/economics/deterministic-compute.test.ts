import { describe, it, expect, beforeEach } from 'vitest';
import {
  ComputeRegistry,
  ProofMethod,
  ValueType,
  createSelfAttestation,
  createAnonymousAttestation,
  createRedundantAttestation,
} from './deterministic-compute.js';

describe('Deterministic Compute', () => {
  describe('ComputeRegistry', () => {
    let registry: ComputeRegistry;

    beforeEach(() => {
      registry = new ComputeRegistry();
    });

    describe('register', () => {
      it('should register a basic attestation', () => {
        const att = registry.register({
          providerId: 'provider-1',
          inputCid: 'QmInput123',
          codeCid: 'QmCode456',
          outputCid: 'QmOutput789',
          computeUnits: 100,
          proofMethod: ProofMethod.SelfAttestation,
          proof: { method: ProofMethod.SelfAttestation },
        });

        expect(att.id).toBeDefined();
        expect(att.timestamp).toBeGreaterThan(0);
        expect(att.providerId).toBe('provider-1');
        expect(att.computeUnits).toBe(100);
      });

      it('should register anonymous attestation (no metadata)', () => {
        const att = registry.register(
          createAnonymousAttestation(
            'provider-1',
            'QmInput',
            'QmCode',
            'QmOutput',
            50
          )
        );

        expect(att.metadata).toBeUndefined();
        expect(att.providerId).toBe('provider-1');
      });

      it('should register attestation with metadata', () => {
        const att = registry.register(
          createSelfAttestation(
            'provider-1',
            'QmInput',
            'QmCode',
            'QmOutput',
            50,
            {
              description: 'Climate simulation',
              tags: ['climate', 'simulation'],
              domain: 'research',
            }
          )
        );

        expect(att.metadata?.description).toBe('Climate simulation');
        expect(att.metadata?.tags).toContain('climate');
      });
    });

    describe('findByProvider', () => {
      it('should find all attestations by a provider', () => {
        registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 10));
        registry.register(createAnonymousAttestation('p1', 'i2', 'c2', 'o2', 20));
        registry.register(createAnonymousAttestation('p2', 'i3', 'c3', 'o3', 30));

        const p1Attestations = registry.findByProvider('p1');
        const p2Attestations = registry.findByProvider('p2');

        expect(p1Attestations).toHaveLength(2);
        expect(p2Attestations).toHaveLength(1);
      });

      it('should return empty for unknown provider', () => {
        const attestations = registry.findByProvider('unknown');
        expect(attestations).toHaveLength(0);
      });
    });

    describe('findByInput/Code/Output', () => {
      it('should find attestations by input CID', () => {
        registry.register(createAnonymousAttestation('p1', 'QmInput', 'c1', 'o1', 10));
        registry.register(createAnonymousAttestation('p2', 'QmInput', 'c2', 'o2', 20));

        const attestations = registry.findByInput('QmInput');
        expect(attestations).toHaveLength(2);
      });

      it('should find attestations by code CID', () => {
        registry.register(createAnonymousAttestation('p1', 'i1', 'QmCode', 'o1', 10));
        registry.register(createAnonymousAttestation('p2', 'i2', 'QmCode', 'o2', 20));

        const attestations = registry.findByCode('QmCode');
        expect(attestations).toHaveLength(2);
      });

      it('should find attestations by output CID', () => {
        registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'QmOutput', 10));

        const attestations = registry.findByOutput('QmOutput');
        expect(attestations).toHaveLength(1);
      });
    });

    describe('findByTag', () => {
      it('should find attestations by tag', () => {
        registry.register(
          createSelfAttestation('p1', 'i1', 'c1', 'o1', 10, { tags: ['climate', 'simulation'] })
        );
        registry.register(
          createSelfAttestation('p2', 'i2', 'c2', 'o2', 20, { tags: ['climate', 'prediction'] })
        );
        registry.register(
          createSelfAttestation('p3', 'i3', 'c3', 'o3', 30, { tags: ['finance'] })
        );

        const climate = registry.findByTag('climate');
        const finance = registry.findByTag('finance');
        const simulation = registry.findByTag('simulation');

        expect(climate).toHaveLength(2);
        expect(finance).toHaveLength(1);
        expect(simulation).toHaveLength(1);
      });

      it('should be case-insensitive', () => {
        registry.register(
          createSelfAttestation('p1', 'i1', 'c1', 'o1', 10, { tags: ['Climate'] })
        );

        const attestations = registry.findByTag('CLIMATE');
        expect(attestations).toHaveLength(1);
      });
    });

    describe('verifyDeterminism', () => {
      it('should verify determinism when outputs match', () => {
        // Same input + code = same output (deterministic)
        registry.register(createAnonymousAttestation('p1', 'QmInput', 'QmCode', 'QmOutput', 10));
        registry.register(createAnonymousAttestation('p2', 'QmInput', 'QmCode', 'QmOutput', 10));

        const result = registry.verifyDeterminism('QmInput', 'QmCode');

        expect(result.deterministic).toBe(true);
        expect(result.outputCid).toBe('QmOutput');
        expect(result.attestationCount).toBe(2);
        expect(result.providers).toContain('p1');
        expect(result.providers).toContain('p2');
      });

      it('should detect non-determinism when outputs differ', () => {
        // Same input + code but different outputs (non-deterministic!)
        registry.register(createAnonymousAttestation('p1', 'QmInput', 'QmCode', 'QmOutput1', 10));
        registry.register(createAnonymousAttestation('p2', 'QmInput', 'QmCode', 'QmOutput2', 10));

        const result = registry.verifyDeterminism('QmInput', 'QmCode');

        expect(result.deterministic).toBe(false);
        expect(result.outputCid).toBeUndefined();
        expect(result.attestationCount).toBe(2);
      });

      it('should return deterministic for novel computations', () => {
        // No previous computations - trivially deterministic
        const result = registry.verifyDeterminism('QmNewInput', 'QmNewCode');

        expect(result.deterministic).toBe(true);
        expect(result.attestationCount).toBe(0);
      });
    });
  });

  describe('Value Attribution', () => {
    let registry: ComputeRegistry;
    let attestation: ReturnType<typeof registry.register>;

    beforeEach(() => {
      registry = new ComputeRegistry();
      attestation = registry.register(
        createAnonymousAttestation('provider-1', 'i1', 'c1', 'o1', 100)
      );
    });

    describe('attributeValue', () => {
      it('should attribute a tip to an attestation', () => {
        const attr = registry.attributeValue(
          attestation.id,
          'tipper-1',
          ValueType.Tip,
          5.0,
          'Great work!'
        );

        expect(attr).not.toBeNull();
        expect(attr!.attestationId).toBe(attestation.id);
        expect(attr!.attributorId).toBe('tipper-1');
        expect(attr!.type).toBe(ValueType.Tip);
        expect(attr!.amount).toBe(5.0);
        expect(attr!.note).toBe('Great work!');
      });

      it('should attribute boosts', () => {
        const attr = registry.attributeValue(
          attestation.id,
          'booster-1',
          ValueType.Boost,
          10.0
        );

        expect(attr!.type).toBe(ValueType.Boost);
        expect(attr!.amount).toBe(10.0);
      });

      it('should attribute citations', () => {
        const attr = registry.attributeValue(
          attestation.id,
          'researcher-1',
          ValueType.Citation,
          2.0,
          'Used in paper doi:10.1234/xyz'
        );

        expect(attr!.type).toBe(ValueType.Citation);
        expect(attr!.note).toContain('paper');
      });

      it('should return null for unknown attestation', () => {
        const attr = registry.attributeValue(
          'unknown-id',
          'tipper-1',
          ValueType.Tip,
          5.0
        );

        expect(attr).toBeNull();
      });
    });

    describe('getAttributions', () => {
      it('should get all attributions for an attestation', () => {
        registry.attributeValue(attestation.id, 't1', ValueType.Tip, 5.0);
        registry.attributeValue(attestation.id, 't2', ValueType.Tip, 3.0);
        registry.attributeValue(attestation.id, 'b1', ValueType.Boost, 10.0);

        const attributions = registry.getAttributions(attestation.id);

        expect(attributions).toHaveLength(3);
      });

      it('should return empty for attestation with no attributions', () => {
        const attributions = registry.getAttributions(attestation.id);
        expect(attributions).toHaveLength(0);
      });
    });

    describe('getAttestationValue', () => {
      it('should aggregate value by type', () => {
        registry.attributeValue(attestation.id, 't1', ValueType.Tip, 5.0);
        registry.attributeValue(attestation.id, 't2', ValueType.Tip, 3.0);
        registry.attributeValue(attestation.id, 'b1', ValueType.Boost, 10.0);
        registry.attributeValue(attestation.id, 'c1', ValueType.Citation, 2.0);

        const value = registry.getAttestationValue(attestation.id);

        expect(value.totalValue).toBe(20.0);
        expect(value.attributionCount).toBe(4);
        expect(value.byType[ValueType.Tip]).toBe(8.0);
        expect(value.byType[ValueType.Boost]).toBe(10.0);
        expect(value.byType[ValueType.Citation]).toBe(2.0);
      });

      it('should track first and last attribution times', () => {
        registry.attributeValue(attestation.id, 't1', ValueType.Tip, 5.0);
        registry.attributeValue(attestation.id, 't2', ValueType.Tip, 3.0);

        const value = registry.getAttestationValue(attestation.id);

        expect(value.firstAttribution).toBeDefined();
        expect(value.lastAttribution).toBeDefined();
        expect(value.firstAttribution).toBeLessThanOrEqual(value.lastAttribution!);
      });
    });

    describe('getProviderValue', () => {
      it('should aggregate value across all provider attestations', () => {
        const att2 = registry.register(
          createAnonymousAttestation('provider-1', 'i2', 'c2', 'o2', 50)
        );

        registry.attributeValue(attestation.id, 't1', ValueType.Tip, 5.0);
        registry.attributeValue(att2.id, 't2', ValueType.Tip, 10.0);

        const providerValue = registry.getProviderValue('provider-1');

        expect(providerValue.totalValue).toBe(15.0);
        expect(providerValue.attestationCount).toBe(2);
        expect(providerValue.topAttestations).toHaveLength(2);
        // Top attestation should be the one with more value
        expect(providerValue.topAttestations[0].value).toBe(10.0);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('createSelfAttestation', () => {
      it('should create a self-attested attestation', () => {
        const att = createSelfAttestation(
          'provider-1',
          'QmInput',
          'QmCode',
          'QmOutput',
          100,
          { description: 'Test' }
        );

        expect(att.proofMethod).toBe(ProofMethod.SelfAttestation);
        expect(att.proof.method).toBe(ProofMethod.SelfAttestation);
        expect(att.metadata?.description).toBe('Test');
      });
    });

    describe('createAnonymousAttestation', () => {
      it('should create attestation with no metadata', () => {
        const att = createAnonymousAttestation(
          'provider-1',
          'QmInput',
          'QmCode',
          'QmOutput',
          100
        );

        expect(att.proofMethod).toBe(ProofMethod.SelfAttestation);
        expect(att.metadata).toBeUndefined();
      });
    });

    describe('createRedundantAttestation', () => {
      it('should create redundantly-verified attestation', () => {
        const att = createRedundantAttestation(
          'provider-1',
          'QmInput',
          'QmCode',
          'QmOutput',
          100,
          [
            { providerId: 'provider-2', signature: 'sig-2' },
            { providerId: 'provider-3', signature: 'sig-3' },
          ]
        );

        expect(att.proofMethod).toBe(ProofMethod.Redundant);
        expect(att.proof.redundantAttestations).toHaveLength(2);
        expect(att.proof.redundantAttestations![0].providerId).toBe('provider-2');
      });
    });
  });

  describe('Statistics', () => {
    let registry: ComputeRegistry;

    beforeEach(() => {
      registry = new ComputeRegistry();
    });

    it('should track statistics', () => {
      registry.register(createAnonymousAttestation('p1', 'i1', 'c1', 'o1', 100));
      registry.register(createAnonymousAttestation('p1', 'i2', 'c2', 'o2', 200));
      registry.register(createAnonymousAttestation('p2', 'i3', 'c3', 'o3', 150));

      registry.register(
        createRedundantAttestation('p3', 'i4', 'c4', 'o4', 50, [
          { providerId: 'p4', signature: 'sig' },
        ])
      );

      const att1 = registry.findByProvider('p1')[0];
      registry.attributeValue(att1.id, 't1', ValueType.Tip, 10.0);

      const stats = registry.getStats();

      expect(stats.totalAttestations).toBe(4);
      expect(stats.totalProviders).toBe(3);
      expect(stats.totalComputeUnits).toBe(500);
      expect(stats.totalValueAttributed).toBe(10.0);
      expect(stats.byProofMethod[ProofMethod.SelfAttestation]).toBe(3);
      expect(stats.byProofMethod[ProofMethod.Redundant]).toBe(1);
    });

    it('should track top tags', () => {
      registry.register(
        createSelfAttestation('p1', 'i1', 'c1', 'o1', 10, { tags: ['climate', 'prediction'] })
      );
      registry.register(
        createSelfAttestation('p2', 'i2', 'c2', 'o2', 10, { tags: ['climate', 'simulation'] })
      );
      registry.register(
        createSelfAttestation('p3', 'i3', 'c3', 'o3', 10, { tags: ['finance'] })
      );

      const stats = registry.getStats();

      expect(stats.topTags[0].tag).toBe('climate');
      expect(stats.topTags[0].count).toBe(2);
    });
  });

  describe('Export/Import', () => {
    it('should export and import state', () => {
      const registry1 = new ComputeRegistry();

      const att = registry1.register(
        createSelfAttestation('p1', 'i1', 'c1', 'o1', 100, { tags: ['test'] })
      );
      registry1.attributeValue(att.id, 't1', ValueType.Tip, 5.0);

      const exported = registry1.export();

      const registry2 = new ComputeRegistry();
      registry2.import(exported);

      // Verify import worked
      const importedAtt = registry2.get(att.id);
      expect(importedAtt).toBeDefined();
      expect(importedAtt!.providerId).toBe('p1');

      const attributions = registry2.getAttributions(att.id);
      expect(attributions).toHaveLength(1);
      expect(attributions[0].amount).toBe(5.0);

      const byTag = registry2.findByTag('test');
      expect(byTag).toHaveLength(1);
    });
  });
});
