'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AttentionState {
  isTabFocused: boolean;
  isVideoPlaying: boolean;
  isEngaged: boolean; // both focused and playing
  secondsWatched: number;
  sessionStart: number | null;
}

interface UseAttentionOptions {
  onEarningTick?: (secondsWatched: number) => void;
  earningIntervalSeconds?: number; // How often to trigger earning (default: 60s = 1 min)
}

interface UseAttentionReturn {
  isEngaged: boolean;
  isTabFocused: boolean;
  isVideoPlaying: boolean;
  secondsWatched: number;
  minutesWatched: number;
  setVideoPlaying: (playing: boolean) => void;
  resetSession: () => void;
}

export function useAttention(options: UseAttentionOptions = {}): UseAttentionReturn {
  const { onEarningTick, earningIntervalSeconds = 60 } = options;

  const [state, setState] = useState<AttentionState>({
    isTabFocused: true,
    isVideoPlaying: false,
    isEngaged: false,
    secondsWatched: 0,
    sessionStart: null,
  });

  const lastEarningTick = useRef(0);
  const tickInterval = useRef<NodeJS.Timeout | null>(null);

  // Track tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      const focused = document.visibilityState === 'visible';
      setState((s) => ({
        ...s,
        isTabFocused: focused,
        isEngaged: focused && s.isVideoPlaying,
      }));
    };

    const handleFocus = () => {
      setState((s) => ({
        ...s,
        isTabFocused: true,
        isEngaged: s.isVideoPlaying,
      }));
    };

    const handleBlur = () => {
      setState((s) => ({
        ...s,
        isTabFocused: false,
        isEngaged: false,
      }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Set video playing state (called by StreamPlayer)
  const setVideoPlaying = useCallback((playing: boolean) => {
    setState((s) => ({
      ...s,
      isVideoPlaying: playing,
      isEngaged: s.isTabFocused && playing,
      sessionStart: playing && !s.sessionStart ? Date.now() : s.sessionStart,
    }));
  }, []);

  // Track engaged time and trigger earnings
  useEffect(() => {
    if (state.isEngaged) {
      tickInterval.current = setInterval(() => {
        setState((s) => {
          const newSeconds = s.secondsWatched + 1;

          // Check if we should trigger an earning tick
          if (
            onEarningTick &&
            newSeconds - lastEarningTick.current >= earningIntervalSeconds
          ) {
            lastEarningTick.current = newSeconds;
            // Call on next tick to avoid state update during render
            setTimeout(() => onEarningTick(newSeconds), 0);
          }

          return {
            ...s,
            secondsWatched: newSeconds,
          };
        });
      }, 1000);
    } else {
      if (tickInterval.current) {
        clearInterval(tickInterval.current);
        tickInterval.current = null;
      }
    }

    return () => {
      if (tickInterval.current) {
        clearInterval(tickInterval.current);
      }
    };
  }, [state.isEngaged, onEarningTick, earningIntervalSeconds]);

  // Reset session
  const resetSession = useCallback(() => {
    setState((s) => ({
      ...s,
      secondsWatched: 0,
      sessionStart: null,
    }));
    lastEarningTick.current = 0;
  }, []);

  return {
    isEngaged: state.isEngaged,
    isTabFocused: state.isTabFocused,
    isVideoPlaying: state.isVideoPlaying,
    secondsWatched: state.secondsWatched,
    minutesWatched: Math.floor(state.secondsWatched / 60),
    setVideoPlaying,
    resetSession,
  };
}
