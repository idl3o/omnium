'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getOmniumClient,
  OmniumClient,
  Wallet,
  OmniumUnit,
  Community,
  Activity,
  TemporalStratum,
  InteractionType,
  PaymentMethod,
  DepositResult,
  WithdrawResult,
  EARNING_RATES,
  SPENDING_RATES,
} from '../lib/omnium-client';

const VIEWER_WALLET_KEY = 'omnium-viewer-wallet';

interface UseOmniumReturn {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;

  // Wallet
  wallet: Wallet | null;
  units: OmniumUnit[];
  balance: number;

  // Streamer
  streamerWallet: Wallet;
  streamerUnits: OmniumUnit[];
  streamerBalance: number;

  // Community
  community: Community;
  isMember: boolean;

  // Activities
  activities: Activity[];

  // Earnings
  attentionEarnings: number;
  earningRates: typeof EARNING_RATES;
  spendingRates: typeof SPENDING_RATES;

  // Actions
  connect: (name?: string) => void;
  disconnect: () => void;
  mint: (amount: number) => void;
  deposit: (amount: number, method?: PaymentMethod) => DepositResult;
  withdraw: (amount: number, method?: PaymentMethod) => WithdrawResult;
  tip: (amount: number, options?: { purpose?: string; temporality?: TemporalStratum; note?: string }) => boolean;
  joinCommunity: () => boolean;
  earnFromAttention: (minutesWatched: number) => void;
  earnFromInteraction: (type: InteractionType, description?: string) => void;
  react: (emoji: string) => boolean;
  reset: () => void;
}

export function useOmnium(): UseOmniumReturn {
  const [client, setClient] = useState<OmniumClient | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState({});

  // Initialize client
  useEffect(() => {
    const c = getOmniumClient();
    setClient(c);

    // Check for existing viewer wallet
    const storedWalletId = localStorage.getItem(VIEWER_WALLET_KEY);
    if (storedWalletId) {
      const existingWallet = c.getWallet(storedWalletId);
      if (existingWallet) {
        setWallet(existingWallet);
      }
    }

    // Subscribe to updates
    const unsubscribe = c.subscribe(() => {
      forceUpdate({});
    });

    setIsLoading(false);

    return () => {
      unsubscribe();
    };
  }, []);

  // Connect wallet
  const connect = useCallback((name?: string) => {
    if (!client) return;

    const walletName = name || `Viewer${Math.floor(Math.random() * 10000)}`;
    const newWallet = client.createWallet(walletName);

    // Mint welcome bonus
    client.mint(newWallet.id, 10, 'Welcome bonus!');

    localStorage.setItem(VIEWER_WALLET_KEY, newWallet.id);
    setWallet(newWallet);
  }, [client]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    localStorage.removeItem(VIEWER_WALLET_KEY);
    setWallet(null);
  }, []);

  // Mint (for demo)
  const mint = useCallback((amount: number) => {
    if (!client || !wallet) return;
    client.mint(wallet.id, amount);
  }, [client, wallet]);

  // Deposit external currency
  const deposit = useCallback((amount: number, method: PaymentMethod = 'demo'): DepositResult => {
    if (!client || !wallet) {
      return { success: false, error: 'Not connected' };
    }
    return client.deposit(wallet.id, amount, method);
  }, [client, wallet]);

  // Withdraw to external currency
  const withdraw = useCallback((amount: number, method: PaymentMethod = 'demo'): WithdrawResult => {
    if (!client || !wallet) {
      return { success: false, error: 'Not connected' };
    }
    return client.withdraw(wallet.id, amount, method);
  }, [client, wallet]);

  // Tip
  const tip = useCallback((
    amount: number,
    options?: { purpose?: string; temporality?: TemporalStratum; note?: string }
  ): boolean => {
    if (!client || !wallet) return false;

    const streamer = client.getStreamerWallet();
    const result = client.tip(wallet.id, streamer.id, amount, options);
    return result !== null;
  }, [client, wallet]);

  // Join community
  const joinCommunity = useCallback((): boolean => {
    if (!client || !wallet) return false;
    return client.joinCommunity(wallet.id);
  }, [client, wallet]);

  // Earn from attention
  const earnFromAttention = useCallback((minutesWatched: number) => {
    if (!client || !wallet) return;
    client.earnFromAttention(wallet.id, minutesWatched);
  }, [client, wallet]);

  // Earn from interaction
  const earnFromInteraction = useCallback((type: InteractionType, description?: string) => {
    if (!client || !wallet) return;
    client.earnFromInteraction(wallet.id, type, description);
  }, [client, wallet]);

  // React (costs Ω, goes to streamer)
  const react = useCallback((emoji: string): boolean => {
    if (!client || !wallet) return false;
    return client.react(wallet.id, emoji);
  }, [client, wallet]);

  // Reset
  const reset = useCallback(() => {
    if (!client) return;
    client.reset();
    localStorage.removeItem(VIEWER_WALLET_KEY);
    setWallet(null);
  }, [client]);

  // Derived state
  const units = useMemo(() => {
    if (!client || !wallet) return [];
    return client.getWalletUnits(wallet.id);
  }, [client, wallet]);

  const balance = useMemo(() => {
    return units.reduce((sum, u) => sum + u.magnitude, 0);
  }, [units]);

  const streamerWallet = useMemo(() => {
    if (!client) return { id: '', name: 'Sam', createdAt: 0 };
    return client.getStreamerWallet();
  }, [client]);

  const streamerUnits = useMemo(() => {
    if (!client) return [];
    return client.getWalletUnits(streamerWallet.id);
  }, [client, streamerWallet]);

  const streamerBalance = useMemo(() => {
    return streamerUnits.reduce((sum, u) => sum + u.magnitude, 0);
  }, [streamerUnits]);

  const community = useMemo(() => {
    if (!client) {
      return {
        id: 'stream-community',
        name: 'Stream Community',
        description: '',
        members: [],
        fundBalance: 0,
        entryFee: 1,
        exitFee: 0.03,
      };
    }
    return client.getCommunity();
  }, [client]);

  const isMember = useMemo(() => {
    if (!client || !wallet) return false;
    return client.isMember(wallet.id);
  }, [client, wallet]);

  const activities = useMemo(() => {
    if (!client) return [];
    return client.getActivities();
  }, [client]);

  const attentionEarnings = useMemo(() => {
    if (!client || !wallet) return 0;
    return client.getAttentionEarnings(wallet.id);
  }, [client, wallet]);

  return {
    isConnected: wallet !== null,
    isLoading,
    wallet,
    units,
    balance,
    streamerWallet,
    streamerUnits,
    streamerBalance,
    community,
    isMember,
    activities,
    attentionEarnings,
    earningRates: EARNING_RATES,
    spendingRates: SPENDING_RATES,
    connect,
    disconnect,
    mint,
    deposit,
    withdraw,
    tip,
    joinCommunity,
    earnFromAttention,
    earnFromInteraction,
    react,
    reset,
  };
}
