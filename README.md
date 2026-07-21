# Omnium

*The first conception of vectorised money — currency as a multi-dimensional vector, not a scalar.*

Omnium is an early, exploratory prototype of an idea: that a unit of money might carry more than a single number. Instead of a bare quantity, each Omnium unit is a vector — it remembers when it is meant to move, where it belongs, what it is for, and where it has been. It is the **first iteration** of a line of thinking the author has since carried forward into [vectorised-money](https://github.com/idl3o/vectorised-money).

The work sits at the intersection of Web3, AI, and philosophy: less a product than a question rendered in TypeScript — *what if money could remember what it's for?*

## Concept

Every unit is modelled as a five-dimensional vector:

```
Ω = (m, T, L, P, R)
```

| Symbol | Dimension | Meaning |
|--------|-----------|---------|
| `m` | Magnitude | The quantity of value |
| `T` | Temporal | Time-bound behaviour — decay or growth across strata (T0/T1/T2/T∞) |
| `L` | Locality | Community boundaries the unit is tied to |
| `P` | Purpose | Intent channels that colour how a unit may be used |
| `R` | Reputation | A provenance chain recording the unit's history |

Temporal strata give money a time-preference without interest rates: `T0` (immediate) carries a 2% annual demurrage to encourage circulation, while `T2` (generational, 20-year lock) and `T∞` (perpetual) accrue yield. Dimensions are converted into one another through an explicit fee model, with fees returning to a shared **Commons Pool** from which new units are minted. These figures are defined directly in `src/core/types.ts` and `ECONOMICS.md`.

The guiding design principle is that conversions *preserve* semantic information: provenance accretes rather than being erased, and complexity is opt-in — a base unit is a plain scalar until dimensions are added.

## What's inside

The implementation lives under `omnium/` and is organised into layers:

- **Core** (`src/core`) — unit creation, splitting, merging, the Commons Pool, and the conversion engine.
- **Dimensional layers** (`src/layers`) — temporal, locality, purpose, and reputation logic.
- **Engine & wallet** (`src/engine`, `src/wallet`) — a ledger tying the pieces together and wallet management.
- **Economics** (`src/economics`) — a contribution-driven minting model (attention, creation, engagement, governance) with compute pools, dividends, and a community fund; see `ECONOMICS.md`.
- **Persistence** (`src/persistence`) — content-addressed storage over Helia/IPFS, with IPNS discovery, CID chains, and pub/sub sync.
- **Blockchain anchor** (`src/anchor`, `contracts/OmniumAnchor.sol`) — Merkle-proof checkpoints anchoring ledger state on-chain.
- **Query engine** (`src/query`) — a small queryable store with sharing, citation, and tipping commands.
- **CLI** (`src/cli`) — an interactive [Commander](https://github.com/tj/commander.js)-based interface.
- **Website** (`website/`) — a Next.js front-end and whitepaper, published at [idl3o.github.io/omnium](https://idl3o.github.io/omnium/).

## Getting started

The code lives in the `omnium/` subdirectory.

```bash
cd omnium
npm install
npm run build      # compile TypeScript
```

Available scripts (from `package.json`):

```bash
npm run dev        # run the CLI directly via tsx
npm test           # run the test suite (Vitest)
npm run typecheck  # type-check without emitting
```

Run the CLI without a build using `tsx`:

```bash
npx tsx src/cli/index.ts demo     # set up a sample scenario
npx tsx src/cli/index.ts status   # system overview
npx tsx src/cli/index.ts --help   # list all commands
```

Commands include (among others) `create-wallet`, `mint`, `transfer`, `convert`, `create-community`, `join`, `register-purpose`, `tick` (advance time to apply demurrage/dividends), `history`, and `demo` — the full set is defined in `src/cli/index.ts`.

## Status

This is an early prototype (`v0.1.0`), described in its own `package.json` as a "Prototype Implementation" and in `CLAUDE.md` as having 522 tests passing with the economics layer integrated. It is best read as a **first conception** — a working sketch of vectorised money rather than a finished system — and has since been **superseded by [vectorised-money](https://github.com/idl3o/vectorised-money)**, which generalises the same idea to an N-dimensional currency framework. Expect rough edges, and treat the design as exploratory rather than settled.

Licence: MIT — see [LICENSE](LICENSE).

## Related

- [vectorised-money](https://github.com/idl3o/vectorised-money) — the successor: an N-dimensional currency framework, money as a vector, not a scalar.
- [kar-coin](https://github.com/idl3o/kar-coin) — currency that scales with and through civilisational progress.
- [helia-blockchain-token](https://github.com/idl3o/helia-blockchain-token) — currency underpinned by six philosophical frameworks.

---

Built by [S. Lavi](https://github.com/idl3o) · [@modsias](https://x.com/modsias)
