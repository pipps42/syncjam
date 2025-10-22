import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RoomProvider } from './contexts/RoomContext';
import { PlaybackProvider } from './contexts/PlaybackContext';
import { WebRTCProvider } from './contexts/WebRTCContext';
import { Login, OAuthCallback } from './components/auth';
import { Home } from './components/Home';
import { CreateRoom } from './components/room/CreateRoom';
import { JoinRoom } from './components/room/JoinRoom';
import { RoomView } from './components/room/RoomView';

/**
 * Loading component
 */
function LoadingScreen() {
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

/**
 * Protected route wrapper for host-only routes
 * Requires authentication AND Spotify Premium
 */
function HostOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ returnTo: '/create' }} />;
  }

  if (!session.is_premium) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Join route handler - supports both authenticated and anonymous users
 * Room code from URL query params is handled in JoinRoom component
 */
function JoinRoomHandler() {
  return <JoinRoom />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <PlaybackProvider>
            <WebRTCProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/callback" element={<OAuthCallback />} />

                {/* Home - accessible to everyone */}
                <Route path="/" element={<Home />} />

                {/* Create room - requires Premium */}
                <Route
                  path="/create"
                  element={
                    <HostOnlyRoute>
                      <CreateRoom />
                    </HostOnlyRoute>
                  }
                />

                {/* Join room - accessible to everyone (anonymous or authenticated) */}
                <Route path="/join" element={<JoinRoomHandler />} />

                {/* Room view - accessible to everyone who joined */}
                <Route path="/room/:code" element={<RoomView />} />

                {/* Catch all - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </WebRTCProvider>
          </PlaybackProvider>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
