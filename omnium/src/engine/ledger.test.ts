/**
 * Ledger Integration Tests
 *
 * Tests for the central ledger coordinating all operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OmniumLedger, createLedger } from './ledger.js';
import { TemporalStratum, ProvenanceType } from '../core/types.js';
import { TIME } from '../test-utils.js';

describe('OmniumLedger', () => {
  let ledger: OmniumLedger;

  beforeEach(() => {
    ledger = createLedger();
  });

  // =========================================================================
  // MINTING
  // =========================================================================
  describe('mint', () => {
    it('creates unit with specified amount', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      expect(unit.magnitude).toBe(100);
    });

    it('adds unit to wallet', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      ledger.mint(100, wallet.id);

      const balance = ledger.wallets.getBalance(wallet.id);
      expect(balance.total).toBe(100);
    });

    it('updates pool supply', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      ledger.mint(100, wallet.id);

      expect(ledger.pool.getState().currentSupply).toBe(100);
    });

    it('throws for unknown wallet', () => {
      expect(() => ledger.mint(100, 'unknown')).toThrow('not found');
    });

    it('creates T0 global unrestricted units', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      expect(unit.temporality).toBe(TemporalStratum.T0);
      expect(unit.locality.size).toBe(0);
      expect(unit.purpose.size).toBe(0);
    });
  });

  // =========================================================================
  // CONVERSION
  // =========================================================================
  describe('convert', () => {
    it('converts temporality', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      const converted = ledger.convert(unit.id, {
        targetTemporality: TemporalStratum.T2,
      });

      expect(converted.temporality).toBe(TemporalStratum.T2);
    });

    it('applies fees for conversion', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      // First convert to T1 (free), then back to T0 (2% fee)
      const t1 = ledger.convert(unit.id, {
        targetTemporality: TemporalStratum.T1,
      });
      const t0 = ledger.convert(t1.id, {
        targetTemporality: TemporalStratum.T0,
      });

      expect(t0.magnitude).toBe(98); // 2% fee
    });

    it('burns fees from supply', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      ledger.convert(unit.id, {
        targetTemporality: TemporalStratum.T1,
      });
      const converted = ledger.convert(
        ledger.wallets.getUnits(wallet.id)[0].id,
        {
          targetTemporality: TemporalStratum.T0,
        }
      );

      const state = ledger.pool.getState();
      expect(state.currentSupply).toBe(98);
      expect(state.totalBurned).toBe(2);
    });

    it('updates wallet units', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      ledger.convert(unit.id, { targetTemporality: TemporalStratum.T2 });

      const units = ledger.wallets.getUnits(wallet.id);
      expect(units.length).toBe(1);
      expect(units[0].temporality).toBe(TemporalStratum.T2);
    });

    it('records transaction', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);

      ledger.convert(unit.id, { targetTemporality: TemporalStratum.T1 });

      const txs = ledger.getTransactions();
      expect(txs.some((tx) => tx.type === 'convert')).toBe(true);
    });

    it('throws for unknown unit', () => {
      expect(() =>
        ledger.convert('unknown', { targetTemporality: TemporalStratum.T1 })
      ).toThrow('not found');
    });

    it('adds locality', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);
      const community = ledger.communities.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      const converted = ledger.convert(unit.id, {
        targetLocality: { add: [community.id] },
      });

      expect(converted.locality.has(community.id)).toBe(true);
    });

    it('routes exit fees to community funds', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);
      const community = ledger.communities.createCommunity({
        name: 'Village',
        boundaryFee: 0.05, // 5% exit fee
      });

      // Enter community (1% entry fee)
      const inCommunity = ledger.convert(unit.id, {
        targetLocality: { add: [community.id] },
      });
      expect(inCommunity.magnitude).toBeCloseTo(99, 1); // 1% entry fee

      // Exit community (5% exit fee)
      const exited = ledger.convert(inCommunity.id, {
        targetLocality: { remove: [community.id] },
      });

      // Exit fee should be ~5% of 99 = ~4.95
      const exitFee = 99 * 0.05;
      expect(exited.magnitude).toBeCloseTo(99 - exitFee, 1);

      // Community fund should have received the exit fee
      const fund = ledger.communityFunds.getFund(community.id);
      expect(fund.getBalance()).toBeCloseTo(exitFee, 1);
    });

    it('burns entry fees but not exit fees', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);
      const community = ledger.communities.createCommunity({
        name: 'Village',
        boundaryFee: 0.05,
      });

      // Entry: 1% of 100 = 1 (burned)
      const inCommunity = ledger.convert(unit.id, {
        targetLocality: { add: [community.id] },
      });

      const stateAfterEntry = ledger.pool.getState();
      expect(stateAfterEntry.totalBurned).toBe(1);

      // Exit: 5% of 99 = 4.95 (to community fund, not burned)
      ledger.convert(inCommunity.id, {
        targetLocality: { remove: [community.id] },
      });

      const stateAfterExit = ledger.pool.getState();
      // Only entry fee was burned, exit fee went to community fund
      expect(stateAfterExit.totalBurned).toBe(1);
      expect(ledger.communityFunds.getTotalBalance()).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // TRANSFER
  // =========================================================================
  describe('transfer', () => {
    it('moves unit to destination wallet', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      const result = ledger.transfer(unit.id, bob.id);

      expect(result.success).toBe(true);
      expect(ledger.wallets.getBalance(alice.id).total).toBe(0);
      expect(ledger.wallets.getBalance(bob.id).total).toBe(100);
    });

    it('supports partial transfer', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      ledger.transfer(unit.id, bob.id, 30);

      expect(ledger.wallets.getBalance(alice.id).total).toBe(70);
      expect(ledger.wallets.getBalance(bob.id).total).toBe(30);
    });

    it('adds transfer provenance', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      ledger.transfer(unit.id, bob.id, undefined, 'Payment');

      const bobUnits = ledger.wallets.getUnits(bob.id);
      const lastEntry = bobUnits[0].provenance[bobUnits[0].provenance.length - 1];
      expect(lastEntry.type).toBe(ProvenanceType.Earned);
      expect(lastEntry.note).toBe('Payment');
    });

    it('uses Gifted type when no note', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      ledger.transfer(unit.id, bob.id);

      const bobUnits = ledger.wallets.getUnits(bob.id);
      const lastEntry = bobUnits[0].provenance[bobUnits[0].provenance.length - 1];
      expect(lastEntry.type).toBe(ProvenanceType.Gifted);
    });

    it('fails for insufficient balance', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      const result = ledger.transfer(unit.id, bob.id, 150);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    it('fails for unknown unit', () => {
      const bob = ledger.wallets.createWallet('Bob');
      const result = ledger.transfer('unknown', bob.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('fails for unknown destination wallet', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, alice.id);

      const result = ledger.transfer(unit.id, 'unknown');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('validates purpose restrictions', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      // Add purpose to unit
      const purpose = ledger.purposes.createPurpose({ name: 'custom' });
      const converted = ledger.convert(unit.id, {
        targetPurpose: { add: [purpose.id] },
      });

      // Bob is not registered for purpose
      const result = ledger.transfer(converted.id, bob.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('records transaction', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const unit = ledger.mint(100, alice.id);

      ledger.transfer(unit.id, bob.id);

      const txs = ledger.getTransactions();
      expect(txs.some((tx) => tx.type === 'transfer')).toBe(true);
    });
  });

  // =========================================================================
  // TICK
  // =========================================================================
  describe('tick', () => {
    it('advances time', () => {
      const before = ledger.currentTime;
      ledger.tick(10);
      const after = ledger.currentTime;

      expect(after - before).toBe(10 * TIME.MS_PER_DAY);
    });

    it('applies demurrage to T0 units', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      ledger.mint(100, wallet.id);

      // Advance 1 year
      ledger.tick(365);

      const balance = ledger.wallets.getBalance(wallet.id);
      expect(balance.total).toBeLessThan(100);
      expect(balance.total).toBeCloseTo(98.02, 1); // ~2% decay
    });

    it('applies dividends to T2 units when pool is funded', () => {
      // Create T0 holder (will pay demurrage) and T2 holder (will earn dividends)
      const spender = ledger.wallets.createWallet('Spender');
      const saver = ledger.wallets.createWallet('Saver');

      // Mint enough T0 to fund the dividend pool via demurrage
      // T0 demurrage (2%) on 1000Ω = ~20Ω per year
      // T2 dividend (3%) on 100Ω = ~3Ω per year
      ledger.mint(1000, spender.id);
      const t2Unit = ledger.mint(100, saver.id);
      ledger.convert(t2Unit.id, { targetTemporality: TemporalStratum.T2 });

      // Advance 1 year - demurrage funds dividends
      const tickResult = ledger.tick(365);

      // T0 paid demurrage into pool
      expect(tickResult.totalDemurrage).toBeGreaterThan(0);
      // T2 requested and received dividends from pool
      expect(tickResult.dividendRequested).toBeGreaterThan(0);
      expect(tickResult.dividendFunded).toBeGreaterThan(0);

      // Saver's T2 unit should have grown
      const saverBalance = ledger.wallets.getBalance(saver.id);
      expect(saverBalance.total).toBeGreaterThan(100);
      expect(saverBalance.total).toBeCloseTo(103.05, 1); // ~3% growth
    });

    it('limits dividends when pool is underfunded', () => {
      // Only T2 holder, no demurrage source
      const saver = ledger.wallets.createWallet('Saver');
      const unit = ledger.mint(100, saver.id);
      ledger.convert(unit.id, { targetTemporality: TemporalStratum.T2 });

      // Advance 1 year - but pool has no funds!
      const tickResult = ledger.tick(365);

      // Dividend was requested but not funded
      expect(tickResult.dividendRequested).toBeGreaterThan(0);
      expect(tickResult.dividendFunded).toBe(0);
      expect(tickResult.poolBalance).toBe(0);

      // Balance unchanged (no dividend growth without funding)
      const balance = ledger.wallets.getBalance(saver.id);
      expect(balance.total).toBe(100);
    });

    it('returns tick statistics', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      ledger.mint(100, wallet.id);

      const result = ledger.tick(365);

      expect(result.updated).toBeGreaterThan(0);
      expect(result.totalDemurrage).toBeGreaterThan(0);
      // New pool-aware statistics
      expect(result.poolBalance).toBeGreaterThan(0); // Demurrage deposited to pool
      expect(typeof result.dividendRequested).toBe('number');
      expect(typeof result.dividendFunded).toBe('number');
    });

    it('does not change T1 units', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      const unit = ledger.mint(100, wallet.id);
      ledger.convert(unit.id, { targetTemporality: TemporalStratum.T1 });

      ledger.tick(365);

      const balance = ledger.wallets.getBalance(wallet.id);
      expect(balance.total).toBe(100);
    });
  });

  // =========================================================================
  // TIME MANAGEMENT
  // =========================================================================
  describe('time', () => {
    it('setTime updates currentTime', () => {
      ledger.setTime(1000000);
      expect(ledger.currentTime).toBe(1000000);
    });

    it('currentTime comes from pool', () => {
      const time = ledger.currentTime;
      expect(time).toBe(ledger.pool.getTime());
    });
  });

  // =========================================================================
  // STATUS
  // =========================================================================
  describe('status', () => {
    it('includes supply information', () => {
      const wallet = ledger.wallets.createWallet('Alice');
      ledger.mint(100, wallet.id);

      const status = ledger.status();

      expect(status).toContain('Supply');
      expect(status).toContain('100');
    });

    it('includes wallet count', () => {
      ledger.wallets.createWallet('Alice');
      ledger.wallets.createWallet('Bob');

      const status = ledger.status();

      expect(status).toContain('Wallets');
      expect(status).toContain('2');
    });
  });

  // =========================================================================
  // COMPONENT ACCESS
  // =========================================================================
  describe('component access', () => {
    it('exposes pool', () => {
      expect(ledger.pool).toBeDefined();
    });

    it('exposes wallets', () => {
      expect(ledger.wallets).toBeDefined();
    });

    it('exposes conversion engine', () => {
      expect(ledger.conversion).toBeDefined();
    });

    it('exposes communities', () => {
      expect(ledger.communities).toBeDefined();
    });

    it('exposes purposes', () => {
      expect(ledger.purposes).toBeDefined();
    });
  });

  // =========================================================================
  // INTEGRATION SCENARIOS
  // =========================================================================
  describe('integration scenarios', () => {
    it('supports full workflow: mint → convert → transfer → tick', () => {
      // Setup
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');
      const community = ledger.communities.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      // Mint
      const unit = ledger.mint(1000, alice.id, 'Initial mint');
      expect(ledger.pool.getState().currentSupply).toBe(1000);

      // Convert to local currency
      const localUnit = ledger.convert(unit.id, {
        targetLocality: { add: [community.id] },
      });
      expect(localUnit.locality.has(community.id)).toBe(true);
      expect(localUnit.magnitude).toBe(990); // 1% entry fee

      // Transfer half to Bob
      ledger.transfer(localUnit.id, bob.id, 450, 'Payment for services');

      expect(ledger.wallets.getBalance(alice.id).total).toBe(540); // 990 - 450
      expect(ledger.wallets.getBalance(bob.id).total).toBe(450);

      // Advance time
      ledger.tick(30); // 30 days

      // Balances should decay slightly (T0 demurrage)
      const aliceBalance = ledger.wallets.getBalance(alice.id);
      const bobBalance = ledger.wallets.getBalance(bob.id);

      expect(aliceBalance.total).toBeLessThan(540);
      expect(bobBalance.total).toBeLessThan(450);
    });

    it('maintains supply invariant through operations', () => {
      const alice = ledger.wallets.createWallet('Alice');
      const bob = ledger.wallets.createWallet('Bob');

      // Series of operations
      ledger.mint(1000, alice.id);
      ledger.mint(500, bob.id);

      const unit = ledger.wallets.getUnits(alice.id)[0];
      ledger.convert(unit.id, { targetTemporality: TemporalStratum.T1 });
      ledger.convert(
        ledger.wallets.getUnits(alice.id)[0].id,
        { targetTemporality: TemporalStratum.T0 } // 2% fee
      );

      ledger.transfer(ledger.wallets.getUnits(alice.id)[0].id, bob.id, 100);

      const state = ledger.pool.getState();

      // Supply = minted - burned
      expect(state.currentSupply).toBeCloseTo(
        state.totalMinted - state.totalBurned,
        6
      );
    });
  });

  // =========================================================================
  // COMPUTE POOL INTEGRATION
  // =========================================================================
  describe('compute pool integration', () => {
    it('has compute pool wired up', () => {
      expect(ledger.computePool).toBeDefined();
      expect(ledger.simulations).toBeDefined();
    });

    it('submits compute job', () => {
      const job = ledger.submitComputeJob(
        'external-requestor',
        {
          type: 'simulation' as const,
          payload: { climate: 'model' },
          estimatedCompute: 1000,
          description: 'Climate simulation',
        },
        100 // $100 payment
      );

      expect(job.id).toBeDefined();
      expect(job.payment).toBe(100);
      expect(job.reward).toBe(100); // 1:1 by default
    });

    it('provider claims and completes job, receives minted Ω', () => {
      const provider = ledger.wallets.createWallet('Provider');

      // Submit job
      const job = ledger.submitComputeJob(
        'external-requestor',
        {
          type: 'simulation' as const,
          payload: { climate: 'model' },
          estimatedCompute: 1000,
        },
        100
      );

      // Provider claims
      const claimed = ledger.claimComputeJob(job.id, provider.id);
      expect(claimed).toBe(true);

      // Provider completes
      const result = ledger.completeComputeJob(job.id, provider.id, {
        output: { temperature: 2.5 },
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 1000,
        executionTime: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.amountMinted).toBe(100);

      // Provider should have the minted Ω
      const balance = ledger.wallets.getBalance(provider.id);
      expect(balance.total).toBe(100);
    });

    it('minted compute rewards are T0', () => {
      const provider = ledger.wallets.createWallet('Provider');

      const job = ledger.submitComputeJob(
        'external',
        { type: 'analysis' as const, payload: {}, estimatedCompute: 100 },
        50
      );

      ledger.claimComputeJob(job.id, provider.id);
      ledger.completeComputeJob(job.id, provider.id, {
        output: {},
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 100,
        executionTime: 1000,
      });

      const units = ledger.wallets.getUnits(provider.id);
      expect(units[0].temporality).toBe(TemporalStratum.T0);
    });

    it('compute rewards update supply', () => {
      const provider = ledger.wallets.createWallet('Provider');

      const job = ledger.submitComputeJob(
        'external',
        { type: 'training' as const, payload: {}, estimatedCompute: 500 },
        200
      );

      ledger.claimComputeJob(job.id, provider.id);
      ledger.completeComputeJob(job.id, provider.id, {
        output: { model: 'trained' },
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 500,
        executionTime: 10000,
      });

      const state = ledger.pool.getState();
      expect(state.currentSupply).toBe(200);
      expect(state.totalMinted).toBe(200);
    });

    it('claim fails for nonexistent wallet', () => {
      const job = ledger.submitComputeJob(
        'external',
        { type: 'simulation' as const, payload: {}, estimatedCompute: 100 },
        50
      );

      const claimed = ledger.claimComputeJob(job.id, 'nonexistent-wallet');
      expect(claimed).toBe(false);
    });

    it('compute rewards can have purpose-coloring', () => {
      const provider = ledger.wallets.createWallet('Provider');
      const researchPurpose = ledger.purposes.createPurpose({
        name: 'research',
        description: 'Research funding',
      });

      const job = ledger.submitComputeJob(
        'external',
        { type: 'simulation' as const, payload: {}, estimatedCompute: 100 },
        100,
        { purpose: researchPurpose.id }
      );

      ledger.claimComputeJob(job.id, provider.id);
      const result = ledger.completeComputeJob(job.id, provider.id, {
        output: {},
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 100,
        executionTime: 1000,
      });

      expect(result.success).toBe(true);
      const units = ledger.wallets.getUnits(provider.id);
      expect(units[0].purpose.has(researchPurpose.id)).toBe(true);
    });

    it('compute rewards can have locality', () => {
      const provider = ledger.wallets.createWallet('Provider');
      const labCommunity = ledger.communities.createCommunity({
        name: 'Research Lab',
        boundaryFee: 0.03,
      });

      const job = ledger.submitComputeJob(
        'external',
        { type: 'simulation' as const, payload: {}, estimatedCompute: 100 },
        100,
        { locality: labCommunity.id }
      );

      ledger.claimComputeJob(job.id, provider.id);
      const result = ledger.completeComputeJob(job.id, provider.id, {
        output: {},
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 100,
        executionTime: 1000,
      });

      expect(result.success).toBe(true);
      const units = ledger.wallets.getUnits(provider.id);
      expect(units[0].locality.has(labCommunity.id)).toBe(true);
    });

    it('tracks compute stats in status', () => {
      const provider = ledger.wallets.createWallet('Provider');

      ledger.submitComputeJob(
        'external',
        { type: 'simulation' as const, payload: {}, estimatedCompute: 100 },
        50
      );

      const job2 = ledger.submitComputeJob(
        'external',
        { type: 'analysis' as const, payload: {}, estimatedCompute: 200 },
        75
      );

      ledger.claimComputeJob(job2.id, provider.id);
      ledger.completeComputeJob(job2.id, provider.id, {
        output: {},
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 200,
        executionTime: 2000,
      });

      const stats = ledger.getComputeStats();
      expect(stats.pendingJobs).toBe(1);
      expect(stats.completedJobs).toBe(1);
      expect(stats.totalPaymentReceived).toBe(125);
      expect(stats.totalRewardsMinted).toBe(75);
    });

    it('status() includes compute pool section', () => {
      const status = ledger.status();
      expect(status).toContain('Compute Pool (Bootstrap)');
      expect(status).toContain('Jobs Pending');
      expect(status).toContain('Rewards Minted');
    });

    it('full bootstrap flow: compute → demurrage → dividends', () => {
      const provider = ledger.wallets.createWallet('Provider');

      // Step 1: Provider does compute work, receives T0 Ω
      const job = ledger.submitComputeJob(
        'external',
        { type: 'simulation' as const, payload: {}, estimatedCompute: 1000 },
        1000
      );

      ledger.claimComputeJob(job.id, provider.id);
      ledger.completeComputeJob(job.id, provider.id, {
        output: { result: 'simulation-complete' },
        proof: { type: 'attestation' as const, data: {}, timestamp: Date.now() },
        actualCompute: 1000,
        executionTime: 10000,
      });

      expect(ledger.wallets.getBalance(provider.id).total).toBe(1000);

      // Step 2: Time passes, T0 demurrage accumulates in dividend pool
      ledger.tick(365); // 1 year

      const divStats = ledger.getDividendPoolStats();
      expect(divStats.totalDemurrageCollected).toBeGreaterThan(0);

      // Provider's T0 should have decayed
      const balance = ledger.wallets.getBalance(provider.id);
      expect(balance.total).toBeLessThan(1000);

      // The demurrage flowed to dividend pool
      expect(divStats.balance).toBeGreaterThan(0);
    });
  });
});
