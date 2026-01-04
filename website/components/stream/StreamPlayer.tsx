'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

type StreamSource =
  | { type: 'hls'; url: string }
  | { type: 'twitch'; channel: string }
  | { type: 'youtube'; videoId: string };

interface StreamPlayerProps {
  source: StreamSource;
  fallbackMessage?: string;
  onPlayingChange?: (playing: boolean) => void;
}

export function StreamPlayer({ source, fallbackMessage = 'Stream is offline', onPlayingChange }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notify parent of playing state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => onPlayingChange?.(true);
    const handlePause = () => onPlayingChange?.(false);
    const handleEnded = () => onPlayingChange?.(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onPlayingChange]);

  useEffect(() => {
    if (source.type !== 'hls') return;

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(source.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLive(true);
        setError(null);
        video.play().catch(() => {
          // Autoplay blocked - user needs to click
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Stream not available');
              setIsLive(false);
              // Try to recover
              setTimeout(() => hls?.startLoad(), 5000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              setError('Playback error');
              setIsLive(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = source.url;
      video.addEventListener('loadedmetadata', () => {
        setIsLive(true);
        video.play();
      });
    } else {
      setError('HLS not supported in this browser');
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [source]);

  // Twitch embed
  if (source.type === 'twitch') {
    return (
      <div className="relative w-full aspect-video bg-omnium-bg-secondary rounded-lg overflow-hidden">
        <iframe
          src={`https://player.twitch.tv/?channel=${source.channel}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
        />
      </div>
    );
  }

  // YouTube embed
  if (source.type === 'youtube') {
    return (
      <div className="relative w-full aspect-video bg-omnium-bg-secondary rounded-lg overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${source.videoId}?autoplay=1`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // HLS player
  return (
    <div className="relative w-full aspect-video bg-omnium-bg-secondary rounded-lg overflow-hidden">
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">LIVE</span>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        controls
        playsInline
        muted
      />

      {/* Offline/error overlay */}
      {(!isLive || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-omnium-bg-secondary/90">
          <div className="w-16 h-16 mb-4 rounded-full bg-omnium-bg flex items-center justify-center">
            <svg
              className="w-8 h-8 text-omnium-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-omnium-muted text-lg">{error || fallbackMessage}</p>
          <p className="text-omnium-muted/60 text-sm mt-2">
            Waiting for stream to start...
          </p>
        </div>
      )}
    </div>
  );
}
