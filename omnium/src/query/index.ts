/**
 * Query System
 *
 * Query → Compute → Private → [Optional] Share → Value Discovery
 *
 * The query system allows users to:
 * 1. Submit queries to compute providers
 * 2. Store results privately (local-first)
 * 3. Optionally share results with attestations
 * 4. Discover value through tips/citations
 */

export * from './types.js';
export { QueryEngine, getQueryEngine } from './engine.js';
export { QueryStore, getQueryStore } from './store.js';
