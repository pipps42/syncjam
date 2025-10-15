import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateRoomName, type CreateRoomRequestBody } from '../types/requests.js';

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
    const { name, host_user_id } = req.body as CreateRoomRequestBody;

    // Validate input
    if (!name || !host_user_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'name and host_user_id are required'
      });
    }

    // Validate room name
    const nameValidation = validateRoomName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({
        error: 'Invalid room name',
        details: nameValidation.error
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
    const { data, error } = await supabase.rpc('generate_room_code');
    const code = Array.isArray(data) ? data[0] : data;
    if (!code || error) {
      console.error('Failed to generate room code:', error);
      return res.status(500).json({ 
        error: 'Failed to generate room code',
        details: error?.message 
      });
    }

    // Define default room settings
    const defaultSettings = {
      max_participants: 20,
      allow_anonymous: true
    };

    // Create the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: code,
        name: name.trim(),
        host_user_id,
        is_active: true,
        settings: defaultSettings
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