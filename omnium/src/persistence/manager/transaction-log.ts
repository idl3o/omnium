/**
 * OMNIUM Transaction Log
 *
 * Append-only transaction log stored as a linked list of blocks.
 * Each block contains a batch of transactions and links to the previous block.
 * This creates an immutable chain that can be verified and replayed.
 */

import { CID } from 'multiformats/cid';
import type { Transaction } from '../../core/types.js';
import type { ContentStore, TransactionBlock } from '../types.js';

/**
 * Append-only transaction log using content-addressed blocks.
 *
 * Transactions are batched and flushed to storage as blocks.
 * Each block links to the previous, forming an immutable chain.
 */
export class TransactionLog {
  private store: ContentStore;
  private batchSize: number;
  private pending: Transaction[] = [];
  private headCid: CID | null = null;
  private blockNumber = 0;

  constructor(store: ContentStore, batchSize: number = 50) {
    this.store = store;
    this.batchSize = batchSize;
  }

  /**
   * Append a transaction to the pending batch.
   * Auto-flushes when batch is full.
   */
  async append(tx: Transaction): Promise<void> {
    this.pending.push(tx);

    if (this.pending.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush pending transactions to a new block.
   * Returns the CID of the new block, or null if nothing to flush.
   */
  async flush(): Promise<CID | null> {
    if (this.pending.length === 0) {
      return null;
    }

    const block: TransactionBlock = {
      transactions: [...this.pending],
      previousBlockCid: this.headCid?.toString() ?? null,
      timestamp: Date.now(),
      blockNumber: this.blockNumber++,
    };

    const cid = await this.store.store(block);
    await this.store.pin(cid);

    // Unpin previous head (keep only latest pinned to allow GC of old blocks)
    // Actually, for audit trail we want to keep all blocks pinned
    // So we won't unpin the previous block

    this.headCid = cid;
    this.pending = [];

    return cid;
  }

  /**
   * Get the current head CID.
   */
  getHeadCid(): CID | null {
    return this.headCid;
  }

  /**
   * Get the current block number.
   */
  getBlockNumber(): number {
    return this.blockNumber;
  }

  /**
   * Get pending transaction count.
   */
  getPendingCount(): number {
    return this.pending.length;
  }

  /**
   * Set the head CID (for restoration from persistence).
   */
  restore(headCid: CID | null, blockNumber: number = 0): void {
    this.headCid = headCid;
    this.blockNumber = blockNumber;
    this.pending = [];
  }

  /**
   * Iterate through all transactions from newest to oldest.
   */
  async *iterateReverse(): AsyncGenerator<Transaction> {
    // First yield pending (newest)
    for (let i = this.pending.length - 1; i >= 0; i--) {
      yield this.pending[i];
    }

    // Then iterate through stored blocks
    let currentCid = this.headCid;

    while (currentCid) {
      const block = await this.store.retrieve<TransactionBlock>(currentCid);
      if (!block) break;

      // Yield transactions in reverse order (newest first)
      for (let i = block.transactions.length - 1; i >= 0; i--) {
        yield block.transactions[i];
      }

      currentCid = block.previousBlockCid
        ? CID.parse(block.previousBlockCid)
        : null;
    }
  }

  /**
   * Iterate through all transactions in chronological order.
   */
  async *iterate(): AsyncGenerator<Transaction> {
    // Collect all in reverse, then yield in order
    const all: Transaction[] = [];

    for await (const tx of this.iterateReverse()) {
      all.unshift(tx);
    }

    for (const tx of all) {
      yield tx;
    }
  }

  /**
   * Get all transactions in chronological order.
   */
  async getAllTransactions(): Promise<Transaction[]> {
    const transactions: Transaction[] = [];

    for await (const tx of this.iterate()) {
      transactions.push(tx);
    }

    return transactions;
  }

  /**
   * Get the most recent N transactions.
   */
  async getRecentTransactions(count: number): Promise<Transaction[]> {
    const transactions: Transaction[] = [];

    for await (const tx of this.iterateReverse()) {
      transactions.push(tx);
      if (transactions.length >= count) break;
    }

    return transactions;
  }

  /**
   * Get transaction count (including pending).
   */
  async getTransactionCount(): Promise<number> {
    let count = this.pending.length;

    let currentCid = this.headCid;
    while (currentCid) {
      const block = await this.store.retrieve<TransactionBlock>(currentCid);
      if (!block) break;

      count += block.transactions.length;
      currentCid = block.previousBlockCid
        ? CID.parse(block.previousBlockCid)
        : null;
    }

    return count;
  }

  /**
   * Get block count.
   */
  getBlockCount(): number {
    return this.blockNumber;
  }
}
