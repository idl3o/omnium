# Omnium Economic Model

## Overview

Omnium (Ω) is dimensional money - each unit carries magnitude, temporality, locality, purpose, and reputation. This document describes how Ω is created, flows, and decays.

## Core Principle

**Value creation is multi-dimensional.** Rather than a single "proof of work," Ω recognizes multiple forms of valuable contribution:

- Attention (watching)
- Capital (deposits)
- Creation (content)
- Engagement (interaction)
- Governance (moderation)
- Growth (referrals)

All contributions mint T0 Ω, which naturally decays via demurrage - creating velocity rather than hoarding.

---

## Ω Creation (Inflows)

### 1. Currency Deposits

External value enters the system.

```
User deposits $100 → Receives 100Ω (T0)
```

| Aspect | Details |
|--------|---------|
| Exchange rate | 1:1 with USD (or market-determined) |
| Temporality | Always T0 (immediate) |
| Purpose | None (general) |
| Locality | None (global) |
| Provenance | "Deposited from [source]" |

**Why it matters:** Provides a value anchor. Ω can always be compared to external currency.

### 2. Attention Mining

Viewers earn by watching content.

```
1 minute watched → 0.01Ω (T0)
```

| Aspect | Details |
|--------|---------|
| Rate | 0.01Ω per minute |
| Verification | Tab focused + video playing |
| Temporality | T0 (immediate, decaying) |
| Purpose | "attention" |
| Locality | Stream community |

**Why it matters:** Attention has real value - advertisers pay billions for it. Instead of extracting that value, we give it directly to viewers.

**Anti-gaming:**
- Must be actively watching (tab focus detection)
- Demurrage makes farming unprofitable
- Could add captcha/interaction requirements

### 3. Interaction Mining

Some engagement earns Ω, while reactions are micro-tips to the creator.

| Action | Effect | Purpose Tag |
|--------|--------|-------------|
| Chat message | +0.02Ω earned | "chat" |
| Poll vote | +0.05Ω earned | "governance" |
| Prediction (correct) | +0.50Ω bonus | "prediction" |
| **Reaction** | **-0.01Ω spent** | "reaction" (micro-tip) |

**Why it matters:** Chat and votes provide valuable signal and earn Ω. Reactions are expressions of appreciation that flow directly to the creator as micro-tips - creating instant, low-friction value transfer.

### 4. Content Creation

Streamers/creators earn from their audience.

```
1 viewer-minute → 0.005Ω to creator
```

| Aspect | Details |
|--------|---------|
| Rate | 0.005Ω per viewer-minute |
| Calculation | viewers × minutes × rate |
| Temporality | T0 |
| Purpose | "creation" |

**Example:** 100 viewers for 60 minutes = 100 × 60 × 0.005 = 30Ω

**Why it matters:** Creators are rewarded proportionally to attention they attract, without needing ads or sponsorships.

### 5. Community Work

Governance and moderation earn Ω.

| Action | Earning | Notes |
|--------|---------|-------|
| Moderate content | 0.10Ω | Per action taken |
| Curate (upvote good content) | 0.02Ω | If content performs well |
| Teach/onboard new user | 0.50Ω | When mentee becomes active |
| Propose governance | 0.20Ω | For accepted proposals |

**Why it matters:** Communities need maintenance. Rather than relying on unpaid volunteers, compensate governance work.

### 6. Network Growth

Referrals and onboarding earn Ω.

```
Refer new user who becomes active → 1.00Ω
```

| Condition | Earning |
|-----------|---------|
| Referral signs up | 0.10Ω |
| Referral watches 10 min | 0.40Ω |
| Referral makes first tip | 0.50Ω |

**Why it matters:** Network effects are valuable. Early adopters who grow the network should be rewarded.

---

## Ω Decay (Outflows)

### 1. Demurrage (T0 Only)

T0 Ω decays at 2% annually.

```
100Ω today → 98Ω in one year (if unspent)
```

| Temporality | Demurrage | Dividends |
|-------------|-----------|-----------|
| T0 | 2%/yr decay | None |
| T1 | None | None |
| T2 | None | 3%/yr yield |
| T∞ | None | 1.5%/yr yield |

**Where does demurrage go?** → DividendPool → Funds T2/T∞ yields

**Why it matters:** Creates velocity. Ω earned from attention/interaction naturally decays, preventing inflation without hard caps.

### 2. Conversion Fees

Changing dimensions costs Ω (burned).

| Conversion | Fee |
|------------|-----|
| T0 → T2 | 0% (locking is free) |
| T2 → T0 | 5% (unlocking costs) |
| Add locality | 1% entry fee |
| Remove locality | 3% exit fee → Community Fund |
| Add purpose | 0% (restricting is free) |
| Remove purpose | 3% (generalizing costs) |

**Why it matters:** Fees create friction that prevents gaming while funding community infrastructure.

### 3. Community Exit Fees

Leaving a locality costs Ω → Community Fund.

```
Leave "stream-community" with 100Ω → 3Ω to Community Fund, receive 97Ω
```

**Why it matters:** Communities capture value from economic activity within them. Exit fees fund community-specific initiatives.

---

## Economic Loops

### The Attention Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Viewer watches ──→ Earns T0 Ω                     │
│       ↑                   │                        │
│       │                   ▼                        │
│       │            Demurrage pressure              │
│       │                   │                        │
│       │                   ▼                        │
│       │            Tip creator / Spend             │
│       │                   │                        │
│       │                   ▼                        │
│  Creator makes     ←── Creator earns              │
│  more content                                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### The Deposit Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  User deposits $ ──→ Receives T0 Ω                 │
│       ↑                   │                        │
│       │                   ▼                        │
│       │            Tips / Community / Converts     │
│       │                   │                        │
│       │                   ▼                        │
│       │            Creator receives Ω              │
│       │                   │                        │
│       │                   ▼                        │
│  Creator withdraws  ←── Or reinvests              │
│  to $ (optional)                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### The Governance Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Community Fund receives exit fees                 │
│       │                                            │
│       ▼                                            │
│  Fund proposals voted on (earns poll Ω)           │
│       │                                            │
│       ▼                                            │
│  Winning proposals funded                          │
│       │                                            │
│       ▼                                            │
│  Community improves ──→ More users ──→ More fees  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Anti-Gaming Measures

| Attack | Mitigation |
|--------|------------|
| Bot watching | Tab focus + video playing detection, captchas |
| Spam reactions | Rate limiting, diminishing returns |
| Fake referrals | Activation requirements (watch time, first tip) |
| Sybil communities | Minimum stake to create community |
| Wash trading | Provenance tracking makes it visible |

---

## Summary: Where Value Comes From

| Source | Value Type | Backing |
|--------|-----------|---------|
| Deposits | External capital | Direct (1:1 with $) |
| Attention | Time/focus | Indirect (ad market values this) |
| Interaction | Engagement/data | Indirect (platforms pay for this) |
| Creation | Content | Indirect (entertainment value) |
| Governance | Coordination | Indirect (community health) |
| Referrals | Network growth | Indirect (network effects) |

All forms of value creation are recognized. Demurrage ensures circulation. Fees fund infrastructure. The system is self-sustaining.

---

## Implementation Status

| Feature | Status |
|---------|--------|
| Currency deposits | Pending |
| Attention mining | ✅ Implemented |
| Interaction mining | ✅ Implemented |
| Content creation rewards | Pending |
| Community work rewards | Pending |
| Referral rewards | Pending |
| Demurrage | ✅ Implemented (in core) |
| Conversion fees | ✅ Implemented (in core) |
| Exit fees → Community Fund | ✅ Implemented (in core) |
