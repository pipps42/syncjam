/**
 * API Response Types for SyncJam
 */

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  details?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: ApiErrorResponse;
}

/**
 * Create room response
 */
export interface CreateRoomResponse {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  created_at: string;
  is_active: boolean;
  is_public: boolean;
  settings: {
    max_participants: number;
    allow_anonymous: boolean;
  };
}

/**
 * Join room response
 */
export interface JoinRoomResponse {
  room: {
    id: string;
    code: string;
    name: string;
    host_user_id: string;
    created_at: string;
    is_active: boolean;
    is_public: boolean;
    settings: {
      max_participants: number;
      allow_anonymous: boolean;
    } | null;
  };
  participant: {
    id: string;
    room_id: string;
    user_id: string | null;
    nickname: string | null;
    is_host: boolean;
    joined_at: string;
    connection_status: 'connected' | 'disconnected' | 'idle';
  };
}

/**
 * Participant with joined user data from database query
 */
export interface ParticipantWithUser {
  id: string;
  room_id: string;
  user_id: string | null;
  nickname: string | null;
  is_host: boolean;
  joined_at: string;
  connection_status: 'connected' | 'disconnected' | 'idle';
  disconnected_at: string | null;
  reconnected_at: string | null;
  auth_sessions: Array<{
    spotify_user: {
      id: string;
      display_name: string;
      email: string;
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
      product: 'premium' | 'free' | 'open';
      country: string;
    };
  }> | null;
}
