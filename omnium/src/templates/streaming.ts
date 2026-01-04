/**
 * Streaming Template
 *
 * Demonstrates how streaming content creation maps to anonymous compute.
 *
 * KEY INSIGHT: Content creation IS computation.
 * - Streamer's setup (camera, encoder, settings) = code
 * - Scene/performance = input
 * - Video segments = output
 * - Watch time + engagement = retroactive value discovery
 *
 * This template shows the pattern for any creator economy use case:
 * 1. Creator produces content (compute attestation)
 * 2. Consumers discover value (tips, reactions, subscriptions)
 * 3. Value flows retroactively to the creator
 *
 * The creator doesn't declare their content is "useful" - the audience does.
 */

import { v4 as uuid } from 'uuid';
import {
  ComputeRegistry,
  ComputeAttestation,
  ValueType,
  ProofMethod,
  createAnonymousAttestation,
} from '../economics/deterministic-compute.js';
import { ComputeRewardManager, RewardEvent } from '../economics/compute-rewards.js';

// =============================================================================
// STREAMING-SPECIFIC TYPES
// =============================================================================

/**
 * A streaming session - maps to a compute attestation.
 */
export interface StreamSession {
  /** Unique session ID */
  id: string;

  /** Streamer's provider ID (wallet) */
  streamerId: string;

  /** When the session started */
  startedAt: number;

  /** When the session ended (null if live) */
  endedAt: number | null;

  /** Configuration hash (encoder settings, etc.) */
  configCid: string;

  /** Current/final content hash (playlist CID) */
  contentCid: string;

  /** Compute units (duration in seconds × quality factor) */
  computeUnits: number;

  /** Linked attestation ID */
  attestationId: string;

  /** Session metrics */
  metrics: StreamMetrics;
}

export interface StreamMetrics {
  /** Total watch time in seconds (all viewers combined) */
  totalWatchSeconds: number;

  /** Unique viewers */
  uniqueViewers: number;

  /** Peak concurrent viewers */
  peakConcurrent: number;

  /** Total reactions received */
  reactionCount: number;

  /** Total tips received (in Ω) */
  totalTips: number;

  /** Total boosts received (in Ω) */
  totalBoosts: number;
}

/**
 * A viewer interaction that can attribute value.
 */
export interface ViewerInteraction {
  /** Interaction ID */
  id: string;

  /** Session this interaction is for */
  sessionId: string;

  /** Viewer's wallet ID */
  viewerId: string;

  /** Timestamp */
  timestamp: number;

  /** Type of interaction */
  type: 'reaction' | 'tip' | 'subscribe' | 'watch';

  /** Emoji for reactions */
  emoji?: string;

  /** Amount for tips/subscriptions */
  amount?: number;

  /** Watch duration in seconds */
  watchSeconds?: number;
}

/**
 * Configuration for the streaming bridge.
 */
export interface StreamBridgeConfig {
  /** Compute units per second of stream */
  computeUnitsPerSecond: number;

  /** Quality multiplier (e.g., 1080p = 1.5, 4K = 3.0) */
  qualityMultiplier: number;

  /** Minimum tip amount to count as value attribution */
  minTipAmount: number;

  /** Watch seconds per attribution (e.g., every 60 seconds = 1 attribution) */
  watchSecondsPerAttribution: number;

  /** Attribution amount for watch time */
  watchAttributionAmount: number;

  /** Reaction attribution amount */
  reactionAttributionAmount: number;
}

export const DEFAULT_STREAM_CONFIG: StreamBridgeConfig = {
  computeUnitsPerSecond: 1,      // 1 compute unit per second of stream
  qualityMultiplier: 1.0,        // Adjust for resolution/bitrate
  minTipAmount: 0.01,            // Minimum 0.01Ω tip
  watchSecondsPerAttribution: 60, // Attribute value every minute watched
  watchAttributionAmount: 0.001,  // 0.001Ω per minute of watch time
  reactionAttributionAmount: 0.01, // 0.01Ω per reaction
};

// =============================================================================
// STREAMING COMPUTE BRIDGE
// =============================================================================

/**
 * Bridge between streaming and the anonymous compute layer.
 *
 * Maps streaming concepts to compute concepts:
 * - Stream session → Compute attestation
 * - Viewer engagement → Value attribution
 * - Tips/reactions → Retroactive rewards
 *
 * This is a TEMPLATE for how creator economies integrate with Omnium.
 */
