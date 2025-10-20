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
    show_dialog: 'true', // Always show consent screen to avoid stale authorization issues
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
 * Exchange authorization code for session
 * This calls our serverless function which handles the client_secret securely
 * and returns the complete session data (no need to call Spotify API again)
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  session: {
    user_id: string;
    spotify_user: any;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    is_premium: boolean;
    created_at: string;
    updated_at: string;
  };
  user: any;
}> {
  const response = await fetch('/api/auth?action=callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[OAuth] API error response:', {
      status: response.status,
      statusText: response.statusText,
      error
    });
    const message = error.details || error.error || 'Failed to exchange authorization code';
    throw new Error(`${message} (${response.status})`);
  }

  return response.json();
}
