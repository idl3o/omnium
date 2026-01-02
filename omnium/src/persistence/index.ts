/**
 * OMNIUM Persistence Layer
 *
 * Content-addressed persistence using Helia (IPFS).
 * Provides snapshot-based state management and append-only transaction logs.
 *
 * Usage:
 *   // Enable persistence on the ledger
 *   await ledger.enablePersistence({ storagePath: './.omnium-data' });
 *
 *   // Save current state
 *   await ledger.save();
 *
 *   // State is automatically loaded on enablePersistence if it exists
 */

// Types
export * from './types.js';

// Serialization utilities
export * from './serialization.js';

// Storage layer
export * from './storage/index.js';

// Manager layer
export * from './manager/index.js';

// Network layer (future P2P)
export * from './network/index.js';
