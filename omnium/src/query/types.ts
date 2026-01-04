/**
 * Query System Types
 *
 * Core types for the query-compute-share system.
 */

import { ProofMethod } from '../economics/deterministic-compute.js';

// =============================================================================
// QUERY
// =============================================================================

/**
 * A user query - the input to computation.
 */
export interface Query {
  /** Unique identifier */
  id: string;

  /** The question or task */
  content: string;

  /** When the query was submitted */
  timestamp: number;

  /** Who submitted the query */
  userId: string;

  /** Optional context/parameters */
  context?: QueryContext;
}

/**
 * Additional context for a query.
 */
export interface QueryContext {
  /** System prompt or instructions */
  systemPrompt?: string;

  /** Previous conversation turns */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  /** Model preferences */
  model?: string;

  /** Temperature/creativity setting */
  temperature?: number;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Any additional parameters */
  [key: string]: unknown;
}

// =============================================================================
// RESULT
// =============================================================================

/**
 * The result of a computation.
 */
export interface QueryResult {
  /** Unique identifier */
  id: string;

  /** The query this answers */
  queryId: string;

  /** The computed response */
  content: string;

  /** When computation completed */
  timestamp: number;

  /** Compute metrics */
  metrics: ComputeMetrics;

  /** The attestation for this computation */
  attestation: QueryAttestation;
}

/**
 * Metrics about the computation.
 */
export interface ComputeMetrics {
  /** Time to compute (ms) */
  durationMs: number;

  /** Tokens in the query */
  inputTokens: number;

  /** Tokens in the response */
  outputTokens: number;

  /** Model used */
  model: string;

  /** Compute units (normalized) */
  computeUnits: number;
}

// =============================================================================
// ATTESTATION
// =============================================================================

/**
 * Attestation that links query → result deterministically.
 */
export interface QueryAttestation {
  /** Unique identifier */
  id: string;

  /** CID of the query */
  inputCid: string;

  /** CID of the model/code used */
  codeCid: string;

  /** CID of the result */
  outputCid: string;

  /** Compute units consumed */
  computeUnits: number;

  /** Proof method */
  proofMethod: ProofMethod;

  /** Who performed the computation */
  providerId: string;

  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// SHARING
// =============================================================================

/**
 * Visibility of a query/result pair.
 */
export type Visibility = 'private' | 'shared' | 'public';

/**
 * A shared query entry in the registry.
 */
export interface SharedEntry {
  /** The query */
  query: Query;

  /** The result */
  result: QueryResult;

  /** When it was shared */
  sharedAt: number;

  /** Who shared it */
  sharedBy: string;

  /** Visibility level */
  visibility: Visibility;

  /** Tags for discovery */
  tags?: string[];

  /** Value attributed to this entry */
  value: EntryValue;
}

/**
 * Value accumulated on a shared entry.
 */
export interface EntryValue {
  /** Total tips received */
  tips: number;

  /** Total boosts received */
  boosts: number;

  /** Number of citations */
  citations: number;

  /** Number of times viewed/used */
  uses: number;

  /** List of attributors */
  attributors: Array<{
    userId: string;
    type: 'tip' | 'boost' | 'citation' | 'use';
    amount: number;
    timestamp: number;
  }>;
}

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * A compute provider (model backend).
 */
export interface ComputeProvider {
  /** Provider identifier */
  id: string;

  /** Display name */
  name: string;

  /** Provider type */
  type: 'local' | 'api' | 'mock';

  /** Available models */
  models: string[];

  /** Cost per compute unit */
  costPerUnit: number;

  /** Whether currently available */
  available: boolean;
}

// =============================================================================
// EVENTS
// =============================================================================

export type QueryEvent =
  | { type: 'query_submitted'; query: Query }
  | { type: 'compute_started'; queryId: string }
  | { type: 'compute_progress'; queryId: string; progress: number; partial?: string }
  | { type: 'compute_completed'; result: QueryResult }
  | { type: 'compute_failed'; queryId: string; error: string }
  | { type: 'entry_shared'; entry: SharedEntry }
  | { type: 'value_attributed'; entryId: string; attribution: EntryValue['attributors'][0] };
