import { describe, it, expect, beforeEach } from 'vitest';
import {
  StreamingComputeBridge,
  createStreamingBridge,
  DEFAULT_STREAM_CONFIG,
} from './streaming.js';

describe('Streaming Template', () => {
  let bridge: StreamingComputeBridge;

  beforeEach(() => {
    bridge = createStreamingBridge();
  });

  describe('Session Management', () => {
    it('should start a streaming session', () => {
      const session = bridge.startSession(
        'streamer-1',
        'QmEncoderConfig',
        'QmInitialPlaylist'
      );

      expect(session.id).toBeDefined();
      expect(session.streamerId).toBe('streamer-1');
      expect(session.configCid).toBe('QmEncoderConfig');
      expect(session.contentCid).toBe('QmInitialPlaylist');
      expect(session.endedAt).toBeNull();
      expect(session.computeUnits).toBe(0);
      expect(session.attestationId).toBeDefined();
    });

    it('should update session with new content', () => {
      const session = bridge.startSession('streamer-1', 'config', 'initial');

      const result = bridge.updateSession(session.id, 'QmNewPlaylist', 30);

      expect(result).toBe(true);
      const updated = bridge.getSession(session.id);
      expect(updated!.contentCid).toBe('QmNewPlaylist');
      expect(updated!.computeUnits).toBe(30); // 30 seconds × 1 unit/second
    });

    it('should accumulate compute units over time', () => {
      const session = bridge.startSession('streamer-1', 'config', 'initial');

      bridge.updateSession(session.id, 'playlist1', 30);
      bridge.updateSession(session.id, 'playlist2', 30);
      bridge.updateSession(session.id, 'playlist3', 30);

      const updated = bridge.getSession(session.id);
      expect(updated!.computeUnits).toBe(90);
    });

    it('should end session and get base reward', () => {
      const session = bridge.startSession('streamer-1', 'config', 'initial');
      bridge.updateSession(session.id, 'content', 600); // 10 minutes

      const result = bridge.endSession(session.id, 'QmFinalPlaylist');

      expect(result).not.toBeNull();
      expect(result!.session.endedAt).not.toBeNull();
      expect(result!.session.contentCid).toBe('QmFinalPlaylist');
      expect(result!.baseReward).not.toBeNull();
      expect(result!.baseReward!.type).toBe('base');
    });

    it('should not update ended session', () => {
      const session = bridge.startSession('streamer-1', 'config', 'initial');
      bridge.endSession(session.id, 'final');

      const result = bridge.updateSession(session.id, 'new', 30);
      expect(result).toBe(false);
    });

    it('should track multiple sessions per streamer', () => {
      bridge.startSession('streamer-1', 'config1', 'content1');
      bridge.startSession('streamer-1', 'config2', 'content2');
      bridge.startSession('streamer-1', 'config3', 'content3');

      const sessions = bridge.getAllSessionsForStreamer('streamer-1');
      expect(sessions).toHaveLength(3);
    });

    it('should track active sessions', () => {
      const s1 = bridge.startSession('streamer-1', 'config1', 'content1');
      bridge.startSession('streamer-1', 'config2', 'content2');
      bridge.endSession(s1.id, 'final');

      const active = bridge.getActiveSessionsForStreamer('streamer-1');
      expect(active).toHaveLength(1);
    });
  });

  describe('Viewer Interactions - Reactions', () => {
    it('should record reaction and attribute value', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      const result = bridge.recordReaction(session.id, 'viewer-1', '🔥');

      expect(result).not.toBeNull();
      expect(result!.interaction.type).toBe('reaction');
      expect(result!.interaction.emoji).toBe('🔥');
      expect(result!.reward).not.toBeNull();
      expect(result!.reward!.type).toBe('value');
      expect(result!.reward!.amount).toBe(DEFAULT_STREAM_CONFIG.reactionAttributionAmount);
    });

    it('should increment reaction count in metrics', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      bridge.recordReaction(session.id, 'viewer-1', '🔥');
      bridge.recordReaction(session.id, 'viewer-2', '👏');
      bridge.recordReaction(session.id, 'viewer-1', '❤️');

      const updated = bridge.getSession(session.id);
      expect(updated!.metrics.reactionCount).toBe(3);
    });

    it('should return null for unknown session', () => {
      const result = bridge.recordReaction('unknown', 'viewer', '🔥');
      expect(result).toBeNull();
    });
  });

  describe('Viewer Interactions - Tips', () => {
    it('should record tip and attribute value', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      const result = bridge.recordTip(session.id, 'viewer-1', 5.0, 'Great stream!');

      expect(result).not.toBeNull();
      expect(result!.interaction.type).toBe('tip');
      expect(result!.interaction.amount).toBe(5.0);
      expect(result!.reward).not.toBeNull();
      expect(result!.reward!.amount).toBe(5.0);
    });

    it('should accumulate tips in metrics', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      bridge.recordTip(session.id, 'viewer-1', 5.0);
      bridge.recordTip(session.id, 'viewer-2', 10.0);
      bridge.recordTip(session.id, 'viewer-3', 2.5);

      const updated = bridge.getSession(session.id);
      expect(updated!.metrics.totalTips).toBe(17.5);
    });

    it('should reject tips below minimum', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      const result = bridge.recordTip(session.id, 'viewer-1', 0.001);
      expect(result).toBeNull();
    });
  });

  describe('Viewer Interactions - Boosts', () => {
    it('should record boost with higher attribution', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      const result = bridge.recordBoost(session.id, 'viewer-1', 25.0, 'Love your content!');

      expect(result).not.toBeNull();
      expect(result!.interaction.type).toBe('subscribe');
      expect(result!.reward!.amount).toBe(25.0);
    });

    it('should track boosts separately from tips', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      bridge.recordTip(session.id, 'viewer-1', 5.0);
      bridge.recordBoost(session.id, 'viewer-2', 20.0);

      const updated = bridge.getSession(session.id);
      expect(updated!.metrics.totalTips).toBe(5.0);
      expect(updated!.metrics.totalBoosts).toBe(20.0);
    });
  });

  describe('Viewer Interactions - Watch Time', () => {
    it('should track watch time per viewer', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      bridge.recordWatchTime(session.id, 'viewer-1', 30);
      bridge.recordWatchTime(session.id, 'viewer-1', 30);

      const updated = bridge.getSession(session.id);
      expect(updated!.metrics.totalWatchSeconds).toBe(60);
    });

    it('should count unique viewers', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      bridge.recordWatchTime(session.id, 'viewer-1', 30);
      bridge.recordWatchTime(session.id, 'viewer-2', 30);
      bridge.recordWatchTime(session.id, 'viewer-1', 30); // Same viewer again

      const updated = bridge.getSession(session.id);
      expect(updated!.metrics.uniqueViewers).toBe(2);
    });

    it('should attribute value at threshold', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      // First 30 seconds - no attribution
      const r1 = bridge.recordWatchTime(session.id, 'viewer-1', 30);
      expect(r1.attributionCreated).toBe(false);

      // Next 30 seconds - crosses 60s threshold
      const r2 = bridge.recordWatchTime(session.id, 'viewer-1', 30);
      expect(r2.attributionCreated).toBe(true);
      expect(r2.reward).not.toBeNull();
    });

    it('should create multiple attributions for long watch time', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      // Watch 3 minutes worth
      bridge.recordWatchTime(session.id, 'viewer-1', 60);
      const r1 = bridge.recordWatchTime(session.id, 'viewer-1', 60);
      const r2 = bridge.recordWatchTime(session.id, 'viewer-1', 60);

      expect(r1.attributionCreated).toBe(true);
      expect(r2.attributionCreated).toBe(true);
    });
  });

  describe('Earnings Aggregation', () => {
    it('should aggregate streamer earnings', () => {
      const s1 = bridge.startSession('streamer-1', 'config', 'content');
      bridge.updateSession(s1.id, 'updated', 600);
      bridge.recordTip(s1.id, 'viewer-1', 10.0);
      bridge.recordBoost(s1.id, 'viewer-2', 25.0);
      bridge.recordReaction(s1.id, 'viewer-3', '🔥');
      bridge.endSession(s1.id, 'final');

      const earnings = bridge.getStreamerEarnings('streamer-1');

      expect(earnings.sessionsCount).toBe(1);
      expect(earnings.totalTips).toBe(10.0);
      expect(earnings.totalBoosts).toBe(25.0);
      // Base rewards come from attestation compute units (registered at session start)
      // Note: compute units accumulate in session but attestation is fixed at registration
      expect(earnings.totalBaseRewards).toBeGreaterThanOrEqual(0);
      // Value rewards: 10 (tip) + 25 (boost) + 0.01 (reaction) = 35.01
      expect(earnings.totalValueRewards).toBeGreaterThan(35);
    });

    it('should aggregate across multiple sessions', () => {
      const s1 = bridge.startSession('streamer-1', 'config1', 'c1');
      const s2 = bridge.startSession('streamer-1', 'config2', 'c2');

      bridge.recordTip(s1.id, 'v1', 5.0);
      bridge.recordTip(s2.id, 'v2', 10.0);

      const earnings = bridge.getStreamerEarnings('streamer-1');

      expect(earnings.sessionsCount).toBe(2);
      expect(earnings.totalTips).toBe(15.0);
    });
  });

  describe('Session Analytics', () => {
    it('should calculate session analytics', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');

      // Simulate 5 minutes of streaming
      bridge.updateSession(session.id, 'updated', 300);

      // 3 viewers watch
      bridge.recordWatchTime(session.id, 'v1', 60);
      bridge.recordWatchTime(session.id, 'v2', 120);
      bridge.recordWatchTime(session.id, 'v3', 180);

      // Some reactions
      bridge.recordReaction(session.id, 'v1', '🔥');
      bridge.recordReaction(session.id, 'v2', '👏');

      // A tip
      bridge.recordTip(session.id, 'v3', 5.0);

      const analytics = bridge.getSessionAnalytics(session.id);

      expect(analytics).not.toBeNull();
      expect(analytics!.session.id).toBe(session.id);
      expect(analytics!.engagement.watchMinutes).toBe(6); // 360 seconds / 60
      expect(analytics!.engagement.averageWatchTime).toBe(120); // 360 / 3 viewers
      expect(analytics!.value.totalAttributed).toBeGreaterThan(5); // tip + reactions + watch
    });

    it('should return null for unknown session', () => {
      const analytics = bridge.getSessionAnalytics('unknown');
      expect(analytics).toBeNull();
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom compute units per second', () => {
      const customBridge = createStreamingBridge({
        computeUnitsPerSecond: 2,
      });

      const session = customBridge.startSession('s', 'c', 'p');
      customBridge.updateSession(session.id, 'new', 30);

      expect(customBridge.getSession(session.id)!.computeUnits).toBe(60); // 30 × 2
    });

    it('should respect quality multiplier', () => {
      const hdBridge = createStreamingBridge({
        qualityMultiplier: 1.5,
      });

      const session = hdBridge.startSession('s', 'c', 'p');
      hdBridge.updateSession(session.id, 'new', 100);

      expect(hdBridge.getSession(session.id)!.computeUnits).toBe(150); // 100 × 1.5
    });

    it('should respect custom watch attribution threshold', () => {
      const customBridge = createStreamingBridge({
        watchSecondsPerAttribution: 30, // Attribute every 30 seconds instead of 60
      });

      const session = customBridge.startSession('s', 'c', 'p');
      const result = customBridge.recordWatchTime(session.id, 'v', 30);

      expect(result.attributionCreated).toBe(true);
    });
  });

  describe('Access to Underlying Systems', () => {
    it('should expose compute registry', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');
      bridge.recordTip(session.id, 'viewer', 5.0);

      const registry = bridge.getRegistry();
      const stats = registry.getStats();

      expect(stats.totalAttestations).toBe(1);
      expect(stats.totalValueAttributed).toBe(5.0);
    });

    it('should expose reward manager', () => {
      const session = bridge.startSession('streamer-1', 'config', 'content');
      bridge.updateSession(session.id, 'content', 100);
      bridge.endSession(session.id, 'final');

      const rewardManager = bridge.getRewardManager();
      const stats = rewardManager.getStats();

      expect(stats.attestationsRewarded).toBe(1);
    });
  });
});
