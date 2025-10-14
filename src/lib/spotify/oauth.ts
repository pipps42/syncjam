/**
 * Spotify OAuth utilities
 */

const VITE_SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';

// Scopes required for SyncJam functionality
const REQUIRED_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming', // Web Playback SDK
  'user-read-currently-playing',
  'user-read-recently-played',
];

/**
 * Generate a random state string for OAuth CSRF protection
 */
function generateRandomState(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Initiate Spotify OAuth flow
 * Redirects user to Spotify login page
 */
export function initiateSpotifyLogin(): void {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error(
      'Missing Spotify configuration. Please check your .env file.\n' +
      'Required: VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_REDIRECT_URI'
    );
  }

  const state = generateRandomState();
  sessionStorage.setItem('spotify_oauth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: REQUIRED_SCOPES.join(' '),
    show_dialog: 'false', // Only show login if not already logged in
  });

  const authUrl = `${VITE_SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
  window.location.href = authUrl;
}

/**
 * Validate OAuth state parameter to prevent CSRF attacks
 */
export function validateOAuthState(receivedState: string | null): boolean {
  const storedState = sessionStorage.getItem('spotify_oauth_state');
  sessionStorage.removeItem('spotify_oauth_state'); // Clean up

  if (!storedState || !receivedState) {
    return false;
  }

  return storedState === receivedState;
}

/**
 * Exchange authorization code for tokens
 * This calls our serverless function which handles the client_secret securely
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('/api/auth/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to exchange authorization code');
  }

  return response.json();
}
