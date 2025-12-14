# OMNIUM

A meta-currency framework implementing **dimensional money** - currency as a multi-dimensional vector rather than a scalar.

## Core Concept

Each unit is a vector: `Ω = (m, T, L, P, R)`

| Dimension | Description |
|-----------|-------------|
| **m** | Magnitude (quantity) |
| **T** | Temporal stratum (T0/T1/T2/T∞) |
| **L** | Locality (community set) |
| **P** | Purpose (intent channels) |
| **R** | Reputation (provenance chain) |

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# CLI commands
node dist/cli/index.js demo      # Set up demo scenario
node dist/cli/index.js status    # System overview
node dist/cli/index.js --help    # All commands

# Development (no build needed)
npx tsx src/cli/index.ts demo
```

## Key Commands

```
create-wallet <name>     Create wallet
mint <amount>            Mint from Commons Pool
transfer <id> <to>       Transfer between wallets
convert <id> [options]   Convert dimensions (-t T2, -l community, -p purpose)
tick [days]              Advance time (apply demurrage/dividends)
balance                  Show wallet balance
```

## Temporal Strata

| Stratum | Behavior | Use Case |
|---------|----------|----------|
| T0 | 2% demurrage | Immediate spending |
| T1 | Stable, 1-year lock | Seasonal savings |
| T2 | 3% dividend, 20-year lock | Generational wealth |
| T∞ | 1.5% yield, principal locked | Endowments |

## License

MIT
