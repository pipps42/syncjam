import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Room, Participant, RoomContextValue } from '../types/room';
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
        const error = await response.json();
        throw new Error(error.message || 'Failed to create room');
      }

      const room = await response.json();
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
        const error = await response.json();
        throw new Error(error.message || 'Failed to join room');
      }

      const { room, participant } = await response.json();
      
      setCurrentRoom(room);
      
      // Load all participants
      await loadParticipants(room.id);
      
      // Subscribe to realtime updates
      subscribeToRoom(room.id);
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
  async function loadParticipants(roomId: string) {
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

    // Transform data to include spotify_user directly
    const transformedParticipants = data.map(p => ({
      ...p,
      spotify_user: p.auth_sessions?.[0]?.spotify_user || null,
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
        (payload: RealtimePostgresChangesPayload<any>) => {
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
        (payload: RealtimePostgresChangesPayload<any>) => {
          handleRoomChange(payload);
        }
      )
      .subscribe();

    setRoomChannel(channel);
  }

  /**
   * Handle participant changes from realtime
   */
  function handleParticipantChange(payload: RealtimePostgresChangesPayload<any>) {
    if (payload.eventType === 'INSERT') {
      // New participant joined
      setParticipants(prev => [...prev, payload.new as Participant]);
    } else if (payload.eventType === 'UPDATE') {
      // Participant updated (status change, left room, etc.)
      setParticipants(prev =>
        prev.map(p => (p.id === payload.new.id ? payload.new as Participant : p))
      );
    } else if (payload.eventType === 'DELETE') {
      // Participant removed
      setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
    }
  }

  /**
   * Handle room changes from realtime
   */
  function handleRoomChange(payload: RealtimePostgresChangesPayload<any>) {
    if (payload.eventType === 'UPDATE') {
      setCurrentRoom(prev => prev ? { ...prev, ...payload.new } : null);
      
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