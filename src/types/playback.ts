/**
 * Playback and WebRTC Types for synchronized audio streaming
 */

/**
 * Playback state stored in database and synced via Realtime
 */
export interface PlaybackState {
  room_id: string;
  current_track_uri: string | null;
  current_queue_item_id: string | null;
  is_playing: boolean;
  position_ms: number;
  started_at: string | null; // ISO timestamp when playback started
  updated_at: string;
}

/**
 * WebRTC signaling message types
 */
export type WebRTCSignalType = 'offer' | 'answer' | 'ice-candidate';

export interface WebRTCSignal {
  type: WebRTCSignalType;
  from_user_id: string;
  to_user_id?: string; // Optional: for targeted messages (answers, ICE candidates)
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

/**
 * Spotify Web Playback SDK Player instance type
 * Docs: https://developer.spotify.com/documentation/web-playback-sdk/reference
 */
export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, callback: (data: any) => void): void;
  removeListener(event: string): void;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  _options: {
    id: string; // device_id
    getOAuthToken: (callback: (token: string) => void) => void;
  };
}

/**
 * Spotify Player State
 */
export interface SpotifyPlayerState {
  position: number;
  duration: number;
  paused: boolean;
  track_window: {
    current_track: SpotifyWebPlaybackTrack;
    previous_tracks: SpotifyWebPlaybackTrack[];
    next_tracks: SpotifyWebPlaybackTrack[];
  };
}

export interface SpotifyWebPlaybackTrack {
  uri: string;
  id: string;
  name: string;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  artists: Array<{ name: string; uri: string }>;
  duration_ms: number;
}

/**
 * Playback control actions (for host only)
 */
export type PlaybackAction = 'play' | 'pause' | 'seek' | 'skip_next' | 'skip_prev';

/**
 * Global Spotify SDK ready callback
 */
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (config: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}
