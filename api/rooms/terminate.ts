import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[TERMINATE] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Allow termination even if room is already inactive - this will DELETE the room
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
