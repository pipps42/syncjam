import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MyRoomBanner } from './MyRoomBanner';
import { PublicRoomsList } from './PublicRoomsList';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  function handleCreateRoom() {
    navigate('/create');
  }

  function handleQuickJoin(e: React.FormEvent) {
    e.preventDefault();
    if (roomCode.trim()) {
      navigate(`/join?code=${roomCode.trim().toUpperCase()}`);
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
    <div className="home-container">
      {/* Header with user info */}
      <header className="home-header">
        <div className="header-content">
          <h1 className="app-logo">🎵 SyncJam</h1>
          
          {session && (
            <div className="user-menu">
              <div className="user-info">
                <span className="user-name">{session.spotify_user.display_name}</span>
                {session.is_premium && (
                  <span className="premium-badge">Premium</span>
                )}
              </div>
              <button className="logout-button" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="home-main">
        <div className="hero-section">
          <div className="hero-content">
            {/* My Room Banner - shown if user is hosting a room */}
            <MyRoomBanner />

            <h2 className="hero-title">
              Listen Together,<br />
              <span className="gradient-text">Stay in Sync</span>
            </h2>
            <p className="hero-subtitle">
              Create or join a room to enjoy synchronized music with friends.
              Everyone hears the same beat at the same time.
            </p>

            {/* Main Actions */}
            <div className="action-cards">
              {/* Create Room Card */}
              <div className="action-card create-card">
                <div className="card-icon">🎧</div>
                <h3>Host a Room</h3>
                <p>Start a listening session and invite friends with a simple code</p>
                <button
                  className="action-button primary"
                  onClick={handleCreateRoom}
                  disabled={session ? !session.is_premium : false}
                >
                  Create Room
                </button>
                {session && !session.is_premium && (
                  <span className="requirement-note">Requires Spotify Premium</span>
                )}
                {!session && (
                  <span className="requirement-note">Login required</span>
                )}
              </div>

              {/* Join Room Card */}
              <div className="action-card join-card">
                <div className="card-icon">👥</div>
                <h3>Join a Room</h3>
                <p>Enter a room code to join an active listening session</p>
                <form onSubmit={handleQuickJoin} className="quick-join-form">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => handleCodeInput(e.target.value)}
                    placeholder="Room Code"
                    maxLength={6}
                    className="room-code-input"
                    autoCapitalize="characters"
                  />
                  <button
                    type="submit"
                    className="action-button secondary"
                    disabled={roomCode.length !== 6}
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>

            {/* Feature List */}
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-emoji">🔊</span>
                <div>
                  <h4>WebRTC Audio Streaming</h4>
                  <p>Non-Premium users can listen via host's stream</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-emoji">⚡</span>
                <div>
                  <h4>Real-time Sync</h4>
                  <p>Everyone stays perfectly in sync, no delays</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-emoji">📱</span>
                <div>
                  <h4>Works Everywhere</h4>
                  <p>Mobile-first design works on any device</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-emoji">🎵</span>
                <div>
                  <h4>Queue & Voting</h4>
                  <p>Everyone can add songs and vote on what's next</p>
                </div>
              </div>
            </div>

            {/* Sign in prompt for non-authenticated users */}
            {!session && (
              <div className="auth-prompt">
                <p>
                  Want the full experience?
                  <button
                    className="link-button"
                    onClick={() => navigate('/login')}
                  >
                    Sign in with Spotify
                  </button>
                </p>
              </div>
            )}

            {/* Public Rooms List */}
            <PublicRoomsList />
          </div>
        </div>

        {/* Quick Join Modal */}
        {showJoinModal && (
          <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Join a Room</h3>
              <p>Enter the 6-character room code</p>
              <form onSubmit={handleQuickJoin}>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => handleCodeInput(e.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                  className="modal-input"
                  autoFocus
                  autoCapitalize="characters"
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button-cancel"
                    onClick={() => setShowJoinModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button-confirm"
                    disabled={roomCode.length !== 6}
                  >
                    Join Room
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}