import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Mark participant as disconnected
 *
 * POST /api/participants/disconnect
 * Body: {
 *   room_id: string,
 *   user_id?: string | null,
 *   connection_status: 'disconnected',
 *   disconnected_at: string (ISO timestamp)
 * }
 *
 * This endpoint marks a participant as disconnected without setting left_at.
 * This allows the participant to reconnect later.
 * The UI will filter out disconnected participants from the active list.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room_id, user_id, nickname, connection_status, disconnected_at } = req.body;
    console.log('[DISCONNECT] Request received:', { room_id, user_id, nickname, connection_status, disconnected_at });

    if (!room_id || typeof room_id !== 'string') {
      console.log('[DISCONNECT] Missing room_id');
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // Either user_id or nickname must be provided
    if (!user_id && !nickname) {
      console.log('[DISCONNECT] Missing identification (user_id or nickname)');
      return res.status(400).json({
        error: 'Identification required',
        details: 'Either user_id or nickname must be provided'
      });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DISCONNECT] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, check if user is the host of this room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, host_user_id')
      .eq('id', room_id)
      .single();

    if (roomError) {
      console.error('[DISCONNECT] Error fetching room:', roomError);
      return res.status(500).json({
        error: 'Failed to fetch room',
        details: roomError.message
      });
    }

    if (!room) {
      console.log('[DISCONNECT] Room not found');
      return res.status(404).json({ error: 'Room not found' });
    }

    const isHost = user_id && room.host_user_id === user_id;

    // Update participant - match by user_id (authenticated) or nickname (anonymous)
    let query = supabase
      .from('participants')
      .update({
        connection_status: 'disconnected',
        disconnected_at: disconnected_at || new Date().toISOString()
      })
      .eq('room_id', room_id);

    // Filter by user_id or nickname
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else if (nickname) {
      query = query.eq('nickname', nickname).is('user_id', null);
    }

    const { data: updatedParticipants, error: updateError } = await query.select();

    if (updateError) {
      console.error('[DISCONNECT] Error updating participant:', updateError);
      return res.status(500).json({
        error: 'Failed to update participant',
        details: updateError.message
      });
    }

    if (!updatedParticipants || updatedParticipants.length === 0) {
      console.log('[DISCONNECT] No participant found to update (may have already left)');
      // Return success anyway - idempotent operation
      return res.status(200).json({
        success: true,
        message: 'No active participant found (already disconnected or left)',
        participant_id: null
      });
    }

    console.log('[DISCONNECT] Participant marked as disconnected:', updatedParticipants[0].id);

    // If user is the host, mark room as inactive
    if (isHost) {
      console.log('[DISCONNECT] User is host, marking room as inactive');
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', room_id);

      if (roomUpdateError) {
        console.error('[DISCONNECT] Error marking room as inactive:', roomUpdateError);
        // Don't fail the request, participant was already marked as disconnected
      } else {
        console.log('[DISCONNECT] Room marked as inactive');
      }
    }

    // The realtime UPDATE events will be automatically broadcast to all subscribers
    return res.status(200).json({
      success: true,
      message: 'Participant marked as disconnected',
      participant_id: updatedParticipants[0].id,
      updated_count: updatedParticipants.length,
      is_host: isHost,
      room_inactive: isHost
    });
  } catch (error) {
    console.error('[DISCONNECT] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
