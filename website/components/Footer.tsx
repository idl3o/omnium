'use client'

import { motion } from 'framer-motion'

export function Footer() {
  return (
    <footer className="relative py-20 px-6">
      {/* Gradient divider */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent)',
        }}
      />

      <div className="max-w-4xl mx-auto text-center">
        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-2xl md:text-3xl font-display font-light text-omnium-text mb-4">
            Ready to explore dimensional value?
          </h2>
          <p className="text-omnium-muted mb-8 max-w-md mx-auto">
            Omnium is currently in development. Join us in reimagining what money can become.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/whitepaper"
              className="px-6 py-3 rounded-full bg-dim-temporal text-white font-medium transition-all hover:bg-dim-temporal/90 hover:shadow-lg hover:shadow-dim-temporal/20"
            >
              Read the Whitepaper
            </a>
            <a
              href="https://github.com/idl3o/omnium"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full border border-omnium-muted/30 text-omnium-text font-medium transition-all hover:border-omnium-muted/60 hover:bg-omnium-bg-secondary"
            >
              View on GitHub
            </a>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-omnium-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-omnium-muted">
          <div className="flex items-center gap-2">
            <span className="text-dim-magnitude text-lg">Ω</span>
            <span>OMNIUM</span>
          </div>
          <p>A meta-currency for dimensional economies</p>
        </div>
      </div>
    </footer>
  )
}
