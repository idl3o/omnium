/**
 * Deterministic Compute Layer
 *
 * Separates "proof of deterministic work" from "declaration of usefulness".
 *
 * Core insight: Value should be DISCOVERED, not DECLARED.
 *
 * - Determinism is required and verifiable (same input + code = same output)
 * - Intent/purpose is optional (privacy preserved by default)
 * - Value can accrue retroactively (tips, boosts, reputation)
 * - Anonymous simulations are first-class citizens
 *
 * "Useful" is a constraint. "Deterministic" is a property.
 */

import { v4 as uuid } from 'uuid';

// =============================================================================
// CORE ATTESTATION
// =============================================================================

/**
 * Proof that deterministic computation occurred.
 *
 * This is the minimal, privacy-preserving unit of work.
 * No judgment on what or why - just that it happened deterministically.
 */
export interface ComputeAttestation {
  /** Unique identifier */
  id: string;

  /** When this computation was performed */
  timestamp: number;

  // === THE DETERMINISM PROOF ===

  /**
   * Content-addressed input.
   * Could be: initial state, parameters, encrypted data, anything.
   * The attestation doesn't care what it IS, just that it's content-addressed.
   */
  inputCid: string;

  /**
   * Content-addressed code/computation.
   * Could be: WASM module, Docker image, script hash.
   * Again - we don't judge, just track.
   */
  codeCid: string;

  /**
   * Content-addressed output.
   * The result of running codeCid on inputCid.
   */
  outputCid: string;

  /**
   * Compute units consumed.
   * Normalized measure of work (CPU-seconds, WASM ops, etc.)
   */
  computeUnits: number;

  /**
   * How reproducibility was proven.
   */
  proofMethod: ProofMethod;

  /**
   * The actual proof data (method-specific).
   */
  proof: DeterminismProof;

  // === PROVIDER INFO ===

  /** Who performed this computation */
  providerId: string;

  /** Provider's signature over the attestation */
  signature?: string;

  // === OPTIONAL METADATA (privacy-preserving) ===

  /**
   * Optional, free-form metadata.
   * Provider chooses what (if anything) to disclose.
   */
  metadata?: ComputeMetadata;
}

/**
 * Methods of proving determinism.
 */
export enum ProofMethod {
  /** Provider self-attests (trust bootstrapping) */
  SelfAttestation = 'self-attestation',

  /** Multiple providers ran same computation, outputs match */
  Redundant = 'redundant',

  /** Trusted Execution Environment attestation */
  TEE = 'tee',

  /** Zero-knowledge proof of correct execution */
  ZKProof = 'zk-proof',

  /** Spot-check: random re-execution by verifiers */
  SpotCheck = 'spot-check',

  /** Optimistic: assumed valid, can be challenged */
  Optimistic = 'optimistic',
}

/**
 * Proof data (varies by method).
 */
export interface DeterminismProof {
  /** Which method */
  method: ProofMethod;

  /** For redundant: other providers who computed same result */
  redundantAttestations?: Array<{
    providerId: string;
    outputCid: string; // Should match
    signature: string;
  }>;

  /** For TEE: attestation report */
  teeReport?: {
    platform: 'sgx' | 'sev' | 'trustzone' | 'nitro';
    report: string;
    measurements: Record<string, string>;
  };

  /** For ZK: the proof */
  zkProof?: {
    system: 'groth16' | 'plonk' | 'stark' | 'halo2';
    proof: string;
    publicInputs: string[];
    verificationKeyCid: string;
  };

  /** For optimistic: challenge window info */
  optimisticWindow?: {
    challengeDeadline: number;
    bondAmount: number;
    challenged: boolean;
    challengeResolved?: boolean;
  };
}

/**
 * Optional metadata - provider chooses what to disclose.
 *
 * This is a folksonomy, not a taxonomy.
 * No enums, no required fields, just free-form attribution.
 */
export interface ComputeMetadata {
  /** Free-form description (optional) */
  description?: string;

  /** Free-form tags (optional) */
  tags?: string[];

  /** Domain hint (optional, not validated) */
  domain?: string;

  /** Link to more info (optional) */
  infoUrl?: string;

  /** Any other key-value pairs */
  [key: string]: unknown;
}

// =============================================================================
// VALUE DISCOVERY (RETROACTIVE)
// =============================================================================

/**
 * A value attribution - someone found this compute valuable.
 *
 * Value is discovered AFTER the fact, not declared before.
 */
export interface ValueAttribution {
  /** Unique identifier */
  id: string;

  /** Which attestation is being valued */
  attestationId: string;

  /** Who is attributing value */
  attributorId: string;

