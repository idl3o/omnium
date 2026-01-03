/**
 * Simulation Framework
 *
 * The substrate for Proof-of-Useful-Compute.
 *
 * Core insight: Value comes from VERIFIED EMERGENCE.
 * - Simulations have RULES (physics, economics, game theory)
 * - Following rules correctly = obviously useful
 * - Emergent properties = the actual value
 * - The chain = immutable witness of computational truth
 *
 * "Payment is for verified emergence, not just CPU cycles."
 */

import { v4 as uuid } from 'uuid';

// =============================================================================
// SIMULATION LAWS / RULE SETS
// =============================================================================

/**
 * Categories of simulation laws.
 */
export enum LawDomain {
  /** Physical laws (thermodynamics, mechanics, quantum) */
  Physics = 'physics',
  /** Economic laws (supply/demand, game theory, markets) */
  Economics = 'economics',
  /** Biological laws (evolution, ecology, genetics) */
  Biology = 'biology',
  /** Social laws (network effects, cooperation, competition) */
  Social = 'social',
  /** Computational laws (cellular automata, agent-based) */
  Computational = 'computational',
  /** Custom/hybrid rule sets */
  Custom = 'custom',
}

/**
 * A set of laws/rules that govern a simulation.
 *
 * Laws are content-addressed: same CID = same rules forever.
 * This enables reproducibility and trust.
 */
export interface LawSet {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Domain of these laws */
  domain: LawDomain;

  /** Version for human tracking (CID is the true version) */
  version: string;

  /** Description of what these laws model */
  description: string;

  /**
   * The actual rules - content-addressed reference.
   * Could be: WASM module CID, mathematical spec CID, etc.
   */
  rulesCid: string;

  /** Hash algorithm used for rulesCid */
  hashAlgorithm: 'sha256' | 'blake3';

  /**
   * Formal properties these laws guarantee.
   * E.g., "energy conservation", "Nash equilibrium convergence"
   */
  invariants: string[];

  /** When this law set was registered */
  registeredAt: number;

  /** Who registered it (for attribution, not authority) */
  registeredBy?: string;
}

// =============================================================================
// DETERMINISTIC CONTAINERS
// =============================================================================

/**
 * Runtime environment types.
 */
export enum RuntimeType {
  /** WebAssembly (most portable, deterministic) */
  WASM = 'wasm',
  /** Docker container (heavier, flexible) */
  Docker = 'docker',
  /** Native binary (fastest, platform-specific) */
  Native = 'native',
  /** JavaScript/V8 isolate */
  V8Isolate = 'v8-isolate',
}

/**
 * A deterministic execution container.
 *
 * Same container + same inputs = same outputs. Always.
 * This is what makes simulations reproducible.
 */
export interface DeterministicContainer {
  /** Container identifier */
  id: string;

  /** Runtime type */
  runtime: RuntimeType;

  /** Runtime version (e.g., "wasmtime-14.0.0") */
  runtimeVersion: string;

  /**
   * Container image/module reference (content-addressed).
   * For WASM: the module CID
   * For Docker: image digest
   */
  imageCid: string;

  /** Resource limits */
  limits: {
    /** Max memory in bytes */
    maxMemory: number;
    /** Max CPU time in ms */
    maxCpuTime: number;
    /** Max storage in bytes */
    maxStorage: number;
  };

  /**
   * Determinism guarantees.
   * What makes this container reproducible.
   */
  determinismProperties: {
    /** No network access */
    networkIsolated: boolean;
    /** No filesystem access (except explicit mounts) */
    filesystemIsolated: boolean;
    /** Fixed random seed handling */
    deterministicRandom: boolean;
    /** Fixed time/clock */
    fixedClock: boolean;
  };
}

// =============================================================================
// SIMULATION STATE
// =============================================================================

/**
 * The state of a simulation at a point in time.
 * Content-addressed for immutability and reproducibility.
 */
export interface SimulationState {
  /** State identifier (usually derived from content) */
  id: string;

  /** Content address of the full state */
  stateCid: string;

  /** When this state was captured */
  timestamp: number;

  /** Which simulation this state belongs to */
  simulationId: string;

  /** Step/tick number in the simulation */
  stepNumber: number;

  /**
   * State summary (for quick inspection without fetching full state).
   * E.g., { particleCount: 1000000, totalEnergy: 42.5 }
   */
  summary: Record<string, unknown>;

  /** Size of full state in bytes */
  sizeBytes: number;
}

// =============================================================================
// EMERGENT PROPERTIES
// =============================================================================

