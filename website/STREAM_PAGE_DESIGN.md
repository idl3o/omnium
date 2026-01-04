# Stream Page Design

## Core Concept

Live stream as the onboarding experience for Omnium. Viewers learn dimensional money by using it - tipping, joining community, watching their Ω move through dimensions.

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Header: [Logo] [Home] [Docs] [Whitepaper]        [Connect Wallet] 🟢  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌──────────────────────────┐ │
│  │                                     │  │  Stream Community        │ │
│  │                                     │  │  ══════════════════════  │ │
│  │         LIVE STREAM EMBED           │  │  Members: 42             │ │
│  │         (Twitch/YouTube)            │  │  Community Fund: 127.5Ω  │ │
│  │                                     │  │  Exit Fee: 3%            │ │
│  │                                     │  │                          │ │
│  │                                     │  │  [Join Community - 1Ω]   │ │
│  └─────────────────────────────────────┘  └──────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Your Wallet                                              [Mint 10Ω]││
│  │  ═══════════════════════════════════════════════════════════════════││
│  │                                                                     ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ 25.00 Ω     │  │ 10.00 Ω     │  │ 5.00 Ω      │                 ││
│  │  │ T0 Immediate│  │ T2 20-year  │  │ T0 Immediate│                 ││
│  │  │ 🟢 stream   │  │ ⚪ general  │  │ 🟠 coding   │                 ││
│  │  │ [Tip] [Conv]│  │ [Tip] [Conv]│  │ [Tip] [Conv]│                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Tip the Stream                                                     ││
│  │  ═══════════════════════════════════════════════════════════════════││
│  │                                                                     ││
│  │  Amount: [____5____] Ω                                              ││
│  │                                                                     ││
│  │  Purpose (what's this tip for?):                                    ││
│  │  [coding]  [gaming]  [education]  [vibes]  [custom...]              ││
│  │                                                                     ││
│  │  Commitment level:                                                  ││
│  │  [T0 Thanks!]  [T1 Seasonal Sub]  [T2 Patron]  [T∞ Endowment]       ││
│  │                                                                     ││
│  │  Preview: 5Ω → Sam (purpose: coding, temporal: T0)                  ││
│  │           Provenance: "From viewer123 for coding stream"            ││
│  │                                                                     ││
│  │                                    [Send Tip →]                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Recent Activity                                                    ││
│  │  ═══════════════════════════════════════════════════════════════════││
│  │  • viewer42 tipped 10Ω (purpose: gaming, T0) - 2 min ago            ││
│  │  • alice joined stream community - 5 min ago                        ││
│  │  • bob converted 20Ω T0 → T2 (locked for 20 years) - 8 min ago      ││
│  │  • sam received 50Ω dividends from T2 holdings - 1 hour ago         ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Learn: What Just Happened?                                         ││
│  │  ═══════════════════════════════════════════════════════════════════││
│  │  When you tipped 5Ω with purpose "coding":                          ││
│  │                                                                     ││
│  │  1. Your Ω gained PURPOSE - it's now colored for coding support     ││
│  │  2. Sam received it with PROVENANCE - your contribution is recorded ││
│  │  3. It entered the STREAM COMMUNITY locality                        ││
│  │  4. As T0, it will slowly DEMURRAGE (2%/year) - use it or lose it!  ││
│  │                                                                     ││
│  │  [Learn more about dimensional money →]                             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Components Needed

### 1. StreamEmbed
```tsx
// Embed Twitch/YouTube stream
// Props: platform, channelId
// Responsive 16:9 aspect ratio
```

### 2. WalletConnect
```tsx
// Simple wallet state (localStorage for demo, or Web3 later)
// Shows connected state in header
// Creates wallet on first visit (auto-onboard)
```

### 3. WalletPanel
```tsx
// Shows user's Ω units with dimensional info
// Each unit card shows: magnitude, temporality, locality, purpose
// Actions: Tip, Convert
```

### 4. CommunityPanel
```tsx
// Stream community stats
// Join button (costs 1Ω entry fee)
// Shows community fund balance
// Member count
```

### 5. TipForm
```tsx
// Amount input
// Purpose selector (predefined + custom)
// Temporality selector (T0-T∞)
// Preview of what will happen
// Send action
```

### 6. ActivityFeed
```tsx
// Real-time feed of transactions
// Tips, joins, conversions, dividends
// Each shows dimensional changes
```

### 7. LearnPanel
```tsx
// Contextual education
// Explains the last action in Omnium terms
// Links to deeper docs
```

## State Management

For demo/MVP, use React state + localStorage:

```tsx
interface StreamState {
  // User wallet
  wallet: {
    id: string;
    name: string;
    units: OmniumUnit[];
  } | null;

  // Stream community
  community: {
    id: string;
    name: string;
    members: number;
    fundBalance: number;
    exitFee: number;
  };

  // Activity feed
  activities: Activity[];

  // Streamer wallet (Sam)
  streamerWallet: {
    id: string;
    units: OmniumUnit[];
  };
}
```

## Onboarding Flow

1. **Land on page** → See stream, see "Connect Wallet" button
2. **Click Connect** → Auto-create wallet, mint 10Ω for free (demo)
3. **See wallet panel** → Units appear with dimensional properties
4. **Tip the stream** → Choose amount, purpose, temporality
5. **See activity feed** → Their tip appears, dimensions explained
6. **Learn panel updates** → Explains what just happened
7. **Optional: Join community** → Pay entry fee, become member

## Why This Works as Onboarding

| Traditional Docs | Stream Experience |
|------------------|-------------------|
| Read about T0 demurrage | See your Ω slowly decay in real-time |
| Understand purpose channels | Choose "coding" or "gaming" when tipping |
| Learn about locality | Join the stream community, see exit fees |
| Study provenance | See your tips appear with your name attached |

The stream makes abstract concepts **tangible and immediate**.

## Technical Notes

### For Demo/MVP
- All state in-memory + localStorage
- No real blockchain (yet)
- Use Omnium engine directly in browser (it's TypeScript!)
- Simulated time for demurrage/dividends

### For Production
- Connect to actual Omnium node
- Real wallet management
- Persistent state via IPFS/persistence layer

## Stream Platform Options

### Primary: OBS Direct Streaming
Self-hosted RTMP ingest → HLS playback. Full control, no third-party dependencies.

```
┌─────────────┐      RTMP        ┌──────────────┐      HLS       ┌─────────────┐
│   OBS       │ ───────────────→ │ Media Server │ ─────────────→ │  Website    │
│  (encoder)  │  rtmp://...      │  (mediamtx)  │   /live/...    │  (hls.js)   │
└─────────────┘                  └──────────────┘                └─────────────┘
```

**Media Server Options:**
1. **mediamtx** (recommended) - Single binary, RTMP→HLS/WebRTC, zero config
2. **node-media-server** - Node.js, easy integration
3. **nginx-rtmp** - Battle-tested, more setup

**OBS Configuration:**
```
Server:   rtmp://your-server:1935/live
Stream Key: omnium-stream
```

### Fallback: Platform Embeds
- **Twitch** - `twitch.tv/embed`
- **YouTube** - `youtube.com/embed/live_stream`

### Player Stack
- **hls.js** - HLS playback (wide browser support)
- **video.js** - Full-featured player wrapper (optional)
- **WebRTC** (future) - Ultra-low latency

## File Structure

```
website/
├── app/
│   └── stream/
│       └── page.tsx           # Stream page route
├── components/
│   └── stream/
│       ├── StreamPlayer.tsx   # HLS/Twitch/YouTube player
│       ├── WalletConnect.tsx
│       ├── WalletPanel.tsx
│       ├── CommunityPanel.tsx
│       ├── TipForm.tsx
│       ├── ActivityFeed.tsx
│       └── LearnPanel.tsx
├── hooks/
│   └── useOmnium.ts           # Hook for Omnium state
└── lib/
    └── omnium-client.ts       # Browser-side Omnium integration

streaming/                      # Streaming infrastructure
├── docker-compose.yml          # mediamtx + optional transcoding
├── mediamtx.yml               # RTMP/HLS server config
└── README.md                  # OBS setup instructions
```

## OBS Setup Instructions

### Quick Start

1. **Start the media server:**
   ```bash
   cd streaming && docker-compose up -d
   ```

2. **Configure OBS:**
   - Settings → Stream
   - Service: Custom
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: `omnium`

3. **Open the stream page:**
   - Navigate to `/stream`
   - Player auto-connects to HLS feed

### Production Deployment

For production, deploy mediamtx to a server with:
- Public IP or domain
- Ports 1935 (RTMP), 8888 (HLS), 8889 (WebRTC)
- Update `NEXT_PUBLIC_STREAM_URL` in `.env`
