-- Migration: Create rooms and participants tables for SyncJam
-- Purpose: Store room sessions and track participants
-- Run this in Supabase SQL Editor after 001_create_auth_sessions.sql

-- ============================================
-- 1. Create rooms table
-- ============================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  host_user_id TEXT NOT NULL REFERENCES public.auth_sessions(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{"max_participants": 20, "allow_anonymous": true}'::jsonb,
  
  -- Constraints
  CONSTRAINT room_code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rooms_host_user_id ON public.rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);

-- ============================================
-- 2. Create participants table
-- ============================================
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.auth_sessions(user_id) ON DELETE CASCADE,
  nickname TEXT,
  is_host BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'idle')),

  -- Ensure either user_id or nickname is present (for anonymous users)
  CONSTRAINT participant_identification CHECK (
    user_id IS NOT NULL OR nickname IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON public.participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participants_active ON public.participants(room_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_participants_connection ON public.participants(room_id, connection_status) WHERE left_at IS NULL;

-- Unique constraints using partial indexes (WHERE clause not supported in CONSTRAINT)
-- Ensure unique active participants per room (authenticated users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_participant
  ON public.participants(room_id, user_id)
  WHERE left_at IS NULL AND user_id IS NOT NULL;

-- Ensure nickname uniqueness per room for anonymous users
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_nickname_per_room
  ON public.participants(room_id, nickname)
  WHERE user_id IS NULL AND left_at IS NULL;

-- ============================================
-- 3. Create function to generate unique room codes
-- ============================================
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  -- Generate 6 character code
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  -- Check if code already exists (for active rooms only)
  IF EXISTS (SELECT 1 FROM public.rooms WHERE code = result AND is_active = true) THEN
    -- Recursively generate a new code
    RETURN generate_room_code();
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================
-- 4. Create function to automatically add host as participant
-- ============================================
CREATE OR REPLACE FUNCTION add_host_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the host as the first participant
  INSERT INTO public.participants (room_id, user_id, is_host)
  VALUES (NEW.id, NEW.host_user_id, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for adding host as participant
CREATE TRIGGER add_host_on_room_creation
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION add_host_as_participant();

-- ============================================
-- 5. Create function to clean up inactive rooms
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS void AS $$
BEGIN
  -- Mark rooms as inactive if no participants for 24 hours
  UPDATE public.rooms
  SET is_active = false
  WHERE is_active = true
    AND id IN (
      SELECT r.id
      FROM public.rooms r
      LEFT JOIN public.participants p ON r.id = p.room_id AND p.left_at IS NULL
      WHERE r.is_active = true
      GROUP BY r.id
      HAVING COUNT(p.id) = 0
        AND r.created_at < NOW() - INTERVAL '24 hours'
    );
    
  -- Delete very old inactive rooms (30 days)
  DELETE FROM public.rooms
  WHERE is_active = false
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create view for active rooms with participant count
-- ============================================
CREATE OR REPLACE VIEW public.active_rooms_view AS
SELECT 
  r.id,
  r.code,
  r.name,
  r.host_user_id,
  r.created_at,
  r.settings,
  COUNT(DISTINCT p.id) FILTER (WHERE p.left_at IS NULL) AS participant_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.left_at IS NULL AND p.connection_status = 'connected') AS connected_count
FROM public.rooms r
LEFT JOIN public.participants p ON r.id = p.room_id
WHERE r.is_active = true
GROUP BY r.id, r.code, r.name, r.host_user_id, r.created_at, r.settings;

-- ============================================
-- 7. Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Anyone can view active rooms"
  ON public.rooms FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid()::text = host_user_id OR host_user_id IS NOT NULL);

CREATE POLICY "Hosts can update their rooms"
  ON public.rooms FOR UPDATE
  USING (host_user_id = auth.uid()::text);

CREATE POLICY "Hosts can delete their rooms"
  ON public.rooms FOR DELETE
  USING (host_user_id = auth.uid()::text);

-- RLS Policies for participants
CREATE POLICY "Anyone can view participants"
  ON public.participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join rooms"
  ON public.participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants can update their own status"
  ON public.participants FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id IS NULL);

CREATE POLICY "Participants can leave rooms"
  ON public.participants FOR DELETE
  USING (user_id = auth.uid()::text OR is_host = false);

-- For now, since we're not using Supabase Auth yet, create permissive policies
-- These should be tightened when proper auth is implemented
CREATE POLICY "Temporary: Allow all operations on rooms"
  ON public.rooms FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Temporary: Allow all operations on participants"
  ON public.participants FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 8. Create Realtime publication
-- ============================================
-- Enable realtime for the tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- ============================================
-- 9. Add helpful comments
-- ============================================
COMMENT ON TABLE public.rooms IS 'Stores listening room sessions where users can join and listen to music together';
COMMENT ON TABLE public.participants IS 'Tracks users who have joined rooms, including anonymous guests';
COMMENT ON COLUMN public.rooms.code IS '6-character alphanumeric code used to join the room';
COMMENT ON COLUMN public.rooms.settings IS 'JSON object containing room settings like max participants, privacy, etc';
COMMENT ON COLUMN public.participants.nickname IS 'Display name for anonymous users who haven not authenticated with Spotify';
COMMENT ON COLUMN public.participants.connection_status IS 'Track if user is actively connected, disconnected, or idle';

-- ============================================
-- 10. Grant permissions
-- ============================================
GRANT ALL ON public.rooms TO anon, authenticated;
GRANT ALL ON public.participants TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_room_code() TO anon, authenticated;
GRANT SELECT ON public.active_rooms_view TO anon, authenticated;