/**
 * Categories of emergence.
 */
export enum EmergenceType {
  /** A measurable quantity (temperature, price, population) */
  Metric = 'metric',
  /** A pattern that formed (cluster, wave, cycle) */
  Pattern = 'pattern',
  /** A phase transition (liquid→gas, bull→bear) */
  PhaseTransition = 'phase-transition',
  /** An equilibrium reached (Nash, thermodynamic) */
  Equilibrium = 'equilibrium',
  /** A prediction about the future */
  Prediction = 'prediction',
  /** An anomaly or unexpected behavior */
  Anomaly = 'anomaly',
}

/**
 * An emergent property that arose from the simulation.
 *
 * This is THE VALUE - what we actually paid for.
 * Not the CPU cycles, but what emerged from following the rules.
 */
export interface EmergentProperty {
  /** Unique identifier */
  id: string;

  /** Type of emergence */
  type: EmergenceType;

  /** Human-readable name */
  name: string;

  /** Description of what emerged */
  description: string;

  /**
   * The actual emergent value.
   * Could be a number, object, reference to larger data, etc.
   */
  value: unknown;

  /** Confidence/certainty (0-1) */
  confidence: number;

  /** At what simulation step this was observed */
  observedAtStep: number;

  /** Statistical significance if applicable */
  significance?: {
    pValue?: number;
    sampleSize?: number;
    method?: string;
  };

  /**
   * Lineage: what inputs/rules led to this emergence.
   * For reproducibility and trust.
   */
  lineage: {
    lawSetId: string;
    initialStateCid: string;
    containerCid: string;
  };
}

// =============================================================================
// REPRODUCIBILITY PROOF
// =============================================================================

/**
 * Methods of proving reproducibility.
 */
export enum ReproducibilityMethod {
  /** Provider self-attests (trust-based, for bootstrap) */
  SelfAttestation = 'self-attestation',
  /** Multiple independent providers ran same simulation */
  ConsensusExecution = 'consensus-execution',
  /** Trusted Execution Environment with attestation */
  TEEAttestation = 'tee-attestation',
  /** Cryptographic proof (ZK-SNARK, etc.) */
  CryptographicProof = 'cryptographic-proof',
  /** Spot-check random re-execution */
  SpotCheck = 'spot-check',
}

/**
 * Proof that a simulation was run correctly and can be reproduced.
 *
 * This is what makes the emergence VERIFIED.
 * Anyone with this proof can re-run and get the same results.
 */
export interface ReproducibilityProof {
  /** Proof identifier */
  id: string;

  /** Method used to establish reproducibility */
  method: ReproducibilityMethod;

  /** When proof was generated */
  timestamp: number;

  /**
   * Everything needed to reproduce the simulation.
   * All CIDs - immutable references.
   */
  reproductionRecipe: {
    /** The rules that were followed */
    lawSetCid: string;
    /** The execution environment */
    containerCid: string;
    /** Initial state */
    initialStateCid: string;
    /** Final state (for comparison) */
    finalStateCid: string;
    /** Random seed if applicable */
    randomSeed?: string;
    /** Number of steps executed */
    stepsExecuted: number;
  };

  /**
   * Attestations from providers who executed this.
   */
  attestations: Array<{
    /** Provider identifier */
    providerId: string;
    /** Cryptographic signature */
    signature: string;
    /** When they executed */
    executedAt: number;
    /** Their computed final state CID (should match) */
    computedFinalStateCid: string;
  }>;

  /**
   * For TEE: the attestation report.
   */
  teeAttestation?: {
    platform: 'sgx' | 'sev' | 'trustzone';
    report: string;
    measurements: Record<string, string>;
  };

  /**
   * For cryptographic proof: the proof data.
   */
  cryptographicProof?: {
    proofSystem: 'groth16' | 'plonk' | 'stark';
    proof: string;
    publicInputs: string[];
    verificationKey: string;
  };
}

// =============================================================================
// SIMULATION JOB (ENHANCED)
// =============================================================================

/**
 * Job status with simulation-aware states.
 */
export enum SimulationJobStatus {
  /** Awaiting provider */
  Pending = 'pending',
  /** Provider claimed, setting up container */
  Initializing = 'initializing',
  /** Simulation running */
  Running = 'running',
  /** Execution complete, generating proof */
  Proving = 'proving',
  /** Fully complete with verified emergence */
  Completed = 'completed',
  /** Failed verification */
  Failed = 'failed',
  /** Expired */
  Expired = 'expired',
  /** Cancelled */
  Cancelled = 'cancelled',
}

