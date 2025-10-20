import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { initiateSpotifyLogin } from '../lib/spotify';
import type { AuthSession, AuthContextValue } from '../types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const userId = localStorage.getItem('syncjam_user_id');

      if (!userId) {
        setIsLoading(false);
        return;
      }

      // Fetch session from Supabase
      const { data, error } = await supabase
        .from('auth_sessions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem('syncjam_user_id');
        setIsLoading(false);
        return;
      }

      // Check if token is expired
      const expiresAt = new Date(data.expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        // Token expired, need to refresh
        // Note: refreshTokens will be called later, but we need session to be set first
        setSession({
          user_id: data.user_id,
          spotify_user: data.spotify_user as AuthSession['spotify_user'],
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          is_premium: data.is_premium,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } else {
        setSession({
          user_id: data.user_id,
          spotify_user: data.spotify_user as AuthSession['spotify_user'],
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          is_premium: data.is_premium,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - stable function

  useEffect(() => {
    // Check for existing session on mount
    loadSession();
  }, [loadSession]);

  async function refreshTokens() {
    try {
      const userId = localStorage.getItem('syncjam_user_id');
      if (!userId || !session) return;

      // Call refresh token endpoint
      const response = await fetch('/api/auth?action=refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const { access_token, expires_in } = await response.json();

      // Update session in Supabase
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      const { error } = await supabase
        .from('auth_sessions')
        .update({
          access_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Update local session
      setSession((prev) =>
        prev ? { ...prev, access_token, expires_at: expiresAt } : null
      );
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
      // If refresh fails, log out
      logout();
    }
  }

  function login() {
    initiateSpotifyLogin();
  }

  function logout() {
    localStorage.removeItem('syncjam_user_id');
    setSession(null);
  }

  const value: AuthContextValue = {
    session,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
    refreshTokens,
    loadSession, // Expose loadSession so it can be called after OAuth callback
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
