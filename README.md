<div align="center">

# OMNIUM

### What if money could remember what it's for?

A meta-currency framework implementing **dimensional money** — currency as a multi-dimensional vector rather than a scalar.

[Whitepaper](#whitepaper) · [Getting Started](#getting-started) · [Documentation](#the-five-dimensions)

---

</div>

## The Vision

Modern money is **one-dimensional**. A dollar is a dollar regardless of its origin, destination, time horizon, or intended purpose. This flatness isn't neutral—it privileges abstraction over meaning, liquidity over intention, and extraction over circulation.

**Omnium** reimagines currency as a multi-dimensional vector. Each unit carries not just quantity, but temporal behavior, locality, purpose, and provenance. Money that remembers what it's for.

```
Ω = (m, T, L, P, R)
```

| Dimension | Symbol | Description |
|-----------|--------|-------------|
| **Magnitude** | `m` | The quantity of value (0 to ∞) |
| **Temporal** | `T` | Time-bound behavior — decay or growth |
| **Locality** | `L` | Community boundaries and regional ties |
| **Purpose** | `P` | Intent channels restricting usage |
| **Reputation** | `R` | Provenance chain tracking history |

---

## The Five Dimensions

### 1. Temporal Strata

Time becomes a dimension of value. Some money decays to encourage flow. Some grows to reward patience.

| Stratum | Behavior | Use Case | Economics |
|---------|----------|----------|-----------|
| **T0** — Immediate | -2% / year | Daily spending, local commerce | Demurrage encourages circulation |
| **T1** — Seasonal | Stable | Emergency funds, short-term savings | 1-year lockup, no change |
| **T2** — Generational | +3% / year | Retirement, education funds | 20-year lock builds wealth |
| **T∞** — Perpetual | +1.5% / year | Endowments, foundations | Principal locked forever |

> *"Moving between temporal strata has costs and benefits, creating a natural market for time-preference without requiring interest rates."*

### 2. Locality

Communities create economic membranes—permeable but present. Value circulates locally while remaining connected to the global economy.

- **Entry Fee (1%)** — Contribution when joining a community
- **Exit Fee (Variable)** — Communities set their own boundary strength
- **Internal Parity (1:1)** — Local currency trades at par within community

### 3. Purpose Channels

Money that carries intent. When you receive purpose-colored money, you know something about the sender's values.

**Standard Channels:** Health · Education · Food · Housing · Carbon-Negative · Creator · Local Business · Charity

- Adding purpose is **free** (restricts utility)
- Removing purpose costs **3%** (stripping intent)

> *"Receiving Ω-P(education) tells you something about the sender's values."*

### 4. Reputation & Provenance

Every unit carries its history. Semantic liquidity: money flows between meanings, but meaning accretes rather than vanishes.

**Provenance Types:**
- **Minted** — Created from Commons Pool
- **Earned** — Payment for goods/services
- **Gifted** — Voluntary transfer
- **Invested** — Return on investment
- **Inherited** — Intergenerational transfer

Reputation is **opt-in**. Strip provenance anytime with a 5% fee.

---

## Conversions & Fees

Any dimension can change through conversion:

```
Ω' = Ω × f(ΔT) × f(ΔL) × f(ΔP) × f(ΔR)
```

| Dimension | Adding/Restricting | Removing/Freeing |
|-----------|-------------------|------------------|
| Temporal | Free (locking up) | 2-10% (unlocking) |
| Locality | 1% (entry) | Variable (exit) |
| Purpose | Free (restricting) | 3% (stripping) |
| Reputation | Free (accretes) | 5% (stripping) |

All fees flow to the **Commons Pool** — the base layer from which all dimensional currency emerges.

---

## The Commons Pool

At the foundation lies the Commons Pool: undifferentiated value from which all dimensional currency emerges and to which fees return.

- **Minting** — New Ω created according to protocol rules
- **Burning** — Ω returned to pool, reducing supply
- **Fee Collection** — All conversion fees flow back
- **Dividend Funding** — T2 and T∞ yields funded from growth

> *"The Commons Pool is governed by a protocol, not a committee."*

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    OMNIUM Framework                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Commons   │  │   Wallet     │  │ Conversion   │   │
│  │    Pool     │  │  Manager     │  │   Engine     │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
│          │               │                   │          │
│  ┌───────┴───────────────┼───────────────────┴───────┐  │
│  │                       │                           │  │
│  ▼                       ▼                           ▼  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   Temporal   │ │    Local     │ │   Purpose    │   │
│  │   Strata     │ │  Communities │ │  Channels    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│          │               │               │             │
│          └───────────────┼───────────────┘             │
│                          ▼                             │
│                  ┌───────────────┐                     │
│                  │  Reputation   │                     │
│                  │   Gradients   │                     │
│                  └───────────────┘                     │
├─────────────────────────────────────────────────────────┤
│            Persistence Layer (Helia/IPFS)               │
└─────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Installation

```bash
cd omnium
npm install
npm run build
```

### CLI Usage

```bash
# Development (no build needed)
npx tsx src/cli/index.ts demo

# Production
node dist/cli/index.js demo
```

### Commands

| Command | Description |
|---------|-------------|
| `create-wallet <name>` | Create a new wallet |
| `mint <amount>` | Mint Ω from Commons Pool |
| `transfer <id> <to> [amount]` | Transfer between wallets |
| `convert <id> [options]` | Convert dimensions (-t T2, -l community, -p purpose) |
| `tick [days]` | Advance time (apply demurrage/dividends) |
| `balance` | Show wallet balance |
| `units` | List all units |
| `history <id>` | Show provenance chain |
| `status` | System overview |
| `demo` | Set up sample scenario |

---

## Data Structure

```typescript
interface OmniumUnit {
  id: string;                    // Unique identifier
  magnitude: number;             // Quantity of value
  temporality: TemporalStratum;  // T0 | T1 | T2 | T∞
  locality: Set<string>;         // Community IDs
  purpose: Set<string>;          // Purpose channel IDs
  provenance: ProvenanceChain;   // Complete history
  createdAt: number;             // Creation timestamp
  lastTickAt: number;            // Last demurrage/dividend
  walletId: string;              // Current owner
}
```

---

## Whitepaper

For the complete technical specification, visit the [live whitepaper](https://idl3o.github.io/omnium/whitepaper/) or explore the sections above which cover the core concepts.

---

## Design Principles

1. **Conversions preserve semantic information** — Provenance accretes, never erased
2. **All operations are reversible** — Nothing locked forever, with appropriate fees
3. **Complexity is opt-in** — Base Ω is simple, add dimensions as needed
4. **Fees fund commons** — Prevent gaming, maintain system health

---

## Technology Stack

- **TypeScript** — Type-safe implementation
- **Helia/IPFS** — Content-addressed storage
- **Commander** — CLI framework
- **Vitest** — Testing

---

## License

MIT

---

<div align="center">

**Omnium** — A meta-currency for dimensional economies

*Money that remembers what it's for.*

[GitHub](https://github.com/idl3o/omnium) · [Website](https://idl3o.github.io/omnium/)

</div>
