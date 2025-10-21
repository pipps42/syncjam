import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import type { WebRTCSignal } from '../types/playback';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WebRTCContextValue {
  // State
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'failed';
  peerCount: number;

  // Audio output (for guests receiving stream)
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;

  // Set audio stream (for host)
  setAudioStream: (stream: MediaStream | null) => void;
}

const WebRTCContext = createContext<WebRTCContextValue | undefined>(undefined);

interface WebRTCProviderProps {
  children: ReactNode;
}

// ICE servers configuration
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function WebRTCProvider({ children }: WebRTCProviderProps) {
  const { session } = useAuth();
  const { currentRoom, participants, isHost } = useRoom();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('disconnected');
  const [peerCount, setPeerCount] = useState(0);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);

  /**
   * Setup signaling channel via Supabase Realtime
   */
  useEffect(() => {
    if (!currentRoom) return;

    console.log('[WebRTC] Setting up signaling channel for room:', currentRoom.id);

    // Remove previous channel
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
    }

    // Create new channel
    const channel = supabase.channel(`webrtc:${currentRoom.id}`);

    // Listen for WebRTC signals
    channel.on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
      handleSignal(payload as WebRTCSignal);
    });

    channel.subscribe((status) => {
      console.log('[WebRTC] Signaling channel status:', status);
    });

    signalingChannelRef.current = channel;

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentRoom]);

  /**
   * Host: Create peer connections to all guests when audio stream is available
   */
  useEffect(() => {
    if (!isHost || !audioStream || !currentRoom) {
      return;
    }

    console.log('[WebRTC] Host creating peer connections for', participants.length, 'participants');

    // Create peer connection for each guest
    participants.forEach((participant) => {
      // Skip self
      if (participant.is_host) return;

      const guestId = participant.user_id || participant.id;

      // Skip if already connected
      if (peerConnectionsRef.current.has(guestId)) {
        console.log('[WebRTC] Already connected to guest:', guestId);
        return;
      }

      console.log('[WebRTC] Creating peer connection for guest:', guestId);
      createPeerConnection(guestId, true); // true = host (creates offer)
    });

    // Cleanup disconnected guests
    const activeGuestIds = participants
      .filter(p => !p.is_host)
      .map(p => p.user_id || p.id);

    peerConnectionsRef.current.forEach((_, guestId) => {
      if (!activeGuestIds.includes(guestId)) {
        console.log('[WebRTC] Removing peer connection for disconnected guest:', guestId);
        closePeerConnection(guestId);
      }
    });

    setPeerCount(peerConnectionsRef.current.size);
  }, [isHost, audioStream, participants, currentRoom]);

  /**
   * Guest: Wait for offer from host
   * (handled via signaling channel listener)
   */

  /**
   * Create a peer connection
   */
  const createPeerConnection = useCallback(async (peerId: string, isInitiator: boolean) => {
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add audio stream tracks (host only)
      if (isInitiator && audioStream) {
        audioStream.getTracks().forEach(track => {
          pc.addTrack(track, audioStream);
          console.log('[WebRTC] Added audio track to peer connection');
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] Sending ICE candidate to', peerId);
          sendSignal({
            type: 'ice-candidate',
            from_user_id: session?.user_id || 'anonymous',
            to_user_id: peerId,
            data: event.candidate.toJSON()
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);

        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
          setIsConnected(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionStatus('failed');
          setIsConnected(false);
        } else if (pc.connectionState === 'connecting') {
          setConnectionStatus('connecting');
        }
      };

      // Handle incoming tracks (guest only)
      if (!isInitiator) {
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote track');

          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(err => {
              console.error('[WebRTC] Failed to play remote audio:', err);
            });
          }
        };
      }

      // Store peer connection
      peerConnectionsRef.current.set(peerId, pc);

      // If initiator (host), create and send offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('[WebRTC] Sending offer to', peerId);
        sendSignal({
          type: 'offer',
          from_user_id: session?.user_id || 'host',
          to_user_id: peerId,
          data: offer
        });
      }

      setPeerCount(peerConnectionsRef.current.size);
    } catch (error) {
      console.error('[WebRTC] Failed to create peer connection:', error);
      setConnectionStatus('failed');
    }
  }, [audioStream, session]);

  /**
   * Close a peer connection
   */
  const closePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);

    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
      setPeerCount(peerConnectionsRef.current.size);
    }
  }, []);

  /**
   * Handle incoming WebRTC signals
   */
  const handleSignal = useCallback(async (signal: WebRTCSignal) => {
    const myId = session?.user_id || 'anonymous';

    // Ignore signals not meant for us (unless it's a broadcast offer from host)
    if (signal.to_user_id && signal.to_user_id !== myId) {
      return;
    }

    console.log('[WebRTC] Received signal:', signal.type, 'from', signal.from_user_id);

    try {
      if (signal.type === 'offer') {
        // Guest receives offer from host
        const pc = peerConnectionsRef.current.get(signal.from_user_id);

        if (!pc) {
          // Create new peer connection if doesn't exist
          await createPeerConnection(signal.from_user_id, false);
        }

        const peerConnection = peerConnectionsRef.current.get(signal.from_user_id);

        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));

          // Create and send answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          console.log('[WebRTC] Sending answer to', signal.from_user_id);
          sendSignal({
            type: 'answer',
            from_user_id: myId,
            to_user_id: signal.from_user_id,
            data: answer
          });
        }
      } else if (signal.type === 'answer') {
        // Host receives answer from guest
        const pc = peerConnectionsRef.current.get(signal.from_user_id);

        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
          console.log('[WebRTC] Answer accepted from', signal.from_user_id);
        }
      } else if (signal.type === 'ice-candidate') {
        // Both host and guest can receive ICE candidates
        const pc = peerConnectionsRef.current.get(signal.from_user_id);

        if (pc && signal.data) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
          console.log('[WebRTC] ICE candidate added from', signal.from_user_id);
        }
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle signal:', error);
    }
  }, [session, createPeerConnection]);

  /**
   * Send a signal via Supabase Realtime broadcast
   */
  const sendSignal = useCallback((signal: WebRTCSignal) => {
    if (!signalingChannelRef.current) {
      console.error('[WebRTC] No signaling channel available');
      return;
    }

    signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: signal
    });
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, []);

  const value: WebRTCContextValue = {
    isConnected,
    connectionStatus,
    peerCount,
    remoteAudioRef,
    setAudioStream
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
      {/* Hidden audio element for guests to receive remote stream */}
      {!isHost && <audio ref={remoteAudioRef} autoPlay />}
    </WebRTCContext.Provider>
  );
}

export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (context === undefined) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
}
