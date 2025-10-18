import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: Client-side triggered cleanup
 *
 * POST /api/rooms/cleanup
 *
 * Cleans up:
 * 1. Inactive rooms where host disconnected > 60 seconds
 * 2. All rooms older than 6 hours
 *
 * Throttling: Runs max once every 2 minutes globally
 * Uses a simple "last_cleanup" timestamp stored in a singleton table
 */

const CLEANUP_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Allow both GET and POST for flexibility
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[CLEANUP] Cleanup request received');

    // Initialize Supabase client with service key (bypass RLS)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[CLEANUP] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // Check throttling: Has cleanup run in last 2 minutes?
    // ============================================
    // We use auth_sessions table to store a "cleanup metadata" row
    // This is a hack but avoids creating a new table
    // The row has a special user_id: '00000000-0000-0000-0000-000000000000'

    const CLEANUP_METADATA_ID = '00000000-0000-0000-0000-000000000000';

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
      // This shouldn't happen, but just in case
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Cleanup skipped'
      });
    }

    // ============================================
    // Update metadata timestamp (before cleanup to prevent race conditions)
    // ============================================
    const { error: updateMetaError } = await supabase
      .from('auth_sessions')
      .upsert({
        user_id: CLEANUP_METADATA_ID,
        spotify_user: { cleanup_metadata: true },
        access_token: 'N/A',
        refresh_token: 'N/A',
        expires_at: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        is_premium: false,
        updated_at: new Date(now).toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateMetaError) {
      console.error('[CLEANUP] Error updating metadata:', updateMetaError);
      // Continue anyway - better to cleanup than to skip
    }

    let totalDeleted = 0;

    // ============================================
    // Cleanup 1: Inactive rooms with host disconnected > 60s
    // ============================================
    console.log('[CLEANUP] Starting cleanup of inactive rooms...');

    const sixtySecondsAgo = new Date(now - 60 * 1000).toISOString();

    // Find inactive rooms
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

      // For each inactive room, check if host has been disconnected > 60s
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

    // ============================================
    // Cleanup 2: Rooms older than 6 hours
    // ============================================
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

    // ============================================
    // Return summary
    // ============================================
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
