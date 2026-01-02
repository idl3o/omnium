'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { dimensions, Dimension } from '@/lib/dimensions'

interface NodePosition {
  x: number
  y: number
}

const getNodePositions = (centerX: number, centerY: number, radius: number): Record<string, NodePosition> => {
  return {
    magnitude: { x: centerX, y: centerY },
    temporal: { x: centerX, y: centerY - radius },
    locality: { x: centerX - radius * 0.95, y: centerY + radius * 0.31 },
    purpose: { x: centerX + radius * 0.95, y: centerY + radius * 0.31 },
    reputation: { x: centerX, y: centerY + radius },
  }
}

function DimensionNode({
  dimension,
  position,
  isCenter,
  isSelected,
  onSelect,
}: {
  dimension: Dimension
  position: NodePosition
  isCenter?: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const size = isCenter ? 80 : 60

  return (
    <motion.g
      style={{ cursor: 'pointer' }}
      onClick={onSelect}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow effect */}
      <motion.circle
        cx={position.x}
        cy={position.y}
        r={size / 2 + 10}
        fill={dimension.color}
        opacity={isSelected ? 0.3 : 0}
        animate={{
          opacity: isSelected ? [0.2, 0.4, 0.2] : 0,
          r: isSelected ? [size / 2 + 10, size / 2 + 20, size / 2 + 10] : size / 2 + 10,
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Main circle */}
      <motion.circle
        cx={position.x}
        cy={position.y}
        r={size / 2}
        fill="#12121a"
        stroke={dimension.color}
        strokeWidth={isSelected ? 3 : 1.5}
        animate={{
          strokeWidth: isSelected ? 3 : 1.5,
        }}
      />

      {/* Symbol */}
      <text
        x={position.x}
        y={position.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={dimension.color}
        fontSize={isCenter ? 32 : 24}
        fontFamily="var(--font-space-grotesk)"
        fontWeight={300}
      >
        {dimension.symbol}
      </text>
    </motion.g>
  )
}

function ConnectionLine({
  from,
  to,
  color,
  isActive,
}: {
  from: NodePosition
  to: NodePosition
  color: string
  isActive: boolean
}) {
  return (
    <motion.line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={isActive ? 2 : 1}
      opacity={isActive ? 0.6 : 0.15}
      strokeDasharray={isActive ? '0' : '4 4'}
      animate={{
        opacity: isActive ? [0.4, 0.8, 0.4] : 0.15,
      }}
      transition={{
        duration: 2,
        repeat: isActive ? Infinity : 0,
      }}
    />
  )
}

function DimensionCard({ dimension, onClose }: { dimension: Dimension; onClose: () => void }) {
  return (
    <motion.div
      className="absolute inset-x-4 bottom-4 md:inset-auto md:right-8 md:top-1/2 md:-translate-y-1/2 md:w-80"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="p-6 rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(18, 18, 26, 0.9)',
          borderColor: dimension.color + '40',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="text-3xl font-display font-light"
                style={{ color: dimension.color }}
              >
                {dimension.symbol}
              </span>
              <div>
                <h3 className="text-xl font-display font-medium text-omnium-text">
                  {dimension.name}
                </h3>
                <p className="text-sm text-omnium-muted">{dimension.tagline}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-omnium-muted hover:text-omnium-text transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-omnium-text/80 leading-relaxed">
          {dimension.description}
        </p>

        {/* Visual accent line */}
        <motion.div
          className="mt-4 h-0.5 rounded-full"
          style={{ backgroundColor: dimension.color }}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
    </motion.div>
  )
}

export function DimensionExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const centerX = 200
  const centerY = 200
  const radius = 120
  const positions = getNodePositions(centerX, centerY, radius)

  const magnitude = dimensions.find((d) => d.id === 'magnitude')!
  const outerDimensions = dimensions.filter((d) => d.id !== 'magnitude')
  const selectedDimension = selectedId ? dimensions.find((d) => d.id === selectedId) : null

  return (
    <section
      id="explorer"
      className="relative min-h-screen flex items-center justify-center px-6 py-20"
    >
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 70%)
          `,
        }}
      />

      <div className="relative w-full max-w-6xl mx-auto">
        {/* Section title */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-2xl md:text-3xl font-display font-light text-omnium-text mb-4">
            Five Dimensions of Value
          </h2>
          <p className="text-omnium-muted max-w-lg mx-auto">
            Click each dimension to discover how Omnium transforms scalar currency
            into a rich, multidimensional medium.
          </p>
        </motion.div>

        {/* Explorer container */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          {/* SVG Visualization */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <svg
              width={400}
              height={400}
              viewBox="0 0 400 400"
              className="overflow-visible"
            >
              {/* Connection lines from center to outer nodes */}
              {outerDimensions.map((dim) => (
                <ConnectionLine
                  key={`line-${dim.id}`}
                  from={positions.magnitude}
                  to={positions[dim.id]}
                  color={dim.color}
                  isActive={selectedId === dim.id}
                />
              ))}

              {/* Outer dimension nodes */}
              {outerDimensions.map((dim) => (
                <DimensionNode
                  key={dim.id}
                  dimension={dim}
                  position={positions[dim.id]}
                  isSelected={selectedId === dim.id}
                  onSelect={() => setSelectedId(selectedId === dim.id ? null : dim.id)}
                />
              ))}

              {/* Center node (magnitude) */}
              <DimensionNode
                dimension={magnitude}
                position={positions.magnitude}
                isCenter
                isSelected={selectedId === 'magnitude'}
                onSelect={() => setSelectedId(selectedId === 'magnitude' ? null : 'magnitude')}
              />
            </svg>
          </motion.div>

          {/* Dimension card */}
          <AnimatePresence mode="wait">
            {selectedDimension && (
              <DimensionCard
                key={selectedDimension.id}
                dimension={selectedDimension}
                onClose={() => setSelectedId(null)}
              />
            )}
          </AnimatePresence>

          {/* Placeholder when nothing selected (desktop only) */}
          {!selectedDimension && (
            <motion.div
              className="hidden lg:block w-80 p-6 rounded-2xl border border-omnium-muted/10 bg-omnium-bg-secondary/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-omnium-muted text-center">
                Select a dimension to learn more
              </p>
            </motion.div>
          )}
        </div>

        {/* Legend (mobile) */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 lg:hidden">
          {dimensions.map((dim) => (
            <button
              key={dim.id}
              onClick={() => setSelectedId(selectedId === dim.id ? null : dim.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                selectedId === dim.id
                  ? 'border-opacity-100'
                  : 'border-opacity-30 hover:border-opacity-60'
              }`}
              style={{
                borderColor: dim.color,
                backgroundColor: selectedId === dim.id ? dim.color + '20' : 'transparent',
              }}
            >
              <span style={{ color: dim.color }}>{dim.symbol}</span>
              <span className="text-sm text-omnium-text">{dim.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
