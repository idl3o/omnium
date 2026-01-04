/**
 * Query System Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueryEngine } from './engine.js';
import type { Query, QueryResult, ComputeProvider, SharedEntry } from './types.js';
import { ProofMethod } from '../economics/deterministic-compute.js';

// In-memory store for testing (simulates QueryStore behavior without filesystem)
class InMemoryQueryStore {
  private queries = new Map<string, Query>();
  private results = new Map<string, QueryResult>();
  private shared = new Map<string, SharedEntry>();
  private index = {
    userId: `user-${Math.random().toString(36).slice(2, 10)}`,
    queries: [] as string[],
    shared: [] as string[],
    stats: {
      totalQueries: 0,
      totalShared: 0,
      totalComputeUnits: 0,
      totalValueReceived: 0,
    },
  };

  getUserId() {
    return this.index.userId;
  }

  saveQuery(query: Query) {
    this.queries.set(query.id, query);
    if (!this.index.queries.includes(query.id)) {
      this.index.queries.push(query.id);
      this.index.stats.totalQueries++;
    }
  }

  getQuery(queryId: string) {
    return this.queries.get(queryId) ?? null;
  }

  listQueries(limit = 50, offset = 0) {
    const ids = this.index.queries.slice(offset, offset + limit).reverse();
    return ids.map(id => this.queries.get(id)).filter((q): q is Query => q !== undefined);
  }

  saveResult(result: QueryResult) {
    this.results.set(result.id, result);
    this.index.stats.totalComputeUnits += result.metrics.computeUnits;
  }

  getResult(resultId: string) {
    return this.results.get(resultId) ?? null;
  }

  getResultForQuery(queryId: string) {
    for (const result of this.results.values()) {
      if (result.queryId === queryId) return result;
    }
    return null;
  }

  share(queryId: string, visibility: 'private' | 'shared' | 'public' = 'shared', tags?: string[]): SharedEntry | null {
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
      value: { tips: 0, boosts: 0, citations: 0, uses: 0, attributors: [] },
    };
    this.shared.set(queryId, entry);
    if (!this.index.shared.includes(queryId)) {
      this.index.shared.push(queryId);
      this.index.stats.totalShared++;
    }
    return entry;
  }

  getSharedEntry(queryId: string) {
    return this.shared.get(queryId) ?? null;
  }

  listShared(limit = 50, offset = 0) {
    const ids = this.index.shared.slice(offset, offset + limit).reverse();
    return ids.map(id => this.shared.get(id)).filter((e): e is SharedEntry => e !== undefined);
  }

  isShared(queryId: string) {
    return this.index.shared.includes(queryId);
  }

  attributeValue(queryId: string, type: 'tip' | 'boost' | 'citation' | 'use', amount: number, fromUserId: string) {
    const entry = this.shared.get(queryId);
    if (!entry) return false;

    entry.value.attributors.push({ userId: fromUserId, type, amount, timestamp: Date.now() });
    switch (type) {
      case 'tip': entry.value.tips += amount; break;
      case 'boost': entry.value.boosts += amount; break;
      case 'citation': entry.value.citations++; break;
      case 'use': entry.value.uses++; break;
    }
    if (type === 'tip' || type === 'boost') {
      this.index.stats.totalValueReceived += amount;
    }
    return true;
  }

  getStats() {
    return {
      ...this.index.stats,
      userId: this.index.userId,
      storagePath: '/mock/.omnium',
    };
  }

  export(queryId: string) {
    const query = this.getQuery(queryId);
    const result = this.getResultForQuery(queryId);
    if (!query || !result) return null;
    return { query, result, attestation: result.attestation };
  }
}

// =============================================================================
// ENGINE TESTS
// =============================================================================

describe('QueryEngine', () => {
  let engine: QueryEngine;

  beforeEach(() => {
    engine = new QueryEngine();
  });

  describe('createQuery', () => {
    it('creates a query with required fields', () => {
      const query = engine.createQuery('What is 2+2?', 'user-123');

      expect(query.id).toBeDefined();
      expect(query.content).toBe('What is 2+2?');
      expect(query.userId).toBe('user-123');
      expect(query.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('accepts optional context', () => {
      const query = engine.createQuery('Question', 'user-123', {
        systemPrompt: 'Be helpful',
        temperature: 0.7,
      });

      expect(query.context?.systemPrompt).toBe('Be helpful');
      expect(query.context?.temperature).toBe(0.7);
    });
  });

  describe('providers', () => {
    it('has mock provider by default', () => {
      const providers = engine.getProviders();
      expect(providers.length).toBeGreaterThanOrEqual(1);
      expect(providers[0].id).toBe('mock');
    });

    it('can register custom providers', () => {
      const customProvider: ComputeProvider = {
        id: 'custom',
        name: 'Custom Provider',
        type: 'api',
        models: ['gpt-4'],
        costPerUnit: 0.001,
        available: true,
      };

      engine.registerProvider(customProvider);
      const providers = engine.getProviders();
      expect(providers.find(p => p.id === 'custom')).toBeDefined();
    });

    it('can switch active provider', () => {
      const customProvider: ComputeProvider = {
        id: 'custom',
        name: 'Custom',
        type: 'mock',
        models: ['test'],
        costPerUnit: 0,
        available: true,
      };

      engine.registerProvider(customProvider);
      expect(engine.setProvider('custom')).toBe(true);
      expect(engine.getCurrentProvider()?.id).toBe('custom');
    });

    it('returns false for unknown provider', () => {
      expect(engine.setProvider('nonexistent')).toBe(false);
    });
  });

  describe('events', () => {
    it('emits events during query processing', async () => {
      const events: string[] = [];
      engine.on(event => events.push(event.type));

      const query = engine.createQuery('Test', 'user-123');
      await engine.process(query);

      expect(events).toContain('query_submitted');
      expect(events).toContain('compute_started');
      expect(events).toContain('compute_completed');
    });

    it('can unsubscribe from events', async () => {
      const events: string[] = [];
      const unsubscribe = engine.on(event => events.push(event.type));

      unsubscribe();

      const query = engine.createQuery('Test', 'user-123');
      await engine.process(query);

      expect(events).toHaveLength(0);
    });
  });

  describe('process', () => {
    it('processes a query and returns result', async () => {
      const query = engine.createQuery('What is life?', 'user-123');
      const result = await engine.process(query);

      expect(result.id).toBeDefined();
      expect(result.queryId).toBe(query.id);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('includes compute metrics', async () => {
      const query = engine.createQuery('Test query', 'user-123');
      const result = await engine.process(query);

      expect(result.metrics.durationMs).toBeGreaterThan(0);
      expect(result.metrics.inputTokens).toBeGreaterThan(0);
      expect(result.metrics.outputTokens).toBeGreaterThan(0);
      expect(result.metrics.computeUnits).toBeGreaterThan(0);
    });

    it('creates attestation for result', async () => {
      const query = engine.createQuery('Test query', 'user-123');
      const result = await engine.process(query);

      expect(result.attestation.id).toBeDefined();
      expect(result.attestation.inputCid).toMatch(/^Qm/);
      expect(result.attestation.codeCid).toMatch(/^Qm/);
      expect(result.attestation.outputCid).toMatch(/^Qm/);
      expect(result.attestation.proofMethod).toBe(ProofMethod.SelfAttestation);
    });

    it('reports progress if callback provided', async () => {
      const progressValues: number[] = [];
      const query = engine.createQuery('Test query', 'user-123');

      await engine.process(query, (progress) => {
        progressValues.push(progress);
      });

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('query (convenience method)', () => {
    it('creates query and processes in one call', async () => {
      const { query, result } = await engine.query('What is 2+2?', 'user-123');

      expect(query.content).toBe('What is 2+2?');
      expect(result.queryId).toBe(query.id);
    });

    it('accepts options', async () => {
      const { query, result } = await engine.query('Question', 'user-123', {
        context: { temperature: 0.5 },
      });

      expect(query.context?.temperature).toBe(0.5);
      expect(result).toBeDefined();
    });
  });
});

// =============================================================================
// STORE TESTS (using InMemoryQueryStore which mirrors QueryStore interface)
// =============================================================================

describe('QueryStore (InMemory)', () => {
  let store: InMemoryQueryStore;

  beforeEach(() => {
    store = new InMemoryQueryStore();
  });

  describe('user', () => {
    it('generates a user ID', () => {
      const userId = store.getUserId();
      expect(userId).toMatch(/^user-/);
    });
  });

  describe('queries', () => {
    it('saves and retrieves a query', () => {
      const query: Query = {
        id: 'test-query-1',
        content: 'What is life?',
        timestamp: Date.now(),
        userId: 'user-123',
      };

      store.saveQuery(query);
      const retrieved = store.getQuery('test-query-1');

      expect(retrieved).toEqual(query);
    });

    it('returns null for unknown query', () => {
      expect(store.getQuery('nonexistent')).toBeNull();
    });

    it('lists queries in reverse order', () => {
      const query1: Query = {
        id: 'q1',
        content: 'First',
        timestamp: 1000,
        userId: 'user-1',
      };
      const query2: Query = {
        id: 'q2',
        content: 'Second',
        timestamp: 2000,
        userId: 'user-1',
      };

      store.saveQuery(query1);
      store.saveQuery(query2);

      const queries = store.listQueries();
      expect(queries[0].id).toBe('q2');
      expect(queries[1].id).toBe('q1');
    });
  });

  describe('results', () => {
    it('saves and retrieves a result', () => {
      const result: QueryResult = {
        id: 'result-1',
        queryId: 'query-1',
        content: 'The answer is 42',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-1',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveResult(result);
      const retrieved = store.getResult('result-1');

      expect(retrieved).toEqual(result);
    });
  });

  describe('sharing', () => {
    it('shares a query/result pair', () => {
      const query: Query = {
        id: 'share-test',
        content: 'Shareable query',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-share',
        queryId: 'share-test',
        content: 'Result content',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-share',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);

      const entry = store.share('share-test', 'shared', ['ai', 'test']);

      expect(entry).not.toBeNull();
      expect(entry?.query.id).toBe('share-test');
      expect(entry?.visibility).toBe('shared');
      expect(entry?.tags).toContain('ai');
      expect(entry?.value.tips).toBe(0);
    });

    it('checks if query is shared', () => {
      const query: Query = {
        id: 'check-shared',
        content: 'Test',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-check',
        queryId: 'check-shared',
        content: 'Result',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-check',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);

      expect(store.isShared('check-shared')).toBe(false);
      store.share('check-shared');
      expect(store.isShared('check-shared')).toBe(true);
    });
  });

  describe('attribution', () => {
    it('records tips on shared entries', () => {
      const query: Query = {
        id: 'tip-test',
        content: 'Tip worthy',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-tip',
        queryId: 'tip-test',
        content: 'Great result',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-tip',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);
      store.share('tip-test');

      const success = store.attributeValue('tip-test', 'tip', 5.0, 'tipper-1');
      expect(success).toBe(true);

      const entry = store.getSharedEntry('tip-test');
      expect(entry?.value.tips).toBe(5.0);
      expect(entry?.value.attributors.length).toBe(1);
      expect(entry?.value.attributors[0].type).toBe('tip');
    });

    it('records citations', () => {
      const query: Query = {
        id: 'cite-test',
        content: 'Citable',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-cite',
        queryId: 'cite-test',
        content: 'Result',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-cite',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);
      store.share('cite-test');

      store.attributeValue('cite-test', 'citation', 1, 'citer-1');
      store.attributeValue('cite-test', 'citation', 1, 'citer-2');

      const entry = store.getSharedEntry('cite-test');
      expect(entry?.value.citations).toBe(2);
    });

    it('fails for non-shared entries', () => {
      const success = store.attributeValue('nonexistent', 'tip', 1.0, 'user-1');
      expect(success).toBe(false);
    });
  });

  describe('stats', () => {
    it('tracks statistics', () => {
      const query: Query = {
        id: 'stats-test',
        content: 'Stats query',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-stats',
        queryId: 'stats-test',
        content: 'Result',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 10,
        },
        attestation: {
          id: 'att-stats',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 10,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);
      store.share('stats-test');

      const stats = store.getStats();
      expect(stats.totalQueries).toBeGreaterThanOrEqual(1);
      expect(stats.totalComputeUnits).toBeGreaterThanOrEqual(10);
      expect(stats.storagePath).toBeDefined();
    });
  });

  describe('export', () => {
    it('exports query/result pair', () => {
      const query: Query = {
        id: 'export-test',
        content: 'Export me',
        timestamp: Date.now(),
        userId: 'user-1',
      };

      const result: QueryResult = {
        id: 'result-export',
        queryId: 'export-test',
        content: 'Result',
        timestamp: Date.now(),
        metrics: {
          durationMs: 100,
          inputTokens: 10,
          outputTokens: 20,
          model: 'test',
          computeUnits: 5,
        },
        attestation: {
          id: 'att-export',
          inputCid: 'QmInput',
          codeCid: 'QmCode',
          outputCid: 'QmOutput',
          computeUnits: 5,
          proofMethod: ProofMethod.SelfAttestation,
          providerId: 'test',
          timestamp: Date.now(),
        },
      };

      store.saveQuery(query);
      store.saveResult(result);

      const exported = store.export('export-test');
      expect(exported).not.toBeNull();
      expect(exported?.query.id).toBe('export-test');
      expect(exported?.result.id).toBe('result-export');
      expect(exported?.attestation.outputCid).toBe('QmOutput');
    });

    it('returns null for missing data', () => {
      expect(store.export('nonexistent')).toBeNull();
    });
  });
});
