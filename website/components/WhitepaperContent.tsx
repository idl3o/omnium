'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const sections = [
  { id: 'abstract', title: 'Abstract' },
  { id: 'introduction', title: '1. Introduction' },
  { id: 'dimensional-model', title: '2. The Dimensional Model' },
  { id: 'temporal', title: '3. Temporal Strata' },
  { id: 'locality', title: '4. Locality & Communities' },
  { id: 'purpose', title: '5. Purpose Channels' },
  { id: 'reputation', title: '6. Reputation & Provenance' },
  { id: 'conversions', title: '7. Conversions & Fees' },
  { id: 'commons', title: '8. The Commons Pool' },
  { id: 'implementation', title: '9. Implementation' },
  { id: 'conclusion', title: '10. Conclusion' },
]

function TableOfContents({ activeSection, onNavigate }: { activeSection: string; onNavigate?: () => void }) {
  return (
    <nav>
      <p className="text-xs text-omnium-muted uppercase tracking-wider mb-4">Contents</p>
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

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-omnium-bg-secondary/50 z-50">
      <motion.div
        className="h-full bg-gradient-to-r from-dim-temporal to-dim-purpose"
        style={{ width: `${progress}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  )
}

function ScrollButtons() {
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight

      setShowTop(scrollTop > 300)
      setShowBottom(scrollTop < scrollHeight - 300)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40">
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="w-10 h-10 rounded-full bg-omnium-bg-secondary border border-omnium-muted/20 text-omnium-muted hover:text-omnium-text hover:border-dim-temporal/50 transition-colors flex items-center justify-center shadow-lg"
            aria-label="Scroll to top"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="w-10 h-10 rounded-full bg-omnium-bg-secondary border border-omnium-muted/20 text-omnium-muted hover:text-omnium-text hover:border-dim-temporal/50 transition-colors flex items-center justify-center shadow-lg"
            aria-label="Scroll to bottom"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileTOC({ activeSection, isOpen, onToggle }: { activeSection: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      {/* Toggle button - only visible on mobile */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed bottom-6 left-6 w-10 h-10 rounded-full bg-dim-temporal text-white flex items-center justify-center shadow-lg z-40"
        aria-label="Toggle table of contents"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Slide-out panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-omnium-bg border-r border-omnium-muted/10 p-6 pt-20 z-50 overflow-y-auto"
            >
              <button
                onClick={onToggle}
                className="absolute top-6 right-6 text-omnium-muted hover:text-omnium-text"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <TableOfContents activeSection={activeSection} onNavigate={onToggle} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
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

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 px-6 py-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10 text-center">
      <code className="text-xl md:text-2xl font-mono">{children}</code>
    </div>
  )
}

function Highlight({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ color }}>{children}</span>
}

export function WhitepaperContent() {
  const [activeSection, setActiveSection] = useState('abstract')
  const [readProgress, setReadProgress] = useState(0)
  const [mobileTOCOpen, setMobileTOCOpen] = useState(false)

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0
      setReadProgress(Math.min(100, Math.max(0, progress)))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Track active section
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

  const toggleMobileTOC = useCallback(() => {
    setMobileTOCOpen(prev => !prev)
  }, [])

  return (
    <div className="min-h-screen bg-omnium-bg">
      {/* Progress Bar */}
      <ProgressBar progress={readProgress} />

      {/* Header */}
      <header className="border-b border-omnium-muted/10">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-omnium-text hover:text-dim-temporal transition-colors">
            <span className="text-2xl">Ω</span>
            <span className="font-display">OMNIUM</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/idl3o/omnium/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-omnium-muted hover:text-omnium-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">View MD</span>
            </a>
            <span className="text-sm text-omnium-muted">v1.0</span>
          </div>
        </div>
      </header>

      {/* Desktop TOC */}
      <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 w-48">
        <TableOfContents activeSection={activeSection} />
      </div>

      {/* Mobile TOC */}
      <MobileTOC activeSection={activeSection} isOpen={mobileTOCOpen} onToggle={toggleMobileTOC} />

      {/* Scroll Buttons */}
      <ScrollButtons />

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
            OMNIUM
          </h1>
          <p className="text-xl text-omnium-muted mb-2">
            A Meta-Currency Framework for Dimensional Money
          </p>
          <p className="text-sm text-omnium-muted">
            Version 1.0 — January 2025
          </p>
        </motion.div>

        {/* Abstract */}
        <Section id="abstract" title="Abstract">
          <p className="text-omnium-text/80 leading-relaxed">
            Modern monetary systems operate on a single axis: quantity. A dollar is a dollar regardless of
            its origin, destination, time horizon, or intended purpose. This paper introduces <strong>OMNIUM</strong>,
            a meta-currency framework that extends currency from a scalar to a multi-dimensional vector.
          </p>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            Each unit of Omnium carries five dimensions: <Highlight color="#ffffff">magnitude</Highlight>,{' '}
            <Highlight color="#6366f1">temporality</Highlight>, <Highlight color="#22c55e">locality</Highlight>,{' '}
            <Highlight color="#f59e0b">purpose</Highlight>, and <Highlight color="#ec4899">reputation</Highlight>.
            This dimensional model enables money to carry semantic information—to remember what it&apos;s for,
            where it belongs, and where it came from—while remaining fully liquid and interoperable.
          </p>
          <Formula>
            <Highlight color="#ffffff">Ω</Highlight>
            <span className="text-omnium-muted"> = (</span>
            <Highlight color="#ffffff">m</Highlight>
            <span className="text-omnium-muted">, </span>
            <Highlight color="#6366f1">T</Highlight>
            <span className="text-omnium-muted">, </span>
            <Highlight color="#22c55e">L</Highlight>
            <span className="text-omnium-muted">, </span>
            <Highlight color="#f59e0b">P</Highlight>
            <span className="text-omnium-muted">, </span>
            <Highlight color="#ec4899">R</Highlight>
            <span className="text-omnium-muted">)</span>
          </Formula>
        </Section>

        {/* Introduction */}
        <Section id="introduction" title="1. Introduction">
          <p className="text-omnium-text/80 leading-relaxed">
            What if money could remember what it&apos;s for?
          </p>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            This question drives the design of Omnium. Contemporary currency is deliberately context-free—
            a feature that enables efficiency but eliminates meaning. When money forgets where it came from,
            it forgets where it should go. The result is an economy optimized for abstract liquidity at the
            expense of human values.
          </p>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            Omnium proposes a different architecture: currency as a multi-dimensional vector rather than a
            scalar quantity. Each unit carries:
          </p>
          <ul className="mt-4 space-y-2 text-omnium-text/80">
            <li><strong className="text-white">m (Magnitude)</strong> — The quantity of value (0 to ∞)</li>
            <li><strong className="text-dim-temporal">T (Temporal Stratum)</strong> — Time-bound behavior affecting decay or growth</li>
            <li><strong className="text-dim-locality">L (Locality)</strong> — Community boundaries and regional restrictions</li>
            <li><strong className="text-dim-purpose">P (Purpose)</strong> — Intent channels restricting how money can be used</li>
            <li><strong className="text-dim-reputation">R (Reputation)</strong> — Provenance chain tracking the money&apos;s history</li>
          </ul>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            This isn&apos;t about adding complexity—it&apos;s about encoding the complexity that already exists in
            human economic life. Money flows through communities, carries intentions, and builds history.
            Omnium makes that visible.
          </p>
        </Section>

        {/* Dimensional Model */}
        <Section id="dimensional-model" title="2. The Dimensional Model">
          <p className="text-omnium-text/80 leading-relaxed">
            In Omnium, each unit of currency is represented as a five-dimensional vector:
          </p>
          <Formula>
            Ω = (m, T, L, P, R)
          </Formula>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            These dimensions are not independent constraints but interacting fields. A unit might be
            simultaneously time-locked, community-bound, purpose-colored, and reputation-tracked. The
            interaction of these dimensions creates emergent properties impossible with scalar currency.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">2.1 Design Principles</h3>
          <ul className="space-y-3 text-omnium-text/80">
            <li>
              <strong className="text-omnium-text">Conversions preserve semantic information.</strong>{' '}
              Provenance accretes rather than vanishes. History is never erased, only added to.
            </li>
            <li>
              <strong className="text-omnium-text">All operations are reversible.</strong>{' '}
              Nothing is locked forever. Any restriction can be removed—with appropriate fees.
            </li>
            <li>
              <strong className="text-omnium-text">Complexity is opt-in.</strong>{' '}
              Base Ω is simple. Users add dimensions as needed.
            </li>
            <li>
              <strong className="text-omnium-text">Fees fund commons and prevent gaming.</strong>{' '}
              Conversion fees flow to the Commons Pool, maintaining system health.
            </li>
          </ul>
        </Section>

        {/* Temporal */}
        <Section id="temporal" title="3. Temporal Strata">
          <p className="text-omnium-text/80 leading-relaxed">
            The temporal dimension encodes time-preference directly into money. Rather than using
            interest rates set by central authorities, Omnium allows money itself to behave differently
            over time.
          </p>

          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 font-display font-medium">T0 — Immediate</span>
                <span className="text-red-400 font-mono text-sm">-2% / year</span>
              </div>
              <p className="text-omnium-text/70 text-sm">
                Demurrage encourages circulation. Money in T0 slowly decays, incentivizing spending
                and local commerce. &ldquo;Use it or gradually lose it.&rdquo;
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dim-temporal font-display font-medium">T1 — Seasonal</span>
                <span className="text-dim-temporal font-mono text-sm">Stable</span>
              </div>
              <p className="text-omnium-text/70 text-sm">
                No decay, no growth. A 1-year lockup period. Suitable for medium-term savings,
                emergency funds, or seasonal planning.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dim-locality font-display font-medium">T2 — Generational</span>
                <span className="text-dim-locality font-mono text-sm">+3% / year</span>
              </div>
              <p className="text-omnium-text/70 text-sm">
                Dividends reward patience. 20-year lockup builds lasting wealth across generations.
                Suitable for retirement, education funds, inheritance planning.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dim-purpose font-display font-medium">T∞ — Perpetual</span>
                <span className="text-dim-purpose font-mono text-sm">+1.5% / year</span>
              </div>
              <p className="text-omnium-text/70 text-sm">
                Principal locked forever. Only the yield flows. True endowments for perpetual
                institutions, foundations, and scholarships.
              </p>
            </div>
          </div>

          <p className="text-omnium-muted italic mt-6">
            &ldquo;Moving between temporal strata has costs and benefits, creating a natural market for
            time-preference without requiring interest rates.&rdquo;
          </p>
        </Section>

        {/* Locality */}
        <Section id="locality" title="4. Locality & Communities">
          <p className="text-omnium-text/80 leading-relaxed">
            The locality dimension enables money to &ldquo;know where it belongs.&rdquo; Communities can create
            economic membranes—permeable but present—that allow local resilience while remaining
            connected to the global economy.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">4.1 Community Mechanics</h3>
          <ul className="space-y-3 text-omnium-text/80">
            <li>
              <strong className="text-omnium-text">Entry Fee (1%)</strong> — A small contribution when
              joining a community, funding shared resources.
            </li>
            <li>
              <strong className="text-omnium-text">Exit Fee (Variable)</strong> — Communities set their own
              boundary fees. Higher fees create stronger local circulation.
            </li>
            <li>
              <strong className="text-omnium-text">Internal Parity (1:1)</strong> — Local currency trades at
              par within its community. No friction for neighbors.
            </li>
          </ul>

          <p className="text-omnium-text/80 leading-relaxed mt-6">
            A unit can belong to multiple nested communities simultaneously (e.g., neighborhood → city →
            region). Each boundary can have its own membrane strength, creating nuanced economic geography.
          </p>
        </Section>

        {/* Purpose */}
        <Section id="purpose" title="5. Purpose Channels">
          <p className="text-omnium-text/80 leading-relaxed">
            Purpose channels allow money to carry intent. When you receive purpose-colored money, you
            know something about the sender&apos;s values—and you&apos;re restricted in how you can spend it.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">5.1 Standard Channels</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {['Health', 'Education', 'Food', 'Housing', 'Carbon-Negative', 'Creator', 'Local Business', 'Charity'].map((purpose) => (
              <div key={purpose} className="px-3 py-2 rounded-lg bg-dim-purpose/10 border border-dim-purpose/30 text-center">
                <span className="text-dim-purpose text-sm">{purpose}</span>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">5.2 Economics of Purpose</h3>
          <ul className="space-y-3 text-omnium-text/80">
            <li>
              <strong className="text-omnium-text">Adding purpose is free</strong> — It restricts utility,
              so no fee is charged. You&apos;re limiting where your money can go.
            </li>
            <li>
              <strong className="text-omnium-text">Removing purpose costs 3%</strong> — Stripping intent
              requires a fee, discouraging gaming while maintaining liquidity.
            </li>
            <li>
              <strong className="text-omnium-text">Purpose-colored money trades at a discount</strong> —
              Due to restricted utility, but carries social information.
            </li>
          </ul>

          <p className="text-omnium-muted italic mt-6">
            &ldquo;Receiving Ω-P(education) tells you something about the sender&apos;s values.&rdquo;
          </p>
        </Section>

        {/* Reputation */}
        <Section id="reputation" title="6. Reputation & Provenance">
          <p className="text-omnium-text/80 leading-relaxed">
            Every unit of Omnium carries a provenance chain—a history of how it came to be where it is.
            This creates &ldquo;semantic liquidity&rdquo;: money flows between meanings, but meaning accretes rather
            than vanishes.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">6.1 Provenance Types</h3>
          <div className="space-y-2 mt-4">
            {[
              { type: 'Minted', color: '#ffffff', desc: 'Created from Commons Pool' },
              { type: 'Earned', color: '#22c55e', desc: 'Payment for goods/services' },
              { type: 'Gifted', color: '#ec4899', desc: 'Voluntary transfer without exchange' },
              { type: 'Invested', color: '#6366f1', desc: 'Return on investment' },
              { type: 'Inherited', color: '#f59e0b', desc: 'Intergenerational transfer' },
            ].map((prov) => (
              <div key={prov.type} className="flex items-center gap-3 p-3 rounded-lg bg-omnium-bg-secondary/30">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: prov.color }} />
                <span className="text-omnium-text font-medium">{prov.type}</span>
                <span className="text-omnium-muted text-sm">— {prov.desc}</span>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">6.2 Reputation Scoring</h3>
          <p className="text-omnium-text/80 leading-relaxed">
            Provenance chains enable reputation scoring across multiple dimensions:
          </p>
          <ul className="space-y-2 text-omnium-text/80 mt-4">
            <li><strong>Breadth</strong> — How many different sources contributed to this money?</li>
            <li><strong>Depth</strong> — How many transactions deep is the provenance chain?</li>
            <li><strong>Maturity</strong> — How old is the provenance history?</li>
          </ul>

          <p className="text-omnium-text/80 leading-relaxed mt-6">
            Reputation is <strong>entirely opt-in</strong>. You can strip provenance at any time by
            dissolving to base Ω—with a 5% fee. Privacy is preserved as a choice, not a default.
          </p>
        </Section>

        {/* Conversions */}
        <Section id="conversions" title="7. Conversions & Fees">
          <p className="text-omnium-text/80 leading-relaxed">
            Any dimension can be changed through conversion. The conversion formula applies fees based
            on the delta in each dimension:
          </p>
          <Formula>
            Ω&apos; = Ω × f(ΔT) × f(ΔL) × f(ΔP) × f(ΔR)
          </Formula>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">7.1 Fee Schedule</h3>
          <div className="overflow-x-auto">
            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="border-b border-omnium-muted/20">
                  <th className="text-left py-3 text-omnium-muted font-normal">Dimension</th>
                  <th className="text-left py-3 text-omnium-muted font-normal">Adding/Restricting</th>
                  <th className="text-left py-3 text-omnium-muted font-normal">Removing/Freeing</th>
                </tr>
              </thead>
              <tbody className="text-omnium-text/80">
                <tr className="border-b border-omnium-muted/10">
                  <td className="py-3 text-dim-temporal">Temporal</td>
                  <td className="py-3">Free (locking up)</td>
                  <td className="py-3">2-10% (unlocking)</td>
                </tr>
                <tr className="border-b border-omnium-muted/10">
                  <td className="py-3 text-dim-locality">Locality</td>
                  <td className="py-3">1% (entry fee)</td>
                  <td className="py-3">Variable (exit fee)</td>
                </tr>
                <tr className="border-b border-omnium-muted/10">
                  <td className="py-3 text-dim-purpose">Purpose</td>
                  <td className="py-3">Free (restricting)</td>
                  <td className="py-3">3% (stripping)</td>
                </tr>
                <tr>
                  <td className="py-3 text-dim-reputation">Reputation</td>
                  <td className="py-3">Free (accretes)</td>
                  <td className="py-3">5% (stripping)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-omnium-text/80 leading-relaxed mt-6">
            All fees flow to the Commons Pool, funding system maintenance and preventing gaming.
            The asymmetry—free to restrict, costly to free—creates natural stability.
          </p>
        </Section>

        {/* Commons Pool */}
        <Section id="commons" title="8. The Commons Pool">
          <p className="text-omnium-text/80 leading-relaxed">
            At the foundation of Omnium lies the Commons Pool: a base layer of undifferentiated value
            from which all dimensional currency emerges and to which fees return.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">8.1 Pool Functions</h3>
          <ul className="space-y-3 text-omnium-text/80">
            <li>
              <strong className="text-omnium-text">Minting</strong> — New Ω is created from the Commons
              Pool according to protocol rules.
            </li>
            <li>
              <strong className="text-omnium-text">Burning</strong> — Ω can be returned to the pool,
              reducing circulating supply.
            </li>
            <li>
              <strong className="text-omnium-text">Fee Collection</strong> — All conversion fees flow
              back to the pool.
            </li>
            <li>
              <strong className="text-omnium-text">Dividend Funding</strong> — T2 and T∞ yields are
              funded from pool growth.
            </li>
          </ul>

          <p className="text-omnium-muted italic mt-6">
            &ldquo;The Commons Pool is governed by a protocol, not a committee.&rdquo;
          </p>
        </Section>

        {/* Implementation */}
        <Section id="implementation" title="9. Implementation">
          <p className="text-omnium-text/80 leading-relaxed">
            The reference implementation of Omnium is built on a content-addressed storage layer using
            IPFS/Helia, enabling decentralized persistence without requiring blockchain consensus for
            every transaction.
          </p>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">9.1 Core Data Structure</h3>
          <div className="bg-omnium-bg-secondary/50 rounded-xl p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-omnium-text/80">{`interface OmniumUnit {
  id: string;                    // Unique identifier
  magnitude: number;             // Quantity of value
  temporality: TemporalStratum;  // T0 | T1 | T2 | T∞
  locality: Set<string>;         // Community IDs
  purpose: Set<string>;          // Purpose channel IDs
  provenance: ProvenanceChain;   // Complete history
  createdAt: number;             // Creation timestamp
  lastTickAt: number;            // Last demurrage/dividend
  walletId: string;              // Current owner
}`}</pre>
          </div>

          <h3 className="text-xl font-display text-omnium-text mt-8 mb-4">9.2 Architecture Layers</h3>
          <ol className="space-y-2 text-omnium-text/80 list-decimal list-inside">
            <li><strong>Commons Pool</strong> — Base reserve, minting/burning</li>
            <li><strong>Temporal Engine</strong> — Demurrage/dividend calculations</li>
            <li><strong>Locality Registry</strong> — Community definitions and boundaries</li>
            <li><strong>Purpose Registry</strong> — Channel definitions and validation</li>
            <li><strong>Reputation Tracker</strong> — Provenance chain management</li>
            <li><strong>Conversion Engine</strong> — Dimensional transformations</li>
            <li><strong>Persistence Layer</strong> — Content-addressed storage</li>
          </ol>
        </Section>

        {/* Conclusion */}
        <Section id="conclusion" title="10. Conclusion">
          <p className="text-omnium-text/80 leading-relaxed">
            Omnium represents a fundamental reimagining of what money can be. By extending currency
            from a scalar to a multi-dimensional vector, we enable money to carry the semantic
            information that human economies naturally generate.
          </p>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            This is not a replacement for existing monetary systems but a meta-framework within which
            all monetary forms can interoperate. Local currencies, time-based money, purpose-bound
            grants, and reputation-tracked value can all exist simultaneously, converting between
            forms as needed.
          </p>
          <p className="text-omnium-text/80 leading-relaxed mt-4">
            The result is an economy that can optimize for human values—not just efficiency, but
            meaning, community, sustainability, and trust.
          </p>

          <div className="mt-12 p-8 rounded-2xl bg-omnium-bg-secondary/30 border border-omnium-muted/10 text-center">
            <p className="text-2xl font-display text-omnium-text mb-4">
              What if money could remember what it&apos;s for?
            </p>
            <p className="text-omnium-muted">
              With Omnium, it can.
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-omnium-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-omnium-muted hover:text-omnium-text transition-colors">
            ← Back to Home
          </Link>
          <a
            href="https://github.com/idl3o/omnium"
            target="_blank"
            rel="noopener noreferrer"
            className="text-omnium-muted hover:text-omnium-text transition-colors"
          >
            View on GitHub →
          </a>
        </div>
      </main>
    </div>
  )
}
