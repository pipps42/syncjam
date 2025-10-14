/**
 * Spotify OAuth and Authentication Types
 */

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  product: 'premium' | 'free' | 'open';
  country: string;
}

export interface AuthSession {
  user_id: string;
  spotify_user: SpotifyUser;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  refreshTokens: () => Promise<void>;
}

export interface OAuthCallbackParams {
  code?: string;
  error?: string;
  state?: string;
}
