'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { EARNING_RATES } from '../../lib/omnium-client';

interface EarningsDisplayProps {
  isEngaged: boolean;
  isConnected: boolean;
  minutesWatched: number;
  secondsWatched: number;
  attentionEarnings: number;
  onConnect: () => void;
}

export function EarningsDisplay({
  isEngaged,
  isConnected,
  minutesWatched,
  secondsWatched,
  attentionEarnings,
  onConnect,
}: EarningsDisplayProps) {
  const [showEarningPulse, setShowEarningPulse] = useState(false);
  const [lastMinute, setLastMinute] = useState(0);

  // Show pulse animation when a new minute is earned
  useEffect(() => {
    if (minutesWatched > lastMinute && isConnected) {
      setShowEarningPulse(true);
      setLastMinute(minutesWatched);
      setTimeout(() => setShowEarningPulse(false), 1000);
    }
  }, [minutesWatched, lastMinute, isConnected]);

  const secondsUntilNextEarn = 60 - (secondsWatched % 60);
  const progress = ((secondsWatched % 60) / 60) * 100;

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-r from-dim-temporal/10 to-dim-purpose/10 border border-dim-temporal/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-omnium-text font-medium">Earn while you watch</h3>
            <p className="text-sm text-omnium-muted">
              Connect wallet to earn {EARNING_RATES.watchPerMinute}Ω per minute
            </p>
          </div>
          <button
            onClick={onConnect}
            className="px-4 py-2 bg-dim-temporal text-white rounded-lg text-sm font-medium hover:bg-dim-temporal/80 transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-dim-temporal/10 to-dim-purpose/10 border border-dim-temporal/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Engagement indicator */}
          <div className={`w-3 h-3 rounded-full ${isEngaged ? 'bg-green-500 animate-pulse' : 'bg-omnium-muted'}`} />
          <div>
            <h3 className="text-omnium-text font-medium">
              {isEngaged ? 'Earning...' : 'Paused'}
            </h3>
            <p className="text-xs text-omnium-muted">
              {isEngaged ? 'Keep watching to earn' : 'Focus tab & play video to earn'}
            </p>
          </div>
        </div>

        {/* Earnings counter */}
        <div className="text-right">
          <AnimatePresence>
            {showEarningPulse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -mt-6 mr-2 text-dim-temporal text-sm font-medium"
              >
                +{EARNING_RATES.watchPerMinute}Ω
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            animate={showEarningPulse ? { scale: [1, 1.1, 1] } : {}}
            className="text-xl font-bold text-dim-temporal"
          >
            {attentionEarnings.toFixed(2)}Ω
          </motion.div>
          <p className="text-xs text-omnium-muted">earned this session</p>
        </div>
      </div>

      {/* Progress to next earning */}
      {isEngaged && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-omnium-muted">
            <span>Next earning in {secondsUntilNextEarn}s</span>
            <span>{EARNING_RATES.watchPerMinute}Ω/min</span>
          </div>
          <div className="h-1.5 bg-omnium-bg rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-dim-temporal to-dim-purpose"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-omnium-muted/10">
        <div className="text-center">
          <div className="text-lg font-semibold text-omnium-text">{minutesWatched}</div>
          <div className="text-xs text-omnium-muted">minutes watched</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-dim-temporal">
            {EARNING_RATES.watchPerMinute}Ω
          </div>
          <div className="text-xs text-omnium-muted">per minute</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-dim-purpose">T0</div>
          <div className="text-xs text-omnium-muted">temporality</div>
        </div>
      </div>
    </div>
  );
}
