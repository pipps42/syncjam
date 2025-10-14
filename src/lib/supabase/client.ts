import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

/**
 * Supabase client instance
 * Configured for browser use with Realtime enabled
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // We handle OAuth manually
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limit for realtime events
    },
  },
});

/**
 * Database types will be generated here after migrations
 * For now, we use the generic Database type
 */
export type Database = {
  public: {
    Tables: {
      auth_sessions: {
        Row: {
          user_id: string;
          spotify_user: unknown;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['auth_sessions']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['auth_sessions']['Insert']>;
      };
    };
  };
};
