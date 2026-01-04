/**
 * Blockchain Anchor Module
 *
 * Anchors Omnium state to the blockchain for:
 * - Permanent head CID resolution (on-chain IPNS alternative)
 * - Provable checkpoints with Merkle proofs
 * - Temporal lock enforcement
 */

export * from './merkle.js';
export * from './types.js';
export * from './blockchain-anchor.js';
