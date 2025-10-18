import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Get user's hosted room
 *
 * GET /api/rooms/my-room?user_id=xxx
 * Returns: Room info if user is hosting a room, null otherwise
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({
        error: 'Missing user_id',
        details: 'user_id query parameter is required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[MY_ROOM] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user's hosted room (can be active or inactive)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('host_user_id', user_id)
      .single();

    if (roomError) {
      // PGRST116 means no rows found - this is OK, user has no room
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
