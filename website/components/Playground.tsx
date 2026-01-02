'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

type TemporalStratum = 'T0' | 'T1' | 'T2' | 'T∞'

interface UnitState {
  magnitude: number
  temporal: TemporalStratum
  locality: string | null
  purpose: string[]
  hasReputation: boolean
}

const temporalFees: Record<string, Record<string, number>> = {
  'T0': { 'T0': 0, 'T1': 0, 'T2': 0, 'T∞': 0 },
  'T1': { 'T0': 0.02, 'T1': 0, 'T2': 0, 'T∞': 0 },
  'T2': { 'T0': 0.05, 'T1': 0.03, 'T2': 0, 'T∞': 0 },
  'T∞': { 'T0': 0.10, 'T1': 0.07, 'T2': 0.04, 'T∞': 0 },
}

export function Playground() {
  const [unit, setUnit] = useState<UnitState>({
    magnitude: 100,
    temporal: 'T0',
    locality: null,
    purpose: [],
    hasReputation: true,
  })

  const [targetTemporal, setTargetTemporal] = useState<TemporalStratum>('T2')
  const [targetLocality, setTargetLocality] = useState<string | null>('local')
  const [targetPurpose, setTargetPurpose] = useState<string[]>(['education'])
  const [stripReputation, setStripReputation] = useState(false)

  const conversionResult = useMemo(() => {
    let fee = 0
    const breakdown: string[] = []

    // Temporal conversion fee
    const tempFee = temporalFees[unit.temporal][targetTemporal]
    if (tempFee > 0) {
      fee += tempFee
      breakdown.push(`Temporal (${unit.temporal}→${targetTemporal}): ${(tempFee * 100).toFixed(0)}%`)
    }

    // Locality fee (entering)
    if (!unit.locality && targetLocality) {
      fee += 0.01
      breakdown.push(`Enter community: 1%`)
    }
    // Locality fee (exiting)
    if (unit.locality && !targetLocality) {
      fee += 0.03
      breakdown.push(`Exit community: 3%`)
    }

    // Purpose fee (removing)
    const removedPurposes = unit.purpose.filter((p) => !targetPurpose.includes(p))
    if (removedPurposes.length > 0) {
      const purposeFee = removedPurposes.length * 0.03
      fee += purposeFee
      breakdown.push(`Remove ${removedPurposes.length} purpose(s): ${(purposeFee * 100).toFixed(0)}%`)
    }

    // Reputation strip fee
    if (unit.hasReputation && stripReputation) {
      fee += 0.05
      breakdown.push(`Strip reputation: 5%`)
    }

    const finalMagnitude = unit.magnitude * (1 - fee)

    return {
      fee,
      finalMagnitude,
      breakdown,
    }
  }, [unit, targetTemporal, targetLocality, targetPurpose, stripReputation])

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 40% 30% at 20% 30%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 80% 70%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)
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
            Interactive Demo
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-light text-omnium-text">
            Conversion Playground
          </h2>
          <p className="mt-4 text-omnium-muted max-w-2xl mx-auto">
            See how conversions work. Moving between dimensions has costs—
            each transformation applies the formula: Ω&apos; = Ω × f(ΔT) × f(ΔL) × f(ΔP) × f(ΔR)
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Source unit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-6 border border-omnium-muted/10"
          >
            <h3 className="text-lg font-display text-omnium-text mb-4">Source Unit</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-omnium-muted block mb-1">Magnitude</label>
                <div className="text-2xl font-display text-omnium-text">
                  {unit.magnitude}<span className="text-dim-magnitude">Ω</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-1">Temporal</label>
                <span className="text-dim-temporal font-mono">{unit.temporal}</span>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-1">Locality</label>
                <span className="text-dim-locality">
                  {unit.locality || 'Global'}
                </span>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-1">Purpose</label>
                <span className="text-dim-purpose">
                  {unit.purpose.length > 0 ? unit.purpose.join(', ') : 'None'}
                </span>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-1">Reputation</label>
                <span className="text-dim-reputation">
                  {unit.hasReputation ? 'Has provenance' : 'Anonymous'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Conversion options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-6 border border-dim-temporal/20"
          >
            <h3 className="text-lg font-display text-omnium-text mb-4">Convert To</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-omnium-muted block mb-2">Temporal Stratum</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['T0', 'T1', 'T2', 'T∞'] as TemporalStratum[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTargetTemporal(t)}
                      className={`py-2 rounded text-sm font-mono transition-all ${
                        targetTemporal === t
                          ? 'bg-dim-temporal text-white'
                          : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-2">Locality</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setTargetLocality(null)}
                    className={`py-2 rounded text-sm transition-all ${
                      !targetLocality
                        ? 'bg-dim-locality text-white'
                        : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                    }`}
                  >
                    Global
                  </button>
                  <button
                    onClick={() => setTargetLocality('local')}
                    className={`py-2 rounded text-sm transition-all ${
                      targetLocality
                        ? 'bg-dim-locality text-white'
                        : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                    }`}
                  >
                    Local
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-2">Purpose</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setTargetPurpose([])}
                    className={`py-2 rounded text-sm transition-all ${
                      targetPurpose.length === 0
                        ? 'bg-dim-purpose text-white'
                        : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                    }`}
                  >
                    None
                  </button>
                  <button
                    onClick={() => setTargetPurpose(['education'])}
                    className={`py-2 rounded text-sm transition-all ${
                      targetPurpose.length > 0
                        ? 'bg-dim-purpose text-white'
                        : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                    }`}
                  >
                    Education
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-omnium-muted block mb-2">Reputation</label>
                <button
                  onClick={() => setStripReputation(!stripReputation)}
                  className={`w-full py-2 rounded text-sm transition-all ${
                    stripReputation
                      ? 'bg-dim-reputation text-white'
                      : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
                  }`}
                >
                  {stripReputation ? 'Strip provenance' : 'Keep provenance'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-omnium-bg-secondary/50 rounded-2xl p-6 border border-omnium-muted/10"
          >
            <h3 className="text-lg font-display text-omnium-text mb-4">Result</h3>

            <div className="text-center py-6">
              <motion.div
                key={conversionResult.finalMagnitude}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-display"
              >
                <span className="text-omnium-text">{conversionResult.finalMagnitude.toFixed(1)}</span>
                <span className="text-dim-magnitude">Ω</span>
              </motion.div>
              <p className="text-omnium-muted text-sm mt-2">
                {conversionResult.fee > 0 ? (
                  <>Total fee: <span className="text-dim-purpose">{(conversionResult.fee * 100).toFixed(0)}%</span></>
                ) : (
                  <span className="text-dim-locality">No conversion fee</span>
                )}
              </p>
            </div>

            {conversionResult.breakdown.length > 0 && (
              <div className="space-y-1 pt-4 border-t border-omnium-muted/10">
                <p className="text-xs text-omnium-muted mb-2">Fee breakdown:</p>
                {conversionResult.breakdown.map((item, i) => (
                  <p key={i} className="text-xs text-omnium-text/60">• {item}</p>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-omnium-muted text-sm mt-8"
        >
          Fees fund the Commons Pool. Conversions are always possible—nothing is locked forever.
        </motion.p>
      </div>
    </section>
  )
}
