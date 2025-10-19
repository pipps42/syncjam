import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import './CreateRoom.css';

export function CreateRoom() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { createRoom } = useRoom();
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    if (!session?.is_premium) {
      setError('Only Spotify Premium users can host rooms');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const room = await createRoom(roomName.trim());
      navigate(`/room/${room.code}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsCreating(false);
    }
  }

  return (
    <div className="create-room-container">
      <div className="create-room-card">
        <div className="card-header">
          <h2>Create a Room</h2>
          <p>Start a listening session with friends</p>
        </div>

        <form onSubmit={handleCreateRoom} className="create-room-form">
          <div className="form-group">
            <label htmlFor="room-name">Room Name</label>
            <input
              id="room-name"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Friday Night Vibes"
              maxLength={50}
              disabled={isCreating}
              autoFocus
            />
            <span className="input-hint">{roomName.length}/50 characters</span>
          </div>

          {!session?.is_premium && (
            <div className="premium-warning">
              <span className="warning-icon">⚠️</span>
              <p>You need Spotify Premium to host rooms</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">✕</span>
              <p>{error}</p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate('/')}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isCreating || !session?.is_premium}
            >
              {isCreating ? (
                <>
                  <span className="spinner-small"></span>
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
        </form>

        <div className="room-features">
          <h3>Your room will have:</h3>
          <ul>
            <li>
              <span className="feature-icon">🔗</span>
              <span>Unique 6-character code for easy sharing</span>
            </li>
            <li>
              <span className="feature-icon">🎵</span>
              <span>Synchronized playback for all participants</span>
            </li>
            <li>
              <span className="feature-icon">👥</span>
              <span>Support for up to 20 participants</span>
            </li>
            <li>
              <span className="feature-icon">🎧</span>
              <span>Audio streaming for non-Premium guests</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}