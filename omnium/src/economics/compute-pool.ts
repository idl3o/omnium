/**
 * Compute Pool
 *
 * Proof-of-Useful-Compute: The bootstrap mechanism for Omnium.
 *
 * Core insight: External demand for computation creates real value.
 * Requestors pay into the commons, providers earn freshly minted Ω.
 *
 * Flow:
 * 1. Requestor submits job with payment → Commons Pool funded
 * 2. Provider claims job and executes
 * 3. Provider submits result with proof
 * 4. Verified completion → Mint reward to provider
 *
 * This solves the bootstrap problem:
 * - External value enters the system
 * - Useful work backs new money
 * - Creates T0 circulation → demurrage flows → dividends funded
 */

import { v4 as uuid } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export enum JobStatus {
  /** Waiting for a provider to claim */
  Pending = 'pending',
  /** Claimed by a provider, work in progress */
  Claimed = 'claimed',
  /** Successfully completed and verified */
  Completed = 'completed',
  /** Failed verification or provider abandoned */
  Failed = 'failed',
  /** Expired before completion */
  Expired = 'expired',
  /** Cancelled by requestor (before claim) */
  Cancelled = 'cancelled',
}

export enum JobType {
  /** Scientific/climate/physics simulations */
  Simulation = 'simulation',
  /** AI/ML model training */
  Training = 'training',
  /** Graphics/video rendering */
  Rendering = 'rendering',
  /** Data analysis/processing */
  Analysis = 'analysis',
  /** Generic compute task */
  Custom = 'custom',
}

export enum ProofType {
  /** Provider self-attests (trust-based, for bootstrap) */
  Attestation = 'attestation',
  /** Multiple providers run same job */
  Redundant = 'redundant',
  /** Trusted Execution Environment */
  TEE = 'tee',
  /** Optimistic with challenge period */
  Challenge = 'challenge',
}

/**
 * Specification of what to compute.
 */
export interface JobSpec {
  /** Type of computation */
  type: JobType;

  /** Job-specific payload (could be WASM, Docker ref, etc.) */
  payload: unknown;

  /** Estimated compute units (for pricing) */
  estimatedCompute: number;

  /** Human-readable description */
  description?: string;
}

/**
 * Proof that computation was performed correctly.
 */
export interface ComputeProof {
  /** Verification method used */
  type: ProofType;

  /** Proof-specific data */
  data: unknown;

  /** When proof was generated */
  timestamp: number;
}

/**
 * Result of a completed computation.
 */
export interface ComputeResult {
  /** Job-specific output */
  output: unknown;

  /** Verification proof */
  proof: ComputeProof;

  /** Actual compute units used */
  actualCompute: number;

  /** Execution time in ms */
  executionTime: number;
}

/**
 * A compute job in the pool.
 */
export interface ComputeJob {
  /** Unique job identifier */
  id: string;

  /** Requestor wallet ID */
  requestor: string;

  /** What to compute */
  specification: JobSpec;

  /** Amount paid to commons (external value) */
  payment: number;

  /** Ω to mint for provider on completion */
  reward: number;

  /** Optional purpose-coloring for minted Ω */
  purpose?: string;

  /** Optional community locality */
  locality?: string;

  /** Current job status */
  status: JobStatus;

  /** When job was submitted */
  createdAt: number;

  /** When job expires if unclaimed/incomplete */
  expiresAt: number;

  /** Provider who claimed (if claimed) */
  claimedBy?: string;

  /** When claimed */
  claimedAt?: number;

  /** When completed */
  completedAt?: number;

  /** Computation result (if completed) */
  result?: ComputeResult;

  /** Failure reason (if failed) */
  failureReason?: string;
}

/**
 * Options for submitting a job.
 */
export interface SubmitJobOptions {
  /** Optional purpose-coloring for reward */
  purpose?: string;

  /** Optional community locality */
  locality?: string;

  /** Custom expiration (default: 24 hours) */
  expiresIn?: number;

  /** Reward multiplier (default: 1.0, reward = payment * multiplier) */
  rewardMultiplier?: number;
}

/**
 * Result of minting after job completion.
 */
export interface MintResult {
  /** Whether minting succeeded */
  success: boolean;

  /** Job that was completed */
  jobId: string;

  /** Amount minted */
  amountMinted?: number;

  /** Minted unit ID */
  unitId?: string;

  /** Error if failed */
  error?: string;
}

/**
 * Pool statistics.
 */
export interface ComputePoolStats {
  /** Total jobs submitted */
  totalJobsSubmitted: number;

  /** Jobs currently pending */
  pendingJobs: number;

  /** Jobs currently in progress */
  claimedJobs: number;

  /** Successfully completed jobs */
  completedJobs: number;

  /** Failed jobs */
  failedJobs: number;

  /** Total payment received */
  totalPaymentReceived: number;

  /** Total rewards minted */
  totalRewardsMinted: number;

  /** Total compute units processed */
  totalComputeProcessed: number;
}

// =============================================================================
// COMPUTE POOL
// =============================================================================