  /** When this attribution was made */
  timestamp: number;

  /** Type of value attribution */
  type: ValueType;

  /** Amount (in Ω) */
  amount: number;

  /** Optional note */
  note?: string;
}

/**
 * Ways value can be attributed retroactively.
 */
export enum ValueType {
  /** Direct tip to the provider */
  Tip = 'tip',

  /** Boost: increase visibility/reputation */
  Boost = 'boost',

  /** Citation: this compute was used in subsequent work */
  Citation = 'citation',

  /** Bounty: retroactive reward for solving a problem */
  Bounty = 'bounty',

  /** Grant: institutional recognition */
  Grant = 'grant',
}

/**
 * Aggregated value for an attestation.
 */
export interface AttestationValue {
  attestationId: string;
  totalValue: number;
  attributionCount: number;
  byType: Record<ValueType, number>;
  firstAttribution?: number;
  lastAttribution?: number;
}

// =============================================================================
// COMPUTE REGISTRY
// =============================================================================

/**
 * Registry of compute attestations.
 *
 * Key properties:
 * - No judgment on usefulness
 * - Privacy-preserving by default
 * - Retroactive value discovery
 * - Reputation emerges from use
 */
export class ComputeRegistry {
  private attestations: Map<string, ComputeAttestation> = new Map();
  private byProvider: Map<string, Set<string>> = new Map();
  private byInputCid: Map<string, Set<string>> = new Map();
  private byCodeCid: Map<string, Set<string>> = new Map();
  private byOutputCid: Map<string, Set<string>> = new Map();
  private byTag: Map<string, Set<string>> = new Map();

  private attributions: Map<string, ValueAttribution> = new Map();
  private attributionsByAttestation: Map<string, Set<string>> = new Map();

  // =========================================================================
  // ATTESTATION REGISTRATION
  // =========================================================================

  /**
   * Register a compute attestation.
   *
   * No validation of "usefulness" - just determinism proof.
   */
  register(
    attestation: Omit<ComputeAttestation, 'id' | 'timestamp'>
  ): ComputeAttestation {
    const full: ComputeAttestation = {
      ...attestation,
      id: uuid(),
      timestamp: Date.now(),
    };

    // Store attestation
    this.attestations.set(full.id, full);

    // Index by provider
    if (!this.byProvider.has(full.providerId)) {
      this.byProvider.set(full.providerId, new Set());
    }
    this.byProvider.get(full.providerId)!.add(full.id);

    // Index by CIDs
    this.indexByCid(this.byInputCid, full.inputCid, full.id);
    this.indexByCid(this.byCodeCid, full.codeCid, full.id);
    this.indexByCid(this.byOutputCid, full.outputCid, full.id);

    // Index by tags (if provided)
    if (full.metadata?.tags) {
      for (const tag of full.metadata.tags) {
        this.indexByCid(this.byTag, tag.toLowerCase(), full.id);
      }
    }

    return full;
  }

