'use client';

import { useCallback } from 'react';
import { useOmnium } from '../../hooks/useOmnium';
import { useAttention } from '../../hooks/useAttention';
import {
  StreamPlayer,
  WalletPanel,
  TipForm,
  CommunityPanel,
  ActivityFeed,
  EarningsDisplay,
  InteractionBar,
  DepositPanel,
} from '../../components/stream';
import Link from 'next/link';

// Stream configuration - update these for your setup
const STREAM_CONFIG = {
  // HLS stream URL (from mediamtx)
  hlsUrl: process.env.NEXT_PUBLIC_STREAM_HLS_URL || 'http://localhost:8888/live/omnium/index.m3u8',
};

export default function StreamPage() {
  const {
    isConnected,
    isLoading,
    wallet,
    units,
    balance,
    streamerWallet,
    community,
    isMember,
    activities,
    attentionEarnings,
    connect,
    mint,
    tip,
    deposit,
    withdraw,
    joinCommunity,
    earnFromAttention,
    earnFromInteraction,
    react,
    reset,
  } = useOmnium();

  // Handle earning tick from attention tracker
  const handleEarningTick = useCallback((secondsWatched: number) => {
    const minutesWatched = Math.floor(secondsWatched / 60);
    earnFromAttention(minutesWatched);
  }, [earnFromAttention]);

  const {
    isEngaged,
    secondsWatched,
    minutesWatched,
    setVideoPlaying,
  } = useAttention({
    onEarningTick: isConnected ? handleEarningTick : undefined,
    earningIntervalSeconds: 60, // Earn every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-omnium-bg flex items-center justify-center">
        <div className="text-omnium-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-omnium-bg">
      {/* Header */}
      <header className="border-b border-omnium-muted/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl text-dim-magnitude">Ω</span>
            <span className="text-omnium-text font-semibold">Omnium</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/docs" className="text-omnium-muted hover:text-omnium-text transition-colors text-sm">
              Docs
            </Link>
            <Link href="/whitepaper" className="text-omnium-muted hover:text-omnium-text transition-colors text-sm">
              Whitepaper
            </Link>

            {isConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-omnium-text text-sm">{wallet?.name}</span>
                <span className="text-dim-magnitude font-medium">{balance.toFixed(2)}Ω</span>
                <span className={`w-2 h-2 rounded-full ${isEngaged ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`} />
              </div>
            ) : (
              <button
                onClick={() => connect()}
                className="px-4 py-2 bg-dim-temporal text-white rounded-lg text-sm font-medium hover:bg-dim-temporal/80 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Stream & Interactions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stream player */}
            <div>
              <StreamPlayer
                source={{ type: 'hls', url: STREAM_CONFIG.hlsUrl }}
                fallbackMessage="Stream is offline - start OBS to go live!"
                onPlayingChange={setVideoPlaying}
              />
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-omnium-text">
                    {streamerWallet.name}&apos;s Stream
                  </h1>
                  <p className="text-omnium-muted text-sm">
                    Learn Omnium by using it
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-omnium-muted">Streamer balance</div>
                  <div className="text-lg font-semibold text-dim-magnitude">
                    {units.filter(u => u.walletId === streamerWallet.id).reduce((s, u) => s + u.magnitude, 0).toFixed(2)}Ω
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings display */}
            <EarningsDisplay
              isEngaged={isEngaged}
              isConnected={isConnected}
              minutesWatched={minutesWatched}
              secondsWatched={secondsWatched}
              attentionEarnings={attentionEarnings}
              onConnect={() => connect()}
            />

            {/* Interaction bar */}
            <InteractionBar
              isConnected={isConnected}
              balance={balance}
              onInteract={earnFromInteraction}
              onReact={react}
              onConnect={() => connect()}
            />

            {/* Wallet panel */}
            <WalletPanel
              units={units}
              balance={balance}
              isConnected={isConnected}
              onConnect={() => connect()}
              onMint={() => mint(10)}
            />

            {/* Tip form */}
            <TipForm
              isConnected={isConnected}
              balance={balance}
              streamerName={streamerWallet.name}
              onTip={tip}
              onConnect={() => connect()}
            />

            {/* Deposit/Withdraw panel */}
            <DepositPanel
              isConnected={isConnected}
              balance={balance}
              onDeposit={deposit}
              onWithdraw={withdraw}
              onConnect={() => connect()}
            />
          </div>

          {/* Right column - Community & Activity */}
          <div className="space-y-6">
            {/* Community panel */}
            <CommunityPanel
              community={community}
              isMember={isMember}
              isConnected={isConnected}
              balance={balance}
              onJoin={joinCommunity}
              onConnect={() => connect()}
            />

            {/* Activity feed */}
            <ActivityFeed activities={activities} />

            {/* Learn panel */}
            <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-omnium-text mb-4">
                How It Works
              </h2>
              <div className="space-y-3 text-sm text-omnium-muted">
                <div className="text-xs uppercase tracking-wide text-dim-magnitude mb-1">Earn</div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-omnium-bg">
                  <span className="text-lg">👀</span>
                  <div>
                    <div className="text-omnium-text">Watch stream</div>
                    <div className="text-xs text-dim-magnitude">+0.01Ω per minute</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-omnium-bg">
                  <span className="text-lg">💬</span>
                  <div>
                    <div className="text-omnium-text">Send chat</div>
                    <div className="text-xs text-dim-magnitude">+0.02Ω per message</div>
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wide text-dim-purpose mt-3 mb-1">Spend</div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-omnium-bg">
                  <span className="text-lg">🔥</span>
                  <div>
                    <div className="text-omnium-text">React</div>
                    <div className="text-xs text-dim-purpose">-0.01Ω (micro-tip)</div>
                  </div>
                </div>
                <p className="pt-2 text-xs text-omnium-muted/60">
                  Earnings are T0 with 2% annual demurrage. Reactions go directly to the streamer.
                </p>
              </div>
            </div>

            {/* Dev tools (hidden in production) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-omnium-bg border border-red-500/20 rounded-xl p-4">
                <h3 className="text-sm font-medium text-red-400 mb-2">Dev Tools</h3>
                <div className="space-y-2">
                  <button
                    onClick={reset}
                    className="w-full px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-sm hover:bg-red-500/20"
                  >
                    Reset All State
                  </button>
                  <div className="text-xs text-omnium-muted/60">
                    Engaged: {isEngaged ? 'Yes' : 'No'} |
                    Watched: {secondsWatched}s
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-omnium-muted/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-omnium-muted text-sm">
          <p>Omnium - Dimensional Money for the Future</p>
        </div>
      </footer>
    </div>
  );
}
