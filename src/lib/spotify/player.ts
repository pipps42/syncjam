/**
 * Spotify Web Playback SDK Helper Functions
 * Docs: https://developer.spotify.com/documentation/web-playback-sdk
 */

import type { SpotifyPlayer } from '../../types/playback';

/**
 * Initialize Spotify Web Playback SDK
 * Returns a promise that resolves when the SDK is ready
 */
export function initializeWebPlaybackSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if SDK is already loaded
    if (window.Spotify) {
      resolve();
      return;
    }

    // Set up the callback BEFORE checking for existing script
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="spotify-player.js"]');
    if (existingScript) {
      // Script exists, callback already set above
      return;
    }

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    script.onerror = () => {
      reject(new Error('Failed to load Spotify Web Playback SDK'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Create a Spotify Player instance
 */
export function createSpotifyPlayer(
  name: string,
  getOAuthToken: (callback: (token: string) => void) => void,
  volume: number = 1.0
): SpotifyPlayer {
  if (!window.Spotify) {
    throw new Error('Spotify SDK not loaded. Call initializeWebPlaybackSDK() first.');
  }

  return new window.Spotify.Player({
    name,
    getOAuthToken,
    volume
  });
}

/**
 * Transfer playback to a specific device
 */
export async function transferPlayback(
  deviceId: string,
  accessToken: string,
  play: boolean = true
): Promise<void> {
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play
    })
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to transfer playback: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Play a specific track on a device
 */
export async function playTrack(
  deviceId: string,
  trackUri: string,
  accessToken: string,
  positionMs: number = 0
): Promise<void> {
  console.log('[playTrack] Starting playback:', {
    deviceId,
    trackUri,
    positionMs
  });

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      uris: [trackUri],
      position_ms: positionMs
    })
  });

  console.log('[playTrack] Response status:', response.status, response.statusText);

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[playTrack] Error response:', error);
    throw new Error(`Failed to play track: ${error.error?.message || response.statusText}`);
  }

  console.log('[playTrack] Track started successfully');
}

/**
 * Pause playback on a device
 */
export async function pausePlayback(
  deviceId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to pause playback: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Resume playback on a device
 */
export async function resumePlayback(
  deviceId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to resume playback: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Seek to position in current track
 */
export async function seekToPosition(
  deviceId: string,
  positionMs: number,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to seek: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Skip to next track
 */
export async function skipToNext(
  deviceId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to skip to next: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Skip to previous track
 */
export async function skipToPrevious(
  deviceId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${deviceId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to skip to previous: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Get current playback state from Spotify
 */
export async function getCurrentPlaybackState(accessToken: string): Promise<any> {
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (response.status === 204) {
    // No active device
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to get playback state: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}
