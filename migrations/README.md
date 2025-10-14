# Database Migrations

This folder contains SQL migration files for the Supabase database.

## How to Run Migrations

1. Go to your Supabase project: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (SyncJam)
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of the migration file
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

## Migration Order

Run these migrations in order:

### 001_create_auth_sessions.sql
Creates the `auth_sessions` table to store Spotify OAuth tokens and user session data.

**Status:** ⏳ **Required for OAuth to work**

**Schema:**
- `user_id` (TEXT, PRIMARY KEY) - Spotify user ID
- `spotify_user` (JSONB) - Full Spotify user profile
- `access_token` (TEXT) - Spotify access token
- `refresh_token` (TEXT) - Spotify refresh token
- `expires_at` (TIMESTAMPTZ) - Token expiration timestamp
- `is_premium` (BOOLEAN) - Whether user has Premium
- `created_at` (TIMESTAMPTZ) - Session creation time
- `updated_at` (TIMESTAMPTZ) - Last update time (auto-updated)

**Features:**
- Automatic `updated_at` timestamp via trigger
- Row Level Security (RLS) enabled
- Index on `expires_at` for efficient queries

---

## Verification

After running a migration, verify it worked:

```sql
-- Check if table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'auth_sessions';

-- View table structure
\d auth_sessions

-- Or in Supabase UI, check the "Table Editor" section
```

---

## Future Migrations

As we add more features (rooms, playback state, etc.), new migration files will be added here with incremented numbers:

- 002_create_rooms.sql (upcoming)
- 003_create_playback_state.sql (upcoming)
- etc.
