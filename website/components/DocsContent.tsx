'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'core-types', title: 'Core Types' },
  { id: 'economics', title: 'Economics Layer' },
  { id: 'compute', title: 'Proof-of-Useful-Compute' },
  { id: 'simulations', title: 'Simulation Framework' },
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'api-reference', title: 'API Reference' },
]

function TableOfContents({ activeSection, onNavigate }: { activeSection: string; onNavigate?: () => void }) {
  return (
    <nav>
      <p className="text-xs text-omnium-muted uppercase tracking-wider mb-4">Documentation</p>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={onNavigate}
              className={`text-sm transition-colors block py-1 border-l-2 pl-3 ${
                activeSection === section.id
                  ? 'text-dim-temporal border-dim-temporal'
                  : 'text-omnium-muted border-transparent hover:text-omnium-text hover:border-omnium-muted/50'
              }`}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      <h2 className="text-2xl md:text-3xl font-display font-light text-omnium-text mb-6">
        {title}
      </h2>
      <div className="prose prose-invert prose-lg max-w-none">
        {children}
      </div>
    </section>
  )
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-6 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10 overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-omnium-muted/10 text-xs text-omnium-muted font-mono">
          {title}
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-omnium-text/80 overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function Diagram({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 p-6 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10 font-mono text-sm overflow-x-auto">
      {children}
    </div>
  )
}

export function DocsContent() {
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )

    sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-omnium-bg">
      {/* Header */}
      <header className="border-b border-omnium-muted/10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-omnium-text hover:text-dim-temporal transition-colors">
            <span className="text-2xl">Ω</span>
            <span className="font-display">OMNIUM</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/whitepaper/"
              className="text-sm text-omnium-muted hover:text-omnium-text transition-colors"
            >
              Whitepaper
            </Link>
            <a
              href="https://github.com/idl3o/omnium"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-omnium-muted hover:text-omnium-text transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Desktop TOC */}
      <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 w-48">
        <TableOfContents activeSection={activeSection} />
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-display font-light text-omnium-text mb-4">
            Documentation
          </h1>
          <p className="text-xl text-omnium-muted">
            Technical reference for the OMNIUM framework
          </p>
        </motion.div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <p className="text-omnium-text/80 leading-relaxed">
            OMNIUM is a meta-currency framework implementing &ldquo;dimensional money&rdquo; &mdash; currency as
            a multi-dimensional vector rather than a scalar. Each unit carries magnitude, temporality,
            locality, purpose, and reputation (provenance).
          </p>

          <CodeBlock title="Core Concept">
{`Ω = (m, T, L, P, R)

where:
  m = magnitude (quantity)
  T = temporal stratum (T0/T1/T2/T∞)
  L = locality set (communities)
  P = purpose set (intent channels)
  R = reputation (provenance chain)`}
          </CodeBlock>

          <p className="text-omnium-text/80 leading-relaxed mt-4">
            The framework enables money to carry semantic information &mdash; to remember what it&apos;s for,
            where it belongs, and where it came from &mdash; while remaining fully liquid and interoperable.
          </p>
        </Section>

        {/* Architecture */}
        <Section id="architecture" title="Architecture">
          <p className="text-omnium-text/80 leading-relaxed">
            OMNIUM is organized into five logical layers, each handling a specific dimension:
          </p>

          <Diagram>
            <pre className="text-omnium-text/70">{`
┌─────────────────────────────────────────────────────────────────┐
│                         OMNIUM LEDGER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Commons Pool │  │ Wallet Mgr   │  │ Conversion Engine    │  │
│  │              │  │              │  │                      │  │
│  │ mint/burn    │  │ balance      │  │ Ω' = Ω × f(Δdims)   │  │
│  │ supply       │  │ units        │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         FIVE LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Temporal   │ │   Local     │ │   Purpose   │ │ Reputation│ │
│  │             │ │             │ │             │ │           │ │
│  │ T0: -2%/yr  │ │ Entry: 1%   │ │ Add: free   │ │ Accretes  │ │
│  │ T1: stable  │ │ Exit: var   │ │ Remove: 3%  │ │ Strip: 5% │ │
│  │ T2: +3%/yr  │ │             │ │             │ │           │ │
│  │ T∞: +1.5%   │ │             │ │             │ │           │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      ECONOMICS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ DividendPool │  │CommunityFund │  │    ComputePool       │  │
│  │              │  │              │  │    (Bootstrap)       │  │
│  │ demurrage →  │  │ exit fees →  │  │                      │  │
│  │ dividends    │  │ community    │  │ external $ → mint Ω  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            `}</pre>
          </Diagram>
        </Section>

        {/* Core Types */}
        <Section id="core-types" title="Core Types">
          <p className="text-omnium-text/80 leading-relaxed">
            The fundamental data structures that power OMNIUM:
          </p>

          <CodeBlock title="OmniumUnit">
{`interface OmniumUnit {
  id: string;                    // Unique identifier
  magnitude: number;             // Quantity of value (0 to ∞)
  temporality: TemporalStratum;  // T0 | T1 | T2 | TInfinity
  locality: Set<string>;         // Community IDs (empty = global)
  purpose: Set<string>;          // Purpose channel IDs (empty = unrestricted)
  provenance: ProvenanceChain;   // Complete history
  createdAt: number;             // Creation timestamp
  lastTickAt: number;            // Last demurrage/dividend calculation
  lockedUntil?: number;          // Temporal lock expiration
  walletId: string;              // Current owner
}`}
          </CodeBlock>

          <CodeBlock title="TemporalStratum">
{`enum TemporalStratum {
  T0 = 'T0',         // Immediate: -2%/year demurrage
  T1 = 'T1',         // Seasonal: stable, 1-year lock
  T2 = 'T2',         // Generational: +3%/year, 20-year lock
  TInfinity = 'T∞',  // Perpetual: +1.5%/year, forever locked
}`}
          </CodeBlock>

          <CodeBlock title="ProvenanceEntry">
{`interface ProvenanceEntry {
  timestamp: number;
  type: ProvenanceType;  // Minted | Earned | Gifted | Invested | Inherited
  fromWallet?: string;
  toWallet?: string;
  amount: number;
  note?: string;
  transactionId: string;
}`}
          </CodeBlock>
        </Section>

        {/* Economics Layer */}
        <Section id="economics" title="Economics Layer">
          <p className="text-omnium-text/80 leading-relaxed">
            The economics layer handles the flow of value within the system. Fees and demurrage
            don&apos;t vanish &mdash; they flow to where they create the most value.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">DividendPool</h3>
          <p className="text-omnium-text/80 leading-relaxed">
            Mediates time preference by collecting T0 demurrage and distributing it as T2/T∞ dividends:
          </p>

          <CodeBlock title="DividendPool Flow">
{`T0 holder (decaying money)
    │
    ▼ demurrage collected
┌──────────────────┐
│   DividendPool   │ ← accumulates over time
└──────────────────┘
    │
    ▼ dividends distributed
T2/T∞ holders (growing money)`}
          </CodeBlock>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">CommunityFund</h3>
          <p className="text-omnium-text/80 leading-relaxed">
            Each community has its own fund, accumulating exit fees for local sovereignty:
          </p>

          <CodeBlock title="CommunityFund API">
{`// Deposit exit fees when money leaves a community
communityFunds.depositExitFee(
  communityId: string,
  amount: number,
  sourceUnitId: string,
  sourceWalletId: string,
  timestamp: number
)

// Communities can withdraw for local purposes
communityFunds.withdraw(communityId, amount, note)`}
          </CodeBlock>
        </Section>

        {/* Proof-of-Useful-Compute */}
        <Section id="compute" title="Proof-of-Useful-Compute">
          <p className="text-omnium-text/80 leading-relaxed">
            The bootstrap mechanism for OMNIUM. External demand for computation creates real value,
            allowing the economy to start from zero without requiring initial capital.
          </p>

          <Diagram>
            <pre className="text-omnium-text/70">{`
External Requestor (needs simulation)
        │
        ▼  pays $
   ┌──────────────┐
   │ Commons Pool │ ← external value accumulates
   └──────────────┘
        │
        ▼  authorizes minting
   ┌──────────────┐
   │ ComputePool  │ ← manages job lifecycle
   └──────────────┘
        │
        ▼  verified work
   ┌──────────────┐
   │   Provider   │ ← receives freshly minted T0 Ω
   └──────────────┘
        │
        ▼  spends, time passes
   ┌──────────────┐
   │ Demurrage    │ → DividendPool → T2/T∞ yields
   └──────────────┘
            `}</pre>
          </Diagram>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">Job Lifecycle</h3>

          <CodeBlock title="ComputePool Usage">
{`// 1. External requestor submits a job
const job = ledger.submitComputeJob(
  'requestor-id',
  {
    type: 'simulation',
    payload: { climate: 'model-v2' },
    estimatedCompute: 1000,
    description: 'Climate simulation run'
  },
  100  // $100 payment
);

// 2. Provider claims the job
ledger.claimComputeJob(job.id, providerWallet.id);

// 3. Provider completes with proof
const result = ledger.completeComputeJob(job.id, providerWallet.id, {
  output: { temperature: 2.5, confidence: 0.95 },
  proof: {
    type: 'attestation',  // or 'redundant', 'tee', 'challenge'
    data: { signature: '...' },
    timestamp: Date.now()
  },
  actualCompute: 1000,
  executionTime: 5000
});

// Provider now has 100 Ω in their wallet!`}
          </CodeBlock>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">Proof Types</h3>
          <ul className="space-y-3 text-omnium-text/80">
            <li>
              <strong className="text-omnium-text">Attestation</strong> &mdash; Provider self-attests
              (trust-based, suitable for bootstrap phase)
            </li>
            <li>
              <strong className="text-omnium-text">Redundant</strong> &mdash; Multiple providers run
              the same job, results must match
            </li>
            <li>
              <strong className="text-omnium-text">TEE</strong> &mdash; Trusted Execution Environment
              provides hardware attestation
            </li>
            <li>
              <strong className="text-omnium-text">Challenge</strong> &mdash; Optimistic execution with
              fraud proofs during challenge period
            </li>
          </ul>
        </Section>

        {/* Simulation Framework */}
        <Section id="simulations" title="Simulation Framework">
          <p className="text-omnium-text/80 leading-relaxed">
            The deeper model of Proof-of-Useful-Compute centers on <strong>verified emergence</strong>:
            value comes from emergent properties that arise from following simulation rules correctly.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">Core Concept</h3>
          <p className="text-omnium-text/80 leading-relaxed">
            Payment is not for CPU cycles &mdash; it&apos;s for verified emergence. The blockchain becomes
            an immutable ledger proving the history of computed jobs.
          </p>

          <CodeBlock title="LawSet (Content-Addressed Rules)">
{`interface LawSet {
  id: string;
  name: string;
  domain: 'physics' | 'economics' | 'biology' | 'chemistry' | 'social' | 'custom';
  rulesCid: string;      // Content-addressed rule package
  invariants: string[];  // e.g., ['energy-conservation', 'mass-conservation']
  version: string;
}`}
          </CodeBlock>

          <CodeBlock title="DeterministicContainer">
{`interface DeterministicContainer {
  id: string;
  name: string;
  runtime: 'wasm' | 'docker' | 'native';
  imageCid: string;
  determinismProperties: {
    networkIsolated: boolean;
    filesystemIsolated: boolean;
    deterministicRandom: boolean;
    fixedClock: boolean;
  };
}`}
          </CodeBlock>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">Emergent Properties</h3>
          <p className="text-omnium-text/80 leading-relaxed">
            These are the actual valuable outputs of simulations:
          </p>

          <ul className="space-y-3 text-omnium-text/80">
            <li><strong className="text-dim-temporal">Metric</strong> &mdash; Quantitative measurements (temperature, population, etc.)</li>
            <li><strong className="text-dim-locality">Pattern</strong> &mdash; Recurring structures or behaviors</li>
            <li><strong className="text-dim-purpose">PhaseTransition</strong> &mdash; Qualitative state changes</li>
            <li><strong className="text-dim-reputation">Equilibrium</strong> &mdash; Stable states the system settles into</li>
            <li><strong className="text-omnium-text">Prediction</strong> &mdash; Forecasts for future states</li>
            <li><strong className="text-omnium-muted">Anomaly</strong> &mdash; Unexpected behaviors worth investigating</li>
          </ul>

          <CodeBlock title="ReproducibilityProof">
{`interface ReproducibilityProof {
  method: 'self-attestation' | 'consensus' | 'tee' | 'zk-proof';

  reproductionRecipe: {
    lawSetCid: string;
    containerCid: string;
    initialStateCid: string;
    finalStateCid: string;
    stepsExecuted: number;
  };

  attestations: Array<{
    providerId: string;
    signature: string;
    computedFinalStateCid: string;
  }>;
}`}
          </CodeBlock>
        </Section>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <CodeBlock title="Installation">
{`# Clone the repository
git clone https://github.com/idl3o/omnium.git

# Navigate to the omnium package
cd omnium

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build`}
          </CodeBlock>

          <CodeBlock title="Basic Usage">
{`import { createLedger } from './engine/ledger.js';

// Create a new ledger
const ledger = createLedger();

// Create wallets
const alice = ledger.wallets.createWallet('Alice');
const bob = ledger.wallets.createWallet('Bob');

// Mint some Ω
const unit = ledger.mint(1000, alice.id, 'Initial funding');

// Transfer
ledger.transfer(unit.id, bob.id, 500, 'Payment for services');

// Convert temporal stratum
ledger.convert(unit.id, { targetTemporality: 'T2' });

// Advance time (apply demurrage/dividends)
ledger.tick(30);  // 30 days

// Check status
console.log(ledger.status());`}
          </CodeBlock>
        </Section>

        {/* API Reference */}
        <Section id="api-reference" title="API Reference">
          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">Ledger Methods</h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-temporal">mint(amount, walletId, note?)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Create new T0 Ω from the Commons Pool
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-temporal">transfer(unitId, toWalletId, amount?, note?)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Transfer Ω between wallets, updating provenance
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-temporal">convert(unitId, options)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Convert dimensions: temporality, locality, purpose
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-temporal">tick(days)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Advance time, applying demurrage to T0 and dividends to T2/T∞
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-locality">submitComputeJob(requestor, spec, payment, options?)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Submit a compute job for providers to claim
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-locality">claimComputeJob(jobId, providerId)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Provider claims a pending job
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/30 border border-omnium-muted/10">
              <code className="text-dim-locality">completeComputeJob(jobId, providerId, result)</code>
              <p className="text-omnium-text/70 text-sm mt-2">
                Submit completed work with proof; auto-mints reward on success
              </p>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-omnium-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-omnium-muted hover:text-omnium-text transition-colors">
            &larr; Back to Home
          </Link>
          <Link href="/whitepaper/" className="text-omnium-muted hover:text-omnium-text transition-colors">
            Read the Whitepaper &rarr;
          </Link>
        </div>
      </main>
    </div>
  )
}
