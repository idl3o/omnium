/**
 * Simulation Framework Tests
 *
 * Tests for the verified emergence system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimulationRegistry,
  createSimulationRegistry,
  createPhysicsLawSet,
  createEconomicsLawSet,
  createWasmContainer,
  verifyReproducibilityProof,
  LawDomain,
  RuntimeType,
  EmergenceType,
  ReproducibilityMethod,
  ReproducibilityProof,
  EmergentProperty,
  SimulationState,
} from './simulation.js';

describe('SimulationRegistry', () => {
  let registry: SimulationRegistry;

  beforeEach(() => {
    registry = createSimulationRegistry();
  });

  // ===========================================================================
  // LAW SET REGISTRATION
  // ===========================================================================
  describe('law set registration', () => {
    it('registers a law set', () => {
      const lawSet = registry.registerLawSet(
        createPhysicsLawSet('Newtonian Mechanics', 'bafyNewton123')
      );

      expect(lawSet.id).toBeDefined();
      expect(lawSet.name).toBe('Newtonian Mechanics');
      expect(lawSet.domain).toBe(LawDomain.Physics);
      expect(lawSet.rulesCid).toBe('bafyNewton123');
      expect(lawSet.registeredAt).toBeGreaterThan(0);
    });

    it('retrieves law set by ID', () => {
      const lawSet = registry.registerLawSet(
        createPhysicsLawSet('Thermodynamics', 'bafyThermo456')
      );

      const retrieved = registry.getLawSet(lawSet.id);
      expect(retrieved).toEqual(lawSet);
    });

    it('retrieves law set by CID', () => {
      const lawSet = registry.registerLawSet(
        createPhysicsLawSet('Quantum', 'bafyQuantum789')
      );

      const retrieved = registry.getLawSetByCid('bafyQuantum789');
      expect(retrieved).toEqual(lawSet);
    });

    it('filters by domain', () => {
      registry.registerLawSet(createPhysicsLawSet('Physics1', 'bafyP1'));
      registry.registerLawSet(createPhysicsLawSet('Physics2', 'bafyP2'));
      registry.registerLawSet(createEconomicsLawSet('Econ1', 'bafyE1'));

      const physics = registry.getLawSetsByDomain(LawDomain.Physics);
      expect(physics.length).toBe(2);

      const econ = registry.getLawSetsByDomain(LawDomain.Economics);
      expect(econ.length).toBe(1);
    });

    it('includes invariants', () => {
      const lawSet = registry.registerLawSet(
        createPhysicsLawSet('Conservation Laws', 'bafyConserve', {
          invariants: ['energy-conservation', 'momentum-conservation', 'angular-momentum'],
        })
      );

      expect(lawSet.invariants).toContain('energy-conservation');
      expect(lawSet.invariants).toContain('momentum-conservation');
    });
  });

  // ===========================================================================
  // CONTAINER REGISTRATION
  // ===========================================================================
  describe('container registration', () => {
    it('registers a WASM container', () => {
      const container = registry.registerContainer(
        createWasmContainer('bafyWasm123')
      );

      expect(container.id).toBeDefined();
      expect(container.runtime).toBe(RuntimeType.WASM);
      expect(container.imageCid).toBe('bafyWasm123');
    });

    it('sets determinism properties', () => {
      const container = registry.registerContainer(
        createWasmContainer('bafyDeterministic')
      );

      expect(container.determinismProperties.networkIsolated).toBe(true);
      expect(container.determinismProperties.filesystemIsolated).toBe(true);
      expect(container.determinismProperties.deterministicRandom).toBe(true);
      expect(container.determinismProperties.fixedClock).toBe(true);
    });

    it('sets resource limits', () => {
      const container = registry.registerContainer(
        createWasmContainer('bafyLimited', {
          maxMemory: 512 * 1024 * 1024,
          maxCpuTime: 60000,
        })
      );

      expect(container.limits.maxMemory).toBe(512 * 1024 * 1024);
      expect(container.limits.maxCpuTime).toBe(60000);
    });

    it('retrieves by ID and CID', () => {
      const container = registry.registerContainer(
        createWasmContainer('bafyContainer456')
      );

      expect(registry.getContainer(container.id)).toEqual(container);
      expect(registry.getContainerByCid('bafyContainer456')).toEqual(container);
    });

    it('filters by runtime', () => {
      registry.registerContainer(createWasmContainer('bafyW1'));
      registry.registerContainer(createWasmContainer('bafyW2'));
      registry.registerContainer({
        runtime: RuntimeType.Docker,
        runtimeVersion: 'docker-24.0',
        imageCid: 'sha256:abc123',
        limits: { maxMemory: 1e9, maxCpuTime: 3600000, maxStorage: 1e8 },
        determinismProperties: {
          networkIsolated: true,
          filesystemIsolated: true,
          deterministicRandom: false,
          fixedClock: false,
        },
      });

      const wasm = registry.getContainersByRuntime(RuntimeType.WASM);
      expect(wasm.length).toBe(2);

      const docker = registry.getContainersByRuntime(RuntimeType.Docker);
      expect(docker.length).toBe(1);
    });
  });

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================
  describe('persistence', () => {
    it('exports and imports state', () => {
      registry.registerLawSet(createPhysicsLawSet('Physics', 'bafyP'));
      registry.registerLawSet(createEconomicsLawSet('Econ', 'bafyE'));
      registry.registerContainer(createWasmContainer('bafyC'));

      const exported = registry.export();

      const registry2 = createSimulationRegistry();
      registry2.import(exported);

      expect(registry2.getLawSetByCid('bafyP')).toBeDefined();
      expect(registry2.getLawSetByCid('bafyE')).toBeDefined();
      expect(registry2.getContainerByCid('bafyC')).toBeDefined();
    });
  });
});

// =============================================================================
// REPRODUCIBILITY PROOF VERIFICATION
// =============================================================================
describe('verifyReproducibilityProof', () => {
  const createValidRecipe = () => ({
    lawSetCid: 'bafyLaws123',
    containerCid: 'bafyContainer123',
    initialStateCid: 'bafyInitial123',
    finalStateCid: 'bafyFinal123',
    stepsExecuted: 1000,
  });

  const createAttestation = (providerId: string, finalStateCid: string) => ({
    providerId,
    signature: `sig-${providerId}`,
    executedAt: Date.now(),
    computedFinalStateCid: finalStateCid,
  });

  describe('self-attestation', () => {
    it('accepts valid self-attestation', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.SelfAttestation,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [createAttestation('provider-1', 'bafyFinal123')],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(true);
    });

    it('rejects without attestation', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.SelfAttestation,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No attestations');
    });
  });

  describe('consensus execution', () => {
    it('accepts matching consensus', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.ConsensusExecution,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [
          createAttestation('provider-1', 'bafyFinal123'),
          createAttestation('provider-2', 'bafyFinal123'),
          createAttestation('provider-3', 'bafyFinal123'),
        ],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(true);
    });

    it('rejects with only one attestation', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.ConsensusExecution,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [createAttestation('provider-1', 'bafyFinal123')],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('at least 2');
    });

    it('rejects mismatched final states', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.ConsensusExecution,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [
          createAttestation('provider-1', 'bafyFinal123'),
          createAttestation('provider-2', 'bafyDifferent!'), // Mismatch!
        ],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('do not agree');
    });
  });

  describe('TEE attestation', () => {
    it('accepts valid TEE proof', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.TEEAttestation,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [],
        teeAttestation: {
          platform: 'sgx',
          report: 'base64-encoded-report',
          measurements: { mrenclave: 'abc123', mrsigner: 'def456' },
        },
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(true);
    });

    it('rejects missing TEE attestation', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.TEEAttestation,
        timestamp: Date.now(),
        reproductionRecipe: createValidRecipe(),
        attestations: [],
        // Missing teeAttestation!
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing TEE');
    });
  });

  describe('recipe validation', () => {
    it('rejects missing recipe', () => {
      const proof = {
        id: 'proof-1',
        method: ReproducibilityMethod.SelfAttestation,
        timestamp: Date.now(),
        attestations: [],
      } as unknown as ReproducibilityProof;

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing reproduction recipe');
    });

    it('rejects incomplete recipe', () => {
      const proof: ReproducibilityProof = {
        id: 'proof-1',
        method: ReproducibilityMethod.SelfAttestation,
        timestamp: Date.now(),
        reproductionRecipe: {
          lawSetCid: 'bafyLaws',
          // Missing containerCid and initialStateCid!
        } as any,
        attestations: [createAttestation('p1', 'final')],
      };

      const result = verifyReproducibilityProof(proof);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing required CIDs');
    });
  });
});

// =============================================================================
// EMERGENT PROPERTIES
// =============================================================================
describe('EmergentProperty', () => {
  it('represents a metric emergence', () => {
    const prop: EmergentProperty = {
      id: 'emerge-1',
      type: EmergenceType.Metric,
      name: 'Temperature Anomaly',
      description: 'Global mean temperature increase',
      value: 1.8,
      confidence: 0.95,
      observedAtStep: 10000,
      significance: {
        pValue: 0.001,
        sampleSize: 1000000,
        method: 'bootstrap',
      },
      lineage: {
        lawSetId: 'climate-physics',
        initialStateCid: 'bafyInitial',
        containerCid: 'bafyContainer',
      },
    };

    expect(prop.type).toBe(EmergenceType.Metric);
    expect(prop.value).toBe(1.8);
    expect(prop.confidence).toBe(0.95);
  });

  it('represents a pattern emergence', () => {
    const prop: EmergentProperty = {
      id: 'emerge-2',
      type: EmergenceType.Pattern,
      name: 'Market Bubble',
      description: 'Price deviation from fundamental value',
      value: { bubbleStart: 5000, bubblePeak: 7500, bubbleBurst: 8200 },
      confidence: 0.87,
      observedAtStep: 8200,
      lineage: {
        lawSetId: 'market-dynamics',
        initialStateCid: 'bafyMarketInit',
        containerCid: 'bafyEconSim',
      },
    };

    expect(prop.type).toBe(EmergenceType.Pattern);
    expect((prop.value as any).bubblePeak).toBe(7500);
  });

  it('represents a phase transition', () => {
    const prop: EmergentProperty = {
      id: 'emerge-3',
      type: EmergenceType.PhaseTransition,
      name: 'Cooperation Emergence',
      description: 'Transition from defection to cooperation equilibrium',
      value: {
        beforePhase: 'defection-dominated',
        afterPhase: 'cooperation-dominated',
        transitionPoint: 3500,
        orderParameter: 0.78,
      },
      confidence: 0.92,
      observedAtStep: 3500,
      lineage: {
        lawSetId: 'game-theory-iterated',
        initialStateCid: 'bafyGameInit',
        containerCid: 'bafyAgentSim',
      },
    };

    expect(prop.type).toBe(EmergenceType.PhaseTransition);
  });
});

// =============================================================================
// SIMULATION STATE
// =============================================================================
describe('SimulationState', () => {
  it('captures state at a point in time', () => {
    const state: SimulationState = {
      id: 'state-1',
      stateCid: 'bafyState123',
      timestamp: Date.now(),
      simulationId: 'sim-1',
      stepNumber: 5000,
      summary: {
        particleCount: 1000000,
        totalEnergy: 42.5,
        temperature: 300.15,
      },
      sizeBytes: 50 * 1024 * 1024, // 50MB
    };

    expect(state.stepNumber).toBe(5000);
    expect(state.summary.particleCount).toBe(1000000);
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
describe('helper functions', () => {
  describe('createPhysicsLawSet', () => {
    it('creates with defaults', () => {
      const spec = createPhysicsLawSet('Newton', 'bafyNewton');

      expect(spec.domain).toBe(LawDomain.Physics);
      expect(spec.version).toBe('1.0.0');
      expect(spec.invariants).toContain('energy-conservation');
    });

    it('accepts custom options', () => {
      const spec = createPhysicsLawSet('Custom', 'bafyCustom', {
        version: '2.0.0',
        description: 'My custom physics',
        invariants: ['custom-invariant'],
      });

      expect(spec.version).toBe('2.0.0');
      expect(spec.description).toBe('My custom physics');
      expect(spec.invariants).toContain('custom-invariant');
    });
  });

  describe('createEconomicsLawSet', () => {
    it('creates economic law set', () => {
      const spec = createEconomicsLawSet('Market', 'bafyMarket');

      expect(spec.domain).toBe(LawDomain.Economics);
      expect(spec.invariants).toContain('no-free-lunch');
    });
  });

  describe('createWasmContainer', () => {
    it('creates with defaults', () => {
      const spec = createWasmContainer('bafyWasm');

      expect(spec.runtime).toBe(RuntimeType.WASM);
      expect(spec.runtimeVersion).toBe('wasmtime-14.0.0');
      expect(spec.limits.maxMemory).toBe(1024 * 1024 * 1024);
    });

    it('accepts custom limits', () => {
      const spec = createWasmContainer('bafyWasm', {
        maxMemory: 2e9,
        maxCpuTime: 7200000,
      });

      expect(spec.limits.maxMemory).toBe(2e9);
      expect(spec.limits.maxCpuTime).toBe(7200000);
    });
  });
});

// =============================================================================
// INTEGRATION SCENARIO
// =============================================================================
describe('integration scenario', () => {
  it('full flow: register laws → run simulation → verify emergence', () => {
    const registry = createSimulationRegistry();

    // 1. Register climate physics laws
    const climateLaws = registry.registerLawSet({
      name: 'IPCC AR7 Climate Model',
      domain: LawDomain.Physics,
      version: '7.0.0',
      description: 'Coupled atmosphere-ocean general circulation model',
      rulesCid: 'bafyIPCC_AR7_v7.0.0',
      hashAlgorithm: 'sha256',
      invariants: [
        'energy-conservation',
        'mass-conservation',
        'radiative-balance',
      ],
    });

    // 2. Register WASM container
    const container = registry.registerContainer(
      createWasmContainer('bafyClimateSimWasm', {
        runtimeVersion: 'wasmtime-14.0.0',
        maxMemory: 4 * 1024 * 1024 * 1024, // 4GB
        maxCpuTime: 24 * 60 * 60 * 1000, // 24 hours
      })
    );

    // 3. Define initial state
    const initialState: SimulationState = {
      id: 'init-2024',
      stateCid: 'bafyClimate2024State',
      timestamp: Date.now(),
      simulationId: 'climate-2024-2100',
      stepNumber: 0,
      summary: {
        year: 2024,
        co2_ppm: 420,
        globalMeanTemp: 15.1,
      },
      sizeBytes: 100 * 1024 * 1024,
    };

    // 4. Simulate and observe emergence
    const emergentResult: EmergentProperty = {
      id: 'climate-prediction-2100',
      type: EmergenceType.Prediction,
      name: 'Global Temperature 2100',
      description: 'Projected global mean temperature anomaly for year 2100',
      value: {
        anomaly: 2.4,
        range: [1.8, 3.2],
        scenario: 'SSP2-4.5',
      },
      confidence: 0.9,
      observedAtStep: 76 * 365, // 76 years of daily steps
      significance: {
        sampleSize: 100, // ensemble runs
        method: 'ensemble-mean',
      },
      lineage: {
        lawSetId: climateLaws.id,
        initialStateCid: initialState.stateCid,
        containerCid: container.imageCid,
      },
    };

    // 5. Create reproducibility proof
    const proof: ReproducibilityProof = {
      id: 'proof-climate-2100',
      method: ReproducibilityMethod.ConsensusExecution,
      timestamp: Date.now(),
      reproductionRecipe: {
        lawSetCid: climateLaws.rulesCid,
        containerCid: container.imageCid,
        initialStateCid: initialState.stateCid,
        finalStateCid: 'bafyFinalClimate2100',
        stepsExecuted: 76 * 365,
      },
      attestations: [
        {
          providerId: 'compute-cluster-1',
          signature: 'sig1',
          executedAt: Date.now(),
          computedFinalStateCid: 'bafyFinalClimate2100',
        },
        {
          providerId: 'compute-cluster-2',
          signature: 'sig2',
          executedAt: Date.now(),
          computedFinalStateCid: 'bafyFinalClimate2100',
        },
        {
          providerId: 'university-hpc',
          signature: 'sig3',
          executedAt: Date.now(),
          computedFinalStateCid: 'bafyFinalClimate2100',
        },
      ],
    };

    // 6. Verify
    const verification = verifyReproducibilityProof(proof);
    expect(verification.valid).toBe(true);

    // The emergence is verified: multiple independent providers
    // running the same laws on the same initial state
    // arrived at the same final state.
    expect(emergentResult.value).toEqual({
      anomaly: 2.4,
      range: [1.8, 3.2],
      scenario: 'SSP2-4.5',
    });

    // This verified emergence IS the value.
    // Payment was for this prediction.
    // Omnium minted to providers represents this computational truth.
  });
});