/** Default job expiration: 24 hours */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Default reward multiplier */
const DEFAULT_REWARD_MULTIPLIER = 1.0;

/** Maximum time to complete after claiming: 4 hours */
const MAX_CLAIM_DURATION_MS = 4 * 60 * 60 * 1000;

/**
 * The Compute Pool - manages useful compute jobs.
 *
 * This is the bootstrap mechanism for Omnium:
 * - External requestors pay for compute
 * - Payments fund the commons
 * - Providers do useful work
 * - Verified work earns freshly minted Ω
 */
export class ComputePool {
  private jobs: Map<string, ComputeJob> = new Map();
  private jobsByRequestor: Map<string, Set<string>> = new Map();
  private jobsByProvider: Map<string, Set<string>> = new Map();

  // Statistics
  private totalPaymentReceived: number = 0;
  private totalRewardsMinted: number = 0;
  private totalComputeProcessed: number = 0;
  private completedCount: number = 0;
  private failedCount: number = 0;

  // Callback for minting (set by ledger integration)
  private mintCallback?: (
    amount: number,
    toWallet: string,
    purpose?: string,
    locality?: string,
    note?: string
  ) => string | null;

  // Current time provider (for testing)
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

  /**
   * Submit a new compute job.
   *
   * @param requestor - Wallet ID of the requestor
   * @param spec - Job specification
   * @param payment - Amount paid (funds commons)
   * @param options - Optional settings
   * @returns The created job
   */
  submitJob(
    requestor: string,
    spec: JobSpec,
    payment: number,
    options: SubmitJobOptions = {}
  ): ComputeJob {
    if (payment <= 0) {
      throw new Error('Payment must be positive');
    }

    if (spec.estimatedCompute <= 0) {
      throw new Error('Estimated compute must be positive');
    }

    const now = this.timeProvider();
    const expiresIn = options.expiresIn ?? DEFAULT_EXPIRATION_MS;
    const multiplier = options.rewardMultiplier ?? DEFAULT_REWARD_MULTIPLIER;

    const job: ComputeJob = {
      id: uuid(),
      requestor,
      specification: spec,
      payment,
      reward: payment * multiplier,
      purpose: options.purpose,
      locality: options.locality,
      status: JobStatus.Pending,
      createdAt: now,
      expiresAt: now + expiresIn,
    };

    this.jobs.set(job.id, job);
    this.addToIndex(this.jobsByRequestor, requestor, job.id);
    this.totalPaymentReceived += payment;

    return job;
  }

