/**
 * Session management utilities
 */

import { supabase } from '../supabase';
import type { AuthSession } from '../../types';

/**
 * Save session after successful OAuth
 * Called by the callback handler
 */
export async function saveSession(session: AuthSession): Promise<void> {
  try {
    const { error } = await supabase
      .from('auth_sessions')
      .upsert({
        user_id: session.user_id,
        spotify_user: session.spotify_user,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        is_premium: session.is_premium,
      });

    if (error) throw error;

    localStorage.setItem('syncjam_user_id', session.user_id);
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}
