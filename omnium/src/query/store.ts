/**
 * Query Store
 *
 * Local private storage for queries and results.
 * Privacy-first: everything stays local until explicitly shared.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuid } from 'uuid';
import type {
  Query,
  QueryResult,
  SharedEntry,
  Visibility,
  EntryValue,
} from './types.js';

// =============================================================================
// STORAGE PATHS
// =============================================================================

const OMNIUM_DIR = join(homedir(), '.omnium');
const QUERIES_DIR = join(OMNIUM_DIR, 'queries');
const RESULTS_DIR = join(OMNIUM_DIR, 'results');
const SHARED_DIR = join(OMNIUM_DIR, 'shared');
const INDEX_FILE = join(OMNIUM_DIR, 'index.json');

// =============================================================================
// INDEX
// =============================================================================

interface StoreIndex {
  /** User ID for this store */
  userId: string;

  /** Query IDs in order of creation */
  queries: string[];

  /** Shared entry IDs */
  shared: string[];

  /** Statistics */
  stats: {
    totalQueries: number;
    totalShared: number;
    totalComputeUnits: number;
    totalValueReceived: number;
  };
}

// =============================================================================
// STORE
// =============================================================================

/**
 * Local store for queries and results.
 *
 * All data is stored locally in ~/.omnium/
 * Nothing leaves your machine unless you explicitly share.
 */
export class QueryStore {
  private index: StoreIndex;
  private initialized: boolean = false;

