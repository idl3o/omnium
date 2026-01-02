'use client'

import { motion } from 'framer-motion'

const provenanceTypes = [
  { type: 'minted', label: 'Minted', color: '#ffffff', description: 'Created from Commons Pool' },
  { type: 'earned', label: 'Earned', color: '#22c55e', description: 'Payment for goods/services' },
  { type: 'gifted', label: 'Gifted', color: '#ec4899', description: 'Voluntary transfer' },
  { type: 'invested', label: 'Invested', color: '#6366f1', description: 'Return on investment' },
  { type: 'inherited', label: 'Inherited', color: '#f59e0b', description: 'Intergenerational transfer' },
]

const sampleChain = [
  { type: 'minted', from: 'Commons', amount: '1000Ω', time: 'Day 0' },
  { type: 'earned', from: 'Alice (bakery)', amount: '1000Ω', time: 'Day 15' },
  { type: 'gifted', from: 'Bob (birthday)', amount: '500Ω', time: 'Day 45' },
  { type: 'earned', from: 'Carol (tutoring)', amount: '500Ω', time: 'Day 90' },
]

export function ReputationDeepDive() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 70% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 60%)',
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dim-reputation/10 border border-dim-reputation/30 mb-4">
            <span className="text-dim-reputation font-display text-lg">R</span>
            <span className="text-dim-reputation text-sm">Reputation</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-light text-omnium-text">
            Money that remembers its journey
          </h2>
          <p className="mt-4 text-omnium-muted max-w-2xl mx-auto">
            Provenance becomes signal. Every unit carries its history—
            how it was created, earned, gifted, or invested. Meaning accretes rather than vanishes.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Provenance types */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h3 className="text-lg font-display text-omnium-text mb-4">Provenance Types</h3>
            <div className="space-y-2">
              {provenanceTypes.map((prov, index) => (
                <motion.div
                  key={prov.type}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-omnium-bg-secondary/50 border border-omnium-muted/10"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: prov.color }}
                  />
                  <div className="flex-1">
                    <span className="text-omnium-text font-medium">{prov.label}</span>
                    <span className="text-omnium-muted text-sm ml-2">— {prov.description}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl border border-dim-reputation/20 bg-dim-reputation/5">
              <p className="text-sm text-omnium-text/80">
                <strong className="text-dim-reputation">Opt-in transparency:</strong> You can strip
                reputation at any time by dissolving to base Ω—with a <span className="font-mono">5%</span> fee.
              </p>
            </div>
          </motion.div>

          {/* Right: Provenance chain visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-8 border border-omnium-muted/10"
          >
            <h3 className="text-lg font-display text-omnium-text mb-6">Sample Provenance Chain</h3>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-6 bottom-6 w-px bg-gradient-to-b from-dim-reputation/50 to-transparent" />

              {/* Chain entries */}
              <div className="space-y-6">
                {sampleChain.map((entry, index) => {
                  const prov = provenanceTypes.find((p) => p.type === entry.type)!
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.1 * index }}
                      className="flex items-start gap-4 pl-1"
                    >
                      {/* Node */}
                      <div
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center bg-omnium-bg flex-shrink-0"
                        style={{ borderColor: prov.color }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: prov.color }}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-medium"
                            style={{ color: prov.color }}
                          >
                            {prov.label}
                          </span>
                          <span className="text-omnium-muted text-sm">from</span>
                          <span className="text-omnium-text text-sm">{entry.from}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-omnium-text font-mono text-sm">{entry.amount}</span>
                          <span className="text-omnium-muted text-xs">{entry.time}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-omnium-muted/10">
              <p className="text-omnium-muted text-sm italic">
                &ldquo;Semantic liquidity: Money flows between meanings, but meaning accretes rather than vanishes.&rdquo;
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
