import { useAuth } from '../../contexts/AuthContext';
import { Button, SpotifyIcon } from '../common';
import { Music, Users, Headphones } from 'lucide-react';
import './Login.css';

export function Login() {
  const { login, isLoading } = useAuth();

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <div className="logo-icon">
            <Music size={48} />
          </div>
          <h1 className="app-title">SyncJam</h1>
          <p className="app-tagline">Listen together, stay in sync</p>
        </div>

        <div className="features-section">
          <div className="feature">
            <div className="feature-icon">
              <Music size={24} />
            </div>
            <p>Synchronized playback across all devices</p>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <Users size={24} />
            </div>
            <p>Listen with friends in real-time</p>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <Headphones size={24} />
            </div>
            <p>No Premium? No problem - we stream to you</p>
          </div>
        </div>

        <Button
          variant="spotify"
          fullWidth
          onClick={login}
          disabled={isLoading}
          isLoading={isLoading}
          icon={<SpotifyIcon size={20} className="spotify-icon" />}
        >
          Continue with Spotify
        </Button>

        <p className="disclaimer">
          By continuing, you agree to let SyncJam access your Spotify account.
          <br />
          <strong>Host users require Spotify Premium.</strong>
        </p>
      </div>
    </div>
  );
}
