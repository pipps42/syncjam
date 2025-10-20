import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Avatar, Badge, Button } from './common';
import { Music, Users, RefreshCw, AlertCircle } from 'lucide-react';
import './PublicRoomsList.css';

interface PublicRoom {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  created_at: string;
  is_active: boolean;
  is_public: boolean;
  host_display_name: string | null;
  host_avatar_url: string | null;
  participant_count: number;
}

interface PublicRoomsResponse {
  rooms: PublicRoom[];
  count: number;
}

export function PublicRoomsList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicRooms();

    // Refresh every 10 seconds
    const interval = setInterval(loadPublicRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadPublicRooms() {
    try {
      const response = await fetch('/api/rooms?action=list');

      if (!response.ok) {
        throw new Error('Failed to load rooms');
      }

      const data: PublicRoomsResponse = await response.json();
      setRooms(data.rooms);
      setError(null);
    } catch (err) {
      console.error('Error loading public rooms:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }

  function handleJoinRoom(code: string) {
    navigate(`/join?code=${code}`);
  }

  if (isLoading) {
    return (
      <div className="public-rooms-section">
        <h3 className="section-title">Public Rooms</h3>
        <div className="loading-state">
          <div className="spinner-small"></div>
          <p>Loading rooms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-rooms-section">
        <h3 className="section-title">Public Rooms</h3>
        <div className="error-state">
          <AlertCircle size={32} className="error-icon" />
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadPublicRooms}
            icon={<RefreshCw size={16} />}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="public-rooms-section">
        <h3 className="section-title">Public Rooms</h3>
        <div className="empty-rooms-state">
          <Music size={48} className="empty-icon" />
          <p>No public rooms available</p>
          <p className="empty-subtitle">Be the first to create one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-rooms-section">
      <h3 className="section-title">
        Public Rooms
        <Badge variant="info" size="sm">{rooms.length}</Badge>
      </h3>

      <div className="rooms-grid">
        {rooms.map((room) => (
          <Card key={room.id} variant="elevated" padding="lg" hoverable>
            <div className="room-card-header">
              <h4 className="room-name">{room.name}</h4>
              <Badge variant="default" size="sm">
                <span className="code-text">{room.code}</span>
              </Badge>
            </div>

            <div className="room-host-info">
              <Avatar
                src={room.host_avatar_url}
                name={room.host_display_name || 'Unknown'}
                size="md"
              />
              <div className="host-details">
                <span className="host-label">Hosted by</span>
                <span className="host-name">{room.host_display_name || 'Unknown'}</span>
              </div>
            </div>

            <div className="room-footer">
              <div className="participant-info">
                <Users size={16} />
                <span className="participant-count">{room.participant_count}</span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleJoinRoom(room.code)}
              >
                Join
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
