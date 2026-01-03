/**
 * ComputePool Tests
 *
 * Tests for the Proof-of-Useful-Compute bootstrap mechanism.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComputePool,
  createComputePool,
  JobStatus,
  JobType,
  ProofType,
  ComputeResult,
} from './compute-pool.js';

describe('ComputePool', () => {
  let pool: ComputePool;
  let currentTime: number;

  beforeEach(() => {
    currentTime = Date.now();
    pool = new ComputePool(() => currentTime);
  });

  const advanceTime = (ms: number) => {
    currentTime += ms;
  };

  const createBasicSpec = (type = JobType.Simulation) => ({
    type,
    payload: { model: 'climate-v1' },
    estimatedCompute: 100,
    description: 'Test simulation',
  });

  const createBasicResult = (): ComputeResult => ({
    output: { result: 'success' },
    proof: {
      type: ProofType.Attestation,
      data: { signature: 'test-sig' },
      timestamp: currentTime,
    },
    actualCompute: 100,
    executionTime: 5000,
  });

  // ===========================================================================
  // JOB SUBMISSION
  // ===========================================================================
  describe('job submission', () => {
    it('creates a pending job', () => {
      const job = pool.submitJob('requestor-1', createBasicSpec(), 100);

      expect(job.id).toBeDefined();
      expect(job.status).toBe(JobStatus.Pending);
      expect(job.requestor).toBe('requestor-1');
      expect(job.payment).toBe(100);
      expect(job.reward).toBe(100); // Default 1.0 multiplier
    });

    it('applies reward multiplier', () => {
      const job = pool.submitJob('requestor-1', createBasicSpec(), 100, {
        rewardMultiplier: 1.5,
      });

      expect(job.reward).toBe(150);
    });

    it('sets purpose and locality', () => {
      const job = pool.submitJob('requestor-1', createBasicSpec(), 100, {
        purpose: 'climate-research',
        locality: 'science-community',
      });

      expect(job.purpose).toBe('climate-research');
      expect(job.locality).toBe('science-community');
    });

    it('sets expiration time', () => {
      const job = pool.submitJob('requestor-1', createBasicSpec(), 100, {
        expiresIn: 3600000, // 1 hour
      });

      expect(job.expiresAt).toBe(currentTime + 3600000);
    });

    it('rejects zero payment', () => {
      expect(() => pool.submitJob('requestor-1', createBasicSpec(), 0)).toThrow(
        'Payment must be positive'
      );
    });

    it('rejects zero compute estimate', () => {
      const spec = { ...createBasicSpec(), estimatedCompute: 0 };
      expect(() => pool.submitJob('requestor-1', spec, 100)).toThrow(
        'Estimated compute must be positive'
      );
    });

    it('tracks total payment received', () => {
      pool.submitJob('requestor-1', createBasicSpec(), 100);
      pool.submitJob('requestor-2', createBasicSpec(), 200);

      const stats = pool.getStats();
      expect(stats.totalPaymentReceived).toBe(300);
    });
  });

  // ===========================================================================
  // JOB QUERIES
  // ===========================================================================
  describe('job queries', () => {
    beforeEach(() => {
      pool.submitJob('alice', createBasicSpec(), 100);
      pool.submitJob('alice', createBasicSpec(), 200);
      pool.submitJob('bob', createBasicSpec(), 150);
    });

    it('gets job by ID', () => {
      const job = pool.submitJob('charlie', createBasicSpec(), 50);
      const retrieved = pool.getJob(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('returns undefined for unknown job', () => {
      expect(pool.getJob('unknown')).toBeUndefined();
    });

    it('gets available jobs', () => {
      const available = pool.getAvailableJobs();

      expect(available.length).toBe(3);
      expect(available.every((j) => j.status === JobStatus.Pending)).toBe(true);
    });

    it('excludes expired jobs from available', () => {
      advanceTime(25 * 60 * 60 * 1000); // 25 hours

      const available = pool.getAvailableJobs();
      expect(available.length).toBe(0);
    });

    it('gets jobs by requestor', () => {
      const aliceJobs = pool.getJobsByRequestor('alice');
      expect(aliceJobs.length).toBe(2);

      const bobJobs = pool.getJobsByRequestor('bob');
      expect(bobJobs.length).toBe(1);
    });
  });

  // ===========================================================================
  // JOB CLAIMING
  // ===========================================================================
  describe('job claiming', () => {
    let job: ReturnType<typeof pool.submitJob>;

    beforeEach(() => {
      job = pool.submitJob('requestor', createBasicSpec(), 100);
    });

    it('allows provider to claim pending job', () => {
      const success = pool.claimJob(job.id, 'provider-1');

      expect(success).toBe(true);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Claimed);
      expect(pool.getJob(job.id)?.claimedBy).toBe('provider-1');
    });

    it('prevents claiming already claimed job', () => {
      pool.claimJob(job.id, 'provider-1');
      const success = pool.claimJob(job.id, 'provider-2');

      expect(success).toBe(false);
    });

    it('prevents claiming expired job', () => {
      advanceTime(25 * 60 * 60 * 1000);
      const success = pool.claimJob(job.id, 'provider-1');

      expect(success).toBe(false);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Expired);
    });

    it('tracks jobs by provider', () => {
      pool.claimJob(job.id, 'provider-1');

      const providerJobs = pool.getJobsByProvider('provider-1');
      expect(providerJobs.length).toBe(1);
      expect(providerJobs[0].id).toBe(job.id);
    });
  });

  // ===========================================================================
  // JOB ABANDONMENT
  // ===========================================================================
  describe('job abandonment', () => {
    let job: ReturnType<typeof pool.submitJob>;

    beforeEach(() => {
      job = pool.submitJob('requestor', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider-1');
    });

    it('allows provider to abandon claimed job', () => {
      const success = pool.abandonJob(job.id, 'provider-1');

      expect(success).toBe(true);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Pending);
      expect(pool.getJob(job.id)?.claimedBy).toBeUndefined();
    });

    it('prevents wrong provider from abandoning', () => {
      const success = pool.abandonJob(job.id, 'provider-2');
      expect(success).toBe(false);
    });

    it('abandoned job becomes available again', () => {
      pool.abandonJob(job.id, 'provider-1');

      const available = pool.getAvailableJobs();
      expect(available.some((j) => j.id === job.id)).toBe(true);
    });
  });

  // ===========================================================================
  // RESULT SUBMISSION
  // ===========================================================================
  describe('result submission', () => {
    let job: ReturnType<typeof pool.submitJob>;

    beforeEach(() => {
      job = pool.submitJob('requestor', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider-1');
    });

    it('accepts valid result', () => {
      const mintResult = pool.submitResult(job.id, 'provider-1', createBasicResult());

      expect(mintResult.success).toBe(true);
      expect(mintResult.jobId).toBe(job.id);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Completed);
    });

    it('rejects result from wrong provider', () => {
      const mintResult = pool.submitResult(job.id, 'provider-2', createBasicResult());

      expect(mintResult.success).toBe(false);
      expect(mintResult.error).toContain('Not claimed');
    });

    it('rejects result for unclaimed job', () => {
      const newJob = pool.submitJob('requestor', createBasicSpec(), 50);
      const mintResult = pool.submitResult(newJob.id, 'provider-1', createBasicResult());

      expect(mintResult.success).toBe(false);
      expect(mintResult.error).toContain('not claimable');
    });

    it('rejects result without proof', () => {
      const badResult = { ...createBasicResult(), proof: undefined as any };
      const mintResult = pool.submitResult(job.id, 'provider-1', badResult);

      expect(mintResult.success).toBe(false);
      expect(mintResult.error).toContain('No proof');
    });

    it('stores result on completion', () => {
      const result = createBasicResult();
      pool.submitResult(job.id, 'provider-1', result);

      const completed = pool.getJob(job.id);
      expect(completed?.result).toEqual(result);
      expect(completed?.completedAt).toBe(currentTime);
    });

    it('tracks completed count', () => {
      pool.submitResult(job.id, 'provider-1', createBasicResult());

      const stats = pool.getStats();
      expect(stats.completedJobs).toBe(1);
    });

    it('tracks compute processed', () => {
      pool.submitResult(job.id, 'provider-1', createBasicResult());

      const stats = pool.getStats();
      expect(stats.totalComputeProcessed).toBe(100);
    });
  });

  // ===========================================================================
  // MINTING INTEGRATION
  // ===========================================================================
  describe('minting integration', () => {
    let job: ReturnType<typeof pool.submitJob>;
    let mintedUnits: Array<{
      amount: number;
      wallet: string;
      purpose?: string;
      locality?: string;
    }>;

    beforeEach(() => {
      mintedUnits = [];
      pool.setMintCallback((amount, wallet, purpose, locality) => {
        const id = `unit-${mintedUnits.length}`;
        mintedUnits.push({ amount, wallet, purpose, locality });
        return id;
      });

      job = pool.submitJob('requestor', createBasicSpec(), 100, {
        purpose: 'climate',
        locality: 'science',
      });
      pool.claimJob(job.id, 'provider-1');
    });

    it('mints reward on completion', () => {
      const mintResult = pool.submitResult(job.id, 'provider-1', createBasicResult());

      expect(mintResult.success).toBe(true);
      expect(mintResult.amountMinted).toBe(100);
      expect(mintResult.unitId).toBe('unit-0');
      expect(mintedUnits.length).toBe(1);
      expect(mintedUnits[0].amount).toBe(100);
      expect(mintedUnits[0].wallet).toBe('provider-1');
    });

    it('passes purpose and locality to mint', () => {
      pool.submitResult(job.id, 'provider-1', createBasicResult());

      expect(mintedUnits[0].purpose).toBe('climate');
      expect(mintedUnits[0].locality).toBe('science');
    });

    it('tracks total rewards minted', () => {
      pool.submitResult(job.id, 'provider-1', createBasicResult());

      const stats = pool.getStats();
      expect(stats.totalRewardsMinted).toBe(100);
    });

    it('handles mint callback failure', () => {
      pool.setMintCallback(() => null);
      const mintResult = pool.submitResult(job.id, 'provider-1', createBasicResult());

      expect(mintResult.success).toBe(false);
      expect(mintResult.error).toContain('Minting failed');
    });
  });

  // ===========================================================================
  // JOB CANCELLATION
  // ===========================================================================
  describe('job cancellation', () => {
    it('allows requestor to cancel pending job', () => {
      const job = pool.submitJob('alice', createBasicSpec(), 100);
      const success = pool.cancelJob(job.id, 'alice');

      expect(success).toBe(true);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Cancelled);
    });

    it('prevents non-requestor from cancelling', () => {
      const job = pool.submitJob('alice', createBasicSpec(), 100);
      const success = pool.cancelJob(job.id, 'bob');

      expect(success).toBe(false);
    });

    it('prevents cancelling claimed job', () => {
      const job = pool.submitJob('alice', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider');
      const success = pool.cancelJob(job.id, 'alice');

      expect(success).toBe(false);
    });
  });

  // ===========================================================================
  // EXPIRATION
  // ===========================================================================
  describe('expiration', () => {
    it('expires unclaimed jobs past deadline', () => {
      pool.submitJob('alice', createBasicSpec(), 100);
      pool.submitJob('bob', createBasicSpec(), 100);

      advanceTime(25 * 60 * 60 * 1000); // 25 hours

      const expired = pool.expireStaleJobs();
      expect(expired).toBe(2);
    });

    it('expires claimed jobs taking too long', () => {
      const job = pool.submitJob('alice', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider');

      advanceTime(5 * 60 * 60 * 1000); // 5 hours (max is 4)

      const expired = pool.expireStaleJobs();
      expect(expired).toBe(1);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Expired);
    });
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================
  describe('statistics', () => {
    it('provides complete stats', () => {
      // Create various job states
      const job1 = pool.submitJob('alice', createBasicSpec(), 100);
      pool.submitJob('bob', createBasicSpec(), 200); // pending

      pool.claimJob(job1.id, 'provider');
      pool.submitResult(job1.id, 'provider', createBasicResult());

      const stats = pool.getStats();

      expect(stats.totalJobsSubmitted).toBe(2);
      expect(stats.pendingJobs).toBe(1);
      expect(stats.claimedJobs).toBe(0);
      expect(stats.completedJobs).toBe(1);
      expect(stats.totalPaymentReceived).toBe(300);
    });
  });

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================
  describe('persistence', () => {
    it('exports and imports state', () => {
      const job = pool.submitJob('alice', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider');

      const exported = pool.export();

      const pool2 = createComputePool(() => currentTime);
      pool2.import(exported);

      const restored = pool2.getJob(job.id);
      expect(restored).toBeDefined();
      expect(restored?.status).toBe(JobStatus.Claimed);
      expect(restored?.claimedBy).toBe('provider');

      const stats = pool2.getStats();
      expect(stats.totalPaymentReceived).toBe(100);
    });
  });

  // ===========================================================================
  // ECONOMIC SCENARIOS
  // ===========================================================================
  describe('economic scenarios', () => {
    it('full bootstrap flow: request → claim → complete → mint', () => {
      const mintedUnits: any[] = [];
      pool.setMintCallback((amount, wallet, purpose, locality, note) => {
        const id = `unit-${mintedUnits.length}`;
        mintedUnits.push({ amount, wallet, purpose, locality, note });
        return id;
      });

      // 1. Scientist needs climate simulation
      const job = pool.submitJob(
        'scientist',
        {
          type: JobType.Simulation,
          payload: { model: 'climate-2030', params: { co2: 450 } },
          estimatedCompute: 1000,
          description: 'Climate projection for 2030',
        },
        500, // Pays $500 worth
        { purpose: 'climate-research', rewardMultiplier: 1.2 }
      );

      expect(job.reward).toBe(600); // 500 * 1.2

      // 2. Compute provider claims the job
      pool.claimJob(job.id, 'compute-provider');

      // 3. Provider completes and submits result
      const result = pool.submitResult(job.id, 'compute-provider', {
        output: { temperature_anomaly: 1.8, confidence: 0.95 },
        proof: {
          type: ProofType.Attestation,
          data: { hash: 'abc123', signature: 'sig' },
          timestamp: currentTime,
        },
        actualCompute: 1100,
        executionTime: 3600000,
      });

      // 4. Provider receives minted Ω
      expect(result.success).toBe(true);
      expect(result.amountMinted).toBe(600);
      expect(mintedUnits[0].purpose).toBe('climate-research');

      // Stats show the flow
      const stats = pool.getStats();
      expect(stats.totalPaymentReceived).toBe(500);
      expect(stats.totalRewardsMinted).toBe(600);
      expect(stats.totalComputeProcessed).toBe(1100);
    });

    it('multiple providers compete for jobs', () => {
      pool.submitJob('requestor', createBasicSpec(), 100);
      pool.submitJob('requestor', createBasicSpec(), 200);
      pool.submitJob('requestor', createBasicSpec(), 150);

      // Provider 1 claims highest value
      const available = pool.getAvailableJobs();
      const sorted = available.sort((a, b) => b.reward - a.reward);
      pool.claimJob(sorted[0].id, 'fast-provider');

      // Provider 2 gets next best
      const remaining = pool.getAvailableJobs();
      expect(remaining.length).toBe(2);
      pool.claimJob(remaining[0].id, 'other-provider');

      expect(pool.getJobsByProvider('fast-provider').length).toBe(1);
      expect(pool.getJobsByProvider('other-provider').length).toBe(1);
    });

    it('failed verification does not mint', () => {
      const mintedUnits: any[] = [];
      pool.setMintCallback((amount, wallet) => {
        mintedUnits.push({ amount, wallet });
        return 'unit-id';
      });

      const job = pool.submitJob('requestor', createBasicSpec(), 100);
      pool.claimJob(job.id, 'provider');

      // Submit with invalid compute amount
      const result = pool.submitResult(job.id, 'provider', {
        output: {},
        proof: {
          type: ProofType.Attestation,
          data: {},
          timestamp: currentTime,
        },
        actualCompute: -1, // Invalid!
        executionTime: 1000,
      });

      expect(result.success).toBe(false);
      expect(mintedUnits.length).toBe(0);
      expect(pool.getJob(job.id)?.status).toBe(JobStatus.Failed);
    });
  });
});
