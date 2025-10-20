import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Consolidated Auth API
 *
 * Actions:
 * - callback: Exchange OAuth code for tokens
 * - refresh: Refresh access token
 */

// Helper: Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper: Get Spotify credentials
function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  return { clientId, clientSecret };
}

/**
 * ACTION: callback
 * Exchange OAuth authorization code for access and refresh tokens
 */
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, redirect_uri } = req.body;

  if (!code || !redirect_uri) {
    return res.status(400).json({
      error: 'Missing parameters',
      details: 'code and redirect_uri are required'
    });
  }

  try {
    const { clientId, clientSecret } = getSpotifyCredentials();

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Spotify token error:', errorData);
      return res.status(tokenResponse.status).json({
        error: 'Token exchange failed',
        details: errorData.error_description || errorData.error
      });
    }

    const tokenData = await tokenResponse.json();

    // Get user profile
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error('Spotify profile fetch error:', {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        error: errorData
      });
      return res.status(profileResponse.status).json({
        error: 'Failed to fetch user profile',
        details: errorData.error?.message || profileResponse.statusText
      });
    }

    const profile = await profileResponse.json();

    // Store/update session in Supabase
    const supabase = getSupabaseClient();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { data: session, error: dbError } = await supabase
      .from('auth_sessions')
      .upsert({
        user_id: profile.id,
        spotify_user: profile,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        is_premium: profile.product === 'premium'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        error: 'Failed to store session',
        details: dbError.message
      });
    }

    return res.status(200).json({
      session,
      user: profile
    });
  } catch (error) {
    console.error('Callback error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: refresh
 * Refresh Spotify access token using refresh token
 */
async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({
      error: 'Missing refresh_token'
    });
  }

  try {
    const { clientId, clientSecret } = getSpotifyCredentials();

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return res.status(tokenResponse.status).json({
        error: 'Token refresh failed',
        details: errorData.error_description || errorData.error
      });
    }

    const tokenData = await tokenResponse.json();

    // Get updated user profile
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error('Spotify profile fetch error (refresh):', {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        error: errorData
      });
      return res.status(profileResponse.status).json({
        error: 'Failed to fetch user profile',
        details: errorData.error?.message || profileResponse.statusText
      });
    }

    const profile = await profileResponse.json();

    // Update session in Supabase
    const supabase = getSupabaseClient();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { data: session, error: dbError } = await supabase
      .from('auth_sessions')
      .update({
        spotify_user: profile,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refresh_token,
        expires_at: expiresAt,
        is_premium: profile.product === 'premium',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', profile.id)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        error: 'Failed to update session',
        details: dbError.message
      });
    }

    return res.status(200).json({
      session,
      user: profile
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Main handler with action routing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'callback':
        return handleCallback(req, res);
      case 'refresh':
        return handleRefresh(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          details: `Action must be one of: callback, refresh. Got: ${action}`
        });
    }
  } catch (error) {
    console.error('[AUTH] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
