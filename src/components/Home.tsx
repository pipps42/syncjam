import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MyRoomBanner } from './MyRoomBanner';
import { PublicRoomsList } from './PublicRoomsList';
import { Avatar, Button } from './common';
import { Headphones, Users, LogOut } from 'lucide-react';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
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
          <h1 className="app-logo">
            <span className="logo-icon">🎵</span> SyncJam
          </h1>

          {session ? (
            <div className="user-menu">
              <Avatar
                src={session.spotify_user.images[0]?.url}
                name={session.spotify_user.display_name}
                size="sm"
              />
              <span className="user-name">{session.spotify_user.display_name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                icon={<LogOut size={16} />}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Button
              variant="spotify"
              size="sm"
              onClick={() => navigate('/login')}
            >
              Sign in with Spotify
            </Button>
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
                <div className="card-icon">
                  <Headphones size={48} strokeWidth={1.5} />
                </div>
                <h3>Host a Room</h3>
                <p>Start a listening session and invite friends with a simple code</p>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleCreateRoom}
                  disabled={session ? !session.is_premium : false}
                >
                  Create Room
                </Button>
                {session && !session.is_premium && (
                  <span className="requirement-note">Requires Spotify Premium</span>
                )}
                {!session && (
                  <span className="requirement-note">Login required</span>
                )}
              </div>

              {/* Join Room Card */}
              <div className="action-card join-card">
                <div className="card-icon">
                  <Users size={48} strokeWidth={1.5} />
                </div>
                <h3>Join a Room</h3>
                <p>Enter a room code to join an active listening session</p>
                <form onSubmit={handleQuickJoin} className="quick-join-form">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => handleCodeInput(e.target.value)}
                    placeholder="ABC123"
                    maxLength={6}
                    className="room-code-input"
                    autoCapitalize="characters"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={roomCode.length !== 6}
                  >
                    Join
                  </Button>
                </form>
              </div>
            </div>

            {/* Public Rooms List */}
            <PublicRoomsList />
          </div>
        </div>
      </main>
    </div>
  );
}
