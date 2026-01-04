/**
 * BlockchainAnchor - Anchors Omnium state to the blockchain
 *
 * Provides:
 * - Head CID publishing (on-chain IPNS alternative)
 * - Checkpoint creation with provenance Merkle roots
 * - Temporal lock management
 * - Provenance proof verification
 */

import { CID } from 'multiformats/cid';
import {
  buildProvenanceTree,
  generateProof,
  toBytes32,
  fromBytes32,
  serializeProof,
  type MerkleTree,
  type MerkleProof,
  type ProvenanceEntry,
} from './merkle.js';
import {
  type AnchorConfig,
  type Checkpoint,
  type TemporalLock,
  type AnchorResult,
  type CheckpointResult,
  type LockResult,
  type ProofVerificationResult,
  STRATUM_TO_NUMBER,
  NUMBER_TO_STRATUM,
  OMNIUM_ANCHOR_ABI,
  type TemporalStratum,
} from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LedgerSnapshot {
  height: number;
  totalSupply: number;
  unitCount: number;
  units: Array<{
    id: string;
    provenance: ProvenanceEntry[];
  }>;
}

export interface BlockchainProvider {
  // Read operations
  call(to: string, data: string): Promise<string>;
  getBlockNumber(): Promise<number>;

  // Write operations (optional, for anchoring)
  sendTransaction?(tx: {
    to: string;
    data: string;
    value?: bigint;
  }): Promise<{ hash: string; wait: () => Promise<{ blockNumber: number }> }>;
}

// =============================================================================
// CID UTILITIES
// =============================================================================

/**
 * Convert a CID to bytes32 format for the contract
 * Uses the multihash digest (32 bytes for SHA-256)
 */
export function cidToBytes32(cid: CID | string): string {
  const parsed = typeof cid === 'string' ? CID.parse(cid) : cid;
  // Get the multihash digest (should be 32 bytes for SHA-256)
  const digest = parsed.multihash.digest;
  if (digest.length !== 32) {
    throw new Error(`CID digest must be 32 bytes, got ${digest.length}`);
  }
  return toBytes32(digest);
}

/**
 * Reconstruct CID from bytes32 (requires knowing the codec)
 * This is lossy - we assume SHA-256 and the original codec
 */
export function bytes32ToCidDigest(bytes32: string): Uint8Array {
  return fromBytes32(bytes32);
}

// =============================================================================
// BLOCKCHAIN ANCHOR
// =============================================================================

export class BlockchainAnchor {
  private config: AnchorConfig;
  private provider: BlockchainProvider;
  private provenanceTree: MerkleTree | null = null;
  private provenanceEntries: ProvenanceEntry[] = [];

  constructor(config: AnchorConfig, provider: BlockchainProvider) {
    this.config = config;
    this.provider = provider;
  }

  // ===========================================================================
  // NODE MANAGEMENT
  // ===========================================================================

