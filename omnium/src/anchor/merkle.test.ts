import { describe, it, expect } from 'vitest';
import {
  buildTree,
  buildProvenanceTree,
  generateProof,
  verifyProof,
  verifyProvenance,
  generateProvenanceProof,
  toBytes32,
  fromBytes32,
  serializeProof,
  deserializeProof,
  type ProvenanceEntry,
} from './merkle.js';

describe('Merkle Tree', () => {
  describe('buildTree', () => {
    it('should build a tree from single leaf', async () => {
      const leaves = [new Uint8Array([1, 2, 3])];
      const tree = await buildTree(leaves);

      expect(tree.leaves).toHaveLength(1);
      expect(tree.root).toHaveLength(32);
      expect(tree.layers).toHaveLength(1);
    });

    it('should build a tree from multiple leaves', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
        new Uint8Array([10, 11, 12]),
      ];
      const tree = await buildTree(leaves);

      expect(tree.leaves).toHaveLength(4);
      expect(tree.root).toHaveLength(32);
      // 4 leaves → 2 nodes → 1 root = 3 layers
      expect(tree.layers).toHaveLength(3);
    });

    it('should handle empty leaves', async () => {
      const tree = await buildTree([]);
      expect(tree.root).toEqual(new Uint8Array(32));
      expect(tree.leaves).toHaveLength(0);
    });

    it('should pad to power of 2', async () => {
      const leaves = [
        new Uint8Array([1]),
        new Uint8Array([2]),
        new Uint8Array([3]),
      ];
      const tree = await buildTree(leaves);

      // 3 leaves padded to 4 → hashed leaves layer should have 4
      expect(tree.layers[0]).toHaveLength(4);
    });
  });

  describe('generateProof and verifyProof', () => {
    it('should generate valid proofs for all leaves', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
        new Uint8Array([10, 11, 12]),
      ];
      const tree = await buildTree(leaves);

      // Verify each leaf has a valid proof
      for (let i = 0; i < leaves.length; i++) {
        const proof = generateProof(tree, i);
        const isValid = await verifyProof(proof);
        expect(isValid).toBe(true);
      }
    });

    it('should reject tampered proofs', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      ];
      const tree = await buildTree(leaves);

      const proof = generateProof(tree, 0);

      // Tamper with the leaf
      const tampered = { ...proof, leaf: new Uint8Array([99, 99, 99]) };
      const isValid = await verifyProof(tampered);
      expect(isValid).toBe(false);
    });

    it('should reject wrong root', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      ];
      const tree = await buildTree(leaves);

      const proof = generateProof(tree, 0);

      // Tamper with the root
      const tampered = { ...proof, root: new Uint8Array(32).fill(99) };
      const isValid = await verifyProof(tampered);
      expect(isValid).toBe(false);
    });

    it('should throw for out of bounds index', async () => {
      const leaves = [new Uint8Array([1, 2, 3])];
      const tree = await buildTree(leaves);

      expect(() => generateProof(tree, 5)).toThrow();
      expect(() => generateProof(tree, -1)).toThrow();
    });
  });

  describe('buildProvenanceTree', () => {
    const entries: ProvenanceEntry[] = [
      {
        unitId: 'unit-1',
        timestamp: 1000,
        type: 'mint',
        toWallet: 'wallet-1',
        amount: 100,
        note: 'Initial mint',
      },
      {
        unitId: 'unit-1',
        timestamp: 2000,
        type: 'transfer',
        fromWallet: 'wallet-1',
        toWallet: 'wallet-2',
        amount: 50,
      },
      {
        unitId: 'unit-2',
        timestamp: 3000,
        type: 'mint',
        toWallet: 'wallet-2',
        amount: 200,
      },
    ];

    it('should build tree from provenance entries', async () => {
      const tree = await buildProvenanceTree(entries);

      expect(tree.leaves).toHaveLength(3);
      expect(tree.root).toHaveLength(32);
    });

    it('should generate valid provenance proofs', async () => {
      const tree = await buildProvenanceTree(entries);

      for (let i = 0; i < entries.length; i++) {
        const proof = generateProof(tree, i);
        const isValid = await verifyProof(proof);
        expect(isValid).toBe(true);
      }
    });

    it('should verify provenance entries', async () => {
      const tree = await buildProvenanceTree(entries);

      for (const entry of entries) {
        const result = await generateProvenanceProof(tree, entry);
        expect(result).not.toBeNull();
        if (result) {
          const isValid = await verifyProvenance(entry, result);
          expect(isValid).toBe(true);
        }
      }
    });

    it('should reject modified provenance', async () => {
      const tree = await buildProvenanceTree(entries);

      const proof = await generateProvenanceProof(tree, entries[0]);
      expect(proof).not.toBeNull();

      if (proof) {
        // Modify the entry
        const modified = { ...entries[0], amount: 999 };
        const isValid = await verifyProvenance(modified, proof);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('bytes32 conversion', () => {
    it('should convert to and from bytes32', () => {
      const original = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        original[i] = i * 8;
      }

      const hex = toBytes32(original);
      expect(hex).toMatch(/^0x[0-9a-f]{64}$/);

      const recovered = fromBytes32(hex);
      expect(recovered).toEqual(original);
    });

    it('should throw for wrong length', () => {
      expect(() => toBytes32(new Uint8Array(16))).toThrow();
      expect(() => fromBytes32('0x1234')).toThrow();
    });

    it('should handle zero bytes', () => {
      const zeros = new Uint8Array(32);
      const hex = toBytes32(zeros);
      expect(hex).toBe('0x' + '0'.repeat(64));
    });
  });

  describe('proof serialization', () => {
    it('should serialize and deserialize proofs', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
        new Uint8Array([10, 11, 12]),
      ];
      const tree = await buildTree(leaves);
      const proof = generateProof(tree, 1);

      const serialized = serializeProof(proof);
      expect(serialized.leaf).toMatch(/^0x[0-9a-f]{64}$/);
      expect(serialized.proof.every((p) => p.match(/^0x[0-9a-f]{64}$/))).toBe(true);
      expect(serialized.index).toBe(1);
      expect(serialized.root).toMatch(/^0x[0-9a-f]{64}$/);

      const deserialized = deserializeProof(serialized);
      expect(deserialized.leaf).toEqual(proof.leaf);
      expect(deserialized.proof.length).toBe(proof.proof.length);
      expect(deserialized.index).toBe(proof.index);
      expect(deserialized.root).toEqual(proof.root);

      // Should still verify
      const isValid = await verifyProof(deserialized);
      expect(isValid).toBe(true);
    });
  });

  describe('determinism', () => {
    it('should produce same root for same leaves', async () => {
      const leaves = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      ];

      const tree1 = await buildTree(leaves);
      const tree2 = await buildTree(leaves);

      expect(tree1.root).toEqual(tree2.root);
    });

    it('should produce different root for different leaves', async () => {
      const tree1 = await buildTree([new Uint8Array([1, 2, 3])]);
      const tree2 = await buildTree([new Uint8Array([4, 5, 6])]);

      expect(tree1.root).not.toEqual(tree2.root);
    });

    it('should produce different root for different order', async () => {
      const tree1 = await buildTree([
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      ]);
      const tree2 = await buildTree([
        new Uint8Array([4, 5, 6]),
        new Uint8Array([1, 2, 3]),
      ]);

      expect(tree1.root).not.toEqual(tree2.root);
    });
  });
});
