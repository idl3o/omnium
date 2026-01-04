'use client';

import { motion } from 'framer-motion';
import type { Community } from '../../lib/omnium-client';

interface CommunityPanelProps {
  community: Community;
  isMember: boolean;
  isConnected: boolean;
  balance: number;
  onJoin: () => boolean;
  onConnect: () => void;
}

export function CommunityPanel({
  community,
  isMember,
  isConnected,
  balance,
  onJoin,
  onConnect,
}: CommunityPanelProps) {
  const canJoin = isConnected && !isMember && balance >= community.entryFee;

  const handleJoin = () => {
    if (canJoin) {
      onJoin();
    }
  };

  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-3 h-3 rounded-full bg-dim-locality animate-pulse" />
        <h2 className="text-lg font-semibold text-omnium-text">{community.name}</h2>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-omnium-muted">Members</span>
          <span className="text-omnium-text font-medium">{community.members.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-omnium-muted">Community Fund</span>
          <span className="text-dim-locality font-medium">{community.fundBalance.toFixed(2)}Ω</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-omnium-muted">Exit Fee</span>
          <span className="text-omnium-muted/80">{(community.exitFee * 100).toFixed(0)}%</span>
        </div>
      </div>

      {isMember ? (
        <div className="flex items-center justify-center gap-2 py-3 bg-dim-locality/10 rounded-lg border border-dim-locality/30">
          <span className="text-dim-locality">✓</span>
          <span className="text-dim-locality font-medium">Member</span>
        </div>
      ) : !isConnected ? (
        <button
          onClick={onConnect}
          className="w-full py-3 bg-dim-locality text-black rounded-lg font-medium hover:bg-dim-locality/80 transition-colors"
        >
          Connect to Join
        </button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleJoin}
          disabled={!canJoin}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            canJoin
              ? 'bg-dim-locality text-black hover:bg-dim-locality/80'
              : 'bg-omnium-muted/20 text-omnium-muted cursor-not-allowed'
          }`}
        >
          Join Community - {community.entryFee}Ω
        </motion.button>
      )}

      <p className="text-xs text-omnium-muted/60 text-center mt-3">
        Entry fee goes to the community fund
      </p>
    </div>
  );
}
