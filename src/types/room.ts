/**
 * Room and Participant Types for SyncJam
 */

import type { SpotifyUser } from './auth';

/**
 * Database record types for Supabase Realtime payloads
 */
export interface ParticipantRecord {
  id: string;
  room_id: string;
  user_id: string | null;
  nickname: string | null;
  is_host: boolean;
  joined_at: string;
  connection_status: 'connected' | 'disconnected' | 'idle';
  disconnected_at: string | null;
  reconnected_at: string | null;
}

export interface RoomRecord {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  created_at: string;
  is_active: boolean;
  is_public: boolean;
  settings: RoomSettings | null;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  created_at: string;
  is_active: boolean;
  is_public: boolean;
  settings?: RoomSettings;
  participant_count?: number;
  connected_count?: number;
}

export interface RoomSettings {
  max_participants?: number;
  allow_anonymous?: boolean;
}

export interface Participant {
  id: string;
  room_id: string;
  user_id?: string | null;
  nickname?: string | null;
  is_host: boolean;
  joined_at: string;
  connection_status: 'connected' | 'disconnected' | 'idle';
  disconnected_at?: string | null;
  reconnected_at?: string | null;
  // Extended with user data when joined
  spotify_user?: SpotifyUser;
}

export interface CreateRoomRequest {
  name: string;
  is_public?: boolean;
  settings?: RoomSettings;
}

export interface JoinRoomRequest {
  room_code: string;
  nickname?: string; // For anonymous users
}

export interface RoomContextValue {
  currentRoom: Room | null;
  participants: Participant[];
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  createRoom: (name: string, isPublic?: boolean) => Promise<Room>;
  joinRoom: (code: string, nickname?: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  reconnectToRoom: (code: string) => Promise<void>;
}

export interface RoomViewProps {
  room: Room;
  participants: Participant[];
  onLeave: () => void;
}