export class StreamingComputeBridge {
  private registry: ComputeRegistry;
  private rewardManager: ComputeRewardManager;
  private config: StreamBridgeConfig;

  // Active sessions
  private sessions: Map<string, StreamSession> = new Map();
  private sessionsByStreamer: Map<string, Set<string>> = new Map();
  private sessionsByAttestation: Map<string, string> = new Map();

  // Viewer tracking
  private interactions: Map<string, ViewerInteraction> = new Map();
  private interactionsBySession: Map<string, Set<string>> = new Map();
  private viewerWatchTime: Map<string, Map<string, number>> = new Map(); // session -> viewer -> seconds

  constructor(config: Partial<StreamBridgeConfig> = {}) {
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
    this.registry = new ComputeRegistry();
    this.rewardManager = new ComputeRewardManager(this.registry);
  }

  // ===========================================================================
  // SESSION MANAGEMENT (STREAMER SIDE)
  // ===========================================================================

  /**
   * Start a new streaming session.
   *
   * This creates a compute attestation for the stream.
   * The streamer doesn't need to declare what they're streaming -
   * they just prove they're producing deterministic output.
   */
  startSession(
    streamerId: string,
    configCid: string,
    initialContentCid: string
  ): StreamSession {
    const now = Date.now();

    // Create the compute attestation
    const attestation = this.registry.register(
      createAnonymousAttestation(
        streamerId,
        configCid,          // Input: encoder configuration
        'stream-encoder',   // Code: standardized streaming codec
        initialContentCid,  // Output: content manifest
        0                   // Compute units start at 0, accumulate over time
      )
    );

    const session: StreamSession = {
      id: uuid(),
      streamerId,
      startedAt: now,
      endedAt: null,
      configCid,
      contentCid: initialContentCid,
      computeUnits: 0,
      attestationId: attestation.id,
      metrics: {
        totalWatchSeconds: 0,
        uniqueViewers: 0,
        peakConcurrent: 0,
        reactionCount: 0,
        totalTips: 0,
        totalBoosts: 0,
      },
    };

    // Store session
    this.sessions.set(session.id, session);
    this.addToIndex(this.sessionsByStreamer, streamerId, session.id);
    this.sessionsByAttestation.set(attestation.id, session.id);
    this.interactionsBySession.set(session.id, new Set());
    this.viewerWatchTime.set(session.id, new Map());

    return session;
  }

  /**
   * Update session with new content.
   *
   * Called periodically as new segments are produced.
   */
  updateSession(
    sessionId: string,
    newContentCid: string,
    durationSeconds: number
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.endedAt !== null) return false;

    session.contentCid = newContentCid;
    session.computeUnits += durationSeconds * this.config.computeUnitsPerSecond * this.config.qualityMultiplier;