/**
 * A simulation job - request for verified emergence.
 */
export interface SimulationJob {
  /** Unique job identifier */
  id: string;

  /** Who requested this simulation */
  requestor: string;

  /** Human-readable description */
  description: string;

  // === THE SIMULATION SPECIFICATION ===

  /** Laws/rules to follow */
  lawSet: LawSet;

  /** Container to execute in */
  container: DeterministicContainer;

  /** Initial state CID */
  initialStateCid: string;

  /** Number of steps to simulate */
  stepsRequested: number;

  /**
   * What emergent properties to look for.
   * Provider must identify/measure these.
   */
  emergenceTargets: Array<{
    name: string;
    type: EmergenceType;
    description: string;
  }>;

  // === ECONOMIC TERMS ===

  /** Payment amount (external value entering system) */
  payment: number;

  /** Reward for provider (Ω to mint) */
  reward: number;

  /** Required reproducibility method */
  requiredProofMethod: ReproducibilityMethod;

  /** Optional: purpose-coloring for minted Ω */
  purpose?: string;

  /** Optional: locality for minted Ω */
  locality?: string;

  // === JOB STATE ===

  status: SimulationJobStatus;
  createdAt: number;
  expiresAt: number;
  claimedBy?: string;
  claimedAt?: number;
  completedAt?: number;

  // === RESULTS ===

  /** Final state after simulation */
  finalState?: SimulationState;

  /** Emergent properties discovered */
  emergentProperties?: EmergentProperty[];

  /** Reproducibility proof */
  proof?: ReproducibilityProof;

  /** Failure reason if failed */
  failureReason?: string;
}

// =============================================================================
// SIMULATION REGISTRY
// =============================================================================

/**
 * Registry of known law sets and containers.
 *
 * Provides discoverability and trust anchors.
 * "These are the rules we know are correct."
 */
export class SimulationRegistry {
  private lawSets: Map<string, LawSet> = new Map();
  private containers: Map<string, DeterministicContainer> = new Map();
  private lawSetsByCid: Map<string, LawSet> = new Map();
  private containersByCid: Map<string, DeterministicContainer> = new Map();

  /**
   * Register a new law set.
   */
  registerLawSet(lawSet: Omit<LawSet, 'id' | 'registeredAt'>): LawSet {
    const full: LawSet = {
      ...lawSet,
      id: uuid(),
      registeredAt: Date.now(),
    };
    this.lawSets.set(full.id, full);
    this.lawSetsByCid.set(full.rulesCid, full);
    return full;
  }

  /**
   * Get law set by ID.
   */
  getLawSet(id: string): LawSet | undefined {
    return this.lawSets.get(id);
  }

  /**
   * Get law set by rules CID.
   */
  getLawSetByCid(cid: string): LawSet | undefined {
    return this.lawSetsByCid.get(cid);
  }

  /**
   * Get all law sets in a domain.
   */
  getLawSetsByDomain(domain: LawDomain): LawSet[] {
    return Array.from(this.lawSets.values()).filter((ls) => ls.domain === domain);
  }

  /**
   * Register a deterministic container.
   */
  registerContainer(
    container: Omit<DeterministicContainer, 'id'>
  ): DeterministicContainer {
    const full: DeterministicContainer = {
      ...container,
      id: uuid(),
    };
    this.containers.set(full.id, full);
    this.containersByCid.set(full.imageCid, full);
    return full;
  }

  /**
   * Get container by ID.
   */
  getContainer(id: string): DeterministicContainer | undefined {
    return this.containers.get(id);
  }

  /**
   * Get container by image CID.
   */
  getContainerByCid(cid: string): DeterministicContainer | undefined {
    return this.containersByCid.get(cid);
  }

  /**
   * Get all containers of a runtime type.
   */
  getContainersByRuntime(runtime: RuntimeType): DeterministicContainer[] {
    return Array.from(this.containers.values()).filter(
      (c) => c.runtime === runtime
    );
  }

  /**
   * Export registry state.
   */
  export(): {
    lawSets: LawSet[];
    containers: DeterministicContainer[];
  } {
    return {
      lawSets: Array.from(this.lawSets.values()),
      containers: Array.from(this.containers.values()),
    };
  }

