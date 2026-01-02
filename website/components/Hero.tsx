'use client'

import { motion } from 'framer-motion'
import { OmegaSymbol } from './OmegaSymbol'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 70% 100%, rgba(236, 72, 153, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 20% 80%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)
          `,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
        {/* Omega Symbol */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <OmegaSymbol size={140} />
        </motion.div>

        {/* Tagline */}
        <motion.h1
          className="mt-12 text-3xl md:text-5xl lg:text-6xl font-display font-light tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          What if money could{' '}
          <span className="text-dim-temporal">remember</span>
          <br />
          what it&apos;s for?
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-6 text-lg md:text-xl text-omnium-muted max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          A meta-currency framework where value flows through five dimensions—
          magnitude, time, place, purpose, and provenance.
        </motion.p>

        {/* Formula */}
        <motion.div
          className="mt-10 px-6 py-3 rounded-full border border-omnium-muted/20 bg-omnium-bg-secondary/50 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          <code className="text-lg md:text-xl font-mono">
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
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="flex flex-col items-center gap-2 text-omnium-muted cursor-pointer"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            onClick={() => {
              document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="text-sm tracking-widest uppercase">Explore</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
