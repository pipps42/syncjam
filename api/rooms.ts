import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateRoomCode, validateNickname, type JoinRoomRequestBody } from './types/requests.js';

/**
 * Consolidated Rooms API
 *
 * Actions:
 * - create: Create new room
 * - join: Join/reconnect to room
 * - get: Get room by code
 * - list: List public rooms
 * - my-room: Get user's hosted room
 * - terminate: Delete room (host only)
 * - cleanup: Cleanup old rooms (throttled)
 */

// Helper: Initialize Supabase client
function getSupabaseClient(useServiceKey = false) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = useServiceKey
    ? (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)
    : (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Helper: Trigger cleanup in background (fire-and-forget)
function triggerCleanup() {
  const cleanupUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/rooms?action=cleanup`
    : 'http://localhost:3000/api/rooms?action=cleanup';

  fetch(cleanupUrl, { method: 'POST' })
    .then(() => console.log('[ROOMS] Cleanup triggered'))
    .catch(err => console.error('[ROOMS] Cleanup trigger failed:', err));
}

/**
 * ACTION: create
 * Create a new room (Premium users only, one room per host)
 */
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const { user_id, room_name, is_public = false, settings = {} } = req.body;

  if (!user_id) {
    return res.status(400).json({
      error: 'Missing user ID',
      details: 'user_id is required'
    });
  }

  try {
    const supabase = getSupabaseClient(true);

    // Check if user is Premium
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('is_premium')
      .eq('user_id', user_id)
      .single();

    if (sessionError || !session) {
      return res.status(401).json({
        error: 'User not found',
        details: 'Please authenticate with Spotify first'
      });
    }

    if (!session.is_premium) {
      return res.status(403).json({
        error: 'Premium required',
        details: 'Only Spotify Premium users can create rooms'
      });
    }

    // Check if user already has a room
    const { data: existingRoom, error: existingError } = await supabase
      .from('rooms')
      .select('id, code, name')
      .eq('host_user_id', user_id)
      .single();

    if (existingRoom) {
      return res.status(409).json({
        error: 'Room already exists',
        details: `You already have a room: ${existingRoom.code}`,
        existing_room: existingRoom
      });
    }

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing room:', existingError);
    }

    // Generate unique room code
    const { data: codeData, error: codeError } = await supabase.rpc('generate_room_code');

    if (codeError || !codeData) {
      console.error('Error generating room code:', codeError);
      return res.status(500).json({
        error: 'Failed to generate room code',
        details: codeError?.message
      });
    }

    const roomCode = codeData;

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: roomCode,
        name: room_name || `${user_id}'s Room`,
        host_user_id: user_id,
        is_public,
        is_active: true,
        settings: {
          max_participants: 20,
          allow_explicit: true,
          ...settings
        }
      })
      .select()
      .single();

    if (roomError) {
      console.error('Failed to create room:', roomError);
      return res.status(500).json({
        error: 'Failed to create room',
        details: roomError.message
      });
    }

    // Host is automatically added as participant by database trigger (add_host_as_participant)
    // No need to fetch participant - frontend will load all participants separately

    triggerCleanup();

    return res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: join
 * Join or reconnect to a room
 */
