import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateRoomCode, validateNickname, type JoinRoomRequestBody } from '../types/requests.js';

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

    // Find the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ 
        error: 'Room not found',
        details: 'No active room found with this code' 
      });
    }

    // Check if room is full
    const countRes = await supabase
      .from('participants')
      .select('id', { count: 'exact' })
      .eq('room_id', room.id)
      .is('left_at', null);

    const participantCount = typeof countRes.count === 'number' ? countRes.count : 0;

    const maxParticipants = room.settings?.max_participants || 20;
    if (participantCount && participantCount >= maxParticipants) {
      return res.status(403).json({ 
        error: 'Room is full',
        details: `Maximum ${maxParticipants} participants allowed` 
      });
    }

    // Check if user is already in the room
    if (user_id) {
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user_id)
        .is('left_at', null)
        .single();

      if (existingParticipant) {
        // User is already in the room, just update their connection status
        const { data: updatedParticipant, error: updateError } = await supabase
          .from('participants')
          .update({ connection_status: 'connected' })
          .eq('id', existingParticipant.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update participant:', updateError);
        }

        return res.status(200).json({ 
          room, 
          participant: updatedParticipant || existingParticipant 
        });
      }
    }

    // Check if nickname is already taken (for anonymous users)
    if (!user_id && nickname) {
      const { data: existingNickname } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('nickname', nickname.trim())
        .is('left_at', null)
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