-- Migration: Create auth_sessions table
-- Purpose: Store Spotify OAuth tokens and user session data
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  user_id TEXT PRIMARY KEY,
  spotify_user JSONB NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON public.auth_sessions(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read/write their own session
CREATE POLICY "Users can manage their own session"
  ON public.auth_sessions
  FOR ALL
  USING (user_id = current_setting('request.jwt.claim.user_id', true))
  WITH CHECK (user_id = current_setting('request.jwt.claim.user_id', true));

-- For now, allow all operations (we'll tighten this later with proper auth)
-- This is needed because we're using Supabase as a simple datastore without Supabase Auth
CREATE POLICY "Allow all operations for now"
  ON public.auth_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER update_auth_sessions_updated_at
  BEFORE UPDATE ON public.auth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.auth_sessions IS 'Stores Spotify OAuth session data for SyncJam users';
