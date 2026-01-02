'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const communities = [
  { id: 'global', name: 'Global', color: '#ffffff', size: 180 },
  { id: 'regional', name: 'Regional', color: '#22c55e', size: 130 },
  { id: 'local', name: 'Local', color: '#10b981', size: 80 },
]

export function LocalityDeepDive() {
  const [hoveredCommunity, setHoveredCommunity] = useState<string | null>(null)

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 70%, rgba(34, 197, 94, 0.06) 0%, transparent 60%)',
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dim-locality/10 border border-dim-locality/30 mb-4">
            <span className="text-dim-locality font-display text-lg">L</span>
            <span className="text-dim-locality text-sm">Locality</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-light text-omnium-text">
            Money that knows where it belongs
          </h2>
          <p className="mt-4 text-omnium-muted max-w-2xl mx-auto">
            Communities create economic membranes—permeable but present.
            Value circulates locally while remaining connected to the global economy.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Concentric circles visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="relative" style={{ width: 200, height: 200 }}>
              {communities.map((community, index) => (
                <motion.div
                  key={community.id}
                  className="absolute rounded-full border-2 cursor-pointer transition-all"
                  style={{
                    width: community.size,
                    height: community.size,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderColor: community.color + (hoveredCommunity === community.id ? 'ff' : '40'),
                    backgroundColor: hoveredCommunity === community.id ? community.color + '15' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredCommunity(community.id)}
                  onMouseLeave={() => setHoveredCommunity(null)}
                  animate={{
                    scale: hoveredCommunity === community.id ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {index === communities.length - 1 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-dim-locality text-xs font-medium">Your Town</span>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Labels */}
              <div className="absolute -right-20 top-0 text-xs text-omnium-muted">Global Ω</div>
              <div className="absolute -right-24 top-1/4 text-xs text-dim-locality">Regional Ω</div>
              <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-xs text-dim-locality">Local Ω</div>
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-omnium-text font-medium">Entry Fee</span>
                  <span className="text-dim-locality font-mono">1%</span>
                </div>
                <p className="text-sm text-omnium-muted">
                  A small contribution when joining a community—funds shared resources.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-omnium-text font-medium">Exit Fee</span>
                  <span className="text-dim-purpose font-mono">Variable</span>
                </div>
                <p className="text-sm text-omnium-muted">
                  Communities set their own boundary fees. Higher fees = stronger local circulation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-omnium-bg-secondary/50 border border-omnium-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-omnium-text font-medium">Within Community</span>
                  <span className="text-dim-locality font-mono">1:1</span>
                </div>
                <p className="text-sm text-omnium-muted">
                  Local currency trades at par within its community. No friction for neighbors.
                </p>
              </div>
            </div>

            <p className="text-omnium-text/80 leading-relaxed">
              Local currencies let communities cultivate economic resilience.
              Money that&apos;s meant for your neighborhood stays in your neighborhood—unless
              there&apos;s a good reason for it to leave.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
