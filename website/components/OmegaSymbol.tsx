'use client'

import { motion } from 'framer-motion'

interface OmegaSymbolProps {
  size?: number
  className?: string
}

export function OmegaSymbol({ size = 120, className = '' }: OmegaSymbolProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          filter: [
            'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
            'drop-shadow(0 0 20px rgba(255,255,255,0.5))',
            'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Omega character */}
        <span
          className="font-display text-omnium-text select-none"
          style={{
            fontSize: size,
            lineHeight: 1,
            fontWeight: 300,
          }}
        >
          Ω
        </span>
      </motion.div>

      {/* Orbiting particles */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: ['#ffffff', '#6366f1', '#22c55e', '#f59e0b', '#ec4899'][i],
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [
              Math.cos((i * 72 * Math.PI) / 180) * (size * 0.6),
              Math.cos(((i * 72 + 360) * Math.PI) / 180) * (size * 0.6),
            ],
            y: [
              Math.sin((i * 72 * Math.PI) / 180) * (size * 0.6),
              Math.sin(((i * 72 + 360) * Math.PI) / 180) * (size * 0.6),
            ],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.5,
          }}
        />
      ))}
    </motion.div>
  )
}