  /**
   * Import registry state.
   */
  import(state: ReturnType<SimulationRegistry['export']>): void {
    this.lawSets.clear();
    this.containers.clear();
    this.lawSetsByCid.clear();
    this.containersByCid.clear();

    for (const ls of state.lawSets) {
      this.lawSets.set(ls.id, ls);
      this.lawSetsByCid.set(ls.rulesCid, ls);
    }
    for (const c of state.containers) {
      this.containers.set(c.id, c);
      this.containersByCid.set(c.imageCid, c);
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standard physics law set.
 */
export function createPhysicsLawSet(
  name: string,
  rulesCid: string,
  options: {
    version?: string;
    description?: string;
    invariants?: string[];
  } = {}
): Omit<LawSet, 'id' | 'registeredAt'> {
  return {
    name,
    domain: LawDomain.Physics,
    version: options.version ?? '1.0.0',
    description: options.description ?? `Physics simulation: ${name}`,
    rulesCid,
    hashAlgorithm: 'sha256',
    invariants: options.invariants ?? ['energy-conservation', 'momentum-conservation'],
  };
}

/**
 * Create a standard economics law set.
 */
export function createEconomicsLawSet(
  name: string,
  rulesCid: string,
  options: {
    version?: string;
    description?: string;
    invariants?: string[];
  } = {}
): Omit<LawSet, 'id' | 'registeredAt'> {
  return {
    name,
    domain: LawDomain.Economics,
    version: options.version ?? '1.0.0',
    description: options.description ?? `Economic simulation: ${name}`,
    rulesCid,
    hashAlgorithm: 'sha256',
    invariants: options.invariants ?? ['no-free-lunch', 'budget-balance'],
  };
}

/**
 * Create a WASM container specification.
 */
export function createWasmContainer(
  imageCid: string,
  options: {
    runtimeVersion?: string;
    maxMemory?: number;
    maxCpuTime?: number;
  } = {}
): Omit<DeterministicContainer, 'id'> {
  return {
    runtime: RuntimeType.WASM,
    runtimeVersion: options.runtimeVersion ?? 'wasmtime-14.0.0',
    imageCid,
    limits: {
      maxMemory: options.maxMemory ?? 1024 * 1024 * 1024, // 1GB
      maxCpuTime: options.maxCpuTime ?? 3600000, // 1 hour
      maxStorage: 100 * 1024 * 1024, // 100MB
    },
    determinismProperties: {
      networkIsolated: true,
      filesystemIsolated: true,
      deterministicRandom: true,
      fixedClock: true,
    },
  };
}

/**
 * Verify that a reproducibility proof is valid.
 * (Simplified - real implementation would do cryptographic verification)
 */
export function verifyReproducibilityProof(
  proof: ReproducibilityProof
): { valid: boolean; reason?: string } {
  // Check we have the recipe
  if (!proof.reproductionRecipe) {
    return { valid: false, reason: 'Missing reproduction recipe' };
  }

  const recipe = proof.reproductionRecipe;

  // Check all required CIDs are present
  if (!recipe.lawSetCid || !recipe.containerCid || !recipe.initialStateCid) {
    return { valid: false, reason: 'Missing required CIDs in recipe' };
  }

  // For self-attestation, just check we have at least one attestation
  if (proof.method === ReproducibilityMethod.SelfAttestation) {
    if (proof.attestations.length === 0) {
      return { valid: false, reason: 'No attestations provided' };
    }
    return { valid: true };
  }

  // For consensus, check multiple matching attestations
  if (proof.method === ReproducibilityMethod.ConsensusExecution) {
    if (proof.attestations.length < 2) {
      return { valid: false, reason: 'Consensus requires at least 2 attestations' };
    }
    const finalStates = proof.attestations.map((a) => a.computedFinalStateCid);
    const allMatch = finalStates.every((s) => s === finalStates[0]);
    if (!allMatch) {
      return { valid: false, reason: 'Attestations do not agree on final state' };
    }
    return { valid: true };
  }

  // For TEE, check attestation report exists
  if (proof.method === ReproducibilityMethod.TEEAttestation) {
    if (!proof.teeAttestation) {
      return { valid: false, reason: 'Missing TEE attestation' };
    }
    // TODO: Actually verify the TEE attestation
    return { valid: true };
  }

  // For cryptographic proof, verify the proof
  if (proof.method === ReproducibilityMethod.CryptographicProof) {
    if (!proof.cryptographicProof) {
      return { valid: false, reason: 'Missing cryptographic proof' };
    }
    // TODO: Actually verify the ZK proof
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Create the simulation registry.
 */
export function createSimulationRegistry(): SimulationRegistry {
  return new SimulationRegistry();
}
