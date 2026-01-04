'use client';

import { motion } from 'framer-motion';
import type { OmniumUnit, TemporalStratum } from '../../lib/omnium-client';

interface WalletPanelProps {
  units: OmniumUnit[];
  balance: number;
  isConnected: boolean;
  onConnect: () => void;
  onMint: () => void;
}

const temporalColors: Record<TemporalStratum, string> = {
  T0: 'bg-dim-temporal/20 border-dim-temporal text-dim-temporal',
  T1: 'bg-blue-500/20 border-blue-500 text-blue-400',
  T2: 'bg-purple-500/20 border-purple-500 text-purple-400',
  TInfinity: 'bg-pink-500/20 border-pink-500 text-pink-400',
};

const temporalLabels: Record<TemporalStratum, string> = {
  T0: 'Immediate',
  T1: 'Seasonal',
  T2: 'Generational',
  TInfinity: 'Perpetual',
};

function UnitCard({ unit }: { unit: OmniumUnit }) {
  const purposeColor = unit.purpose.length > 0 ? 'text-dim-purpose' : 'text-omnium-muted';
  const localityColor = unit.locality.length > 0 ? 'text-dim-locality' : 'text-omnium-muted';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-omnium-bg border border-omnium-muted/20 rounded-lg p-3 min-w-[140px]"
    >
      {/* Magnitude */}
      <div className="text-xl font-bold text-omnium-text mb-1">
        {unit.magnitude.toFixed(2)} <span className="text-dim-magnitude">Ω</span>
      </div>

      {/* Temporality */}
      <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${temporalColors[unit.temporality]} mb-2`}>
        {unit.temporality === 'TInfinity' ? 'T∞' : unit.temporality} {temporalLabels[unit.temporality]}
      </div>

      {/* Purpose */}
      {unit.purpose.length > 0 && (
        <div className={`text-xs ${purposeColor} flex items-center gap-1`}>
          <span className="w-2 h-2 rounded-full bg-dim-purpose" />
          {unit.purpose.join(', ')}
        </div>
      )}

      {/* Locality */}
      {unit.locality.length > 0 && (
        <div className={`text-xs ${localityColor} flex items-center gap-1 mt-1`}>
          <span className="w-2 h-2 rounded-full bg-dim-locality" />
          {unit.locality.join(', ')}
        </div>
      )}
    </motion.div>
  );
}

export function WalletPanel({ units, balance, isConnected, onConnect, onMint }: WalletPanelProps) {
  if (!isConnected) {
    return (
      <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-omnium-text mb-4">Your Wallet</h2>
        <div className="text-center py-8">
          <p className="text-omnium-muted mb-4">Connect to start using Omnium</p>
          <button
            onClick={onConnect}
            className="px-6 py-3 bg-dim-temporal text-white rounded-lg font-medium hover:bg-dim-temporal/80 transition-colors"
          >
            Connect Wallet
          </button>
          <p className="text-xs text-omnium-muted/60 mt-3">
            You&apos;ll receive 10Ω to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-omnium-text">Your Wallet</h2>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-omnium-text">
            {balance.toFixed(2)} <span className="text-dim-magnitude">Ω</span>
          </span>
          <button
            onClick={onMint}
            className="px-3 py-1.5 bg-dim-magnitude/10 border border-dim-magnitude/30 text-dim-magnitude rounded-lg text-sm hover:bg-dim-magnitude/20 transition-colors"
          >
            + Mint 10Ω
          </button>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="text-center py-8 text-omnium-muted">
          <p>No units yet. Mint some Ω to get started!</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
