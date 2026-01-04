'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { TemporalStratum } from '../../lib/omnium-client';

interface TipFormProps {
  isConnected: boolean;
  balance: number;
  streamerName: string;
  onTip: (amount: number, options: { purpose?: string; temporality?: TemporalStratum; note?: string }) => boolean;
  onConnect: () => void;
}

const purposes = [
  { id: 'coding', label: 'Coding', emoji: '💻' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'vibes', label: 'Vibes', emoji: '✨' },
];

const temporalities: { id: TemporalStratum; label: string; description: string }[] = [
  { id: 'T0', label: 'T0 Thanks!', description: 'Immediate, spendable now' },
  { id: 'T1', label: 'T1 Seasonal', description: 'Locked for 1 year' },
  { id: 'T2', label: 'T2 Patron', description: 'Locked 20 years, earns dividends' },
  { id: 'TInfinity', label: 'T∞ Endowment', description: 'Locked forever, perpetual yield' },
];

export function TipForm({ isConnected, balance, streamerName, onTip, onConnect }: TipFormProps) {
  const [amount, setAmount] = useState(5);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [temporality, setTemporality] = useState<TemporalStratum>('T0');
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleTip = () => {
    if (!isConnected || amount <= 0 || amount > balance) return;

    const success = onTip(amount, {
      purpose: purpose || undefined,
      temporality,
      note: note || undefined,
    });

    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setNote('');
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-omnium-text mb-4">Tip the Stream</h2>
        <div className="text-center py-6">
          <p className="text-omnium-muted mb-4">Connect your wallet to send tips</p>
          <button
            onClick={onConnect}
            className="px-6 py-3 bg-dim-temporal text-white rounded-lg font-medium hover:bg-dim-temporal/80 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-omnium-text mb-4">Tip the Stream</h2>

      {/* Amount */}
      <div className="mb-4">
        <label className="block text-sm text-omnium-muted mb-2">Amount</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0.1}
            max={balance}
            step={0.1}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-omnium-bg border border-omnium-muted/30 rounded-lg px-4 py-2 text-omnium-text focus:outline-none focus:border-dim-temporal"
          />
          <span className="text-xl text-dim-magnitude font-bold">Ω</span>
        </div>
        <div className="flex gap-2 mt-2">
          {[1, 5, 10, 25].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                amount === val
                  ? 'bg-dim-temporal text-white'
                  : 'bg-omnium-bg border border-omnium-muted/30 text-omnium-muted hover:border-dim-temporal'
              }`}
            >
              {val}Ω
            </button>
          ))}
        </div>
      </div>

      {/* Purpose */}
      <div className="mb-4">
        <label className="block text-sm text-omnium-muted mb-2">
          Purpose <span className="text-omnium-muted/60">(what&apos;s this tip for?)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {purposes.map((p) => (
            <button
              key={p.id}
              onClick={() => setPurpose(purpose === p.id ? null : p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                purpose === p.id
                  ? 'bg-dim-purpose text-black font-medium'
                  : 'bg-omnium-bg border border-omnium-muted/30 text-omnium-muted hover:border-dim-purpose'
              }`}
            >
              <span>{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Temporality */}
      <div className="mb-4">
        <label className="block text-sm text-omnium-muted mb-2">
          Commitment level
        </label>
        <div className="grid grid-cols-2 gap-2">
          {temporalities.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemporality(t.id)}
              className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                temporality === t.id
                  ? 'bg-dim-temporal/20 border border-dim-temporal text-dim-temporal'
                  : 'bg-omnium-bg border border-omnium-muted/30 text-omnium-muted hover:border-dim-temporal/50'
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="text-xs opacity-70">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mb-4">
        <label className="block text-sm text-omnium-muted mb-2">
          Note <span className="text-omnium-muted/60">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Great stream!"
          className="w-full bg-omnium-bg border border-omnium-muted/30 rounded-lg px-4 py-2 text-omnium-text placeholder:text-omnium-muted/40 focus:outline-none focus:border-dim-temporal"
        />
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-omnium-bg rounded-lg text-sm">
        <div className="text-omnium-muted mb-1">Preview:</div>
        <div className="text-omnium-text">
          {amount}Ω → {streamerName}
          {purpose && <span className="text-dim-purpose"> ({purpose})</span>}
          {temporality !== 'T0' && <span className="text-dim-temporal"> [{temporality}]</span>}
        </div>
      </div>

      {/* Send button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleTip}
        disabled={amount <= 0 || amount > balance}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          amount > 0 && amount <= balance
            ? 'bg-dim-temporal text-white hover:bg-dim-temporal/80'
            : 'bg-omnium-muted/20 text-omnium-muted cursor-not-allowed'
        }`}
      >
        {showSuccess ? '✓ Sent!' : `Send ${amount}Ω Tip →`}
      </motion.button>

      {amount > balance && (
        <p className="text-red-400 text-sm mt-2 text-center">
          Insufficient balance
        </p>
      )}
    </div>
  );
}
