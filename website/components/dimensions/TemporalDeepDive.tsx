'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const strata = [
  {
    id: 'T0',
    name: 'Immediate',
    behavior: '-2% yearly',
    description: 'Demurrage encourages circulation. Use it or gradually lose it.',
    color: '#ef4444',
    example: 'Daily spending, local commerce',
  },
  {
    id: 'T1',
    name: 'Seasonal',
    behavior: 'Stable',
    description: 'No decay, no growth. A 1-year lockup for medium-term needs.',
    color: '#6366f1',
    example: 'Saving for a trip, emergency fund',
  },
  {
    id: 'T2',
    name: 'Generational',
    behavior: '+3% yearly',
    description: 'Dividends reward patience. 20-year lock builds lasting wealth.',
    color: '#22c55e',
    example: 'Retirement, children\'s education',
  },
  {
    id: 'T∞',
    name: 'Perpetual',
    behavior: '+1.5% yearly',
    description: 'Principal locked forever. Only the yield flows. True endowments.',
    color: '#f59e0b',
    example: 'Foundations, perpetual scholarships',
  },
]

export function TemporalDeepDive() {
  const [activeStratum, setActiveStratum] = useState('T1')
  const active = strata.find((s) => s.id === activeStratum)!

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99, 102, 241, 0.06) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dim-temporal/10 border border-dim-temporal/30 mb-4">
            <span className="text-dim-temporal font-display text-lg">T</span>
            <span className="text-dim-temporal text-sm">Temporal</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-light text-omnium-text">
            Money that ages differently
          </h2>
          <p className="mt-4 text-omnium-muted max-w-2xl mx-auto">
            Time becomes a dimension of value. Some money decays to encourage flow.
            Some grows to reward patience. Choose your temporal stratum.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Stratum selector */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-3"
          >
            {strata.map((stratum) => (
              <button
                key={stratum.id}
                onClick={() => setActiveStratum(stratum.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeStratum === stratum.id
                    ? 'bg-omnium-bg-secondary border-opacity-50'
                    : 'border-omnium-muted/10 hover:border-omnium-muted/30'
                }`}
                style={{
                  borderColor: activeStratum === stratum.id ? stratum.color : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xl font-display font-medium"
                      style={{ color: stratum.color }}
                    >
                      {stratum.id}
                    </span>
                    <span className="text-omnium-text">{stratum.name}</span>
                  </div>
                  <span
                    className="text-sm font-mono"
                    style={{ color: stratum.color }}
                  >
                    {stratum.behavior}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>

          {/* Right: Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-8 border border-omnium-muted/10"
          >
            {/* Time visualization */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm text-omnium-muted mb-2">
                <span>Now</span>
                <span>10 Years</span>
              </div>
              <div className="relative h-16 bg-omnium-bg rounded-lg overflow-hidden">
                {/* Value bar */}
                <motion.div
                  key={activeStratum}
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{ backgroundColor: active.color + '40' }}
                  initial={{ width: '30%' }}
                  animate={{
                    width: active.id === 'T0' ? '15%' : active.id === 'T1' ? '30%' : active.id === 'T2' ? '60%' : '45%',
                  }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                {/* Starting point marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{ left: '30%', backgroundColor: active.color }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-xs font-mono px-2 py-1 rounded"
                  style={{ left: '32%', color: active.color }}
                >
                  100Ω
                </div>
              </div>
              <div className="flex items-center justify-center mt-4 gap-2">
                <motion.span
                  key={activeStratum + '-result'}
                  className="text-2xl font-display"
                  style={{ color: active.color }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {active.id === 'T0' ? '82Ω' : active.id === 'T1' ? '100Ω' : active.id === 'T2' ? '134Ω' : '116Ω'}
                </motion.span>
                <span className="text-omnium-muted text-sm">after 10 years</span>
              </div>
            </div>

            {/* Description */}
            <motion.div
              key={activeStratum + '-desc'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-omnium-text/80 mb-4">{active.description}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-omnium-muted">Example:</span>
                <span className="text-omnium-text">{active.example}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom insight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-omnium-muted italic max-w-2xl mx-auto">
            &ldquo;Moving between temporal strata has costs and benefits,
            creating a natural market for time-preference without requiring interest rates.&rdquo;
          </p>
        </motion.div>
      </div>
    </section>
  )
}
