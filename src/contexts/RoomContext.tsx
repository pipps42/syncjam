import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Room, Participant, RoomContextValue, ParticipantRecord, RoomRecord } from '../types/room';
import type { ApiErrorResponse, CreateRoomResponse, JoinRoomResponse, ParticipantWithUser } from '../types/api';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

interface RoomProviderProps {
  children: ReactNode;
}

export function RoomProvider({ children }: RoomProviderProps) {
  const { session } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomChannel, setRoomChannel] = useState<RealtimeChannel | null>(null);

  // Clean up realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (roomChannel) {
        supabase.removeChannel(roomChannel);
      }
    };
  }, [roomChannel]);

  /**
   * Create a new room (host only)
   */
  const createRoom = useCallback(async (name: string): Promise<Room> => {
    if (!session) {
      throw new Error('You must be logged in to create a room');
    }

    if (!session.is_premium) {
      throw new Error('Only Spotify Premium users can host rooms');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call serverless function to create room
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          host_user_id: session.user_id,
        }),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create room');
      }

      const room: CreateRoomResponse = await response.json();
      setCurrentRoom(room);

      // Subscribe to realtime updates for this room
      subscribeToRoom(room.id);

      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  /**
   * Join an existing room
   */
  const joinRoom = useCallback(async (code: string, nickname?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Call serverless function to join room
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_code: code,
          user_id: session?.user_id || null,
          nickname: nickname || null,
        }),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to join room');
      }

      const data: JoinRoomResponse = await response.json();

      // Convert room settings from null to undefined for type consistency
      const room: Room = {
        ...data.room,
        settings: data.room.settings || undefined,
      };

      setCurrentRoom(room);

      // Load all participants
      await loadParticipants(data.room.id);

      // Subscribe to realtime updates
      subscribeToRoom(data.room.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  /**
   * Leave the current room
   */
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    setIsLoading(true);
    setError(null);

    try {
      const participantId = participants.find(
        p => (session ? p.user_id === session.user_id : p.nickname) && !p.left_at
      )?.id;

      if (participantId) {
        // Mark participant as left
        await supabase
          .from('participants')
          .update({ left_at: new Date().toISOString(), connection_status: 'disconnected' })
          .eq('id', participantId);
      }

      // Unsubscribe from realtime
      if (roomChannel) {
        supabase.removeChannel(roomChannel);
        setRoomChannel(null);
      }

      // Clear state
      setCurrentRoom(null);
      setParticipants([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave room';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentRoom, participants, session, roomChannel]);

  /**
   * Load participants for a room
   */
  async function loadParticipants(roomId: string): Promise<void> {
    const { data, error } = await supabase
      .from('participants')
      .select(`
        *,
        auth_sessions (
          spotify_user
        )
      `)
      .eq('room_id', roomId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Failed to load participants:', error);
      return;
    }

    if (!data) {
      setParticipants([]);
      return;
    }

    // Transform data to include spotify_user directly
    // Cast to ParticipantWithUser to properly type the joined data
    const rawParticipants = data as unknown as ParticipantWithUser[];

    const transformedParticipants: Participant[] = rawParticipants.map(p => ({
      id: p.id,
      room_id: p.room_id,
      user_id: p.user_id,
      nickname: p.nickname,
      is_host: p.is_host,
      joined_at: p.joined_at,
      left_at: p.left_at,
      connection_status: p.connection_status,
      spotify_user: p.auth_sessions?.[0]?.spotify_user,
    }));

    setParticipants(transformedParticipants);
  }

  /**
   * Subscribe to realtime updates for a room
   */
  function subscribeToRoom(roomId: string) {
    // Unsubscribe from previous room if any
    if (roomChannel) {
      supabase.removeChannel(roomChannel);
    }

    // Create new channel for this room
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<ParticipantRecord>) => {
          handleParticipantChange(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<RoomRecord>) => {
          handleRoomChange(payload);
        }
      )
      .subscribe();

    setRoomChannel(channel);
  }

  /**
   * Handle participant changes from realtime
   */
  function handleParticipantChange(payload: RealtimePostgresChangesPayload<ParticipantRecord>) {
    if (payload.eventType === 'INSERT') {
      // New participant joined - convert record to Participant with optional spotify_user
      const newParticipant: Participant = {
        ...payload.new,
        spotify_user: undefined, // Will be populated by loadParticipants
      };
      setParticipants(prev => [...prev, newParticipant]);
    } else if (payload.eventType === 'UPDATE') {
      // Participant updated (status change, left room, etc.)
      setParticipants(prev =>
        prev.map(p => {
          if (p.id === payload.new.id) {
            return {
              ...p,
              ...payload.new,
            };
          }
          return p;
        })
      );
    } else if (payload.eventType === 'DELETE') {
      // Participant removed
      setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
    }
  }

  /**
   * Handle room changes from realtime
   */
  function handleRoomChange(payload: RealtimePostgresChangesPayload<RoomRecord>) {
    if (payload.eventType === 'UPDATE') {
      setCurrentRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...payload.new,
          settings: payload.new.settings || undefined,
        };
      });

      // If room is no longer active, leave it
      if (!payload.new.is_active) {
        leaveRoom();
      }
    }
  }

  const isHost = currentRoom && session
    ? currentRoom.host_user_id === session.user_id
    : false;

  const value: RoomContextValue = {
    currentRoom,
    participants,
    isHost,
    isLoading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

/**
 * Hook to access room context
 * Must be used within RoomProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRoom() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}