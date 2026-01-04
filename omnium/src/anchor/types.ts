/**
 * Types for blockchain anchor integration
 */

// =============================================================================
// CONTRACT TYPES
// =============================================================================

export interface Checkpoint {
  headCid: string;        // bytes32
  snapshotCid: string;    // bytes32
  provenanceRoot: string; // bytes32
  height: bigint;
  timestamp: bigint;
  totalSupply: bigint;    // scaled by 1e18
  unitCount: number;
}

export interface TemporalLock {
  unitCid: string;        // bytes32
  owner: string;          // address
  amount: bigint;         // scaled by 1e18
  lockTime: bigint;
  unlockTime: bigint;
  fromStratum: number;    // 0=T0, 1=T1, 2=T2, 3=T∞
  toStratum: number;
  released: boolean;
}

export type TemporalStratum = 'T0' | 'T1' | 'T2' | 'TInfinity';

export const STRATUM_TO_NUMBER: Record<TemporalStratum, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  TInfinity: 3,
};

export const NUMBER_TO_STRATUM: Record<number, TemporalStratum> = {
  0: 'T0',
  1: 'T1',
  2: 'T2',
  3: 'TInfinity',
};

// =============================================================================
// ANCHOR CONFIG
// =============================================================================

export interface AnchorConfig {
  /** RPC URL for the blockchain */
  rpcUrl: string;

  /** Contract address */
  contractAddress: string;

  /** Private key for signing transactions (optional for read-only) */
  privateKey?: string;

  /** Chain ID */
  chainId: number;

  /** Node ID (bytes32 identifier) */
  nodeId: string;

  /** Checkpoint interval in blocks */
  checkpointInterval?: number;

  /** Auto-anchor on state changes */
  autoAnchor?: boolean;
}

// =============================================================================
// EVENTS
// =============================================================================

export interface HeadUpdatedEvent {
  nodeId: string;
  headCid: string;
  height: bigint;
  timestamp: bigint;
}

export interface CheckpointCreatedEvent {
  nodeId: string;
  checkpointIndex: bigint;
  headCid: string;
  provenanceRoot: string;
  height: bigint;
}

export interface TemporalLockCreatedEvent {
  lockId: string;
  nodeId: string;
  owner: string;
  unitCid: string;
  amount: bigint;
  unlockTime: bigint;
  toStratum: number;
}

export interface TemporalLockReleasedEvent {
  lockId: string;
  owner: string;
  amount: bigint;
}

// =============================================================================
// OPERATION RESULTS
// =============================================================================

export interface AnchorResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

export interface CheckpointResult extends AnchorResult {
  checkpointIndex?: number;
  provenanceRoot?: string;
}

export interface LockResult extends AnchorResult {
  lockId?: string;
  unlockTime?: bigint;
}

export interface ProofVerificationResult {
  valid: boolean;
  checkpointIndex?: number;
  timestamp?: bigint;
}

// =============================================================================
// CONTRACT ABI (minimal for TypeScript usage)
// =============================================================================

export const OMNIUM_ANCHOR_ABI = [
  // Node management
  'function registerNode(bytes32 nodeId) external',
  'function setOperator(bytes32 nodeId, address operator, bool authorized) external',
  'function nodeOwners(bytes32 nodeId) external view returns (address)',
  'function operators(bytes32 nodeId, address operator) external view returns (bool)',

  // Head resolution
  'function updateHead(bytes32 nodeId, bytes32 headCid, uint64 height) external',
  'function resolveHead(bytes32 nodeId) external view returns (bytes32)',
  'function heads(bytes32 nodeId) external view returns (bytes32)',

  // Checkpoints
  'function createCheckpoint(bytes32 nodeId, bytes32 headCid, bytes32 snapshotCid, bytes32 provenanceRoot, uint64 height, uint64 totalSupply, uint32 unitCount) external',
  'function getCheckpointCount(bytes32 nodeId) external view returns (uint256)',
  'function getCheckpoint(bytes32 nodeId, uint256 index) external view returns (tuple(bytes32 headCid, bytes32 snapshotCid, bytes32 provenanceRoot, uint64 height, uint64 timestamp, uint64 totalSupply, uint32 unitCount))',
  'function getLatestCheckpoint(bytes32 nodeId) external view returns (tuple(bytes32 headCid, bytes32 snapshotCid, bytes32 provenanceRoot, uint64 height, uint64 timestamp, uint64 totalSupply, uint32 unitCount))',

  // Provenance proofs
  'function verifyProvenance(bytes32 nodeId, uint256 checkpointIndex, bytes32 provenanceHash, bytes32[] calldata proof, uint256 index) external view returns (bool)',
  'function anchorProvenance(bytes32 nodeId, uint256 checkpointIndex, bytes32 provenanceHash, bytes32[] calldata proof, uint256 index) external',
  'function isProvenanceAnchored(bytes32 nodeId, bytes32 provenanceHash) external view returns (bool anchored, uint256 checkpointIndex)',

  // Temporal locks
  'function createTemporalLock(bytes32 nodeId, bytes32 unitCid, uint64 amount, uint64 lockDuration, uint8 toStratum) external returns (bytes32 lockId)',
  'function releaseTemporalLock(bytes32 lockId) external',
  'function canRelease(bytes32 lockId) external view returns (bool)',
  'function getOwnerLocks(address owner) external view returns (bytes32[])',
  'function getLock(bytes32 lockId) external view returns (tuple(bytes32 unitCid, address owner, uint64 amount, uint64 lockTime, uint64 unlockTime, uint8 fromStratum, uint8 toStratum, bool released))',

  // Events
  'event HeadUpdated(bytes32 indexed nodeId, bytes32 indexed headCid, uint64 height, uint64 timestamp)',
  'event CheckpointCreated(bytes32 indexed nodeId, uint256 indexed checkpointIndex, bytes32 headCid, bytes32 provenanceRoot, uint64 height)',
  'event TemporalLockCreated(bytes32 indexed lockId, bytes32 indexed nodeId, address indexed owner, bytes32 unitCid, uint64 amount, uint64 unlockTime, uint8 toStratum)',
  'event TemporalLockReleased(bytes32 indexed lockId, address indexed owner, uint64 amount)',
  'event ProvenanceAnchored(bytes32 indexed nodeId, bytes32 indexed provenanceHash, uint256 checkpointIndex)',
  'event NodeRegistered(bytes32 indexed nodeId, address indexed owner)',
  'event OperatorUpdated(bytes32 indexed nodeId, address indexed operator, bool authorized)',
] as const;
