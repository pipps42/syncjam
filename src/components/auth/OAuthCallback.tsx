import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { validateOAuthState, exchangeCodeForTokens } from '../../lib/spotify';
import { saveSession } from '../../lib/auth';
import type { OAuthCallbackParams, SpotifyUser } from '../../types';
import './OAuthCallback.css';

export function OAuthCallback() {
  const navigate = useNavigate();
  const { loadSession } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    try {
      // Parse URL parameters
      const params = new URLSearchParams(window.location.search);
      const callbackParams: OAuthCallbackParams = {
        code: params.get('code') || undefined,
        error: params.get('error') || undefined,
        state: params.get('state') || undefined,
      };

      // Check for OAuth error
      if (callbackParams.error) {
        throw new Error(`Spotify OAuth error: ${callbackParams.error}`);
      }

      // Validate required parameters
      if (!callbackParams.code || !callbackParams.state) {
        throw new Error('Missing OAuth parameters');
      }

      // Validate state (CSRF protection)
      if (!validateOAuthState(callbackParams.state)) {
        throw new Error('Invalid OAuth state - possible CSRF attack');
      }

      // Exchange code for tokens
      setStatus('loading');
      const tokens = await exchangeCodeForTokens(callbackParams.code);

      // Fetch user profile from Spotify
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const spotifyUser: SpotifyUser = await userResponse.json();

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Save session to Supabase
      await saveSession({
        user_id: spotifyUser.id,
        spotify_user: spotifyUser,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        is_premium: spotifyUser.product === 'premium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Reload session in AuthContext so user appears logged in immediately
      await loadSession();

      setStatus('success');

      // Redirect to home page after brief success message
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  }

  return (
    <div className="callback-container">
      <div className="callback-card">
        {status === 'loading' && (
          <>
            <div className="spinner"></div>
            <h2>Completing login...</h2>
            <p>Please wait while we connect your Spotify account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2>Success!</h2>
            <p>You're all set. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">✕</div>
            <h2>Login Failed</h2>
            <p className="error-message">{errorMessage}</p>
            <button
              className="retry-button"
              onClick={() => navigate('/', { replace: true })}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
