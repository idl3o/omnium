# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OMNIUM is a meta-currency framework prototype implementing "dimensional money" - currency as a multi-dimensional vector rather than a scalar. Each unit carries magnitude, temporality, locality, purpose, and reputation (provenance).

**Core concept:** `Ω = (m, T, L, P, R)` where:
- `m` = magnitude (quantity)
- `T` = temporal stratum (T0/T1/T2/T∞)
- `L` = locality set (communities)
- `P` = purpose set (intent channels)
- `R` = reputation (provenance chain)

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev          # Run CLI directly with tsx
npm run typecheck    # Type-check without emitting
npm test             # Run tests (vitest)
```

**CLI usage (after build):**
```bash
node dist/cli/index.js demo     # Set up demo scenario
node dist/cli/index.js status   # System status
node dist/cli/index.js --help   # All commands
```

**Development (no build needed):**
```bash
npx tsx src/cli/index.ts demo
```

## Architecture

### Five Layers

1. **Commons Pool** (`src/core/pool.ts`) - Base undifferentiated reserve, minting/burning
2. **Temporal Strata** (`src/layers/temporal.ts`) - Time-bound behavior (demurrage/dividends)
3. **Local Currencies** (`src/layers/local.ts`) - Community boundaries with exit fees
4. **Purpose Channels** (`src/layers/purpose.ts`) - Intent-colored money with spending restrictions
5. **Reputation Gradients** (`src/layers/reputation.ts`) - Provenance tracking and scoring

### Core Components

- **Conversion Engine** (`src/core/conversion.ts`) - Transforms units between dimensions: `Ω' = Ω × f(ΔT) × f(ΔL) × f(ΔP) × f(ΔR)`
- **Ledger** (`src/engine/ledger.ts`) - Central coordinator tying all components together
- **Wallet** (`src/wallet/wallet.ts`) - Holds units, tracks dimensional balances

### Key Types (`src/core/types.ts`)

```typescript
interface OmniumUnit {
  id: string;
  magnitude: number;
  temporality: TemporalStratum;  // T0, T1, T2, T∞
  locality: Set<string>;         // Community IDs
  purpose: Set<string>;          // Purpose channel IDs
  provenance: ProvenanceChain;   // History
  walletId: string;
}
```

## Temporal Mechanics

| Stratum | Behavior | Use Case |
|---------|----------|----------|
| T0 | 2% annual demurrage (decay) | Immediate spending |
| T1 | Stable, 1-year lockup | Seasonal savings |
| T2 | 3% annual dividend, 20-year lock | Generational wealth |
| T∞ | 1.5% yield, principal locked forever | Endowments |

## Conversion Fees

- **Temporal:** Free to lock up (T0→T∞), costs to unlock (T∞→T0 = 10%)
- **Locality:** 1% to enter community, boundary fee (configurable) to leave
- **Purpose:** Free to add (restricts utility), discount to remove (3% default)
- **Reputation:** 5% to strip provenance

## CLI Commands Reference

```
create-wallet <name>     Create wallet
mint <amount>            Mint from Commons Pool
transfer <id> <to> [amt] Transfer between wallets
convert <id> [options]   Convert dimensions (-t T2, -l community, -p purpose)
tick [days]              Advance time (apply demurrage/dividends)
balance                  Show wallet balance
units                    List units
history <id>             Show provenance
status                   System overview
demo                     Set up sample scenario
```

## Design Principles

- Conversions preserve semantic information (provenance accretes)
- All operations are reversible (with fees)
- Complexity is opt-in (base Ω is simple)
- Fees fund commons / prevent gaming