    return true;
  }

  /**
   * End a streaming session.
   *
   * Finalizes the attestation and processes base rewards.
   */
  endSession(sessionId: string, finalContentCid: string): {
    session: StreamSession;
    baseReward: RewardEvent | null;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.endedAt !== null) return null;

    const now = Date.now();
    session.endedAt = now;
    session.contentCid = finalContentCid;

    // Update the attestation's compute units in registry
    // (In a real implementation, we'd update the attestation)

    // Process base reward for the compute done
    const baseReward = this.rewardManager.processBaseReward(session.attestationId);

    return { session, baseReward };
  }

  // ===========================================================================
  // VIEWER INTERACTIONS (VALUE DISCOVERY)
  // ===========================================================================

  /**
   * Record a viewer reaction.
   *
   * Reactions are micro-value attributions - they signal appreciation.
   */
  recordReaction(
    sessionId: string,
    viewerId: string,
    emoji: string
  ): { interaction: ViewerInteraction; reward: RewardEvent | null } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const interaction: ViewerInteraction = {
      id: uuid(),
      sessionId,
      viewerId,
      timestamp: Date.now(),
      type: 'reaction',
      emoji,
    };

    // Store interaction
    this.interactions.set(interaction.id, interaction);
    this.addToIndex(this.interactionsBySession, sessionId, interaction.id);

    // Update metrics
    session.metrics.reactionCount++;

    // Attribute value to the session's attestation
    const attribution = this.registry.attributeValue(
      session.attestationId,
      viewerId,
      ValueType.Tip, // Reactions are micro-tips
      this.config.reactionAttributionAmount,
      `Reaction: ${emoji}`
    );

    let reward: RewardEvent | null = null;
    if (attribution) {
      reward = this.rewardManager.processValueAttribution(attribution.id);
    }

    return { interaction, reward };
  }

  /**
   * Record a viewer tip.
   *
   * Tips are direct value attributions.
   */
  recordTip(
    sessionId: string,
    viewerId: string,
    amount: number,
    note?: string
  ): { interaction: ViewerInteraction; reward: RewardEvent | null } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (amount < this.config.minTipAmount) return null;

    const interaction: ViewerInteraction = {
      id: uuid(),
      sessionId,
      viewerId,
      timestamp: Date.now(),
      type: 'tip',
      amount,
    };

    // Store interaction
    this.interactions.set(interaction.id, interaction);
    this.addToIndex(this.interactionsBySession, sessionId, interaction.id);

    // Update metrics
    session.metrics.totalTips += amount;

    // Attribute value
    const attribution = this.registry.attributeValue(
      session.attestationId,
      viewerId,
      ValueType.Tip,
      amount,
      note
    );

    let reward: RewardEvent | null = null;
    if (attribution) {
      reward = this.rewardManager.processValueAttribution(attribution.id);
    }

    return { interaction, reward };
  }

  /**
   * Record a boost (super reaction/subscription).
   *
   * Boosts are higher-value attributions that signal strong appreciation.
   */
  recordBoost(
    sessionId: string,
    viewerId: string,
    amount: number,
    note?: string
  ): { interaction: ViewerInteraction; reward: RewardEvent | null } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const interaction: ViewerInteraction = {
      id: uuid(),
      sessionId,
      viewerId,
      timestamp: Date.now(),
      type: 'subscribe',
      amount,
    };

    // Store interaction
    this.interactions.set(interaction.id, interaction);
    this.addToIndex(this.interactionsBySession, sessionId, interaction.id);

    // Update metrics
    session.metrics.totalBoosts += amount;

    // Attribute value as boost
    const attribution = this.registry.attributeValue(
      session.attestationId,
      viewerId,
      ValueType.Boost,
      amount,
      note
    );

    let reward: RewardEvent | null = null;
    if (attribution) {
      reward = this.rewardManager.processValueAttribution(attribution.id);
    }

    return { interaction, reward };
  }

  /**
   * Record viewer watch time.
   *
   * Accumulated watch time becomes value attributions.
   */
  recordWatchTime(
    sessionId: string,
    viewerId: string,
    seconds: number
  ): { attributionCreated: boolean; reward: RewardEvent | null } {
    const session = this.sessions.get(sessionId);
    if (!session) return { attributionCreated: false, reward: null };

    // Get viewer's watch time for this session
    const sessionWatchers = this.viewerWatchTime.get(sessionId)!;
    const previousSeconds = sessionWatchers.get(viewerId) || 0;
    const newTotal = previousSeconds + seconds;
    sessionWatchers.set(viewerId, newTotal);

    // Update metrics
    session.metrics.totalWatchSeconds += seconds;
    if (previousSeconds === 0) {
      session.metrics.uniqueViewers++;
    }

    // Check if we've crossed an attribution threshold
    const previousAttributions = Math.floor(previousSeconds / this.config.watchSecondsPerAttribution);
    const newAttributions = Math.floor(newTotal / this.config.watchSecondsPerAttribution);

    if (newAttributions > previousAttributions) {
      // Create value attribution for watching
      const attribution = this.registry.attributeValue(
        session.attestationId,
        viewerId,
        ValueType.Citation, // Watch time is a form of citation - "I found this worth my time"
        this.config.watchAttributionAmount,
        `Watched ${this.config.watchSecondsPerAttribution}s`
      );

      let reward: RewardEvent | null = null;
      if (attribution) {
        reward = this.rewardManager.processValueAttribution(attribution.id);
      }

      return { attributionCreated: true, reward };
    }

    return { attributionCreated: false, reward: null };
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Get session by ID.
   */
  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active sessions for a streamer.
   */
  getActiveSessionsForStreamer(streamerId: string): StreamSession[] {
    const sessionIds = this.sessionsByStreamer.get(streamerId);
    if (!sessionIds) return [];
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id)!)
      .filter(s => s.endedAt === null);
  }

  /**
   * Get all sessions for a streamer.
   */
  getAllSessionsForStreamer(streamerId: string): StreamSession[] {
    const sessionIds = this.sessionsByStreamer.get(streamerId);
    if (!sessionIds) return [];
    return Array.from(sessionIds).map(id => this.sessions.get(id)!);
  }

  /**
   * Get streamer's total earnings from all sessions.
   */
  getStreamerEarnings(streamerId: string): {
    totalBaseRewards: number;
    totalValueRewards: number;
    totalTips: number;
    totalBoosts: number;
    totalWatchValue: number;
    sessionsCount: number;
  } {
    const rewardStats = this.rewardManager.getProviderRewards(streamerId);
    const sessions = this.getAllSessionsForStreamer(streamerId);

    let totalTips = 0;
    let totalBoosts = 0;
    for (const session of sessions) {
      totalTips += session.metrics.totalTips;
      totalBoosts += session.metrics.totalBoosts;
    }

    return {
      totalBaseRewards: rewardStats.baseRewards,
      totalValueRewards: rewardStats.valueRewards,
      totalTips,
      totalBoosts,
      totalWatchValue: rewardStats.valueRewards - totalTips - totalBoosts,
      sessionsCount: sessions.length,
    };
  }

  /**
   * Get session analytics.
   */
  getSessionAnalytics(sessionId: string): {
    session: StreamSession;
    engagement: {
      watchMinutes: number;
      reactionsPerMinute: number;
      tipsPerViewer: number;
      averageWatchTime: number;
    };
    value: {
      totalAttributed: number;
      baseReward: number;
      valueReward: number;
    };
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const attestationValue = this.registry.getAttestationValue(session.attestationId);
    const watchMinutes = session.metrics.totalWatchSeconds / 60;
    const durationMinutes = session.endedAt
      ? (session.endedAt - session.startedAt) / 60000
      : (Date.now() - session.startedAt) / 60000;

    return {
      session,
      engagement: {
        watchMinutes,
        reactionsPerMinute: durationMinutes > 0 ? session.metrics.reactionCount / durationMinutes : 0,
        tipsPerViewer: session.metrics.uniqueViewers > 0
          ? session.metrics.totalTips / session.metrics.uniqueViewers
          : 0,
        averageWatchTime: session.metrics.uniqueViewers > 0
          ? session.metrics.totalWatchSeconds / session.metrics.uniqueViewers
          : 0,
      },
      value: {
        totalAttributed: attestationValue.totalValue,
        baseReward: 0, // Would need to track this
        valueReward: attestationValue.totalValue,
      },
    };
  }

  /**
   * Get underlying registry and reward manager.
   */
  getRegistry(): ComputeRegistry {
    return this.registry;
  }

  getRewardManager(): ComputeRewardManager {
    return this.rewardManager;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(value);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createStreamingBridge(
  config?: Partial<StreamBridgeConfig>
): StreamingComputeBridge {
  return new StreamingComputeBridge(config);
}

// =============================================================================
// EXAMPLE USAGE (for documentation)
// =============================================================================

/**
 * Example: How a streaming platform integrates with Omnium
 *
 * ```typescript
 * // 1. Create the bridge
 * const bridge = createStreamingBridge();
 *
 * // 2. Streamer starts streaming
 * const session = bridge.startSession(
 *   'streamer-wallet-id',
 *   'QmEncoderConfig123',  // Hash of OBS/encoder settings
 *   'QmInitialPlaylist'    // Initial HLS manifest
 * );
 *
 * // 3. Periodically update as new segments are produced
 * setInterval(() => {
 *   bridge.updateSession(session.id, 'QmNewPlaylist', 30); // 30 second segment
 * }, 30000);
 *
 * // 4. Viewer watches and reacts
 * bridge.recordWatchTime(session.id, 'viewer-wallet', 60);
 * bridge.recordReaction(session.id, 'viewer-wallet', '🔥');
 * bridge.recordTip(session.id, 'viewer-wallet', 5.0, 'Great content!');
 *
 * // 5. End session - streamer receives base reward for compute
 * const result = bridge.endSession(session.id, 'QmFinalPlaylist');
 *
 * // 6. Check earnings
 * const earnings = bridge.getStreamerEarnings('streamer-wallet-id');
 * console.log(`Base rewards: ${earnings.totalBaseRewards}Ω`);
 * console.log(`Value rewards: ${earnings.totalValueRewards}Ω`);
 * ```
 *
 * KEY PATTERN:
 * - Streamer produces content (compute attestation)
 * - Viewers discover value through engagement
 * - Value flows retroactively via tips, reactions, watch time
 * - No upfront declaration of "usefulness" required
 */
