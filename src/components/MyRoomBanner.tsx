import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { Button } from './common';
import { Crown, Users, DoorOpen } from 'lucide-react';
import './MyRoomBanner.css';

interface MyRoomData {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  participant_count: number;
  created_at: string;
}

interface MyRoomResponse {
  room: MyRoomData | null;
  has_room: boolean;
}

export function MyRoomBanner() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { reconnectToRoom } = useRoom();
  const [room, setRoom] = useState<MyRoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }

    loadMyRoom();

    // Refresh every 10 seconds
    const interval = setInterval(loadMyRoom, 10000);
    return () => clearInterval(interval);
  }, [session]);

  async function loadMyRoom() {
    if (!session) return;

    try {
      const response = await fetch(`/api/rooms?action=my-room&user_id=${session.user_id}`);

      if (!response.ok) {
        throw new Error('Failed to load your room');
      }

      const data: MyRoomResponse = await response.json();
      setRoom(data.room);
    } catch (err) {
      console.error('Error loading my room:', err);
      setRoom(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTerminateRoom() {
    if (!room || !session) return;

    const confirmed = window.confirm(
      'Are you sure you want to terminate this room? All participants will be disconnected.'
    );

    if (!confirmed) return;

    setIsTerminating(true);

    try {
      const response = await fetch('/api/rooms?action=terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: room.id,
          host_user_id: session.user_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to terminate room');
      }

      // Room terminated successfully
      setRoom(null);
    } catch (err) {
      console.error('Error terminating room:', err);
      alert(err instanceof Error ? err.message : 'Failed to terminate room');
    } finally {
      setIsTerminating(false);
    }
  }

  async function handleGoToRoom() {
    if (!room) return;

    setIsReconnecting(true);

    try {
      // Reconnect to room first (this sets currentRoom in context)
      await reconnectToRoom(room.code);

      // Then navigate to the room view
      navigate(`/room/${room.code}`);
    } catch (err) {
      console.error('Error reconnecting to room:', err);
      alert(err instanceof Error ? err.message : 'Failed to enter room');
    } finally {
      setIsReconnecting(false);
    }
  }

  // Don't render if not logged in
  if (!session) {
    return null;
  }

  // Don't render while loading
  if (isLoading) {
    return null;
  }

  // Don't render if user has no room
  if (!room) {
    return null;
  }

  return (
    <div className="my-room-banner">
      <div className="banner-content">
        <div className="banner-info">
          <div className="banner-header">
            <Crown size={24} />
            <h3 className="banner-title">Your Hosted Room</h3>
          </div>

          <div className="room-details">
            <span className="room-name">{room.name}</span>
            <span className="code-highlight">{room.code}</span>
          </div>

          <div className="room-meta">
            <span className="detail-item">
              <Users size={16} />
              {room.participant_count} {room.participant_count === 1 ? 'participant' : 'participants'}
            </span>
          </div>
        </div>

        <div className="banner-actions">
          <Button
            variant="primary"
            onClick={handleGoToRoom}
            disabled={isReconnecting}
            isLoading={isReconnecting}
          >
            Go to Room
          </Button>
          <Button
            variant="danger"
            onClick={handleTerminateRoom}
            disabled={isTerminating || isReconnecting}
            isLoading={isTerminating}
            icon={<DoorOpen size={16} />}
          >
            Terminate
          </Button>
        </div>
      </div>
    </div>
  );
}
