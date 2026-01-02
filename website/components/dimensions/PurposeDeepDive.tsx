'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const purposes = [
  { id: 'health', name: 'Health', icon: '❤', color: '#ef4444' },
  { id: 'education', name: 'Education', icon: '📚', color: '#6366f1' },
  { id: 'food', name: 'Food', icon: '🌾', color: '#22c55e' },
  { id: 'housing', name: 'Housing', icon: '🏠', color: '#f59e0b' },
  { id: 'carbon', name: 'Carbon-Negative', icon: '🌱', color: '#10b981' },
  { id: 'creator', name: 'Creator', icon: '🎨', color: '#ec4899' },
]

export function PurposeDeepDive() {
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>(['education'])

  const togglePurpose = (id: string) => {
    setSelectedPurposes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 30% 50%, rgba(245, 158, 11, 0.06) 0%, transparent 60%)',
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dim-purpose/10 border border-dim-purpose/30 mb-4">
            <span className="text-dim-purpose font-display text-lg">P</span>
            <span className="text-dim-purpose text-sm">Purpose</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-light text-omnium-text">
            Money that carries intent
          </h2>
          <p className="mt-4 text-omnium-muted max-w-2xl mx-auto">
            Purpose channels let value flow toward meaning.
            Color your money with intent—and watch alignment emerge.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Purpose selector */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p className="text-omnium-muted text-sm mb-4">Click to add purpose channels:</p>
            <div className="grid grid-cols-2 gap-3">
              {purposes.map((purpose) => {
                const isSelected = selectedPurposes.includes(purpose.id)
                return (
                  <button
                    key={purpose.id}
                    onClick={() => togglePurpose(purpose.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isSelected ? 'border-opacity-60' : 'border-omnium-muted/20 hover:border-omnium-muted/40'
                    }`}
                    style={{
                      borderColor: isSelected ? purpose.color : undefined,
                      backgroundColor: isSelected ? purpose.color + '15' : 'rgba(18, 18, 26, 0.5)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{purpose.icon}</span>
                      <span className="text-omnium-text">{purpose.name}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Right: Result visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-8 border border-omnium-muted/10"
          >
            {/* Unit visualization */}
            <div className="text-center mb-6">
              <p className="text-omnium-muted text-sm mb-2">Your unit becomes:</p>
              <div className="inline-flex items-center gap-2 flex-wrap justify-center">
                <span className="text-2xl font-display text-omnium-text">100Ω</span>
                {selectedPurposes.length > 0 && (
                  <>
                    <span className="text-omnium-muted">·</span>
                    {selectedPurposes.map((id) => {
                      const purpose = purposes.find((p) => p.id === id)!
                      return (
                        <motion.span
                          key={id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-lg"
                          title={purpose.name}
                        >
                          {purpose.icon}
                        </motion.span>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Trade-off explanation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-omnium-bg/50">
                <span className="text-omnium-muted text-sm">Utility</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-omnium-bg overflow-hidden">
                    <motion.div
                      className="h-full bg-dim-purpose rounded-full"
                      animate={{
                        width: `${Math.max(20, 100 - selectedPurposes.length * 20)}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-omnium-muted w-8">
                    {Math.max(20, 100 - selectedPurposes.length * 20)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-omnium-bg/50">
                <span className="text-omnium-muted text-sm">Signal strength</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-omnium-bg overflow-hidden">
                    <motion.div
                      className="h-full bg-dim-reputation rounded-full"
                      animate={{
                        width: `${Math.min(100, 20 + selectedPurposes.length * 25)}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-omnium-muted w-8">
                    {Math.min(100, 20 + selectedPurposes.length * 25)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm text-omnium-muted">
              Adding purpose is <span className="text-dim-locality">free</span>—it restricts where the money can go.
              Removing purpose costs <span className="text-dim-purpose">3%</span> to strip the intent.
            </p>

            <div className="mt-4 pt-4 border-t border-omnium-muted/10">
              <p className="text-omnium-text/80 text-sm italic">
                &ldquo;Receiving Ω-P(education) tells you something about the sender&apos;s values.&rdquo;
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
