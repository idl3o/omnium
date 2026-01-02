'use client'

import { motion } from 'framer-motion'

export function SolutionSection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 20% 70%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)
          `,
        }}
      />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-omnium-muted text-sm tracking-widest uppercase mb-4 block">
            The Solution
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-light text-omnium-text">
            Money that carries <span className="text-dim-temporal">meaning</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6 order-2 md:order-1"
          >
            <p className="text-lg text-omnium-text/80 leading-relaxed">
              <strong className="text-omnium-text">Omnium</strong> reimagines currency as a
              <strong className="text-dim-temporal"> multi-dimensional vector</strong>.
              Each unit carries not just quantity, but temporal behavior, locality,
              purpose, and provenance.
            </p>
            <p className="text-lg text-omnium-text/80 leading-relaxed">
              This isn&apos;t about adding complexity—it&apos;s about encoding the complexity
              that already exists in human economic life. Money flows through communities,
              carries intentions, and builds history. Omnium makes that visible.
            </p>
            <div className="pt-4">
              <p className="text-omnium-text font-display text-xl">
                A meta-currency where all monetary forms can interoperate,
                and new forms can emerge organically from human need.
              </p>
            </div>
          </motion.div>

          {/* Right: Visual - The formula expanding */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex justify-center order-1 md:order-2"
          >
            <div className="relative">
              {/* Central Omega */}
              <motion.div
                className="w-48 h-48 rounded-full border-2 border-dim-temporal/50 flex items-center justify-center bg-omnium-bg-secondary/50 backdrop-blur-sm"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(99, 102, 241, 0.2)',
                    '0 0 40px rgba(99, 102, 241, 0.3)',
                    '0 0 20px rgba(99, 102, 241, 0.2)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="text-center">
                  <span className="text-5xl font-display text-omnium-text">Ω</span>
                  <p className="text-xs text-omnium-muted mt-2">Dimensional Value</p>
                </div>
              </motion.div>

              {/* Dimension labels - active */}
              <motion.div
                className="absolute -top-6 left-1/2 -translate-x-1/2"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                <span className="text-dim-temporal text-sm font-medium px-2 py-1 rounded-full bg-dim-temporal/10 border border-dim-temporal/30">
                  T · time
                </span>
              </motion.div>
              <motion.div
                className="absolute top-1/2 -left-14 -translate-y-1/2"
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
              >
                <span className="text-dim-locality text-sm font-medium px-2 py-1 rounded-full bg-dim-locality/10 border border-dim-locality/30">
                  L · place
                </span>
              </motion.div>
              <motion.div
                className="absolute top-1/2 -right-16 -translate-y-1/2"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 }}
              >
                <span className="text-dim-purpose text-sm font-medium px-2 py-1 rounded-full bg-dim-purpose/10 border border-dim-purpose/30">
                  P · intent
                </span>
              </motion.div>
              <motion.div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2"
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
              >
                <span className="text-dim-reputation text-sm font-medium px-2 py-1 rounded-full bg-dim-reputation/10 border border-dim-reputation/30">
                  R · history
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