  constructor() {
    this.index = this.loadOrCreateIndex();
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  private ensureDirectories(): void {
    if (this.initialized) return;

    for (const dir of [OMNIUM_DIR, QUERIES_DIR, RESULTS_DIR, SHARED_DIR]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.initialized = true;
  }

  private loadOrCreateIndex(): StoreIndex {
    this.ensureDirectories();

    if (existsSync(INDEX_FILE)) {
      try {
        const data = readFileSync(INDEX_FILE, 'utf-8');
        return JSON.parse(data);
      } catch {
        // Corrupted, recreate
      }
    }

    // Create new index
    const index: StoreIndex = {
      userId: `user-${uuid().slice(0, 8)}`,
      queries: [],
      shared: [],
      stats: {
        totalQueries: 0,
        totalShared: 0,
        totalComputeUnits: 0,
        totalValueReceived: 0,
      },
    };

    this.saveIndex(index);
    return index;
  }

  private saveIndex(index?: StoreIndex): void {
    this.ensureDirectories();
    writeFileSync(INDEX_FILE, JSON.stringify(index ?? this.index, null, 2));
  }

  // ---------------------------------------------------------------------------
  // USER
  // ---------------------------------------------------------------------------

  /**
   * Get the local user ID.
   */
  getUserId(): string {
    return this.index.userId;
  }

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Save a query to local storage.
   */
  saveQuery(query: Query): void {
    this.ensureDirectories();

    const filePath = join(QUERIES_DIR, `${query.id}.json`);
    writeFileSync(filePath, JSON.stringify(query, null, 2));

    if (!this.index.queries.includes(query.id)) {
      this.index.queries.push(query.id);
      this.index.stats.totalQueries++;
      this.saveIndex();
    }
  }

  /**
   * Get a query by ID.
   */
  getQuery(queryId: string): Query | null {
    const filePath = join(QUERIES_DIR, `${queryId}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * List all queries.
   */
  listQueries(limit: number = 50, offset: number = 0): Query[] {
    const queryIds = this.index.queries.slice(offset, offset + limit).reverse();
    return queryIds
      .map(id => this.getQuery(id))
      .filter((q): q is Query => q !== null);
  }

  // ---------------------------------------------------------------------------
  // RESULTS
  // ---------------------------------------------------------------------------

  /**
   * Save a result to local storage.
   */
  saveResult(result: QueryResult): void {
    this.ensureDirectories();

    const filePath = join(RESULTS_DIR, `${result.id}.json`);
    writeFileSync(filePath, JSON.stringify(result, null, 2));

    this.index.stats.totalComputeUnits += result.metrics.computeUnits;
    this.saveIndex();
  }

  /**
   * Get a result by ID.
   */
  getResult(resultId: string): QueryResult | null {
    const filePath = join(RESULTS_DIR, `${resultId}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Get result for a query.
   */
  getResultForQuery(queryId: string): QueryResult | null {
    // Scan results directory for matching queryId
    if (!existsSync(RESULTS_DIR)) return null;

    const files = readdirSync(RESULTS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = join(RESULTS_DIR, file);
      try {
        const data = readFileSync(filePath, 'utf-8');
        const result: QueryResult = JSON.parse(data);
        if (result.queryId === queryId) {
          return result;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // SHARING
  // ---------------------------------------------------------------------------

  /**
   * Share a query/result pair.
   *
   * This marks it for sharing but doesn't actually publish it yet.
   */
  share(
    queryId: string,
    visibility: Visibility = 'shared',
    tags?: string[]
  ): SharedEntry | null {
    const query = this.getQuery(queryId);
    const result = this.getResultForQuery(queryId);

    if (!query || !result) return null;

    const entry: SharedEntry = {
      query,
      result,
      sharedAt: Date.now(),
      sharedBy: this.index.userId,
      visibility,
      tags,
      value: {
        tips: 0,
        boosts: 0,
        citations: 0,
        uses: 0,
        attributors: [],
      },
    };

    // Save shared entry
    const filePath = join(SHARED_DIR, `${queryId}.json`);
    writeFileSync(filePath, JSON.stringify(entry, null, 2));

    if (!this.index.shared.includes(queryId)) {
      this.index.shared.push(queryId);
      this.index.stats.totalShared++;
      this.saveIndex();
    }

    return entry;
  }

  /**
   * Get a shared entry.
   */
  getSharedEntry(queryId: string): SharedEntry | null {
    const filePath = join(SHARED_DIR, `${queryId}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * List shared entries.
   */
  listShared(limit: number = 50, offset: number = 0): SharedEntry[] {
    const entryIds = this.index.shared.slice(offset, offset + limit).reverse();
    return entryIds
      .map(id => this.getSharedEntry(id))
      .filter((e): e is SharedEntry => e !== null);
  }

  /**
   * Check if a query has been shared.
   */
  isShared(queryId: string): boolean {
    return this.index.shared.includes(queryId);
  }

  // ---------------------------------------------------------------------------
  // VALUE ATTRIBUTION
  // ---------------------------------------------------------------------------

  /**
   * Record value attribution on a shared entry.
   */
  attributeValue(
    queryId: string,
    type: 'tip' | 'boost' | 'citation' | 'use',
    amount: number,
    fromUserId: string
  ): boolean {
    const entry = this.getSharedEntry(queryId);
    if (!entry) return false;

    entry.value.attributors.push({
      userId: fromUserId,
      type,
      amount,
      timestamp: Date.now(),
    });

    switch (type) {
      case 'tip':
        entry.value.tips += amount;
        break;
      case 'boost':
        entry.value.boosts += amount;
        break;
      case 'citation':
        entry.value.citations++;
        break;
      case 'use':
        entry.value.uses++;
        break;
    }

    // Update global stats
    if (type === 'tip' || type === 'boost') {
      this.index.stats.totalValueReceived += amount;
      this.saveIndex();
    }

    // Save updated entry
    const filePath = join(SHARED_DIR, `${queryId}.json`);
    writeFileSync(filePath, JSON.stringify(entry, null, 2));

    return true;
  }

  // ---------------------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------------------

  /**
   * Get store statistics.
   */
  getStats(): StoreIndex['stats'] & {
    userId: string;
    storagePath: string;
  } {
    return {
      ...this.index.stats,
      userId: this.index.userId,
      storagePath: OMNIUM_DIR,
    };
  }

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------

  /**
   * Export a query/result for external use.
   */
  export(queryId: string): {
    query: Query;
    result: QueryResult;
    attestation: QueryResult['attestation'];
  } | null {
    const query = this.getQuery(queryId);
    const result = this.getResultForQuery(queryId);

    if (!query || !result) return null;

    return {
      query,
      result,
      attestation: result.attestation,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let store: QueryStore | null = null;

export function getQueryStore(): QueryStore {
  if (!store) {
    store = new QueryStore();
  }
  return store;
}
