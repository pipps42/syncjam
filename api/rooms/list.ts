import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Get list of public active rooms
 *
 * GET /api/rooms/list
 * No authentication required - public endpoint
 * Returns: Array of public rooms with participant counts
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
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[LIST] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch public active rooms using the view created in migration 004
    const { data: rooms, error: roomsError } = await supabase
      .from('public_rooms_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (roomsError) {
      console.error('[LIST] Error fetching public rooms:', roomsError);
      return res.status(500).json({
        error: 'Failed to fetch rooms',
        details: roomsError.message
      });
    }

    console.log(`[LIST] Returning ${rooms?.length || 0} public rooms`);

    return res.status(200).json({
      rooms: rooms || [],
      count: rooms?.length || 0
    });
  } catch (error) {
    console.error('[LIST] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
