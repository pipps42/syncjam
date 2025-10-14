import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Create a new room
 *
 * POST /api/rooms/create
 * Body: { name: string, host_user_id: string }
 * Returns: Room object
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
    const { name, host_user_id } = req.body;

    // Validate input
    if (!name || !host_user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'name and host_user_id are required' 
      });
    }

    if (name.length > 50) {
      return res.status(400).json({ 
        error: 'Room name too long',
        details: 'Room name must be 50 characters or less' 
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists and has Premium
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('user_id, is_premium')
      .eq('user_id', host_user_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ 
        error: 'User not found',
        details: 'Please login with Spotify first' 
      });
    }

    if (!session.is_premium) {
      return res.status(403).json({ 
        error: 'Premium required',
        details: 'Only Spotify Premium users can host rooms' 
      });
    }

    // Generate a unique room code
    const { data: codeResult, error: codeError } = await supabase
      .rpc('generate_room_code');

    if (codeError) {
      console.error('Failed to generate room code:', codeError);
      return res.status(500).json({ 
        error: 'Failed to generate room code',
        details: codeError.message 
      });
    }

    // Create the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: codeResult,
        name: name.trim(),
        host_user_id,
        is_active: true,
        settings: {
          max_participants: 20,
          allow_anonymous: true
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

    // The host will be automatically added as a participant by the database trigger

    return res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}