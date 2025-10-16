import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoom } from '../../contexts/RoomContext';
import './RoomViewMobile.css';

type ActiveTab = 'queue' | 'search' | 'participants' | 'chat';

export function RoomView() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentRoom, participants, isHost, leaveRoom } = useRoom();
  const [showCopied, setShowCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    // Load room data if not already loaded
    if (!currentRoom || currentRoom.code !== code) {
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
    <div className="room-view-mobile">
      {/* Mobile Header */}
      <header className="room-header-mobile">
        <div className="room-title-section">
          <h1>{currentRoom.name}</h1>
          <div className="room-code-badge">
            <span className="room-code">{currentRoom.code}</span>
          </div>
        </div>
        <div className="room-header-actions">
          {isHost && (
            <span className="host-badge-small">👑</span>
          )}
          <button
            className="share-button-icon"
            onClick={copyShareLink}
            title="Share room"
          >
            🔗
          </button>
          <button
            className="leave-button-icon"
            onClick={handleLeaveRoom}
            title="Leave room"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Main Content Area with Tab Switching */}
      <main className="room-main-content">
        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="tab-content queue-content">
            <div className="empty-state">
              <span className="empty-icon">🎵</span>
              <h2>Queue is empty</h2>
              <p>Search for songs to add them to the queue</p>
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="tab-content search-content">
            <div className="search-box">
              <input
                type="search"
                placeholder="Search for songs, artists, albums..."
                className="search-input"
              />
            </div>
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>Search for music to add to the queue</p>
            </div>
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div className="tab-content participants-content">
            <div className="participants-header">
              <h2>Participants</h2>
              <span className="participant-count">{connectedCount} online</span>
            </div>

            <ul className="participants-list-mobile">
              {activeParticipants.map((participant) => (
                <li
                  key={participant.id}
                  className={`participant-item-mobile ${participant.connection_status}`}
                >
                  <div className="participant-avatar">
                    {participant.spotify_user?.display_name?.[0]?.toUpperCase() ||
                     participant.nickname?.[0]?.toUpperCase() ||
                     '?'}
                  </div>
                  <div className="participant-details">
                    <div className="participant-name-row">
                      <span className="participant-name">
                        {participant.nickname || participant.spotify_user?.display_name || 'Anonymous'}
                      </span>
                      {participant.is_host && (
                        <span className="host-badge-inline">👑</span>
                      )}
                    </div>
                    {participant.spotify_user?.product === 'premium' && (
                      <span className="premium-badge-mobile">Premium</span>
                    )}
                  </div>
                  <div className={`status-dot ${participant.connection_status}`}></div>
                </li>
              ))}
            </ul>

            {currentRoom.settings?.max_participants && activeParticipants.length >= currentRoom.settings.max_participants && (
              <div className="room-full-notice">
                <p>Room is full ({currentRoom.settings.max_participants}/{currentRoom.settings.max_participants})</p>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="tab-content chat-content">
            <div className="chat-messages">
              <div className="empty-state">
                <span className="empty-icon">💬</span>
                <p>No messages yet. Start the conversation!</p>
              </div>
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                placeholder="Type a message..."
                className="chat-input"
              />
              <button className="send-button">Send</button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <span className="nav-icon">🎵</span>
          <span className="nav-label">Queue</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">Search</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-label">Participants</span>
          {connectedCount > 0 && (
            <span className="nav-badge">{connectedCount}</span>
          )}
        </button>
        <button
          className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <span className="nav-icon">💬</span>
          <span className="nav-label">Chat</span>
        </button>
      </nav>

      {/* Notification Toast */}
      {showCopied && (
        <div className="toast-notification">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
