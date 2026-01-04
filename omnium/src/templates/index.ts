/**
 * OMNIUM Templates
 *
 * Reference implementations showing how different use cases
 * integrate with the Omnium economic system.
 *
 * Each template demonstrates:
 * 1. How to map domain concepts to compute attestations
 * 2. How value is discovered retroactively
 * 3. How rewards flow to contributors
 *
 * Use these as patterns for building your own integrations.
 */

export * from './streaming.js';

/**
 * TEMPLATE CATALOG
 *
 * Current templates:
 * - Streaming: Live content creation → viewer engagement → retroactive value
 *
 * Planned templates:
 * - Research: Paper writing → citations → retroactive recognition
 * - Gaming: Gameplay → achievements → community validation
 * - Education: Lesson creation → student progress → outcome attribution
 * - Music: Track creation → listens/saves → streaming value
 * - Code: Open source → usage → dependency attribution
 *
 * PATTERN SUMMARY:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    CREATOR ECONOMY PATTERN                  │
 * ├─────────────────────────────────────────────────────────────┤
 * │  1. PRODUCE                                                  │
 * │     Creator produces content/work                            │
 * │     → Compute Attestation (input + code → output)           │
 * │     → Base reward for deterministic work                     │
 * │                                                              │
 * │  2. DISCOVER                                                 │
 * │     Consumers engage with content                            │
 * │     → Value Attributions (tips, reactions, citations)        │
 * │     → Value flows retroactively to creator                   │
 * │                                                              │
 * │  3. ACCUMULATE                                               │
 * │     Value compounds over time                                │
 * │     → Popular content earns more                             │
 * │     → Creator reputation grows                               │
 * │     → No upfront "usefulness" declaration needed             │
 * └─────────────────────────────────────────────────────────────┘
 */
