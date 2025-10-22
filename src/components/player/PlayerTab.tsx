import { useState, useEffect, useCallback } from 'react';
import { Music, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, AlertCircle, Radio } from 'lucide-react';
import { usePlayback } from '../../contexts/PlaybackContext';
import { useRoom } from '../../contexts/RoomContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { supabase } from '../../lib/supabase';
import { ProgressBar } from './ProgressBar';
import type { QueueItem } from '../../types/queue';
import './PlayerTab.css';

export function PlayerTab() {
  const { currentRoom, isHost } = useRoom();
  const {
    playbackState,
    currentPosition,
    isPlayerReady,
    playerError,
    volume,
    isCapturingAudio,
    audioStream,
    play,
    pause,
    resume,
    seek,
    setVolume,
    captureTabAudio
  } = usePlayback();
  const { connectionStatus, peerCount } = useWebRTC();

  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);

  /**
   * Load queue and current track
   */
  useEffect(() => {
    if (!currentRoom) return;

    loadQueue();

    // Subscribe to queue changes
    const channel = supabase
      .channel(`queue:${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_items',
          filter: `room_id=eq.${currentRoom.id}`
        },
        () => {
          loadQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  async function loadQueue() {
    if (!currentRoom) return;

    const { data, error } = await supabase
      .from('queue_items')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('played', false)
      .order('position', { ascending: true });

    if (error) {
      console.error('[PlayerTab] Failed to load queue:', error);
      return;
    }

    setQueue(data || []);
  }

  /**
   * Update current track based on playback state
   */
  useEffect(() => {
    if (!playbackState?.current_queue_item_id) {
      setCurrentTrack(null);
      setIsPlaying(false);
      return;
    }

    // Find track in queue
    const track = queue.find(q => q.id === playbackState.current_queue_item_id);
    setCurrentTrack(track || null);
    setIsPlaying(playbackState.is_playing);
  }, [playbackState, queue]);

  /**
   * Handle play/pause toggle
   */
  const handlePlayPause = useCallback(async () => {
    if (!isHost) return;

    setIsLoading(true);
    try {
      if (isPlaying) {
        await pause();
      } else if (currentTrack) {
        await resume();
      } else if (queue.length > 0) {
        // No track playing, play first track in queue
        await play(queue[0]);
      }
    } catch (error) {
      console.error('[PlayerTab] Play/pause error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isHost, isPlaying, currentTrack, queue, play, pause, resume]);

  /**
   * Handle skip to next track
   */
  const handleSkipNext = useCallback(async () => {
    if (!isHost || !currentTrack) return;

    setIsLoading(true);
    try {
      // Find next track in queue
      const currentIndex = queue.findIndex(q => q.id === currentTrack.id);
      const nextTrack = queue[currentIndex + 1];

      if (nextTrack) {
        // Mark current track as played
        await supabase
          .from('queue_items')
          .update({ played: true })
          .eq('id', currentTrack.id);

        // Play next track
        await play(nextTrack);
      } else {
        // No more tracks, just pause
        await pause();
      }
    } catch (error) {
      console.error('[PlayerTab] Skip next error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isHost, currentTrack, queue, play, pause]);

  /**
   * Handle skip to previous track
   */
  const handleSkipPrev = useCallback(async () => {
    if (!isHost || !currentTrack) return;

    setIsLoading(true);
    try {
      // If more than 3 seconds into track, restart current track
      if (currentPosition > 3000) {
        await seek(0);
      } else {
        // Go to previous track
        const currentIndex = queue.findIndex(q => q.id === currentTrack.id);

        if (currentIndex > 0) {
          const prevTrack = queue[currentIndex - 1];

          // Unmark previous track as played
          await supabase
            .from('queue_items')
            .update({ played: false })
            .eq('id', prevTrack.id);

          // Play previous track
          await play(prevTrack);
        } else {
          // Already at first track, restart it
          await seek(0);
        }
      }
    } catch (error) {
      console.error('[PlayerTab] Skip previous error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isHost, currentTrack, queue, currentPosition, play, seek]);

  /**
   * Handle seek
   */
  const handleSeek = useCallback(async (positionMs: number) => {
    if (!isHost) return;

    try {
      await seek(positionMs);
    } catch (error) {
      console.error('[PlayerTab] Seek error:', error);
    }
  }, [isHost, seek]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);

    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [setVolume, isMuted]);

  /**
   * Handle mute/unmute
   */
  const handleMuteToggle = useCallback(() => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, previousVolume, setVolume]);

  // Show error state for host if player failed
  if (isHost && playerError) {
    return (
      <div className="player-tab">
        <div className="player-error">
          <AlertCircle size={48} />
          <h3>Player Error</h3>
          <p>{playerError}</p>
          <p className="error-hint">
            Make sure you have Spotify Premium and try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state for host while player initializes
  if (isHost && !isPlayerReady) {
    return (
      <div className="player-tab">
        <div className="player-loading">
          <Loader2 size={48} className="spinner" />
          <p>Initializing Spotify player...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no track
  if (!currentTrack) {
    return (
      <div className="player-tab">
        <div className="player-empty">
          <Music size={64} className="empty-icon" />
          <h3>No track playing</h3>
          <p>
            {queue.length > 0
              ? isHost
                ? 'Press play to start listening'
                : 'Waiting for host to start playback'
              : 'Add tracks to the queue to get started'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="player-tab">
      <div className="player-content">
        {/* Album Artwork */}
        <div className="album-artwork">
          {currentTrack.metadata.albumImage ? (
            <img src={currentTrack.metadata.albumImage} alt={currentTrack.metadata.album} />
          ) : (
            <div className="artwork-placeholder">
              <Music size={80} />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="track-info">
          <h2 className="track-name">{currentTrack.metadata.name}</h2>
          <p className="track-artists">{currentTrack.metadata.artistNames}</p>
          <p className="track-album">{currentTrack.metadata.album}</p>
        </div>

        {/* Progress Bar */}
        <ProgressBar
          currentPosition={currentPosition}
          duration={currentTrack.metadata.duration_ms}
          isSeekable={isHost}
          onSeek={handleSeek}
        />

        {/* Playback Controls (Host Only) */}
        {isHost && (
          <div className="playback-controls">
            <button
              className="control-button"
              onClick={handleSkipPrev}
              disabled={isLoading}
              title="Previous track"
            >
              <SkipBack size={24} />
            </button>

            <button
              className="control-button primary"
              onClick={handlePlayPause}
              disabled={isLoading}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 size={32} className="spinner" />
              ) : isPlaying ? (
                <Pause size={32} />
              ) : (
                <Play size={32} />
              )}
            </button>

            <button
              className="control-button"
              onClick={handleSkipNext}
              disabled={isLoading || queue.length <= 1}
              title="Next track"
            >
              <SkipForward size={24} />
            </button>
          </div>
        )}

        {/* Host: Audio broadcast button */}
        {isHost && (
          <div className="broadcast-section">
            {!audioStream ? (
              <button
                className="broadcast-button"
                onClick={captureTabAudio}
                disabled={isCapturingAudio}
              >
                <Radio size={20} />
                <span>{isCapturingAudio ? 'Requesting permission...' : 'Start Broadcasting to Guests'}</span>
              </button>
            ) : (
              <div className="broadcast-active">
                <Radio size={20} className="broadcast-icon" />
                <span>Broadcasting to {peerCount} guest{peerCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <p className="broadcast-hint">
              {!audioStream
                ? 'Click to share audio with non-Premium guests'
                : 'Guests can now hear the audio'}
            </p>
          </div>
        )}

        {/* Guest: Show waiting message */}
        {!isHost && (
          <div className="guest-info">
            <p className="info-text">
              {isPlaying ? 'Playing' : 'Paused'} • Host controls playback
            </p>
            {connectionStatus === 'connected' && (
              <p className="connection-status connected">Audio streaming active</p>
            )}
            {connectionStatus === 'connecting' && (
              <p className="connection-status connecting">Connecting to audio stream...</p>
            )}
            {connectionStatus === 'failed' && (
              <p className="connection-status failed">Audio stream unavailable</p>
            )}
          </div>
        )}

        {/* Volume Control (Everyone) */}
        <div className="volume-control">
          <button
            className="volume-icon"
            onClick={handleMuteToggle}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={20} />
            ) : (
              <Volume2 size={20} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
          <span className="volume-value">{volume}%</span>
        </div>

        {/* Debug info (only in development) */}
        {isHost && import.meta.env.DEV && (
          <div className="debug-info">
            <p>Player ready: {isPlayerReady ? 'Yes' : 'No'}</p>
            <p>WebRTC peers: {peerCount}</p>
          </div>
        )}
      </div>
    </div>
  );
}
