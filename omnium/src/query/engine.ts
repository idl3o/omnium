/**
 * Query Engine
 *
 * Processes queries through compute providers and creates attestations.
 */

import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import type {
  Query,
  QueryResult,
  QueryContext,
  QueryAttestation,
  ComputeMetrics,
  ComputeProvider,
  QueryEvent,
} from './types.js';
import { ProofMethod } from '../economics/deterministic-compute.js';

// =============================================================================
// CID GENERATION (simplified content addressing)
// =============================================================================

/**
 * Generate a content identifier for data.
 * In production, this would use IPFS CID generation.
 */
function generateCid(data: unknown): string {
  const json = JSON.stringify(data, Object.keys(data as object).sort());
  const hash = createHash('sha256').update(json).digest('hex');
  return `Qm${hash.slice(0, 44)}`; // Simplified CID format
}

// =============================================================================
// MOCK PROVIDER (for testing without real model)
// =============================================================================

const mockResponses: Record<string, string> = {
  default: `I understand your query. Let me think through this step by step.

First, I'll analyze the key aspects of what you're asking.

Then, I'll consider the relevant context and constraints.

Finally, I'll provide a structured response based on my reasoning.

This is a mock response for testing the query system. In production, this would be replaced with actual model inference.`,
};

async function mockCompute(
  query: Query,
  _onProgress?: (progress: number, partial?: string) => void
): Promise<{ content: string; metrics: ComputeMetrics }> {
  // Simulate processing time
  const thinkingTime = 500 + Math.random() * 1000;

  // Simulate progress
  if (_onProgress) {
    _onProgress(0.2, 'Analyzing query...');
    await sleep(thinkingTime * 0.3);
    _onProgress(0.5, 'Processing...');
    await sleep(thinkingTime * 0.4);
    _onProgress(0.8, 'Generating response...');
    await sleep(thinkingTime * 0.3);
  } else {
    await sleep(thinkingTime);
  }

  const content = mockResponses.default;

  return {
    content,
    metrics: {
      durationMs: thinkingTime,
      inputTokens: Math.ceil(query.content.length / 4),
      outputTokens: Math.ceil(content.length / 4),
      model: 'mock-model',
      computeUnits: Math.ceil((query.content.length + content.length) / 100),
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// QUERY ENGINE
// =============================================================================

/**
 * Engine for processing queries and creating attestations.
 */
export class QueryEngine {
  private providers: Map<string, ComputeProvider> = new Map();
  private activeProvider: string = 'mock';
  private eventListeners: Set<(event: QueryEvent) => void> = new Set();

  constructor() {
    // Register mock provider by default
    this.registerProvider({
      id: 'mock',
      name: 'Mock Provider',
      type: 'mock',
      models: ['mock-model'],
      costPerUnit: 0,
      available: true,
    });
  }

  // ---------------------------------------------------------------------------
  // PROVIDERS
  // ---------------------------------------------------------------------------

  /**
   * Register a compute provider.
   */
  registerProvider(provider: ComputeProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Set the active provider.
   */
  setProvider(providerId: string): boolean {
    if (!this.providers.has(providerId)) return false;
    this.activeProvider = providerId;
    return true;
  }

  /**
   * Get available providers.
   */
  getProviders(): ComputeProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get current provider.
   */
  getCurrentProvider(): ComputeProvider | undefined {
    return this.providers.get(this.activeProvider);
  }

  // ---------------------------------------------------------------------------
  // EVENTS
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to engine events.
   */
  on(listener: (event: QueryEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: QueryEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ---------------------------------------------------------------------------
  // QUERY PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Create a query object.
   */
  createQuery(content: string, userId: string, context?: QueryContext): Query {
    return {
      id: uuid(),
      content,
      timestamp: Date.now(),
      userId,
      context,
    };
  }

  /**
   * Process a query and return the result with attestation.
   */
  async process(
    query: Query,
    onProgress?: (progress: number, partial?: string) => void
  ): Promise<QueryResult> {
    this.emit({ type: 'query_submitted', query });
    this.emit({ type: 'compute_started', queryId: query.id });

    const startTime = Date.now();

    try {
      // Get compute from provider
      const provider = this.providers.get(this.activeProvider);
      if (!provider) {
        throw new Error(`Provider not found: ${this.activeProvider}`);
      }

      // Progress wrapper
      const progressWrapper = onProgress
        ? (progress: number, partial?: string) => {
            this.emit({ type: 'compute_progress', queryId: query.id, progress, partial });
            onProgress(progress, partial);
          }
        : undefined;

      // Execute computation
      let computeResult: { content: string; metrics: ComputeMetrics };

      if (provider.type === 'mock') {
        computeResult = await mockCompute(query, progressWrapper);
      } else {
        // Future: integrate real providers
        throw new Error(`Provider type not implemented: ${provider.type}`);
      }

      // Create attestation
      const attestation = this.createAttestation(
        query,
        computeResult.content,
        computeResult.metrics,
        provider.id
      );

      // Build result
      const result: QueryResult = {
        id: uuid(),
        queryId: query.id,
        content: computeResult.content,
        timestamp: Date.now(),
        metrics: {
          ...computeResult.metrics,
          durationMs: Date.now() - startTime,
        },
        attestation,
      };

      this.emit({ type: 'compute_completed', result });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'compute_failed', queryId: query.id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Create an attestation for a computation.
   */
  private createAttestation(
    query: Query,
    output: string,
    metrics: ComputeMetrics,
    providerId: string
  ): QueryAttestation {
    // Generate CIDs for content addressing
    const inputCid = generateCid({
      content: query.content,
      context: query.context,
    });

    const codeCid = generateCid({
      model: metrics.model,
      provider: providerId,
      // In production: include model version, config hash, etc.
    });

    const outputCid = generateCid({
      content: output,
      inputCid,
      codeCid,
    });

    return {
      id: uuid(),
      inputCid,
      codeCid,
      outputCid,
      computeUnits: metrics.computeUnits,
      proofMethod: ProofMethod.SelfAttestation, // Mock uses self-attestation
      providerId,
      timestamp: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // CONVENIENCE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Quick query - creates query, processes, and returns result.
   */
  async query(
    content: string,
    userId: string,
    options?: {
      context?: QueryContext;
      onProgress?: (progress: number, partial?: string) => void;
    }
  ): Promise<{ query: Query; result: QueryResult }> {
    const query = this.createQuery(content, userId, options?.context);
    const result = await this.process(query, options?.onProgress);
    return { query, result };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let engine: QueryEngine | null = null;

export function getQueryEngine(): QueryEngine {
  if (!engine) {
    engine = new QueryEngine();
  }
  return engine;
}
