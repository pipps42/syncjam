-- ============================================
-- DATABASE CLEANUP AND RESET SCRIPT
-- ============================================
-- IMPORTANT: This will DELETE ALL DATA in your database!
-- Use this ONLY if you want to start fresh and re-run all migrations
-- Run this in Supabase SQL Editor BEFORE running migrations 001-004

-- ============================================
-- 1. Drop all views
-- ============================================

DROP VIEW IF EXISTS public.public_rooms_view CASCADE;
DROP VIEW IF EXISTS public.active_rooms_view CASCADE;

-- ============================================
-- 2. Drop all functions
-- ============================================

DROP FUNCTION IF EXISTS public.cleanup_disconnected_participants(INT) CASCADE;
DROP FUNCTION IF EXISTS public.terminate_expired_pending_rooms() CASCADE;
DROP FUNCTION IF EXISTS public.generate_room_code() CASCADE;
DROP FUNCTION IF EXISTS public.add_host_as_participant() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================
-- 3. Drop all tables (in reverse order of dependencies)
-- ============================================

DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.auth_sessions CASCADE;

-- ============================================
-- 4. Drop all policies (if any remain)
-- ============================================

-- Policies are automatically dropped with CASCADE, but we can be explicit
-- (No need to list them since CASCADE handles it)

-- ============================================
-- 5. Drop indexes that might remain
-- ============================================

-- Indexes are automatically dropped with tables, but just in case:
DROP INDEX IF EXISTS public.idx_auth_sessions_expires_at;
DROP INDEX IF EXISTS public.idx_rooms_code;
DROP INDEX IF EXISTS public.idx_rooms_host_user_id;
DROP INDEX IF EXISTS public.idx_rooms_is_active;
DROP INDEX IF EXISTS public.idx_rooms_created_at;
DROP INDEX IF EXISTS public.idx_rooms_active_public;
DROP INDEX IF EXISTS public.idx_rooms_host;
DROP INDEX IF EXISTS public.idx_rooms_created;
DROP INDEX IF EXISTS public.idx_rooms_pending_termination;
DROP INDEX IF EXISTS public.idx_participants_room_id;
DROP INDEX IF EXISTS public.idx_participants_user_id;
DROP INDEX IF EXISTS public.idx_participants_active;
DROP INDEX IF EXISTS public.idx_participants_connection;
DROP INDEX IF EXISTS public.idx_participants_disconnected;
DROP INDEX IF EXISTS public.idx_unique_active_participant;
DROP INDEX IF EXISTS public.idx_unique_nickname_per_room;

-- ============================================
-- Cleanup complete!
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✓ Database cleanup completed successfully';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Run migration 001_create_auth_sessions.sql';
  RAISE NOTICE '2. Run migration 002_create_rooms_and_participants.sql';
  RAISE NOTICE '3. Run migration 003_add_public_rooms_and_cleanup.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: All data has been deleted. Make sure you have backups if needed!';
END $$;
