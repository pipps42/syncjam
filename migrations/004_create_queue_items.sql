-- Migration: Create queue_items table for track queue management
-- Date: 2025-01-19
-- Description: Stores the queue of tracks for each room with ordering

-- Create queue_items table
CREATE TABLE IF NOT EXISTS public.queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  track_uri TEXT NOT NULL, -- Spotify track URI (e.g., spotify:track:...)
  added_by TEXT REFERENCES public.auth_sessions(user_id) ON DELETE SET NULL, -- Who added it (can be null for anonymous)
  added_by_nickname TEXT, -- For anonymous users
  position INTEGER NOT NULL DEFAULT 0, -- Position in queue (0 = next to play)
  metadata JSONB NOT NULL DEFAULT '{}', -- Track metadata (name, artist, album, image, duration, etc.)
  played BOOLEAN NOT NULL DEFAULT false, -- Has this track been played?
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_items_room_id ON public.queue_items(room_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_position ON public.queue_items(room_id, position) WHERE NOT played;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_queue_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_items_updated_at ON public.queue_items;
CREATE TRIGGER trigger_queue_items_updated_at
  BEFORE UPDATE ON public.queue_items
  FOR EACH ROW
  EXECUTE FUNCTION update_queue_items_updated_at();

-- Enable Realtime for queue_items
-- REPLICA IDENTITY FULL ensures all columns are included in WAL events
-- This allows Supabase Realtime to filter by room_id on UPDATE/DELETE events
ALTER TABLE public.queue_items REPLICA IDENTITY FULL;

-- Row Level Security (RLS) Policies
-- Note: We don't use auth.uid() because we're not using Supabase Auth
-- Instead we validate against participants table using added_by field

ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view queue items (client filters by room_id)
CREATE POLICY "Anyone can view queue items"
  ON public.queue_items
  FOR SELECT
  USING (true);

-- Only participants in the room can add tracks
CREATE POLICY "Participants can add tracks to queue"
  ON public.queue_items
  FOR INSERT
  WITH CHECK (
    -- Authenticated user: check if they're a connected participant
    (queue_items.added_by IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = queue_items.room_id
        AND p.user_id = queue_items.added_by
        AND p.connection_status = 'connected'
    ))
    OR
    -- Anonymous user: check if their nickname matches a connected participant
    (queue_items.added_by IS NULL AND queue_items.added_by_nickname IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = queue_items.room_id
        AND p.user_id IS NULL
        AND p.nickname = queue_items.added_by_nickname
        AND p.connection_status = 'connected'
    ))
  );

-- Only the person who added the track or the host can delete it
CREATE POLICY "Owner or host can delete queue items"
  ON public.queue_items
  FOR DELETE
  USING (
    -- User who added it can delete
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.room_id = queue_items.room_id
        AND p.user_id = queue_items.added_by
        AND p.connection_status = 'connected'
    )
    OR
    -- OR room host can delete any track
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.participants p ON p.room_id = r.id AND p.is_host = true
      WHERE r.id = queue_items.room_id
        AND p.connection_status = 'connected'
    )
  );

-- Participants can update queue items
-- Host can update anything (reordering, marking as played, etc.)
DROP POLICY IF EXISTS "Participants can update queue items" ON public.queue_items;
CREATE POLICY "Participants can update queue items"
  ON public.queue_items
  FOR UPDATE
  USING (
    -- Host can update anything (reordering, marking as played, etc.)
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.participants p ON p.room_id = r.id AND p.is_host = true
      WHERE r.id = queue_items.room_id
        AND p.connection_status = 'connected'
    )
  );

-- Create a view for active queue (not played, ordered by position)
DROP VIEW IF EXISTS public.active_queue;
CREATE OR REPLACE VIEW public.active_queue AS
SELECT
  qi.*,
  COALESCE(
    (SELECT jsonb_build_object(
      'id', s.spotify_user->>'id',
      'display_name', s.spotify_user->>'display_name',
      'images', s.spotify_user->'images'
    )
    FROM public.auth_sessions s
    WHERE s.user_id = qi.added_by),
    jsonb_build_object('nickname', qi.added_by_nickname)
  ) AS added_by_user
FROM public.queue_items qi
WHERE qi.played = false
ORDER BY qi.position ASC, qi.created_at ASC;

COMMENT ON TABLE public.queue_items IS 'Stores the queue of tracks for each room';
COMMENT ON COLUMN public.queue_items.track_uri IS 'Spotify track URI';
COMMENT ON COLUMN public.queue_items.position IS 'Position in queue (lower = plays sooner)';
COMMENT ON COLUMN public.queue_items.metadata IS 'Track metadata from Spotify (name, artists, album, image, duration, etc.)';
