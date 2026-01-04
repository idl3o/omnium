'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PaymentMethod, DepositResult, WithdrawResult } from '../../lib/omnium-client';

interface DepositPanelProps {
  isConnected: boolean;
  balance: number;
  onDeposit: (amount: number, method?: PaymentMethod) => DepositResult;
  onWithdraw: (amount: number, method?: PaymentMethod) => WithdrawResult;
  onConnect: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function DepositPanel({
  isConnected,
  balance,
  onDeposit,
  onWithdraw,
  onConnect,
}: DepositPanelProps) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setResult({ success: false, message: 'Enter a valid amount' });
      return;
    }

    setIsProcessing(true);

    // Simulate brief processing delay
    setTimeout(() => {
      if (mode === 'deposit') {
        const res = onDeposit(numAmount, 'demo');
        if (res.success) {
          setResult({ success: true, message: `Deposited $${numAmount} → ${numAmount}Ω` });
          setAmount('');
        } else {
          setResult({ success: false, message: res.error || 'Deposit failed' });
        }
      } else {
        const res = onWithdraw(numAmount, 'demo');
        if (res.success) {
          setResult({
            success: true,
            message: `Withdrew ${numAmount}Ω → $${res.amount?.toFixed(2)} (${res.fee?.toFixed(2)}Ω fee)`,
          });
          setAmount('');
        } else {
          setResult({ success: false, message: res.error || 'Withdrawal failed' });
        }
      }
      setIsProcessing(false);

      // Clear result after 3 seconds
      setTimeout(() => setResult(null), 3000);
    }, 500);
  };

  const handlePresetClick = (preset: number) => {
    setAmount(preset.toString());
  };

  if (!isConnected) {
    return (
      <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-omnium-text mb-4">
          Deposit / Withdraw
        </h2>
        <div className="text-center py-6">
          <p className="text-omnium-muted mb-4">Connect wallet to deposit or withdraw</p>
          <button
            onClick={onConnect}
            className="px-4 py-2 bg-dim-temporal text-white rounded-lg text-sm font-medium hover:bg-dim-temporal/80 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-omnium-text mb-4">
        Deposit / Withdraw
      </h2>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('deposit')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            mode === 'deposit'
              ? 'bg-dim-magnitude text-white'
              : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            mode === 'withdraw'
              ? 'bg-dim-purpose text-white'
              : 'bg-omnium-bg text-omnium-muted hover:text-omnium-text'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Info text */}
      <p className="text-sm text-omnium-muted mb-4">
        {mode === 'deposit' ? (
          <>Convert USD to Ω at 1:1 rate. Instant in demo mode.</>
        ) : (
          <>Convert Ω to USD with 3% exit fee. Balance: {balance.toFixed(2)}Ω</>
        )}
      </p>

      {/* Preset amounts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className="px-3 py-1.5 bg-omnium-bg border border-omnium-muted/30 rounded text-sm text-omnium-text hover:border-omnium-muted/50 transition-colors"
          >
            {mode === 'deposit' ? `$${preset}` : `${preset}Ω`}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-omnium-muted">
            {mode === 'deposit' ? '$' : 'Ω'}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full pl-8 pr-4 py-2 bg-omnium-bg border border-omnium-muted/30 rounded-lg text-omnium-text placeholder-omnium-muted/50 focus:outline-none focus:border-dim-temporal"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !amount}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'deposit'
              ? 'bg-dim-magnitude hover:bg-dim-magnitude/80'
              : 'bg-dim-purpose hover:bg-dim-purpose/80'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing
            </span>
          ) : mode === 'deposit' ? (
            'Deposit'
          ) : (
            'Withdraw'
          )}
        </button>
      </div>

      {/* Result message */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3 rounded-lg text-sm ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {result.success ? '✓' : '✗'} {result.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment method note */}
      <div className="mt-4 pt-4 border-t border-omnium-muted/10">
        <p className="text-xs text-omnium-muted/60">
          Demo mode - instant transactions. Production will support card, ETH, and USDC.
        </p>
      </div>
    </div>
  );
}
