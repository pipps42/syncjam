-- Migration: Create playback_state table for synchronized playback
-- Date: 2025-01-20
-- Description: Stores current playback state for each room (track, position, play/pause)

-- Create playback_state table
CREATE TABLE IF NOT EXISTS public.playback_state (
  room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_track_uri TEXT,
  current_queue_item_id UUID REFERENCES public.queue_items(id) ON DELETE SET NULL,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  position_ms INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ, -- Timestamp when playback started (for interpolation)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_playback_state_room_id ON public.playback_state(room_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_playback_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_playback_state_updated_at ON public.playback_state;
CREATE TRIGGER trigger_playback_state_updated_at
  BEFORE UPDATE ON public.playback_state
  FOR EACH ROW
  EXECUTE FUNCTION update_playback_state_updated_at();

-- Enable Realtime for playback_state
-- REPLICA IDENTITY FULL ensures all columns are included in WAL events
ALTER TABLE public.playback_state REPLICA IDENTITY FULL;

-- Row Level Security (RLS) Policies
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;

-- Anyone can view playback state
CREATE POLICY "Anyone can view playback state"
  ON public.playback_state
  FOR SELECT
  USING (true);

-- Only room host can insert/update playback state
CREATE POLICY "Host can insert playback state"
  ON public.playback_state
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.participants p ON p.room_id = r.id AND p.is_host = true
      WHERE r.id = playback_state.room_id
        AND p.connection_status = 'connected'
    )
  );

CREATE POLICY "Host can update playback state"
  ON public.playback_state
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.participants p ON p.room_id = r.id AND p.is_host = true
      WHERE r.id = playback_state.room_id
        AND p.connection_status = 'connected'
    )
  );

-- Host can delete playback state (when room ends)
CREATE POLICY "Host can delete playback state"
  ON public.playback_state
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.participants p ON p.room_id = r.id AND p.is_host = true
      WHERE r.id = playback_state.room_id
        AND p.connection_status = 'connected'
    )
  );

-- Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_state;

COMMENT ON TABLE public.playback_state IS 'Stores current playback state for synchronized listening in each room';
COMMENT ON COLUMN public.playback_state.started_at IS 'Timestamp when playback started (used for client-side position interpolation)';
COMMENT ON COLUMN public.playback_state.position_ms IS 'Track position in milliseconds when playback started/paused';
