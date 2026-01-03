/**
 * OMNIUM Economics Layer
 *
 * The economic mechanisms that make Omnium self-sustaining.
 *
 * Core principle: Fees and demurrage don't vanish - they flow
 * to where they create the most value.
 *
 * Components:
 * - DividendPool: Time preference arbitrage (demurrage → dividends)
 * - CommunityFund: Local economic sovereignty (exit fees → community)
 * - ComputePool: Proof-of-Useful-Compute bootstrap (external value → minting)
 * - SimulationRegistry: Verified emergence (law sets, containers, proofs)
 * - PurposeFund: Intent-aligned resources (removal fees → purpose) [TODO]
 */

export * from './dividend-pool.js';
export * from './community-fund.js';
export * from './compute-pool.js';
export * from './simulation.js';
