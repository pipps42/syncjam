import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateRoomCode, validateNickname, type JoinRoomRequestBody } from '../types/requests';

/**
 * Helper function to trigger cleanup in background
 * Fire-and-forget - doesn't wait for response
 */
function triggerCleanup() {
  const cleanupUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/rooms/cleanup`
    : 'http://localhost:3000/api/rooms/cleanup';

  fetch(cleanupUrl, { method: 'POST' })
    .then(() => console.log('[JOIN] Cleanup triggered'))
    .catch(err => console.error('[JOIN] Cleanup trigger failed:', err));
}

/**
 * Vercel Serverless Function: Join a room
 *
 * POST /api/rooms/join
 * Body: { room_code: string, user_id?: string, nickname?: string }
 * Returns: { room: Room, participant: Participant }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room_code, user_id, nickname } = req.body as JoinRoomRequestBody;

    // Validate input
    if (!room_code) {
      return res.status(400).json({
        error: 'Missing room code',
        details: 'room_code is required'
      });
    }

    // Anonymous users must provide a nickname
    if (!user_id && !nickname) {
      return res.status(400).json({
        error: 'Missing identification',
        details: 'Either user_id or nickname is required'
      });
    }

    // Validate room code format
    const codeValidation = validateRoomCode(room_code);
    if (!codeValidation.valid) {
      return res.status(400).json({
        error: 'Invalid room code',
        details: codeValidation.error
      });
    }

    // Validate nickname if provided
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

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the room (can be active or inactive - user can reconnect to inactive rooms)
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

    // Check if room is full (count only connected participants)
    const countRes = await supabase
      .from('participants')
      .select('id', { count: 'exact' })
      .eq('room_id', room.id)
      .eq('connection_status', 'connected');

    const participantCount = typeof countRes.count === 'number' ? countRes.count : 0;

    const maxParticipants = room.settings?.max_participants || 20;

    // Check if user is already in the room (either connected or disconnected)
    // Handle both authenticated users (by user_id) and anonymous users (by nickname)
    let existingParticipant = null;

    if (user_id) {
      // Check for authenticated user
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user_id)
        .single();

      existingParticipant = data;
    } else if (nickname) {
      // Check for anonymous user by nickname
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
      // User is reconnecting - update their connection status
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

    // Check if nickname is already taken by a DIFFERENT connected participant
    // (We already handled reconnection above, so this is only for conflicts)
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

    // Trigger cleanup in background (fire-and-forget)
    // This will clean up old/inactive rooms if it hasn't run in the last 2 minutes
    triggerCleanup();

    // Return room and participant info
    return res.status(200).json({ room, participant });
  } catch (error) {
    console.error('Join room error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}