import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login, OAuthCallback } from './components/auth';

/**
 * Protected route wrapper
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#64748b'
      }}>
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/**
 * Temporary home component (placeholder)
 * Will be replaced with room creation/join UI
 */
function Home() {
  const { session, logout } = useAuth();

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1>Welcome to SyncJam!</h1>
      <p>You're logged in as: <strong>{session?.spotify_user.display_name}</strong></p>
      <p>Email: {session?.spotify_user.email}</p>
      <p>
        Account type: {' '}
        <strong style={{ color: session?.is_premium ? '#1db954' : '#f97316' }}>
          {session?.is_premium ? 'Premium ✓' : 'Free'}
        </strong>
      </p>
      <button
        onClick={logout}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>

      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: '#f8fafc',
        borderRadius: '0.75rem',
        border: '2px dashed #cbd5e1'
      }}>
        <h2 style={{ marginTop: 0 }}>🚧 Next Steps:</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>Create room creation UI</li>
          <li>Implement room joining</li>
          <li>Setup Spotify Web Playback SDK</li>
          <li>Build playback controls</li>
          <li>Implement WebRTC audio streaming</li>
        </ul>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 0 }}>
          See <strong>VISION_AND_TASKS.md</strong> for the full roadmap
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<OAuthCallback />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
