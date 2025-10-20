/**
 * TypeScript types for Spotify API responses
 */

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistNames: string;
  album: string;
  albumImage: string | null;
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
}

export interface SpotifySearchResponse {
  tracks: SpotifyTrack[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SpotifySearchError {
  error: string;
  details: string;
}

/**
 * Format duration from milliseconds to MM:SS
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