  /**
   * Get a job by ID.
   */
  getJob(jobId: string): ComputeJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all available (pending) jobs.
   */
  getAvailableJobs(): ComputeJob[] {
    const now = this.timeProvider();
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === JobStatus.Pending && job.expiresAt > now
    );
  }

  /**
   * Get jobs by requestor.
   */
  getJobsByRequestor(requestor: string): ComputeJob[] {
    const ids = this.jobsByRequestor.get(requestor);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.jobs.get(id))
      .filter((j): j is ComputeJob => j !== undefined);
  }

  /**
   * Get jobs by provider.
   */
  getJobsByProvider(provider: string): ComputeJob[] {
    const ids = this.jobsByProvider.get(provider);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.jobs.get(id))
      .filter((j): j is ComputeJob => j !== undefined);
  }

  /**
   * Provider claims a job to work on.
   */
  claimJob(jobId: string, provider: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    const now = this.timeProvider();

    // Can only claim pending, non-expired jobs
    if (job.status !== JobStatus.Pending) return false;
    if (job.expiresAt <= now) {
      job.status = JobStatus.Expired;
      return false;
    }

    // Claim it
    job.status = JobStatus.Claimed;
    job.claimedBy = provider;
    job.claimedAt = now;

    this.addToIndex(this.jobsByProvider, provider, job.id);

    return true;
  }

  /**
   * Provider abandons a claimed job.
   */
  abandonJob(jobId: string, provider: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.status !== JobStatus.Claimed) return false;
    if (job.claimedBy !== provider) return false;

    // Return to pending
    job.status = JobStatus.Pending;
    job.claimedBy = undefined;
    job.claimedAt = undefined;

    this.removeFromIndex(this.jobsByProvider, provider, job.id);

    return true;
  }

  /**
   * Provider submits completed work.
   *
   * On successful verification, mints reward to provider.
   */
  submitResult(
    jobId: string,
    provider: string,
    result: ComputeResult
  ): MintResult {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { success: false, jobId, error: 'Job not found' };
    }

    if (job.status !== JobStatus.Claimed) {
      return { success: false, jobId, error: `Job not claimable: ${job.status}` };
    }

    if (job.claimedBy !== provider) {
      return { success: false, jobId, error: 'Not claimed by this provider' };
    }

    // Verify the proof
    const verificationResult = this.verifyProof(job, result);
    if (!verificationResult.valid) {
      job.status = JobStatus.Failed;
      job.failureReason = verificationResult.reason;
      this.failedCount++;
      return { success: false, jobId, error: verificationResult.reason };
    }

    // Mark completed
    const now = this.timeProvider();
    job.status = JobStatus.Completed;
    job.completedAt = now;
    job.result = result;
    this.completedCount++;
    this.totalComputeProcessed += result.actualCompute;

    // Mint reward
    if (this.mintCallback) {
      const note = `Compute reward: ${job.specification.type} job ${job.id}`;
      const unitId = this.mintCallback(
        job.reward,
        provider,
        job.purpose,
        job.locality,
        note
      );

      if (unitId) {
        this.totalRewardsMinted += job.reward;
        return {
          success: true,
          jobId,
          amountMinted: job.reward,
          unitId,
        };
      } else {
        return {
          success: false,
          jobId,
          error: 'Minting failed',
        };
      }
    }

    // No mint callback set - still count as success but no minting
    return {
      success: true,
      jobId,
      amountMinted: 0,
    };
  }

  /**
   * Cancel a pending job (requestor only).
   */
  cancelJob(jobId: string, requestor: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.requestor !== requestor) return false;
    if (job.status !== JobStatus.Pending) return false;

    job.status = JobStatus.Cancelled;
    return true;
  }

  /**
   * Expire stale jobs (pending expired, claimed too long).
   * Returns number of jobs expired.
   */
  expireStaleJobs(): number {
    const now = this.timeProvider();
    let expired = 0;

    for (const job of this.jobs.values()) {
      // Expire unclaimed jobs past expiration
      if (job.status === JobStatus.Pending && job.expiresAt <= now) {
        job.status = JobStatus.Expired;
        expired++;
      }

      // Expire claimed jobs taking too long
      if (
        job.status === JobStatus.Claimed &&
        job.claimedAt &&
        now - job.claimedAt > MAX_CLAIM_DURATION_MS
      ) {
        job.status = JobStatus.Expired;
        job.failureReason = 'Claim timeout';
        expired++;
      }
    }

    return expired;
  }

  /**
   * Get pool statistics.
   */
  getStats(): ComputePoolStats {
    let pending = 0;
    let claimed = 0;

    for (const job of this.jobs.values()) {
      if (job.status === JobStatus.Pending) pending++;
      if (job.status === JobStatus.Claimed) claimed++;
    }

    return {
      totalJobsSubmitted: this.jobs.size,
      pendingJobs: pending,
      claimedJobs: claimed,
      completedJobs: this.completedCount,
      failedJobs: this.failedCount,
      totalPaymentReceived: this.totalPaymentReceived,
      totalRewardsMinted: this.totalRewardsMinted,
      totalComputeProcessed: this.totalComputeProcessed,
    };
  }

  /**
   * Export state for persistence.
   */
  export(): {
    jobs: ComputeJob[];
    totalPaymentReceived: number;
    totalRewardsMinted: number;
    totalComputeProcessed: number;
    completedCount: number;
    failedCount: number;
  } {
    return {
      jobs: Array.from(this.jobs.values()),
      totalPaymentReceived: this.totalPaymentReceived,
      totalRewardsMinted: this.totalRewardsMinted,
      totalComputeProcessed: this.totalComputeProcessed,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
    };
  }

  /**
   * Import state from persistence.
   */
  import(state: ReturnType<ComputePool['export']>): void {
    this.jobs.clear();
    this.jobsByRequestor.clear();
    this.jobsByProvider.clear();

    for (const job of state.jobs) {
      this.jobs.set(job.id, job);
      this.addToIndex(this.jobsByRequestor, job.requestor, job.id);
      if (job.claimedBy) {
        this.addToIndex(this.jobsByProvider, job.claimedBy, job.id);
      }
    }

    this.totalPaymentReceived = state.totalPaymentReceived;
    this.totalRewardsMinted = state.totalRewardsMinted;
    this.totalComputeProcessed = state.totalComputeProcessed;
    this.completedCount = state.completedCount;
    this.failedCount = state.failedCount;
  }

  /**
   * Reset pool (for testing).
   */
  reset(): void {
    this.jobs.clear();
    this.jobsByRequestor.clear();
    this.jobsByProvider.clear();
    this.totalPaymentReceived = 0;
    this.totalRewardsMinted = 0;
    this.totalComputeProcessed = 0;
    this.completedCount = 0;
    this.failedCount = 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private verifyProof(
    job: ComputeJob,
    result: ComputeResult
  ): { valid: boolean; reason?: string } {
    // For now, accept attestation proofs (trust-based bootstrap)
    // Later: implement redundant, TEE, challenge verification

    if (!result.proof) {
      return { valid: false, reason: 'No proof provided' };
    }

    if (result.actualCompute <= 0) {
      return { valid: false, reason: 'Invalid compute amount' };
    }

    // Attestation: just trust the provider (for bootstrap phase)
    if (result.proof.type === ProofType.Attestation) {
      return { valid: true };
    }

    // TODO: Implement other proof types
    // For now, accept any proof type
    return { valid: true };
  }

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
 * Create a new ComputePool.
 */
export function createComputePool(timeProvider?: () => number): ComputePool {
  return new ComputePool(timeProvider);
}
