# Streaming Template

## Overview

The streaming template demonstrates how live content creation maps to Omnium's anonymous compute layer. This is a **reference implementation** for any creator economy use case.

## Core Insight

**Content creation IS computation.**

When a streamer broadcasts:
- Their encoder settings = **code**
- Their performance = **input**
- The video segments = **output**
- Viewer engagement = **retroactive value discovery**

The streamer doesn't need to declare their content is "useful" - viewers discover that through engagement.

## Concept Mapping

| Streaming Concept | Omnium Compute Concept |
|-------------------|------------------------|
| Stream session | Compute attestation |
| Encoder config | Code CID |
| Performance/scene | Input CID |
| Video segments | Output CID |
| Stream duration | Compute units |
| Viewer reaction | Value attribution (tip) |
| Viewer tip | Value attribution (tip) |
| Viewer boost | Value attribution (boost) |
| Watch time | Value attribution (citation) |

## The Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                     CREATOR ECONOMY PATTERN                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PRODUCE (Anonymous Compute)                                  │
│     ┌─────────┐    ┌─────────┐    ┌──────────┐                 │
│     │ Config  │ +  │ Perform │ →  │ Content  │                  │
│     │ (code)  │    │ (input) │    │ (output) │                  │
│     └─────────┘    └─────────┘    └──────────┘                  │
│                                         │                        │
│     Creator gets BASE REWARD for        │                        │
│     proving deterministic work          │                        │
│                                         ▼                        │
│  2. DISCOVER (Retroactive Value)                                 │
│     ┌─────────────────────────────────────────────────┐         │
│     │                 VIEWER ENGAGEMENT               │         │
│     │                                                 │         │
│     │  👏 Reactions    →  Micro-tips (0.01Ω each)   │         │
│     │  💰 Tips         →  Direct value flow         │         │
│     │  🚀 Boosts       →  Amplified attribution     │         │
│     │  ⏱️ Watch time   →  Attention citation        │         │
│     └─────────────────────────────────────────────────┘         │
│                           │                                      │
│                           ▼                                      │
│  3. REWARD (Value Flows)                                        │
│     ┌─────────────────────────────────────────────────┐         │
│     │  Base Reward (compute)     + Value Reward (tips)│         │
│     │       ↓                           ↓             │         │
│     │  For doing the work         For being valued    │         │
│     └─────────────────────────────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Integration

```typescript
import { createStreamingBridge } from '@omnium/templates';

// 1. Create the bridge
const bridge = createStreamingBridge({
  computeUnitsPerSecond: 1,
  qualityMultiplier: 1.5,  // HD stream
});

// 2. Start streaming
const session = bridge.startSession(
  'streamer-wallet-id',
  'QmEncoderConfig',  // Hash of OBS settings
  'QmInitialPlaylist' // First HLS manifest
);

// 3. Update periodically as new segments are produced
setInterval(() => {
  bridge.updateSession(session.id, 'QmNewPlaylist', 30);
}, 30000);

// 4. Process viewer engagement
bridge.recordReaction(session.id, 'viewer-1', '🔥');
bridge.recordTip(session.id, 'viewer-2', 5.0, 'Great stream!');
bridge.recordWatchTime(session.id, 'viewer-3', 60);

// 5. End session
const result = bridge.endSession(session.id, 'QmFinalPlaylist');
console.log(`Base reward: ${result.baseReward?.amount}Ω`);

// 6. Check total earnings
const earnings = bridge.getStreamerEarnings('streamer-wallet-id');
console.log(`Value discovered: ${earnings.totalValueRewards}Ω`);
```

### Value Attribution Types

| Type | When Used | Amount |
|------|-----------|--------|
| Reaction | Emoji click | 0.01Ω (configurable) |
| Tip | Direct tip | User-specified |
| Boost | Super reaction / sub | User-specified |
| Watch | Every minute watched | 0.001Ω (configurable) |

## Why This Pattern?

### Traditional Model (Problematic)
```
1. Creator declares content is "useful"
2. Platform gatekeeps what's allowed
3. Metrics are gamed
4. Value is extracted, not discovered
```

### Omnium Model (Better)
```
1. Creator proves deterministic work
2. No upfront usefulness declaration
3. Value emerges from engagement
4. Creator owns their attestations
```

## Extending the Pattern

This same pattern applies to:

| Use Case | Compute | Value Discovery |
|----------|---------|-----------------|
| **Streaming** | Video segments | Reactions, tips, watch time |
| **Research** | Papers | Citations, replication |
| **Gaming** | Gameplay | Achievements, community votes |
| **Education** | Lessons | Student progress, outcomes |
| **Music** | Tracks | Listens, saves, shares |
| **Code** | Commits | Usage, forks, dependencies |

## Configuration

```typescript
interface StreamBridgeConfig {
  // Compute units per second of stream
  computeUnitsPerSecond: number;  // Default: 1

  // Quality multiplier (1080p = 1.5, 4K = 3.0)
  qualityMultiplier: number;  // Default: 1.0

  // Minimum tip to count as attribution
  minTipAmount: number;  // Default: 0.01

  // Watch seconds per attribution
  watchSecondsPerAttribution: number;  // Default: 60

  // Ω per watch attribution
  watchAttributionAmount: number;  // Default: 0.001

  // Ω per reaction
  reactionAttributionAmount: number;  // Default: 0.01
}
```

## Privacy Considerations

The anonymous compute layer is privacy-preserving by default:

- **No metadata required**: Streamer doesn't have to declare topic/category
- **CID-based**: Content is content-addressed, not identity-linked
- **Opt-in disclosure**: Metadata (tags, description) is optional
- **Retroactive binding**: Can link to simulations later if desired

This means streamers can:
- Stream privately without declaring intent
- Receive value based purely on engagement
- Maintain anonymity while still earning

## Analytics

```typescript
// Get session analytics
const analytics = bridge.getSessionAnalytics(sessionId);

console.log(`Watch time: ${analytics.engagement.watchMinutes} minutes`);
console.log(`Reactions/min: ${analytics.engagement.reactionsPerMinute}`);
console.log(`Avg watch time: ${analytics.engagement.averageWatchTime}s`);
console.log(`Value attributed: ${analytics.value.totalAttributed}Ω`);
```

## Integration with Full Omnium

The streaming bridge integrates with:

1. **ComputeRegistry**: Stores attestations
2. **ComputeRewardManager**: Calculates rewards
3. **ContributionPool**: Optional simulation binding
4. **DividendPool**: T2/T∞ tips earn dividends
5. **CommunityFund**: Exit fees build commons

## Next Steps

See the [website implementation](../../../website/lib/omnium-client.ts) for a browser-side demo of these concepts in action.
