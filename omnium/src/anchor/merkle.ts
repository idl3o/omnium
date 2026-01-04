/**
 * Merkle Tree utilities for provenance proofs
 *
 * Creates Merkle trees from provenance entries, generates proofs,
 * and verifies inclusion.
 */

import { sha256 } from 'multiformats/hashes/sha2';

// =============================================================================
// TYPES
// =============================================================================

export interface MerkleTree {
  root: Uint8Array;
  leaves: Uint8Array[];
  layers: Uint8Array[][];
}

export interface MerkleProof {
  leaf: Uint8Array;
  proof: Uint8Array[];
  index: number;
  root: Uint8Array;
}

export interface ProvenanceEntry {
  unitId: string;
  timestamp: number;
  type: string;
  fromWallet?: string;
  toWallet?: string;
  amount: number;
  note?: string;
}

// =============================================================================
// HASHING
// =============================================================================

/**
 * Hash data using SHA-256
 */
export async function hash(data: Uint8Array): Promise<Uint8Array> {
  const digest = await sha256.digest(data);
  // Return just the 32-byte digest, not the full multihash (which includes prefix)
  return digest.digest;
}

/**
 * Hash two nodes together (order matters for provenance trees)
 */
export async function hashPair(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  // Concatenate left then right - order matters
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return hash(combined);
}

/**
 * Compare two byte arrays
 */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

/**
 * Convert provenance entry to bytes for hashing
 */
export function provenanceToBytes(entry: ProvenanceEntry): Uint8Array {
  const json = JSON.stringify(entry);
  return new TextEncoder().encode(json);
}

/**
 * Hash a provenance entry
 */
export async function hashProvenance(entry: ProvenanceEntry): Promise<Uint8Array> {
  const bytes = provenanceToBytes(entry);
  return hash(bytes);
}

// =============================================================================
// MERKLE TREE CONSTRUCTION
// =============================================================================

/**
 * Build a Merkle tree from leaf data
 */
export async function buildTree(leaves: Uint8Array[]): Promise<MerkleTree> {
  if (leaves.length === 0) {
    // Empty tree has zero root
    const emptyRoot = new Uint8Array(32);
    return { root: emptyRoot, leaves: [], layers: [[emptyRoot]] };
  }

  // Hash all leaves
  const hashedLeaves = await Promise.all(leaves.map((l) => hash(l)));

  // Pad to power of 2 if needed
  const paddedLeaves = [...hashedLeaves];
  while (paddedLeaves.length > 1 && !isPowerOfTwo(paddedLeaves.length)) {
    // Duplicate last leaf for padding
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1]);
  }

  const layers: Uint8Array[][] = [paddedLeaves];

  // Build layers bottom-up
  let currentLayer = paddedLeaves;
  while (currentLayer.length > 1) {
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] ?? left; // Handle odd length
      nextLayer.push(await hashPair(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves: hashedLeaves,
    layers,
  };
}

/**
 * Build a Merkle tree from provenance entries
 */
export async function buildProvenanceTree(entries: ProvenanceEntry[]): Promise<MerkleTree> {
  const leaves = entries.map(provenanceToBytes);
  return buildTree(leaves);
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

// =============================================================================
// PROOF GENERATION
// =============================================================================

/**
 * Generate a Merkle proof for a leaf at a given index
 */
export function generateProof(tree: MerkleTree, index: number): MerkleProof {
  if (index < 0 || index >= tree.leaves.length) {
    throw new Error(`Index ${index} out of bounds (0-${tree.leaves.length - 1})`);
  }

  const proof: Uint8Array[] = [];
  let currentIndex = index;

  // Walk up the tree, collecting sibling hashes
  for (let i = 0; i < tree.layers.length - 1; i++) {
    const layer = tree.layers[i];
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leaf: tree.leaves[index],
    proof,
    index,
    root: tree.root,
  };
}

/**
 * Generate a proof for a specific provenance entry
 */
export async function generateProvenanceProof(
  tree: MerkleTree,
  entry: ProvenanceEntry
): Promise<MerkleProof | null> {
  const entryHash = await hashProvenance(entry);

  // Find the entry in the tree
  const index = tree.leaves.findIndex(
    (leaf) => compareBytes(leaf, entryHash) === 0
  );

  if (index === -1) {
    return null;
  }

  return generateProof(tree, index);
}

// =============================================================================
// PROOF VERIFICATION
// =============================================================================

/**
 * Verify a Merkle proof
 */
export async function verifyProof(proof: MerkleProof): Promise<boolean> {
  let computedHash = proof.leaf;
  let index = proof.index;

  for (const sibling of proof.proof) {
    if (index % 2 === 0) {
      computedHash = await hashPair(computedHash, sibling);
    } else {
      computedHash = await hashPair(sibling, computedHash);
    }
    index = Math.floor(index / 2);
  }

  return compareBytes(computedHash, proof.root) === 0;
}

/**
 * Verify a provenance entry is included in a tree
 */
export async function verifyProvenance(
  entry: ProvenanceEntry,
  proof: MerkleProof
): Promise<boolean> {
  const entryHash = await hashProvenance(entry);
  if (compareBytes(entryHash, proof.leaf) !== 0) {
    return false;
  }
  return verifyProof(proof);
}

// =============================================================================
// SERIALIZATION (for contract interaction)
// =============================================================================

/**
 * Convert Uint8Array to bytes32 hex string
 */
export function toBytes32(data: Uint8Array): string {
  if (data.length !== 32) {
    throw new Error(`Expected 32 bytes, got ${data.length}`);
  }
  return '0x' + Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert bytes32 hex string to Uint8Array
 */
export function fromBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new Error(`Expected 64 hex chars, got ${clean.length}`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Serialize proof for contract submission
 */
export function serializeProof(proof: MerkleProof): {
  leaf: string;
  proof: string[];
  index: number;
  root: string;
} {
  return {
    leaf: toBytes32(proof.leaf),
    proof: proof.proof.map(toBytes32),
    index: proof.index,
    root: toBytes32(proof.root),
  };
}

/**
 * Deserialize proof from contract format
 */
export function deserializeProof(data: {
  leaf: string;
  proof: string[];
  index: number;
  root: string;
}): MerkleProof {
  return {
    leaf: fromBytes32(data.leaf),
    proof: data.proof.map(fromBytes32),
    index: data.index,
    root: fromBytes32(data.root),
  };
}
