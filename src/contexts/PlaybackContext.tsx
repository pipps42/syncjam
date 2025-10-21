import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import {
  initializeWebPlaybackSDK,
  createSpotifyPlayer,
  playTrack,
  pausePlayback as pausePlaybackAPI,
  resumePlayback,
  seekToPosition
} from '../lib/spotify/player';
import type { PlaybackState, SpotifyPlayer } from '../types/playback';
import type { QueueItem } from '../types/queue';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface PlaybackContextValue {
  // State
  playbackState: PlaybackState | null;
  currentPosition: number; // Calculated client-side position
  isPlayerReady: boolean;
  playerError: string | null;
  volume: number;

  // Controls (host only)
  play: (track: QueueItem) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  setVolume: (volume: number) => void;

  // Audio stream for WebRTC (host only)
  audioStream: MediaStream | null;
}

const PlaybackContext = createContext<PlaybackContextValue | undefined>(undefined);

interface PlaybackProviderProps {
  children: ReactNode;
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const { session } = useAuth();
  const { currentRoom, isHost } = useRoom();

  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [volume, setVolume] = useState(100);
  const [audioStream] = useState<MediaStream | null>(null);

  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playbackChannel, setPlaybackChannel] = useState<RealtimeChannel | null>(null);

  /**
   * Initialize Spotify Web Playback SDK (host only)
   */
  useEffect(() => {
    if (!isHost || !session?.is_premium || !session?.access_token || !currentRoom) {
      return;
    }

    let isMounted = true;

    async function setupPlayer() {
      try {
        console.log('[Playback] Initializing Web Playback SDK...');

        // Load SDK
        await initializeWebPlaybackSDK();

        if (!isMounted) return;

        // Create player
        const spotifyPlayer = createSpotifyPlayer(
          `SyncJam - ${currentRoom!.name}`,
          (callback) => {
            if (session?.access_token) {
              callback(session.access_token);
            }
          },
          volume / 100
        );

        // Player ready
        spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
          console.log('[Playback] Player ready with device ID:', device_id);
          setDeviceId(device_id);
          setIsPlayerReady(true);
          setPlayerError(null);
        });

        // Player not ready
        spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
          console.log('[Playback] Player not ready:', device_id);
          setIsPlayerReady(false);
        });

        // Player errors
        spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
          console.error('[Playback] Initialization error:', message);
          setPlayerError(`Initialization error: ${message}`);
        });

        spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
          console.error('[Playback] Authentication error:', message);
          setPlayerError(`Authentication error: ${message}`);
        });

        spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
          console.error('[Playback] Account error:', message);
          setPlayerError(`Account error: ${message}. Spotify Premium is required.`);
        });

        spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
          console.error('[Playback] Playback error:', message);
          setPlayerError(`Playback error: ${message}`);
        });

        // Player state changes
        spotifyPlayer.addListener('player_state_changed', (state) => {
          console.log('[Playback] Player state changed:', state);

          // TODO: Capture audio stream for WebRTC here
          // This requires Web Audio API to capture MediaStream from player
        });

        // Connect player
        const connected = await spotifyPlayer.connect();

        if (!connected) {
          throw new Error('Failed to connect Spotify player');
        }

        console.log('[Playback] Player connected successfully');
        setPlayer(spotifyPlayer);

      } catch (error) {
        console.error('[Playback] Setup error:', error);
        setPlayerError(error instanceof Error ? error.message : 'Failed to setup player');
      }
    }

    setupPlayer();

    return () => {
      isMounted = false;
      if (player) {
        player.disconnect();
      }
    };
  }, [isHost, session, currentRoom, volume]);

  /**
   * Subscribe to playback state changes via Realtime
   */
  useEffect(() => {
    if (!currentRoom) return;

    console.log('[Playback] Setting up realtime subscription for room:', currentRoom.id);

    // Unsubscribe from previous channel
    if (playbackChannel) {
      supabase.removeChannel(playbackChannel);
    }

    // Create new channel
    const channel = supabase
      .channel(`playback:${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playback_state',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload: RealtimePostgresChangesPayload<PlaybackState>) => {
          console.log('[Playback] Realtime update:', payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setPlaybackState(payload.new);
          } else if (payload.eventType === 'DELETE') {
            setPlaybackState(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Playback] Subscription status:', status);
      });

    setPlaybackChannel(channel);

    // Load initial playback state
    loadPlaybackState(currentRoom.id);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentRoom]);

  /**
   * Load initial playback state
   */
  async function loadPlaybackState(roomId: string) {
    try {
      const response = await fetch(`/api/playback?room_id=${roomId}`);

      if (!response.ok) {
        throw new Error('Failed to load playback state');
      }

      const data = await response.json();
      setPlaybackState(data);
    } catch (error) {
      console.error('[Playback] Failed to load state:', error);
    }
  }

  /**
   * Calculate current position (client-side interpolation)
   */
  useEffect(() => {
    if (!playbackState) {
      setCurrentPosition(0);
      return;
    }

    if (!playbackState.is_playing) {
      setCurrentPosition(playbackState.position_ms);
      return;
    }

    // Update position every 100ms while playing
    const interval = setInterval(() => {
      if (playbackState.started_at) {
        const elapsed = Date.now() - new Date(playbackState.started_at).getTime();
        const position = playbackState.position_ms + elapsed;
        setCurrentPosition(position);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playbackState]);

  /**
   * Play a track (host only)
   */
  const play = useCallback(async (track: QueueItem) => {
    if (!isHost || !deviceId || !session?.access_token || !currentRoom) {
      throw new Error('Only host can control playback');
    }

    try {
      console.log('[Playback] Playing track:', track.track_uri, 'on device:', deviceId);

      // IMPORTANT: First transfer playback to our device, then play the track
      // This ensures the Web Playback SDK device becomes the active device
      await playTrack(deviceId, track.track_uri, session.access_token, 0);

      // Update playback state in DB
      const response = await fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          room_id: currentRoom.id,
          user_id: session.user_id,
          track_uri: track.track_uri,
          queue_item_id: track.id,
          position_ms: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Playback] API error:', errorData);
        throw new Error('Failed to update playback state');
      }

      console.log('[Playback] Track playing successfully on device:', deviceId);
    } catch (error) {
      console.error('[Playback] Play error:', error);
      throw error;
    }
  }, [isHost, deviceId, session, currentRoom]);

  /**
   * Pause playback (host only)
   */
  const pause = useCallback(async () => {
    if (!isHost || !deviceId || !session?.access_token || !currentRoom) {
      throw new Error('Only host can control playback');
    }

    try {
      // Get current position from player
      const state = await player?.getCurrentState();
      const position = state?.position || currentPosition;

      // Pause via Spotify API
      await pausePlaybackAPI(deviceId, session.access_token);

      // Update playback state in DB
      const response = await fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          room_id: currentRoom.id,
          user_id: session.user_id,
          position_ms: position
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update playback state');
      }
    } catch (error) {
      console.error('[Playback] Pause error:', error);
      throw error;
    }
  }, [isHost, deviceId, session, currentRoom, player, currentPosition]);

  /**
   * Resume playback (host only)
   */
  const resume = useCallback(async () => {
    if (!isHost || !deviceId || !session?.access_token || !currentRoom) {
      throw new Error('Only host can control playback');
    }

    try {
      // Resume via Spotify API
      await resumePlayback(deviceId, session.access_token);

      // Update playback state in DB - preserve current track and queue item
      const response = await fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          room_id: currentRoom.id,
          user_id: session.user_id,
          track_uri: playbackState?.current_track_uri,
          queue_item_id: playbackState?.current_queue_item_id,
          position_ms: playbackState?.position_ms || 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update playback state');
      }
    } catch (error) {
      console.error('[Playback] Resume error:', error);
      throw error;
    }
  }, [isHost, deviceId, session, currentRoom, playbackState]);

  /**
   * Seek to position (host only)
   */
  const seek = useCallback(async (positionMs: number) => {
    if (!isHost || !deviceId || !session?.access_token || !currentRoom) {
      throw new Error('Only host can control playback');
    }

    try {
      // Seek via Spotify API
      await seekToPosition(deviceId, positionMs, session.access_token);

      // Update playback state in DB
      const response = await fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'seek',
          room_id: currentRoom.id,
          user_id: session.user_id,
          position_ms: positionMs
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update playback state');
      }
    } catch (error) {
      console.error('[Playback] Seek error:', error);
      throw error;
    }
  }, [isHost, deviceId, session, currentRoom]);

  /**
   * Skip to next track (host only)
   */
  const skipNext = useCallback(async () => {
    if (!isHost) {
      throw new Error('Only host can control playback');
    }

    // Note: This will be handled by the PlayerTab component
    // which will get the next track from queue and call play()
    console.log('[Playback] Skip next requested');
  }, [isHost]);

  /**
   * Skip to previous track (host only)
   */
  const skipPrev = useCallback(async () => {
    if (!isHost) {
      throw new Error('Only host can control playback');
    }

    // Note: This will be handled by the PlayerTab component
    // which will get the previous track from queue and call play()
    console.log('[Playback] Skip previous requested');
  }, [isHost]);

  /**
   * Set volume (client-side only)
   */
  const handleSetVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);

    // Update player volume if it exists
    if (player) {
      player.setVolume(newVolume / 100);
    }
  }, [player]);

  const value: PlaybackContextValue = {
    playbackState,
    currentPosition,
    isPlayerReady,
    playerError,
    volume,
    play,
    pause,
    resume,
    seek,
    skipNext,
    skipPrev,
    setVolume: handleSetVolume,
    audioStream
  };

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}
