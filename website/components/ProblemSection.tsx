'use client'

import { motion } from 'framer-motion'

export function ProblemSection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)',
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
            The Problem
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-light text-omnium-text">
            Money forgot how to <span className="text-red-400">mean</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Visual */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="relative">
              {/* Scalar money representation */}
              <div className="w-40 h-40 rounded-full border-2 border-omnium-muted/30 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-5xl font-display text-omnium-muted">$</span>
                  <p className="text-sm text-omnium-muted/60 mt-2">Just a number</p>
                </div>
              </div>

              {/* Missing dimensions - faded out */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-omnium-muted/20 text-sm">
                <span className="line-through">time</span>
              </div>
              <div className="absolute top-1/2 -left-16 -translate-y-1/2 text-omnium-muted/20 text-sm">
                <span className="line-through">place</span>
              </div>
              <div className="absolute top-1/2 -right-20 -translate-y-1/2 text-omnium-muted/20 text-sm">
                <span className="line-through">purpose</span>
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-omnium-muted/20 text-sm">
                <span className="line-through">history</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-6"
          >
            <p className="text-lg text-omnium-text/80 leading-relaxed">
              Modern money is <strong className="text-omnium-text">one-dimensional</strong>.
              A dollar is a dollar is a dollar—regardless of whether it was earned or inherited,
              saved for decades or spent in seconds, meant for medicine or missiles.
            </p>
            <p className="text-lg text-omnium-text/80 leading-relaxed">
              This flatness isn&apos;t neutral. It&apos;s a design choice that privileges
              abstraction over meaning, liquidity over intention, and extraction over circulation.
            </p>
            <div className="pt-4 border-t border-omnium-muted/20">
              <p className="text-omnium-muted italic">
                &ldquo;When money forgets where it came from, it forgets where it should go.&rdquo;
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
