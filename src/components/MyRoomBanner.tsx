import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
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
      const response = await fetch(`/api/rooms/my-room?user_id=${session.user_id}`);

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
      const response = await fetch('/api/rooms/terminate', {
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
    <div className={`my-room-banner ${room.is_active ? 'active' : 'inactive'}`}>
      <div className="banner-content">
        <div className="banner-icon">
          <span>👑</span>
        </div>

        <div className="banner-info">
          <div className="banner-header">
            <h3 className="banner-title">Your Hosted Room</h3>
            <span className={`status-badge ${room.is_active ? 'active' : 'inactive'}`}>
              {room.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="room-details">
            <span className="detail-item room-name-detail">
              <strong>{room.name}</strong>
            </span>
            <span className="detail-item">
              Code: <strong className="code-highlight">{room.code}</strong>
            </span>
            <span className="detail-item">
              <span className="participant-icon">👥</span>
              {room.participant_count} {room.participant_count === 1 ? 'participant' : 'participants'}
            </span>
          </div>
        </div>

        <div className="banner-actions">
          <button
            className="go-to-room-button"
            onClick={handleGoToRoom}
            disabled={isReconnecting}
          >
            {isReconnecting ? 'Connecting...' : 'Go to Room'}
          </button>
          <button
            className="terminate-button"
            onClick={handleTerminateRoom}
            disabled={isTerminating || isReconnecting}
          >
            {isTerminating ? 'Terminating...' : 'Terminate'}
          </button>
        </div>
      </div>
    </div>
  );
}
