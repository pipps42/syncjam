import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import './JoinRoom.css';

export function JoinRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { joinRoom } = useRoom();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill room code from URL if present
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      const cleaned = codeFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleaned.length <= 6) {
        setRoomCode(cleaned);
      }
    }
  }, [searchParams]);

  // If user is not authenticated, they need to provide a nickname
  const isAnonymous = !session;

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();

    const cleanCode = roomCode.trim().toUpperCase();
    
    if (!cleanCode) {
      setError('Please enter a room code');
      return;
    }

    if (cleanCode.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }

    if (isAnonymous && !nickname.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      await joinRoom(cleanCode, isAnonymous ? nickname.trim() : undefined);
      navigate(`/room/${cleanCode}`);
    } catch (err) {
      console.error('Failed to join room:', err);
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsJoining(false);
    }
  }

  function handleCodeInput(value: string) {
    // Only allow alphanumeric characters and auto-uppercase
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length <= 6) {
      setRoomCode(cleaned);
    }
  }

  return (
    <div className="join-room-container">
      <div className="join-room-card">
        <div className="card-header">
          <h2>Join a Room</h2>
          <p>Enter the room code to start listening</p>
        </div>

        <form onSubmit={handleJoinRoom} className="join-room-form">
          <div className="form-group">
            <label htmlFor="room-code">Room Code</label>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={(e) => handleCodeInput(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              disabled={isJoining}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              className="room-code-input"
            />
            <span className="input-hint">6-character code from the host</span>
          </div>

          {isAnonymous && (
            <div className="form-group">
              <label htmlFor="nickname">Your Name</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                disabled={isJoining}
              />
              <span className="input-hint">This is how others will see you</span>
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
              disabled={isJoining}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isJoining}
            >
              {isJoining ? (
                <>
                  <span className="spinner-small"></span>
                  Joining...
                </>
              ) : (
                'Join Room'
              )}
            </button>
          </div>
        </form>

        {!session && (
          <div className="auth-suggestion">
            <p>Want to access your Spotify library?</p>
            <button
              className="link-button"
              onClick={() => navigate('/login')}
              disabled={isJoining}
            >
              Sign in with Spotify
            </button>
          </div>
        )}

        {session && !session.is_premium && (
          <div className="info-message">
            <span className="info-icon">ℹ️</span>
            <p>
              As a free Spotify user, you'll hear the music through the host's audio stream.
              For the best experience, consider upgrading to Spotify Premium.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}