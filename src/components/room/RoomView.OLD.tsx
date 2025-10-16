import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import './RoomView.css';

export function RoomView() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { currentRoom, participants, isHost, leaveRoom } = useRoom();
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    // Load room data if not already loaded
    if (!currentRoom || currentRoom.code !== code) {
      // This will be handled by RoomContext
      console.log('Loading room:', code);
    }
  }, [code, currentRoom, navigate]);

  async function handleLeaveRoom() {
    try {
      await leaveRoom();
      navigate('/');
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  }

  async function copyRoomCode() {
    if (!currentRoom) return;
    
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function copyShareLink() {
    if (!currentRoom) return;
    
    const shareUrl = `${window.location.origin}/join?code=${currentRoom.code}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  if (!currentRoom) {
    return (
      <div className="room-loading">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  const activeParticipants = participants.filter(p => !p.left_at);
  const connectedCount = activeParticipants.filter(p => p.connection_status === 'connected').length;

  return (
    <div className="room-view-container">
      {/* Room Header */}
      <header className="room-header">
        <div className="room-info">
          <h1>{currentRoom.name}</h1>
          <div className="room-code-display">
            <span className="room-code">{currentRoom.code}</span>
            <button
              className="copy-button"
              onClick={copyRoomCode}
              title="Copy room code"
            >
              {showCopied ? '✓' : '📋'}
            </button>
          </div>
        </div>
        
        <div className="room-actions">
          {isHost && (
            <button className="host-badge">
              👑 Host
            </button>
          )}
          <button
            className="share-button"
            onClick={copyShareLink}
          >
            Share Link
          </button>
          <button
            className="leave-button"
            onClick={handleLeaveRoom}
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="room-content">
        {/* Participants Panel */}
        <aside className="participants-panel">
          <div className="panel-header">
            <h2>Participants ({connectedCount}/{activeParticipants.length})</h2>
          </div>
          
          <ul className="participants-list">
            {activeParticipants.map((participant) => (
              <li
                key={participant.id}
                className={`participant-item ${participant.connection_status}`}
              >
                <div className="participant-info">
                  <span className="participant-status-dot"></span>
                  <span className="participant-name">
                    {participant.nickname || participant.spotify_user?.display_name || 'Anonymous'}
                    {participant.is_host && (
                      <span className="host-indicator" title="Room Host">👑</span>
                    )}
                  </span>
                </div>
                {participant.spotify_user?.product === 'premium' && (
                  <span className="premium-badge" title="Spotify Premium">
                    Premium
                  </span>
                )}
              </li>
            ))}
          </ul>

          {currentRoom.settings?.max_participants && activeParticipants.length >= currentRoom.settings.max_participants && (
            <div className="room-full-notice">
              <p>Room is full</p>
            </div>
          )}
        </aside>

        {/* Player and Queue Area */}
        <main className="main-content">
          <div className="placeholder-content">
            <div className="placeholder-icon">🎵</div>
            <h2>Room is Ready!</h2>
            <p>
              {isHost 
                ? "You're the host. Start playing music to begin the listening session."
                : "Waiting for the host to start playing music..."}
            </p>
            
            <div className="room-stats">
              <div className="stat-item">
                <span className="stat-label">Room Code</span>
                <span className="stat-value">{currentRoom.code}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Connected</span>
                <span className="stat-value">{connectedCount} users</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Created</span>
                <span className="stat-value">
                  {new Date(currentRoom.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {!session && (
              <div className="guest-notice">
                <p>
                  You're listening as a guest. 
                  <button
                    className="link-inline"
                    onClick={() => navigate('/login', { state: { returnTo: `/room/${code}` } })}
                  >
                    Sign in with Spotify
                  </button> 
                  to access your library.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Notification for copied text */}
      {showCopied && (
        <div className="toast-notification">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}