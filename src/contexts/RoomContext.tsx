import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Room, Participant, RoomContextValue, ParticipantRecord, RoomRecord } from '../types/room';
import type { ApiErrorResponse, CreateRoomResponse, JoinRoomResponse } from '../types/api';
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

  // Best practice: Use sessionStorage + beforeunload + unload to detect refresh vs close
  // sessionStorage persists on refresh but is cleared on tab close
    // Detect refresh vs. tab close and handle room termination safely
  /* useEffect(() => {
    if (!currentRoom) return;

    const handleBeforeUnload = () => {
      // Mark that the page is unloading
      sessionStorage.setItem('unload_started', 'true');
      sessionStorage.setItem('unload_timestamp', Date.now().toString());
    };

    const handleUnload = () => {
      const isUserHost = session && currentRoom.host_user_id === session.user_id;
      const unloadStarted = sessionStorage.getItem('unload_started');
      const unloadTime = sessionStorage.getItem('unload_timestamp');

      // --- Detect if this unload is a refresh ---
      let isRefresh = false;
      try {
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navEntries && navEntries.length > 0) {
          // If this unload leads to a reload navigation, treat it as refresh
          isRefresh = navEntries[0].type === 'reload';
        }
      } catch {
        // Ignore performance API errors
      }

      // Fallback: consider it a refresh if the page reloads within 2 seconds
      const recentlyUnloaded = unloadTime && Date.now() - parseInt(unloadTime) < 2000;
      if (!isRefresh && recentlyUnloaded) {
        // The navigation type may not yet be available; be conservative.
        isRefresh = true;
      }

      // Debug logging
      sessionStorage.setItem('unload_debug', JSON.stringify({ isRefresh, unloadStarted, unloadTime }));

      if (isRefresh) {
        // It's a refresh — do nothing destructive
        return;
      }

      // --- Handle true tab close / window exit ---
      if (isUserHost) {
        // Host leaving for good — terminate the room
        const terminateData = JSON.stringify({
          room_id: currentRoom.id,
          host_user_id: session.user_id,
        });

        sessionStorage.setItem('terminating_room', currentRoom.id);
        navigator.sendBeacon(
          '/api/rooms/terminate',
          new Blob([terminateData], { type: 'application/json' })
        );
      } else {
        // Guest leaving
        const participantId = participants.find(
          p => (session ? p.user_id === session.user_id : p.nickname) && !p.left_at
        )?.id;

        if (participantId) {
          const data = JSON.stringify({
            left_at: new Date().toISOString(),
            connection_status: 'disconnected',
          });
          navigator.sendBeacon(
            `/api/participants/${participantId}/leave`,
            new Blob([data], { type: 'application/json' })
          );
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [currentRoom, participants, session]); */

    /**
   * Load participants for a room
   * Now only returns participants who are actively connected
   */
  const loadParticipants = useCallback(async (roomId: string): Promise<void> => {
    console.log('[LOAD_PARTICIPANTS] Starting for room:', roomId);
    const { data, error} = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('connection_status', 'connected') // <-- only connected participants
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[LOAD_PARTICIPANTS] Failed to load participants:', error);
      setParticipants([]); // defensive
      return;
    }

    if (!data) {
      console.log('[LOAD_PARTICIPANTS] No data returned, setting empty array');
      setParticipants([]);
      return;
    }

    console.log('[LOAD_PARTICIPANTS] Found', data.length, 'participants:', data);

    // Load spotify user data separately for each participant with user_id
    const participantsWithUsers = await Promise.all(
      data.map(async (p) => {
        if (!p.user_id) {
          return {
            ...p,
            spotify_user: undefined,
          };
        }

        const { data: sessionData } = await supabase
          .from('auth_sessions')
          .select('spotify_user')
          .eq('user_id', p.user_id)
          .single();

        return {
          ...p,
          spotify_user: sessionData?.spotify_user,
        };
      })
    );

    console.log('[LOAD_PARTICIPANTS] Setting participants with user data:', participantsWithUsers);
    setParticipants(participantsWithUsers);
  }, []);

  // Handle page unload (close tab / navigate away) - disconnect user from room
  // On refresh, user will be automatically reconnected via reconnectToRoom
  useEffect(() => {
    if (!currentRoom) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show browser confirmation dialog to prevent accidental close
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue to be set
      return ''; // For other browsers
    };

    const handlePageHide = () => {
      // Send disconnect beacon for all users (host and guest)
      // This event is more reliable than beforeunload, especially on mobile
      console.log('[PAGEHIDE] Page hiding, sending disconnect beacon');

      const disconnectData = JSON.stringify({
        room_id: currentRoom.id,
        user_id: session?.user_id || null,
        nickname: participants.find(p => !p.user_id)?.nickname || null,
        connection_status: 'disconnected',
        disconnected_at: new Date().toISOString()
      });

      navigator.sendBeacon(
        '/api/participants/disconnect',
        new Blob([disconnectData], { type: 'application/json' })
      );

      // Clear room state to trigger redirect on next render
      setCurrentRoom(null);
      setParticipants([]);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentRoom, session, participants]);

  /**
   * Load participants for a room
   */
  /* const loadParticipants = useCallback(async (roomId: string): Promise<void> => {
    console.log('[LOAD_PARTICIPANTS] Starting for room:', roomId);
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[LOAD_PARTICIPANTS] Failed to load participants:', error);
      return;
    }

    if (!data) {
      console.log('[LOAD_PARTICIPANTS] No data returned, setting empty array');
      setParticipants([]);
      return;
    }

    console.log('[LOAD_PARTICIPANTS] Found', data.length, 'participants:', data);

    // Load spotify user data separately for each participant with user_id
    const participantsWithUsers = await Promise.all(
      data.map(async (p) => {
        if (!p.user_id) {
          return {
            ...p,
            spotify_user: undefined,
          };
        }

        const { data: sessionData } = await supabase
          .from('auth_sessions')
          .select('spotify_user')
          .eq('user_id', p.user_id)
          .single();

        return {
          ...p,
          spotify_user: sessionData?.spotify_user,
        };
      })
    );

    console.log('[LOAD_PARTICIPANTS] Setting participants with user data:', participantsWithUsers);
    setParticipants(participantsWithUsers);
  }, []); */

  /**
   * Handle participant changes from realtime
   */
  const handleParticipantChange = useCallback((payload: RealtimePostgresChangesPayload<ParticipantRecord>, roomId: string) => {
    if (payload.eventType === 'INSERT') {
      // New participant joined - reload participants to get spotify_user data
      console.log('[PARTICIPANT_CHANGE] INSERT event - reloading participants');
      loadParticipants(roomId);
    } else if (payload.eventType === 'UPDATE') {
      // Participant updated (status change, left room, etc.)
      console.log('[PARTICIPANT_CHANGE] UPDATE event:', payload.new);

      // If participant disconnected, remove from list
      if (payload.new.connection_status === 'disconnected') {
        console.log('[PARTICIPANT_CHANGE] Participant disconnected - removing from list');
        setParticipants(prev => prev.filter(p => p.id !== payload.new.id));
      } else if (payload.new.connection_status === 'connected') {
        // Participant reconnected - check if they're in the list
        setParticipants(prev => {
          const existingParticipant = prev.find(p => p.id === payload.new.id);

          if (existingParticipant) {
            // Already in list, just update
            console.log('[PARTICIPANT_CHANGE] Updating existing participant in list');
            return prev.map(p => {
              if (p.id === payload.new.id) {
                return {
                  ...p,
                  ...payload.new,
                };
              }
              return p;
            });
          } else {
            // Not in list (was disconnected before) - reload all participants
            console.log('[PARTICIPANT_CHANGE] Participant reconnected but not in list - reloading');
            loadParticipants(roomId);
            return prev; // Return current state, will be updated by loadParticipants
          }
        });
      } else {
        // Other status updates
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
      }
    } else if (payload.eventType === 'DELETE') {
      // Participant removed
      console.log('[PARTICIPANT_CHANGE] DELETE event - removing participant');
      setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
    }
  }, [loadParticipants]);

  /**
   * Handle room changes from realtime
   */
  const handleRoomChange = useCallback((payload: RealtimePostgresChangesPayload<RoomRecord>) => {
    console.log('[ROOM_CHANGE] Realtime event received:', payload.eventType, payload);

    if (payload.eventType === 'UPDATE') {
      // Just update the room state - guests can stay in inactive rooms
      setCurrentRoom(prev => {
        if (!prev) return null;
        console.log('[ROOM_CHANGE] Updating room state:', {
          was_active: prev.is_active,
          now_active: payload.new.is_active
        });
        return {
          ...prev,
          ...payload.new,
          settings: payload.new.settings || undefined,
        };
      });

      // Note: We don't redirect users when room becomes inactive
      // Guests can stay and wait for the host to return
      // Only DELETE events (room termination) will kick everyone out
    } else if (payload.eventType === 'DELETE') {
      // Room was deleted (terminated by host) - everyone must leave
      console.log('[ROOM_CHANGE] Room was deleted/terminated, clearing state');
      setCurrentRoom(null);
      setParticipants([]);
    }
  }, []);

  /**
   * Subscribe to realtime updates for a room
   */
  const subscribeToRoom = useCallback((roomId: string) => {
    console.log('[SUBSCRIBE] Setting up realtime subscription for room:', roomId);
    // Unsubscribe from previous room if any
    if (roomChannel) {
      console.log('[SUBSCRIBE] Removing previous channel');
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
          console.log('[SUBSCRIBE] Participant change event:', payload.eventType);
          handleParticipantChange(payload, roomId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to all events (UPDATE and DELETE)
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<RoomRecord>) => {
          console.log('[SUBSCRIBE] Room event received:', payload.eventType);
          handleRoomChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[SUBSCRIBE] Subscription status:', status);
      });

    console.log('[SUBSCRIBE] Channel created and subscribed');
    setRoomChannel(channel);
  }, [roomChannel, handleParticipantChange, handleRoomChange]);

  /**
   * Create a new room (host only)
   */
  const createRoom = useCallback(async (name: string, isPublic: boolean = true): Promise<Room> => {
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
      const response = await fetch('/api/rooms?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: name,
          user_id: session.user_id,
          is_public: isPublic,
        }),
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create room');
      }

      const room: CreateRoomResponse = await response.json();
      setCurrentRoom(room);

      // Load all participants (including the host added by trigger)
      await loadParticipants(room.id);

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
  }, [session, loadParticipants, subscribeToRoom]);

  /**
   * Join an existing room
   */
  const joinRoom = useCallback(async (code: string, nickname?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Call serverless function to join room
      const response = await fetch('/api/rooms?action=join', {
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
  }, [session, loadParticipants, subscribeToRoom]);

  /**
   * Reconnect to an existing room (on page refresh / load)
   * - If a participant record exists (even with connection_status != 'connected'), restore it (set connected)
   * - If host and room had pending termination, call cancel endpoint so server won't terminate the room
   */
  const reconnectToRoom = useCallback(async (code: string): Promise<void> => {
    console.log('[RECONNECT] Starting reconnect to room:', code);
    setIsLoading(true);
    setError(null);

    try {
      // Get room details
      console.log('[RECONNECT] Fetching room details');
      const response = await fetch(`/api/rooms?action=get&code=${code}`);

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        console.error('[RECONNECT] Failed to fetch room:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to load room');
      }

      const room: Room = await response.json();
      console.log('[RECONNECT] Room loaded:', room);
      console.log('[RECONNECT] Session:', session);

      setCurrentRoom(room);

      // If user is authenticated, attempt to restore participant record or rejoin
      if (session) {
        console.log('[RECONNECT] User is authenticated, checking participant status');

        // Try to find any participant record for this user in this room (regardless of connection_status)
        const { data: existingParticipant, error: findError } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', session.user_id)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error('[RECONNECT] Error checking existing participant:', findError);
        }

        if (existingParticipant) {
          // If record exists but not connected, update to connected
          if (existingParticipant.connection_status !== 'connected') {
            console.log('[RECONNECT] Existing participant found but not active — restoring/updating to connected');
            const { error: updErr } = await supabase
              .from('participants')
              .update({
                connection_status: 'connected',
                reconnected_at: new Date().toISOString(),
                disconnected_at: null
              })
              .eq('id', existingParticipant.id);

            if (updErr) {
              console.error('[RECONNECT] Failed to update participant on reconnect:', updErr);
            } else {
              console.log('[RECONNECT] Participant restored to connected');
            }

            // If user is the host reconnecting, mark room as active
            if (existingParticipant.is_host) {
              console.log('[RECONNECT] Host reconnecting, marking room as active');
              const { error: roomUpdateError } = await supabase
                .from('rooms')
                .update({ is_active: true })
                .eq('id', room.id);

              if (roomUpdateError) {
                console.error('[RECONNECT] Failed to mark room as active:', roomUpdateError);
              } else {
                console.log('[RECONNECT] Room marked as active');
                // Update local room state
                setCurrentRoom(prev => prev ? { ...prev, is_active: true } : null);
              }
            }
          } else {
            console.log('[RECONNECT] User already an active participant');
          }
        } else {
          console.log('[RECONNECT] No existing participant record, creating a new participant record');
          const isHost = room.host_user_id === session.user_id;

          const { error: insertError } = await supabase
            .from('participants')
            .insert({
              room_id: room.id,
              user_id: session.user_id,
              is_host: isHost,
              connection_status: 'connected',
            });

          if (insertError) {
            console.error('[RECONNECT] Failed to rejoin as participant:', insertError);
            throw new Error('Failed to rejoin room');
          }

          console.log('[RECONNECT] Successfully rejoined as participant');

          // If user is the host, mark room as active
          if (isHost) {
            console.log('[RECONNECT] Host rejoining, marking room as active');
            const { error: roomUpdateError } = await supabase
              .from('rooms')
              .update({ is_active: true })
              .eq('id', room.id);

            if (roomUpdateError) {
              console.error('[RECONNECT] Failed to mark room as active:', roomUpdateError);
            } else {
              console.log('[RECONNECT] Room marked as active');
              // Update local room state
              setCurrentRoom(prev => prev ? { ...prev, is_active: true } : null);
            }
          }
        }

        // Clean up any old sessionStorage flags
        if (room.host_user_id === session.user_id) {
          sessionStorage.removeItem('host_pending_termination');
          console.log('[RECONNECT] Host reconnected successfully');
        }
      }

      // Load participants (only connected ones)
      console.log('[RECONNECT] Loading participants for room:', room.id);
      await loadParticipants(room.id);

      // Subscribe to realtime updates
      console.log('[RECONNECT] Subscribing to room realtime updates');
      subscribeToRoom(room.id);

      console.log('[RECONNECT] Reconnect completed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reconnect to room';
      console.error('[RECONNECT] Error:', err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session, loadParticipants, subscribeToRoom]);
  
  /**
   * Reconnect to an existing room (on page refresh)
   */
  /* const reconnectToRoom = useCallback(async (code: string): Promise<void> => {
    console.log('[RECONNECT] Starting reconnect to room:', code);
    setIsLoading(true);
    setError(null);

    try {
      // Get room details
      console.log('[RECONNECT] Fetching room details');
      const response = await fetch(`/api/rooms?action=get&code=${code}`);

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        console.error('[RECONNECT] Failed to fetch room:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to load room');
      }

      const room: Room = await response.json();
      console.log('[RECONNECT] Room loaded:', room);
      console.log('[RECONNECT] Session:', session);

      // Debug: Check sessionStorage for unload event data
      console.log('[RECONNECT] SessionStorage debug:', {
        isClosing: sessionStorage.getItem('isClosing'),
        beforeunload_time: sessionStorage.getItem('beforeunload_time'),
        cleared_by_timeout: sessionStorage.getItem('cleared_by_timeout'),
        unload_triggered: sessionStorage.getItem('unload_triggered'),
        unload_isClosing: sessionStorage.getItem('unload_isClosing'),
        terminating_room: sessionStorage.getItem('terminating_room'),
      });

      setCurrentRoom(room);

      // Check if user needs to rejoin as participant
      if (session) {
        console.log('[RECONNECT] User is authenticated, checking participant status');

        // Check if user is already an active participant
        const { data: existingParticipant } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', session.user_id)
          .is('left_at', null)
          .single();

        if (!existingParticipant) {
          console.log('[RECONNECT] User not an active participant, rejoining');

          // Rejoin the room (this will create a new participant record)
          const isHost = room.host_user_id === session.user_id;

          const { error: insertError } = await supabase
            .from('participants')
            .insert({
              room_id: room.id,
              user_id: session.user_id,
              is_host: isHost,
              connection_status: 'connected',
            });

          if (insertError) {
            console.error('[RECONNECT] Failed to rejoin as participant:', insertError);
            throw new Error('Failed to rejoin room');
          }

          console.log('[RECONNECT] Successfully rejoined as participant');
        } else {
          console.log('[RECONNECT] User already an active participant');
        }
      }

      // Load participants
      console.log('[RECONNECT] Loading participants for room:', room.id);
      await loadParticipants(room.id);

      // Subscribe to realtime updates
      console.log('[RECONNECT] Subscribing to room realtime updates');
      subscribeToRoom(room.id);

      console.log('[RECONNECT] Reconnect completed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reconnect to room';
      console.error('[RECONNECT] Error:', err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session, loadParticipants, subscribeToRoom]); */

  /**
   * Leave the current room
   */
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    setIsLoading(true);
    setError(null);

    try {
      // If user is host, terminate the entire room
      if (session && currentRoom.host_user_id === session.user_id) {
        const response = await fetch('/api/rooms?action=terminate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_id: currentRoom.id,
            host_user_id: session.user_id,
          }),
        });

        if (!response.ok) {
          const errorData: ApiErrorResponse = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to terminate room');
        }
      } else {
        // Guest leaving - mark as disconnected (not permanent delete)
        const participant = participants.find(
          p => session ? p.user_id === session.user_id : p.nickname
        );

        if (participant) {
          const { error: updateError } = await supabase
            .from('participants')
            .update({
              connection_status: 'disconnected',
              disconnected_at: new Date().toISOString()
            })
            .eq('id', participant.id);

          if (updateError) {
            console.error('[LEAVE_ROOM] Failed to update participant status:', updateError);
            throw updateError;
          }

          console.log('[LEAVE_ROOM] Guest marked as disconnected');
        }
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
    reconnectToRoom,
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