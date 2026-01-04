'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { InteractionType } from '../../lib/omnium-client';
import { EARNING_RATES, SPENDING_RATES } from '../../lib/omnium-client';

interface InteractionBarProps {
  isConnected: boolean;
  balance: number;
  onInteract: (type: InteractionType, description?: string) => void;
  onReact: (emoji: string) => boolean;
  onConnect: () => void;
}

const reactions = [
  { emoji: '👏', label: 'Clap' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💡', label: 'Insight' },
  { emoji: '😂', label: 'Lol' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🎉', label: 'Celebrate' },
];

export function InteractionBar({ isConnected, balance, onInteract, onReact, onConnect }: InteractionBarProps) {
  const [message, setMessage] = useState('');
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [reactionFailed, setReactionFailed] = useState(false);

  const reactionCost = SPENDING_RATES.reaction;
  const canReact = balance >= reactionCost;

  const handleSendMessage = () => {
    if (!message.trim()) return;
    onInteract('chatMessage', message);
    setMessage('');
  };

  const handleReaction = (emoji: string) => {
    if (!canReact) {
      setReactionFailed(true);
      setTimeout(() => setReactionFailed(false), 1000);
      return;
    }
    const success = onReact(emoji);
    if (success) {
      setLastReaction(emoji);
      setTimeout(() => setLastReaction(null), 500);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-4">
        <div className="text-center">
          <p className="text-omnium-muted text-sm mb-2">Connect to chat & react</p>
          <button
            onClick={onConnect}
            className="px-4 py-2 bg-dim-temporal text-white rounded-lg text-sm font-medium"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-4 space-y-3">
      {/* Reactions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {reactions.map((r) => (
            <motion.button
              key={r.emoji}
              whileHover={{ scale: canReact ? 1.2 : 1 }}
              whileTap={{ scale: canReact ? 0.9 : 1 }}
              animate={lastReaction === r.emoji ? { scale: [1, 1.5, 1] } : {}}
              onClick={() => handleReaction(r.emoji)}
              disabled={!canReact}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-lg ${
                canReact
                  ? 'bg-omnium-bg hover:bg-dim-purpose/20 hover:ring-1 hover:ring-dim-purpose/30'
                  : 'bg-omnium-bg/50 opacity-50 cursor-not-allowed'
              }`}
              title={canReact ? `${r.label} (-${reactionCost}Ω to streamer)` : 'Need more Ω'}
            >
              {r.emoji}
            </motion.button>
          ))}
        </div>
        <span className={`text-xs ${reactionFailed ? 'text-red-400' : 'text-dim-purpose'}`}>
          {reactionFailed ? 'Need more Ω!' : `-${reactionCost}Ω each`}
        </span>
      </div>

      {/* Chat input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Send a message..."
          className="flex-1 bg-omnium-bg border border-omnium-muted/30 rounded-lg px-4 py-2 text-sm text-omnium-text placeholder:text-omnium-muted/40 focus:outline-none focus:border-dim-temporal"
        />
        <button
          onClick={handleSendMessage}
          disabled={!message.trim()}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            message.trim()
              ? 'bg-dim-temporal text-white hover:bg-dim-temporal/80'
              : 'bg-omnium-muted/20 text-omnium-muted cursor-not-allowed'
          }`}
        >
          Send
        </button>
      </div>

      <div className="flex justify-between text-xs text-omnium-muted/60">
        <span>Chat earns +{EARNING_RATES.chatMessage}Ω per message</span>
        <span>Reactions cost {reactionCost}Ω (micro-tip to streamer)</span>
      </div>
    </div>
  );
}