  private indexByCid(index: Map<string, Set<string>>, key: string, id: string): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(id);
  }

  /**
   * Get attestation by ID.
   */
  get(id: string): ComputeAttestation | undefined {
    return this.attestations.get(id);
  }

  /**
   * Find attestations by provider.
   */
  findByProvider(providerId: string): ComputeAttestation[] {
    const ids = this.byProvider.get(providerId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.attestations.get(id)!);
  }

  /**
   * Find attestations by input CID.
   * "Who else computed on this input?"
   */
  findByInput(inputCid: string): ComputeAttestation[] {
    const ids = this.byInputCid.get(inputCid);
    if (!ids) return [];
    return Array.from(ids).map(id => this.attestations.get(id)!);
  }

  /**
   * Find attestations by code CID.
   * "Who else ran this code?"
   */
  findByCode(codeCid: string): ComputeAttestation[] {
    const ids = this.byCodeCid.get(codeCid);
    if (!ids) return [];
    return Array.from(ids).map(id => this.attestations.get(id)!);
  }

  /**
   * Find attestations by output CID.
   * "Who produced this output?" (should be unique if deterministic)
   */
  findByOutput(outputCid: string): ComputeAttestation[] {
    const ids = this.byOutputCid.get(outputCid);
    if (!ids) return [];
    return Array.from(ids).map(id => this.attestations.get(id)!);
  }

  /**
   * Find attestations by tag.
   * "What compute is tagged with X?"
   */
  findByTag(tag: string): ComputeAttestation[] {
    const ids = this.byTag.get(tag.toLowerCase());
    if (!ids) return [];
    return Array.from(ids).map(id => this.attestations.get(id)!);
  }

  /**
   * Verify determinism: same input + code should yield same output.
   */
  verifyDeterminism(inputCid: string, codeCid: string): {
    deterministic: boolean;
    outputCid?: string;
    attestationCount: number;
    providers: string[];
  } {
    // Find all attestations with this input+code pair
    const byInput = this.byInputCid.get(inputCid) ?? new Set();
    const byCode = this.byCodeCid.get(codeCid) ?? new Set();

    // Intersection
    const matching = Array.from(byInput).filter(id => byCode.has(id));
    const attestations = matching.map(id => this.attestations.get(id)!);

    if (attestations.length === 0) {
      return { deterministic: true, attestationCount: 0, providers: [] };
    }

    // Check all outputs match
    const outputs = new Set(attestations.map(a => a.outputCid));
    const providers = attestations.map(a => a.providerId);

    return {
      deterministic: outputs.size === 1,
      outputCid: outputs.size === 1 ? attestations[0].outputCid : undefined,
      attestationCount: attestations.length,
      providers,
    };
  }

  // =========================================================================
  // VALUE DISCOVERY
  // =========================================================================

  /**
   * Attribute value to an attestation.
   *
   * This is how value is DISCOVERED, not declared.
   */
  attributeValue(
    attestationId: string,
    attributorId: string,
    type: ValueType,
    amount: number,
    note?: string
  ): ValueAttribution | null {
    const attestation = this.attestations.get(attestationId);
    if (!attestation) return null;

    const attribution: ValueAttribution = {
      id: uuid(),
      attestationId,
      attributorId,
      timestamp: Date.now(),
      type,
      amount,
      note,
    };

    this.attributions.set(attribution.id, attribution);

    if (!this.attributionsByAttestation.has(attestationId)) {
      this.attributionsByAttestation.set(attestationId, new Set());
    }
    this.attributionsByAttestation.get(attestationId)!.add(attribution.id);

    return attribution;
  }

  /**
   * Get all attributions for an attestation.
   */
  getAttributions(attestationId: string): ValueAttribution[] {
    const ids = this.attributionsByAttestation.get(attestationId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.attributions.get(id)!);
  }

  /**
   * Get aggregated value for an attestation.
   */
  getAttestationValue(attestationId: string): AttestationValue {
    const attributions = this.getAttributions(attestationId);

    const byType: Record<ValueType, number> = {
      [ValueType.Tip]: 0,
      [ValueType.Boost]: 0,
      [ValueType.Citation]: 0,
      [ValueType.Bounty]: 0,
      [ValueType.Grant]: 0,
    };

    let totalValue = 0;
    let firstAttribution: number | undefined;
    let lastAttribution: number | undefined;

    for (const attr of attributions) {
      totalValue += attr.amount;
      byType[attr.type] += attr.amount;

      if (!firstAttribution || attr.timestamp < firstAttribution) {
        firstAttribution = attr.timestamp;
      }
      if (!lastAttribution || attr.timestamp > lastAttribution) {
        lastAttribution = attr.timestamp;
      }
    }

    return {
      attestationId,
      totalValue,
      attributionCount: attributions.length,
      byType,
      firstAttribution,
      lastAttribution,
    };
  }

  /**
   * Get provider's total attributed value.
   */
  getProviderValue(providerId: string): {
    totalValue: number;
    attestationCount: number;
    topAttestations: Array<{ id: string; value: number }>;
  } {
    const attestations = this.findByProvider(providerId);
    let totalValue = 0;
    const attestationValues: Array<{ id: string; value: number }> = [];

    for (const attestation of attestations) {
      const value = this.getAttestationValue(attestation.id);
      totalValue += value.totalValue;
      attestationValues.push({ id: attestation.id, value: value.totalValue });
    }

    // Sort by value descending
    attestationValues.sort((a, b) => b.value - a.value);

    return {
      totalValue,
      attestationCount: attestations.length,
      topAttestations: attestationValues.slice(0, 10),
    };
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  /**
   * Get registry statistics.
   */
  getStats(): {
    totalAttestations: number;
    totalProviders: number;
    totalComputeUnits: number;
    totalValueAttributed: number;
    byProofMethod: Record<ProofMethod, number>;
    topTags: Array<{ tag: string; count: number }>;
  } {
    const byProofMethod: Record<ProofMethod, number> = {
      [ProofMethod.SelfAttestation]: 0,
      [ProofMethod.Redundant]: 0,
      [ProofMethod.TEE]: 0,
      [ProofMethod.ZKProof]: 0,
      [ProofMethod.SpotCheck]: 0,
      [ProofMethod.Optimistic]: 0,
    };

    let totalComputeUnits = 0;
    let totalValueAttributed = 0;

    for (const attestation of this.attestations.values()) {
      byProofMethod[attestation.proofMethod]++;
      totalComputeUnits += attestation.computeUnits;
    }

    for (const attribution of this.attributions.values()) {
      totalValueAttributed += attribution.amount;
    }

    // Top tags
    const tagCounts: Array<{ tag: string; count: number }> = [];
    for (const [tag, ids] of this.byTag) {
      tagCounts.push({ tag, count: ids.size });
    }
    tagCounts.sort((a, b) => b.count - a.count);

    return {
      totalAttestations: this.attestations.size,
      totalProviders: this.byProvider.size,
      totalComputeUnits,
      totalValueAttributed,
      byProofMethod,
      topTags: tagCounts.slice(0, 20),
    };
  }

  // =========================================================================
  // EXPORT / IMPORT
  // =========================================================================

  export(): {
    attestations: ComputeAttestation[];
    attributions: ValueAttribution[];
  } {
    return {
      attestations: Array.from(this.attestations.values()),
      attributions: Array.from(this.attributions.values()),
    };
  }

  import(state: ReturnType<ComputeRegistry['export']>): void {
    // Clear existing
    this.attestations.clear();
    this.byProvider.clear();
    this.byInputCid.clear();
    this.byCodeCid.clear();
    this.byOutputCid.clear();
    this.byTag.clear();
    this.attributions.clear();
    this.attributionsByAttestation.clear();

    // Import attestations
    for (const attestation of state.attestations) {
      this.attestations.set(attestation.id, attestation);
      this.indexByCid(this.byProvider as Map<string, Set<string>>, attestation.providerId, attestation.id);
      this.indexByCid(this.byInputCid, attestation.inputCid, attestation.id);
      this.indexByCid(this.byCodeCid, attestation.codeCid, attestation.id);
      this.indexByCid(this.byOutputCid, attestation.outputCid, attestation.id);
      if (attestation.metadata?.tags) {
        for (const tag of attestation.metadata.tags) {
          this.indexByCid(this.byTag, tag.toLowerCase(), attestation.id);
        }
      }
    }

    // Import attributions
    for (const attribution of state.attributions) {
      this.attributions.set(attribution.id, attribution);
      this.indexByCid(
        this.attributionsByAttestation as Map<string, Set<string>>,
        attribution.attestationId,
        attribution.id
      );
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createComputeRegistry(): ComputeRegistry {
  return new ComputeRegistry();
}

// =============================================================================
// HELPER: CREATE ATTESTATION
// =============================================================================

/**
 * Create a self-attested compute attestation.
 * Simplest form - provider vouches for determinism.
 */
export function createSelfAttestation(
  providerId: string,
  inputCid: string,
  codeCid: string,
  outputCid: string,
  computeUnits: number,
  metadata?: ComputeMetadata
): Omit<ComputeAttestation, 'id' | 'timestamp'> {
  return {
    providerId,
    inputCid,
    codeCid,
    outputCid,
    computeUnits,
    proofMethod: ProofMethod.SelfAttestation,
    proof: { method: ProofMethod.SelfAttestation },
    metadata,
  };
}

/**
 * Create an anonymous attestation (no metadata).
 */
export function createAnonymousAttestation(
  providerId: string,
  inputCid: string,
  codeCid: string,
  outputCid: string,
  computeUnits: number
): Omit<ComputeAttestation, 'id' | 'timestamp'> {
  return {
    providerId,
    inputCid,
    codeCid,
    outputCid,
    computeUnits,
    proofMethod: ProofMethod.SelfAttestation,
    proof: { method: ProofMethod.SelfAttestation },
    // No metadata - fully anonymous
  };
}

/**
 * Create a redundantly-verified attestation.
 * Multiple providers computed the same thing.
 */
export function createRedundantAttestation(
  providerId: string,
  inputCid: string,
  codeCid: string,
  outputCid: string,
  computeUnits: number,
  otherProviders: Array<{ providerId: string; signature: string }>,
  metadata?: ComputeMetadata
): Omit<ComputeAttestation, 'id' | 'timestamp'> {
  return {
    providerId,
    inputCid,
    codeCid,
    outputCid,
    computeUnits,
    proofMethod: ProofMethod.Redundant,
    proof: {
      method: ProofMethod.Redundant,
      redundantAttestations: otherProviders.map(p => ({
        providerId: p.providerId,
        outputCid, // Same output
        signature: p.signature,
      })),
    },
    metadata,
  };
}
