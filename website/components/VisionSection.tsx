'use client'

import { motion } from 'framer-motion'

const visionPoints = [
  {
    title: 'Local resilience, global connection',
    description: 'Communities can strengthen their internal economies while remaining connected to the wider world.',
  },
  {
    title: 'Time-preference without interest',
    description: 'Demurrage and dividends create natural incentives for saving and spending—no banks required.',
  },
  {
    title: 'Intent-aligned economics',
    description: 'Purpose channels let value flow toward meaning. Fund what you care about, verifiably.',
  },
  {
    title: 'Transparent provenance',
    description: 'Money that carries its history enables new forms of trust and accountability.',
  },
]

export function VisionSection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)
          `,
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
          <span className="text-omnium-muted text-sm tracking-widest uppercase mb-4 block">
            The Vision
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-light text-omnium-text">
            A framework for <span className="text-dim-temporal">what money could become</span>
          </h2>
          <p className="mt-6 text-xl text-omnium-muted max-w-3xl mx-auto">
            Omnium isn&apos;t a currency. It&apos;s a meta-currency—a framework within which
            all existing monetary forms can interoperate, and new forms can emerge
            organically from human need.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {visionPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="p-6 rounded-2xl bg-omnium-bg-secondary/30 border border-omnium-muted/10 hover:border-omnium-muted/20 transition-colors"
            >
              <h3 className="text-lg font-display text-omnium-text mb-2">{point.title}</h3>
              <p className="text-omnium-muted">{point.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Formula reminder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="inline-block px-8 py-6 rounded-2xl bg-omnium-bg-secondary/50 border border-omnium-muted/20">
            <p className="text-omnium-muted text-sm mb-3">The dimensional equation</p>
            <code className="text-2xl md:text-3xl font-mono">
              <span className="text-dim-magnitude">Ω</span>
              <span className="text-omnium-muted"> = (</span>
              <span className="text-dim-magnitude">m</span>
              <span className="text-omnium-muted">, </span>
              <span className="text-dim-temporal">T</span>
              <span className="text-omnium-muted">, </span>
              <span className="text-dim-locality">L</span>
              <span className="text-omnium-muted">, </span>
              <span className="text-dim-purpose">P</span>
              <span className="text-omnium-muted">, </span>
              <span className="text-dim-reputation">R</span>
              <span className="text-omnium-muted">)</span>
            </code>
            <p className="text-omnium-text mt-4 font-display">
              Magnitude · Time · Place · Purpose · Provenance
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