  /**
   * Register this node on-chain
   */
  async registerNode(): Promise<AnchorResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    try {
      const data = this.encodeCall('registerNode', [this.config.nodeId]);
      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Check if this node is registered
   */
  async isNodeRegistered(): Promise<boolean> {
    const data = this.encodeCall('nodeOwners', [this.config.nodeId]);
    const result = await this.provider.call(this.config.contractAddress, data);
    // If owner is zero address, not registered
    return result !== '0x' + '0'.repeat(64);
  }

  // ===========================================================================
  // HEAD RESOLUTION (IPNS Alternative)
  // ===========================================================================

  /**
   * Update the head CID on-chain
   */
  async updateHead(headCid: CID | string, height: number): Promise<AnchorResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    try {
      const cidBytes = cidToBytes32(headCid);
      const data = this.encodeCall('updateHead', [
        this.config.nodeId,
        cidBytes,
        height,
      ]);
      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Resolve a node's current head CID from chain
   */
  async resolveHead(nodeId?: string): Promise<string | null> {
    const targetNode = nodeId ?? this.config.nodeId;
    const data = this.encodeCall('resolveHead', [targetNode]);
    const result = await this.provider.call(this.config.contractAddress, data);

    if (result === '0x' + '0'.repeat(64)) {
      return null;
    }

    return result;
  }

  // ===========================================================================
  // CHECKPOINTS
  // ===========================================================================

  /**
   * Build provenance tree from current snapshot
   */
  async buildProvenanceTree(snapshot: LedgerSnapshot): Promise<MerkleTree> {
    // Collect all provenance entries
    const entries: ProvenanceEntry[] = [];
    for (const unit of snapshot.units) {
      for (const entry of unit.provenance) {
        entries.push({
          unitId: unit.id,
          ...entry,
        });
      }
    }

    this.provenanceEntries = entries;
    this.provenanceTree = await buildProvenanceTree(entries);
    return this.provenanceTree;
  }

  /**
   * Create a checkpoint on-chain
   */
  async createCheckpoint(
    headCid: CID | string,
    snapshotCid: CID | string,
    snapshot: LedgerSnapshot
  ): Promise<CheckpointResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    try {
      // Build provenance tree
      const tree = await this.buildProvenanceTree(snapshot);

      const data = this.encodeCall('createCheckpoint', [
        this.config.nodeId,
        cidToBytes32(headCid),
        cidToBytes32(snapshotCid),
        toBytes32(tree.root),
        snapshot.height,
        BigInt(Math.floor(snapshot.totalSupply * 1e18)),
        snapshot.unitCount,
      ]);

      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();

      // Get checkpoint count to determine index
      const countData = this.encodeCall('getCheckpointCount', [this.config.nodeId]);
      const countResult = await this.provider.call(this.config.contractAddress, countData);
      const checkpointIndex = parseInt(countResult, 16) - 1;

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        checkpointIndex,
        provenanceRoot: toBytes32(tree.root),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get checkpoint count
   */
  async getCheckpointCount(nodeId?: string): Promise<number> {
    const targetNode = nodeId ?? this.config.nodeId;
    const data = this.encodeCall('getCheckpointCount', [targetNode]);
    const result = await this.provider.call(this.config.contractAddress, data);
    return parseInt(result, 16);
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(index: number, nodeId?: string): Promise<Checkpoint | null> {
    const targetNode = nodeId ?? this.config.nodeId;
    try {
      const data = this.encodeCall('getCheckpoint', [targetNode, index]);
      const result = await this.provider.call(this.config.contractAddress, data);
      return this.decodeCheckpoint(result);
    } catch {
      return null;
    }
  }

  /**
   * Get the latest checkpoint
   */
  async getLatestCheckpoint(nodeId?: string): Promise<Checkpoint | null> {
    const targetNode = nodeId ?? this.config.nodeId;
    try {
      const data = this.encodeCall('getLatestCheckpoint', [targetNode]);
      const result = await this.provider.call(this.config.contractAddress, data);
      return this.decodeCheckpoint(result);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // PROVENANCE PROOFS
  // ===========================================================================

  /**
   * Generate a Merkle proof for a provenance entry
   */
  generateProvenanceProof(entryIndex: number): MerkleProof | null {
    if (!this.provenanceTree) {
      return null;
    }
    try {
      return generateProof(this.provenanceTree, entryIndex);
    } catch {
      return null;
    }
  }

  /**
   * Find and generate proof for a specific entry
   */
  findAndGenerateProof(
    unitId: string,
    timestamp: number
  ): { proof: MerkleProof; entry: ProvenanceEntry } | null {
    if (!this.provenanceTree) {
      return null;
    }

    const index = this.provenanceEntries.findIndex(
      (e) => e.unitId === unitId && e.timestamp === timestamp
    );

    if (index === -1) {
      return null;
    }

    const proof = generateProof(this.provenanceTree, index);
    return { proof, entry: this.provenanceEntries[index] };
  }

  /**
   * Verify a provenance proof on-chain
   */
  async verifyProvenanceOnChain(
    checkpointIndex: number,
    proof: MerkleProof,
    nodeId?: string
  ): Promise<ProofVerificationResult> {
    const targetNode = nodeId ?? this.config.nodeId;
    const serialized = serializeProof(proof);

    try {
      const data = this.encodeCall('verifyProvenance', [
        targetNode,
        checkpointIndex,
        serialized.leaf,
        serialized.proof,
        serialized.index,
      ]);
      const result = await this.provider.call(this.config.contractAddress, data);
      const valid = result !== '0x' + '0'.repeat(64);

      if (valid) {
        const checkpoint = await this.getCheckpoint(checkpointIndex, targetNode);
        return {
          valid: true,
          checkpointIndex,
          timestamp: checkpoint?.timestamp,
        };
      }

      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Anchor a provenance hash on-chain (for indexing)
   */
  async anchorProvenance(
    checkpointIndex: number,
    proof: MerkleProof
  ): Promise<AnchorResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    const serialized = serializeProof(proof);

    try {
      const data = this.encodeCall('anchorProvenance', [
        this.config.nodeId,
        checkpointIndex,
        serialized.leaf,
        serialized.proof,
        serialized.index,
      ]);
      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // ===========================================================================
  // TEMPORAL LOCKS
  // ===========================================================================

  /**
   * Create a temporal lock (T0 → T2/T∞)
   */
  async createTemporalLock(
    unitCid: CID | string,
    amount: number,
    toStratum: TemporalStratum,
    lockDurationYears?: number
  ): Promise<LockResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    const stratumNum = STRATUM_TO_NUMBER[toStratum];
    if (stratumNum < 2) {
      return { success: false, error: 'Can only lock to T2 or TInfinity' };
    }

    // T2 = 20 years, T∞ = max uint64
    const durationSeconds =
      stratumNum === 3
        ? BigInt('18446744073709551615') // max uint64
        : BigInt((lockDurationYears ?? 20) * 365 * 24 * 60 * 60);

    try {
      const data = this.encodeCall('createTemporalLock', [
        this.config.nodeId,
        cidToBytes32(unitCid),
        BigInt(Math.floor(amount * 1e18)),
        durationSeconds,
        stratumNum,
      ]);
      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();

      // TODO: Parse lockId from event logs
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Release a temporal lock (T2 → T0)
   */
  async releaseTemporalLock(lockId: string): Promise<AnchorResult> {
    if (!this.provider.sendTransaction) {
      return { success: false, error: 'Write operations not supported' };
    }

    try {
      const data = this.encodeCall('releaseTemporalLock', [lockId]);
      const tx = await this.provider.sendTransaction({
        to: this.config.contractAddress,
        data,
      });
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Check if a lock can be released
   */
  async canReleaseLock(lockId: string): Promise<boolean> {
    const data = this.encodeCall('canRelease', [lockId]);
    const result = await this.provider.call(this.config.contractAddress, data);
    return result !== '0x' + '0'.repeat(64);
  }

  /**
   * Get lock details
   */
  async getLock(lockId: string): Promise<TemporalLock | null> {
    try {
      const data = this.encodeCall('getLock', [lockId]);
      const result = await this.provider.call(this.config.contractAddress, data);
      return this.decodeTemporalLock(result);
    } catch {
      return null;
    }
  }

  /**
   * Get all locks for an address
   */
  async getOwnerLocks(owner: string): Promise<string[]> {
    const data = this.encodeCall('getOwnerLocks', [owner]);
    const result = await this.provider.call(this.config.contractAddress, data);
    return this.decodeBytes32Array(result);
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Get node ID as bytes32
   */
  getNodeId(): string {
    return this.config.nodeId;
  }

  /**
   * Check if anchor is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  // ===========================================================================
  // ENCODING HELPERS (simplified - production would use ethers.js or viem)
  // ===========================================================================

  private encodeCall(method: string, args: unknown[]): string {
    // Simplified encoding - in production use ethers.js Interface
    // This is a placeholder that returns the method signature
    const selector = this.getSelector(method);
    const encodedArgs = args
      .map((arg) => {
        if (typeof arg === 'string' && arg.startsWith('0x')) {
          return arg.slice(2).padStart(64, '0');
        }
        if (typeof arg === 'number' || typeof arg === 'bigint') {
          return BigInt(arg).toString(16).padStart(64, '0');
        }
        if (Array.isArray(arg)) {
          // Arrays need offset + length + elements
          return this.encodeArray(arg);
        }
        return String(arg).padStart(64, '0');
      })
      .join('');
    return selector + encodedArgs;
  }

  private getSelector(method: string): string {
    // Simplified - would use keccak256 hash of signature
    const selectors: Record<string, string> = {
      registerNode: '0x70e2f827',
      nodeOwners: '0x9b3a2cfb',
      updateHead: '0x8f65f571',
      resolveHead: '0x67db4e18',
      createCheckpoint: '0x42a8c8d7',
      getCheckpointCount: '0x5f7b1577',
      getCheckpoint: '0x50c95f9e',
      getLatestCheckpoint: '0x4c7c7e6b',
      verifyProvenance: '0x7e5a8ad9',
      anchorProvenance: '0x3b2d7c1a',
      createTemporalLock: '0x8d4e4083',
      releaseTemporalLock: '0x2e1a7d4d',
      canRelease: '0x5a3b7e9c',
      getLock: '0xd4fa5f7e',
      getOwnerLocks: '0x6c0360eb',
    };
    return selectors[method] ?? '0x00000000';
  }

  private encodeArray(arr: unknown[]): string {
    // Encode dynamic array
    const offset = '0000000000000000000000000000000000000000000000000000000000000020';
    const length = arr.length.toString(16).padStart(64, '0');
    const elements = arr
      .map((el) => {
        if (typeof el === 'string' && el.startsWith('0x')) {
          return el.slice(2).padStart(64, '0');
        }
        return String(el).padStart(64, '0');
      })
      .join('');
    return offset + length + elements;
  }

  private decodeCheckpoint(data: string): Checkpoint {
    // Simplified decoding
    const clean = data.startsWith('0x') ? data.slice(2) : data;
    return {
      headCid: '0x' + clean.slice(0, 64),
      snapshotCid: '0x' + clean.slice(64, 128),
      provenanceRoot: '0x' + clean.slice(128, 192),
      height: BigInt('0x' + clean.slice(192, 256)),
      timestamp: BigInt('0x' + clean.slice(256, 320)),
      totalSupply: BigInt('0x' + clean.slice(320, 384)),
      unitCount: parseInt(clean.slice(384, 448), 16),
    };
  }

  private decodeTemporalLock(data: string): TemporalLock {
    const clean = data.startsWith('0x') ? data.slice(2) : data;
    return {
      unitCid: '0x' + clean.slice(0, 64),
      owner: '0x' + clean.slice(88, 128), // address is 20 bytes, right-padded
      amount: BigInt('0x' + clean.slice(128, 192)),
      lockTime: BigInt('0x' + clean.slice(192, 256)),
      unlockTime: BigInt('0x' + clean.slice(256, 320)),
      fromStratum: parseInt(clean.slice(320, 384), 16),
      toStratum: parseInt(clean.slice(384, 448), 16),
      released: clean.slice(448, 512) !== '0'.repeat(64),
    };
  }

  private decodeBytes32Array(data: string): string[] {
    const clean = data.startsWith('0x') ? data.slice(2) : data;
    // Skip offset (32 bytes), read length
    const length = parseInt(clean.slice(64, 128), 16);
    const result: string[] = [];
    for (let i = 0; i < length; i++) {
      const start = 128 + i * 64;
      result.push('0x' + clean.slice(start, start + 64));
    }
    return result;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createBlockchainAnchor(
  config: AnchorConfig,
  provider: BlockchainProvider
): BlockchainAnchor {
  return new BlockchainAnchor(config, provider);
}