async function handleJoin(req: VercelRequest, res: VercelResponse) {
  const { room_code, user_id, nickname } = req.body as JoinRoomRequestBody;

  // Validate input
  if (!room_code) {
    return res.status(400).json({
      error: 'Missing room code',
      details: 'room_code is required'
    });
  }

  if (!user_id && !nickname) {
    return res.status(400).json({
      error: 'Missing identification',
      details: 'Either user_id or nickname is required'
    });
  }

  const codeValidation = validateRoomCode(room_code);
  if (!codeValidation.valid) {
    return res.status(400).json({
      error: 'Invalid room code',
      details: codeValidation.error
    });
  }

  if (nickname) {
    const nicknameValidation = validateNickname(nickname);
    if (!nicknameValidation.valid) {
      return res.status(400).json({
        error: 'Invalid nickname',
        details: nicknameValidation.error
      });
    }
  }

  const cleanCode = room_code.trim().toUpperCase();

  try {
    const supabase = getSupabaseClient(true);

    // Find the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .single();

    if (roomError || !room) {
      return res.status(404).json({
        error: 'Room not found',
        details: 'No room found with this code'
      });
    }

    // Check if room is full
    const countRes = await supabase
      .from('participants')
      .select('id', { count: 'exact' })
      .eq('room_id', room.id)
      .eq('connection_status', 'connected');

    const participantCount = typeof countRes.count === 'number' ? countRes.count : 0;
    const maxParticipants = room.settings?.max_participants || 20;

    // Check if user is already in the room
    let existingParticipant = null;

    if (user_id) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user_id)
        .single();
      existingParticipant = data;
    } else if (nickname) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('nickname', nickname.trim())
        .is('user_id', null)
        .single();
      existingParticipant = data;
    }

    if (existingParticipant) {
      // Reconnection
      console.log('[JOIN] Existing participant found, reconnecting:', existingParticipant.id);
      const isHost = existingParticipant.user_id && existingParticipant.user_id === room.host_user_id;

      const { data: updatedParticipant, error: updateError } = await supabase
        .from('participants')
        .update({
          connection_status: 'connected',
          disconnected_at: null,
          reconnected_at: new Date().toISOString()
        })
        .eq('id', existingParticipant.id)
        .select()
        .single();

      if (updateError) {
        console.error('[JOIN] Failed to update participant:', updateError);
        return res.status(500).json({
          error: 'Failed to reconnect',
          details: updateError.message
        });
      }

      // If user is the host, mark room as active
      if (isHost) {
        console.log('[JOIN] Host reconnecting, marking room as active');
        const { error: roomUpdateError } = await supabase
          .from('rooms')
          .update({ is_active: true })
          .eq('id', room.id);

        if (roomUpdateError) {
          console.error('[JOIN] Error marking room as active:', roomUpdateError);
        }
      }

      return res.status(200).json({
        room: { ...room, is_active: isHost ? true : room.is_active },
        participant: updatedParticipant,
        reconnected: true
      });
    }

    // New participant joining - check if room is full
    if (participantCount >= maxParticipants) {
      return res.status(403).json({
        error: 'Room is full',
        details: `Maximum ${maxParticipants} participants allowed`
      });
    }

    // Check if nickname is already taken
    if (!user_id && nickname) {
      const { data: existingNickname } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('nickname', nickname.trim())
        .is('user_id', null)
        .eq('connection_status', 'connected')
        .single();

      if (existingNickname) {
        return res.status(400).json({
          error: 'Nickname already taken',
          details: 'Please choose a different name'
        });
      }
    }

    // Add participant to room
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        user_id: user_id || null,
        nickname: nickname?.trim() || null,
        is_host: false,
        connection_status: 'connected'
      })
      .select()
      .single();

    if (participantError) {
      console.error('Failed to add participant:', participantError);
      return res.status(500).json({
        error: 'Failed to join room',
        details: participantError.message
      });
    }

    triggerCleanup();

    return res.status(200).json({ room, participant });
  } catch (error) {
    console.error('Join room error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: get
 * Get room by code
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: 'Missing room code',
      details: 'code query parameter is required'
    });
  }

  try {
    const supabase = getSupabaseClient();

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !room) {
      return res.status(404).json({
        error: 'Room not found',
        details: 'No room found with this code'
      });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: list
 * List public rooms
 */
async function handleList(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseClient();

    const { data: rooms, error } = await supabase
      .from('public_rooms_view')
      .select('*');

    if (error) {
      console.error('Error fetching public rooms:', error);
      return res.status(500).json({
        error: 'Failed to fetch rooms',
        details: error.message
      });
    }

    return res.status(200).json({ rooms: rooms || [] });
  } catch (error) {
    console.error('List rooms error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: my-room
 * Get user's hosted room
 */
async function handleMyRoom(req: VercelRequest, res: VercelResponse) {
  const { user_id } = req.query;

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({
      error: 'Missing user_id',
      details: 'user_id query parameter is required'
    });
  }

  try {
    const supabase = getSupabaseClient(true);

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('host_user_id', user_id)
      .single();

    if (roomError) {
      if (roomError.code === 'PGRST116') {
        console.log(`[MY_ROOM] User ${user_id} has no room`);
        return res.status(200).json({
          room: null,
          has_room: false
        });
      }

      console.error('[MY_ROOM] Error fetching room:', roomError);
      return res.status(500).json({
        error: 'Failed to fetch room',
        details: roomError.message
      });
    }

    if (!room) {
      return res.status(200).json({
        room: null,
        has_room: false
      });
    }

    // Get participant count
    const { count: participantCount, error: countError } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('connection_status', 'connected');

    if (countError) {
      console.error('[MY_ROOM] Error counting participants:', countError);
    }

    console.log(`[MY_ROOM] User ${user_id} hosts room ${room.code} (${room.is_active ? 'active' : 'inactive'})`);

    return res.status(200).json({
      room: {
        ...room,
        participant_count: participantCount || 0
      },
      has_room: true
    });
  } catch (error) {
    console.error('[MY_ROOM] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: terminate
 * Delete room (host only)
 */
async function handleTerminate(req: VercelRequest, res: VercelResponse) {
  const { room_id, host_user_id } = req.body;

  console.log('[TERMINATE] Request received:', { room_id, host_user_id });

  if (!room_id || typeof room_id !== 'string') {
    console.log('[TERMINATE] Missing room_id');
    return res.status(400).json({ error: 'Room ID is required' });
  }

  if (!host_user_id || typeof host_user_id !== 'string') {
    console.log('[TERMINATE] Missing host_user_id');
    return res.status(400).json({ error: 'Host user ID is required' });
  }

  try {
    const supabase = getSupabaseClient();

    // Verify that the user is actually the host
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('host_user_id, is_active')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      console.log('[TERMINATE] Room not found:', roomError);
      return res.status(404).json({
        error: 'Room not found',
        details: 'This room does not exist'
      });
    }

    console.log('[TERMINATE] Room found:', room);

    if (room.host_user_id !== host_user_id) {
      console.log('[TERMINATE] User is not host:', { actual: room.host_user_id, provided: host_user_id });
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the host can terminate the room'
      });
    }

    // Delete the room (participants will be auto-deleted via CASCADE)
    console.log('[TERMINATE] Deleting room and all participants');
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', room_id);

    if (deleteError) {
      console.error('[TERMINATE] Error deleting room:', deleteError);
      throw deleteError;
    }

    console.log('[TERMINATE] Room and participants deleted successfully');
    return res.status(200).json({
      success: true,
      message: 'Room and all participants deleted successfully'
    });
  } catch (error) {
    console.error('[TERMINATE] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ACTION: cleanup
 * Cleanup old/inactive rooms (throttled to max once per 2 minutes)
 */
async function handleCleanup(req: VercelRequest, res: VercelResponse) {
  const CLEANUP_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes
  const CLEANUP_METADATA_ID = '00000000-0000-0000-0000-000000000000';

  try {
    console.log('[CLEANUP] Cleanup request received');

    const supabase = getSupabaseClient(true);

    // Check throttling
    const { data: metadata, error: metaError } = await supabase
      .from('auth_sessions')
      .select('updated_at')
      .eq('user_id', CLEANUP_METADATA_ID)
      .single();

    const now = Date.now();
    let shouldRunCleanup = true;

    if (metadata && !metaError) {
      const lastCleanup = new Date(metadata.updated_at).getTime();
      const elapsed = now - lastCleanup;

      if (elapsed < CLEANUP_THROTTLE_MS) {
        console.log(`[CLEANUP] Throttled - last cleanup was ${Math.round(elapsed / 1000)}s ago (< 120s)`);
        shouldRunCleanup = false;

        return res.status(200).json({
          success: true,
          skipped: true,
          message: 'Cleanup skipped - ran recently',
          last_cleanup_seconds_ago: Math.round(elapsed / 1000),
          next_cleanup_in_seconds: Math.round((CLEANUP_THROTTLE_MS - elapsed) / 1000)
        });
      }
    }

    if (!shouldRunCleanup) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Cleanup skipped'
      });
    }

    // Update metadata timestamp
    const { error: updateMetaError } = await supabase
      .from('auth_sessions')
      .upsert({
        user_id: CLEANUP_METADATA_ID,
        spotify_user: { cleanup_metadata: true },
        access_token: 'N/A',
        refresh_token: 'N/A',
        expires_at: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
        is_premium: false,
        updated_at: new Date(now).toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateMetaError) {
      console.error('[CLEANUP] Error updating metadata:', updateMetaError);
    }

    let totalDeleted = 0;

    // Cleanup 1: Inactive rooms with host disconnected > 60s
    console.log('[CLEANUP] Starting cleanup of inactive rooms...');

    const sixtySecondsAgo = new Date(now - 60 * 1000).toISOString();

    const { data: inactiveRooms, error: inactiveError } = await supabase
      .from('rooms')
      .select(`
        id,
        code,
        name,
        host_user_id
      `)
      .eq('is_active', false);

    if (inactiveError) {
      console.error('[CLEANUP] Error fetching inactive rooms:', inactiveError);
    } else if (inactiveRooms && inactiveRooms.length > 0) {
      console.log(`[CLEANUP] Found ${inactiveRooms.length} inactive rooms, checking host disconnect time...`);

      const roomsToDelete: string[] = [];

      for (const room of inactiveRooms) {
        const { data: hostParticipant } = await supabase
          .from('participants')
          .select('disconnected_at, connection_status')
          .eq('room_id', room.id)
          .eq('user_id', room.host_user_id)
          .single();

        if (
          hostParticipant &&
          hostParticipant.connection_status === 'disconnected' &&
          hostParticipant.disconnected_at &&
          hostParticipant.disconnected_at < sixtySecondsAgo
        ) {
          roomsToDelete.push(room.id);
          console.log(`[CLEANUP] Room ${room.code} marked for deletion (host disconnected > 60s)`);
        }
      }

      if (roomsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('rooms')
          .delete()
          .in('id', roomsToDelete);

        if (deleteError) {
          console.error('[CLEANUP] Error deleting inactive rooms:', deleteError);
        } else {
          totalDeleted += roomsToDelete.length;
          console.log(`[CLEANUP] Deleted ${roomsToDelete.length} inactive rooms`);
        }
      } else {
        console.log('[CLEANUP] No inactive rooms with host disconnected > 60s');
      }
    } else {
      console.log('[CLEANUP] No inactive rooms found');
    }

    // Cleanup 2: Rooms older than 6 hours
    console.log('[CLEANUP] Checking for rooms older than 6 hours...');

    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();

    const { data: oldRooms, error: oldError } = await supabase
      .from('rooms')
      .select('id, code, name, created_at')
      .lt('created_at', sixHoursAgo);

    if (oldError) {
      console.error('[CLEANUP] Error fetching old rooms:', oldError);
    } else if (oldRooms && oldRooms.length > 0) {
      const oldRoomIds = oldRooms.map(r => r.id);

      console.log(`[CLEANUP] Deleting ${oldRoomIds.length} old rooms (>6h):`, oldRooms.map(r => r.code));

      const { error: deleteOldError } = await supabase
        .from('rooms')
        .delete()
        .in('id', oldRoomIds);

      if (deleteOldError) {
        console.error('[CLEANUP] Error deleting old rooms:', deleteOldError);
      } else {
        totalDeleted += oldRoomIds.length;
        console.log(`[CLEANUP] Deleted ${oldRoomIds.length} old rooms`);
      }
    } else {
      console.log('[CLEANUP] No old rooms found');
    }

    console.log(`[CLEANUP] Cleanup completed. Total rooms deleted: ${totalDeleted}`);

    return res.status(200).json({
      success: true,
      skipped: false,
      message: 'Cleanup completed successfully',
      deleted_count: totalDeleted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CLEANUP] Error:', error);
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
  const { action } = req.query;

  try {
    switch (action) {
      case 'create':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleCreate(req, res);

      case 'join':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleJoin(req, res);

      case 'get':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return handleGet(req, res);

      case 'list':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return handleList(req, res);

      case 'my-room':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return handleMyRoom(req, res);

      case 'terminate':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleTerminate(req, res);

      case 'cleanup':
        if (req.method !== 'POST' && req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        return handleCleanup(req, res);

      default:
        return res.status(400).json({
          error: 'Invalid action',
          details: `Action must be one of: create, join, get, list, my-room, terminate, cleanup. Got: ${action}`
        });
    }
  } catch (error) {
    console.error('[ROOMS] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
