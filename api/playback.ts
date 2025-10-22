import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Consolidated Playback API
 *
 * Actions:
 * - play: Start playback (host only)
 * - pause: Pause playback (host only)
 * - seek: Seek to position (host only)
 * - skip: Skip to next/previous track (host only)
 * - get: Get current playback state (all users)
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

/**
 * Verify user is the host of the room
 */
async function verifyHostPermission(roomId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data: room, error } = await supabase
    .from('rooms')
    .select('host_user_id')
    .eq('id', roomId)
    .single();

  if (error || !room) {
    return false;
  }

  return room.host_user_id === userId;
}

/**
 * ACTION: get
 * Get current playback state for a room
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { room_id } = req.query;

  if (!room_id || typeof room_id !== 'string') {
    return res.status(400).json({
      error: 'Missing parameter',
      details: 'room_id is required'
    });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('playback_state')
      .select('*')
      .eq('room_id', room_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // If no playback state exists yet, return default state
    if (!data) {
      return res.status(200).json({
        room_id,
        current_track_uri: null,
        current_queue_item_id: null,
        is_playing: false,
        position_ms: 0,
        started_at: null,
        updated_at: new Date().toISOString()
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Playback API] Get error:', error);
    return res.status(500).json({
      error: 'Failed to get playback state',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: play
 * Start playback (host only)
 */
async function handlePlay(req: VercelRequest, res: VercelResponse) {
  const { room_id, user_id, track_uri, queue_item_id, position_ms = 0 } = req.body;

  if (!room_id || !user_id) {
    return res.status(400).json({
      error: 'Missing parameters',
      details: 'room_id and user_id are required'
    });
  }

  try {
    // Verify user is host
    const isHost = await verifyHostPermission(room_id, user_id);
    if (!isHost) {
      return res.status(403).json({
        error: 'Permission denied',
        details: 'Only the host can control playback'
      });
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Get current state to preserve fields not being updated
    const { data: currentState } = await supabase
      .from('playback_state')
      .select('*')
      .eq('room_id', room_id)
      .maybeSingle();

    // Upsert playback state - preserve existing values if not provided
    const { data, error } = await supabase
      .from('playback_state')
      .upsert({
        room_id,
        current_track_uri: track_uri !== undefined ? track_uri : (currentState?.current_track_uri || null),
        current_queue_item_id: queue_item_id !== undefined ? queue_item_id : (currentState?.current_queue_item_id || null),
        is_playing: true,
        position_ms: position_ms || 0,
        started_at: now,
        updated_at: now
      }, {
        onConflict: 'room_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Playback API] Play error:', error);
    return res.status(500).json({
      error: 'Failed to start playback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: pause
 * Pause playback (host only)
 */
async function handlePause(req: VercelRequest, res: VercelResponse) {
  const { room_id, user_id, position_ms } = req.body;

  if (!room_id || !user_id) {
    return res.status(400).json({
      error: 'Missing parameters',
      details: 'room_id and user_id are required'
    });
  }

  try {
    // Verify user is host
    const isHost = await verifyHostPermission(room_id, user_id);
    if (!isHost) {
      return res.status(403).json({
        error: 'Permission denied',
        details: 'Only the host can control playback'
      });
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Update playback state
    const { data, error } = await supabase
      .from('playback_state')
      .upsert({
        room_id,
        is_playing: false,
        position_ms: position_ms || 0,
        started_at: null, // Clear started_at when paused
        updated_at: now
      }, {
        onConflict: 'room_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Playback API] Pause error:', error);
    return res.status(500).json({
      error: 'Failed to pause playback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: seek
 * Seek to position (host only)
 */
async function handleSeek(req: VercelRequest, res: VercelResponse) {
  const { room_id, user_id, position_ms } = req.body;

  if (!room_id || !user_id || position_ms === undefined) {
    return res.status(400).json({
      error: 'Missing parameters',
      details: 'room_id, user_id, and position_ms are required'
    });
  }

  try {
    // Verify user is host
    const isHost = await verifyHostPermission(room_id, user_id);
    if (!isHost) {
      return res.status(403).json({
        error: 'Permission denied',
        details: 'Only the host can control playback'
      });
    }

    const supabase = getSupabaseClient();

    // Get current state to preserve is_playing
    const { data: currentState } = await supabase
      .from('playback_state')
      .select('is_playing')
      .eq('room_id', room_id)
      .single();

    const now = new Date().toISOString();

    // Update playback state with new position
    const { data, error } = await supabase
      .from('playback_state')
      .upsert({
        room_id,
        position_ms,
        started_at: currentState?.is_playing ? now : null, // Reset started_at if playing
        updated_at: now
      }, {
        onConflict: 'room_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Playback API] Seek error:', error);
    return res.status(500).json({
      error: 'Failed to seek',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: skip
 * Skip to next/previous track (host only)
 */
async function handleSkip(req: VercelRequest, res: VercelResponse) {
  const { room_id, user_id, direction, track_uri, queue_item_id } = req.body;

  if (!room_id || !user_id || !direction) {
    return res.status(400).json({
      error: 'Missing parameters',
      details: 'room_id, user_id, and direction (next/prev) are required'
    });
  }

  try {
    // Verify user is host
    const isHost = await verifyHostPermission(room_id, user_id);
    if (!isHost) {
      return res.status(403).json({
        error: 'Permission denied',
        details: 'Only the host can control playback'
      });
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // If skipping to a specific track, update playback state
    if (track_uri) {
      const { data, error } = await supabase
        .from('playback_state')
        .upsert({
          room_id,
          current_track_uri: track_uri,
          current_queue_item_id: queue_item_id || null,
          is_playing: true, // Auto-play on skip
          position_ms: 0,
          started_at: now,
          updated_at: now
        }, {
          onConflict: 'room_id'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json(data);
    }

    // If no track specified, just acknowledge the skip
    // (The client will handle queue logic and call this endpoint again with track_uri)
    return res.status(200).json({
      message: 'Skip acknowledged',
      direction
    });
  } catch (error) {
    console.error('[Playback API] Skip error:', error);
    return res.status(500).json({
      error: 'Failed to skip track',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const action = req.method === 'GET' ? 'get' : (req.body?.action || req.query.action);

    if (!action) {
      return res.status(400).json({
        error: 'Missing action parameter',
        details: 'Specify action in query string or request body'
      });
    }

    switch (action) {
      case 'get':
        return await handleGet(req, res);
      case 'play':
        return await handlePlay(req, res);
      case 'pause':
        return await handlePause(req, res);
      case 'seek':
        return await handleSeek(req, res);
      case 'skip':
        return await handleSkip(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          details: `Unknown action: ${action}. Valid actions: get, play, pause, seek, skip`
        });
    }
  } catch (error) {
    console.error('[Playback API] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
