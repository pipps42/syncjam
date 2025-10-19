-- Migration 003: Add Public/Private Rooms and Optimize Schema
-- Purpose: Add public/private rooms, optimize indexes, and create views
-- Run this in Supabase SQL Editor after running migration 002

-- ============================================
-- 1. Add is_public column to rooms
-- ============================================
-- This allows rooms to be either public (visible in homepage) or private (invite-only)

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN public.rooms.is_public IS
  'Whether the room is publicly visible. Public rooms appear in the homepage list, private rooms require invite link.';

-- ============================================
-- 2. Note about participants schema
-- ============================================
-- Participants table already created with correct schema in migration 002:
-- - No left_at column (never created)
-- - Has disconnected_at and reconnected_at columns
-- - Uses connection_status for tracking state

-- ============================================
-- 3. Create optimized indexes
-- ============================================

-- Index for fetching public active rooms (homepage list)
CREATE INDEX IF NOT EXISTS idx_rooms_active_public
  ON public.rooms(is_active, is_public, created_at DESC)
  WHERE is_active = true AND is_public = true;

-- Index for finding user's hosted room
CREATE INDEX IF NOT EXISTS idx_rooms_host
  ON public.rooms(host_user_id)
  WHERE is_active = true OR is_active = false;

-- Index for cron job cleanup by creation date
CREATE INDEX IF NOT EXISTS idx_rooms_created
  ON public.rooms(created_at);

-- Index for finding disconnected participants (cron job queries)
CREATE INDEX IF NOT EXISTS idx_participants_disconnected
  ON public.participants(room_id, connection_status, disconnected_at)
  WHERE connection_status = 'disconnected' AND disconnected_at IS NOT NULL;

-- ============================================
-- 4. Row Level Security (RLS) Policies
-- ============================================

-- Allow anyone (even unauthenticated users) to view public active rooms
CREATE POLICY "Anyone can view public active rooms"
ON public.rooms FOR SELECT
USING (is_public = true AND is_active = true);

-- Note: Other RLS policies should remain unchanged (authenticated users can manage their own rooms/participants)

-- ============================================
-- 5. Create helper view for public rooms list
-- ============================================

CREATE OR REPLACE VIEW public.public_rooms_view AS
SELECT
  r.id,
  r.code,
  r.name,
  r.host_user_id,
  r.created_at,
  r.is_active,
  r.is_public,
  s.user_id AS host_id,
  s.spotify_user->>'display_name' AS host_display_name,
  s.spotify_user->'images'->0->>'url' AS host_avatar_url,
  COUNT(DISTINCT p.id) FILTER (WHERE p.connection_status = 'connected') AS participant_count
FROM public.rooms r
LEFT JOIN public.auth_sessions s ON r.host_user_id = s.user_id
LEFT JOIN public.participants p ON r.id = p.room_id
WHERE r.is_active = true AND r.is_public = true
GROUP BY r.id, r.code, r.name, r.host_user_id, r.created_at, r.is_active, r.is_public,
         s.user_id, s.spotify_user;

COMMENT ON VIEW public.public_rooms_view IS
  'Public view of active public rooms with host info and participant count';

GRANT SELECT ON public.public_rooms_view TO anon, authenticated;

-- ============================================
-- 6. Migration complete message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 003 completed successfully';
  RAISE NOTICE '✓ Added is_public column to rooms (default: true)';
  RAISE NOTICE '✓ Schema already includes disconnected_at and reconnected_at columns';
  RAISE NOTICE '✓ Created optimized indexes:';
  RAISE NOTICE '  - idx_rooms_active_public (for homepage list)';
  RAISE NOTICE '  - idx_rooms_host (for finding user''s room)';
  RAISE NOTICE '  - idx_rooms_created (for cron cleanup)';
  RAISE NOTICE '✓ Created RLS policy for public room visibility';
  RAISE NOTICE '✓ Created public_rooms_view for efficient queries';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Deploy Vercel cron job for room cleanup (runs every 5 minutes)';
  RAISE NOTICE '2. Update frontend to show public rooms list on homepage';
  RAISE NOTICE '3. Add "My Room" banner for hosts on homepage';
END $$;
