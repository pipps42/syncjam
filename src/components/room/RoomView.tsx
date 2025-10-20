import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoom } from '../../contexts/RoomContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar, Badge } from '../common';
import {
  Crown,
  Share2,
  X,
  AlertTriangle,
  Music,
  Search,
  Users,
  MessageCircle
} from 'lucide-react';
import { SearchTab } from './SearchTab';
import { QueueTab } from './QueueTab';
import type { SpotifyTrack } from '../../types/spotify';
import './RoomViewMobile.css';

type ActiveTab = 'queue' | 'search' | 'participants' | 'chat';

export function RoomView() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { currentRoom, participants, isHost, leaveRoom, isLoading, error } = useRoom();
  const [showCopied, setShowCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

  useEffect(() => {
    console.log('[ROOMVIEW] useEffect triggered - code:', code, 'currentRoom:', currentRoom?.code);

    // If no code in URL, redirect to home
    if (!code) {
      console.log('[ROOMVIEW] No code, navigating to home');
      navigate('/');
      return;
    }

    // If currentRoom doesn't match the code in URL, redirect to home
    // The ONLY way to legitimately enter a room is through:
    // 1. Create Room -> sets currentRoom and navigates
    // 2. Join Room -> sets currentRoom and navigates
    // 3. Go to Room (MyRoomBanner) -> calls reconnectToRoom and navigates
    // On refresh or after leaving, currentRoom is null -> redirect to home
    if (!currentRoom || currentRoom.code !== code) {
      console.log('[ROOMVIEW] No valid currentRoom for this code, redirecting to home');
      navigate('/');
      return;
    }

    console.log('[ROOMVIEW] Room loaded successfully:', currentRoom.code);
  }, [code, currentRoom, navigate]);

  // Redirect to home when room becomes null (e.g., terminated by host)
  useEffect(() => {
    if (!currentRoom && code) {
      console.log('[ROOMVIEW] Room was cleared/terminated, redirecting to home');
      navigate('/');
    }
  }, [currentRoom, code, navigate]);

  async function handleLeaveRoom() {
    try {
      await leaveRoom();
      // Clear guest nickname from localStorage when leaving
      localStorage.removeItem('syncjam_guest_nickname');
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
      setToastMessage('Link copied to clipboard!');
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function handleAddToQueue(track: SpotifyTrack) {
    if (!currentRoom) return;

    try {
      // Get current max position
      const { data: maxPosData } = await supabase
        .from('queue_items')
        .select('position')
        .eq('room_id', currentRoom.id)
        .eq('played', false)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = maxPosData && maxPosData.length > 0
        ? maxPosData[0].position + 1
        : 0;

      // Get current user's nickname (only for anonymous users)
      // Authenticated users don't have nickname - they use added_by field instead
      const myNickname = !session ? localStorage.getItem('syncjam_guest_nickname') : null;

      // Insert track into queue using Supabase Direct
      const { error } = await supabase
        .from('queue_items')
        .insert({
          room_id: currentRoom.id,
          track_uri: track.uri,
          added_by: session?.user_id || null,
          added_by_nickname: myNickname,
          position: nextPosition,
          metadata: {
            name: track.name,
            artists: track.artists,
            artistNames: track.artistNames,
            album: track.album,
            albumImage: track.albumImage,
            duration_ms: track.duration_ms,
            explicit: track.explicit,
          },
        });

      if (error) {
        console.error('[RoomView] Supabase error:', error);
        throw new Error(error.message || 'Failed to add track to queue');
      }

      // Show success toast
      setToastMessage(`Added "${track.name}" to queue`);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);

      console.log('[RoomView] Track added to queue:', track.name);
    } catch (error) {
      console.error('[RoomView] Failed to add to queue:', error);
      alert(error instanceof Error ? error.message : 'Failed to add track to queue');
    }
  }

  if (error) {
    return (
      <div className="room-loading">
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (isLoading || !currentRoom) {
    return (
      <div className="room-loading">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  // participants are already filtered by connection_status = 'connected' in loadParticipants
  const activeParticipants = participants;
  const connectedCount = participants.filter(p => p.connection_status === 'connected').length;

  // Find current user's participant record to get their nickname
  const currentParticipant = participants.find(p => {
    // For authenticated users, match by user_id
    if (session?.user_id) {
      return p.user_id === session.user_id;
    }
    // For anonymous users, we need to identify them somehow
    // Since we don't store anonymous user identity reliably, we can't find them here
    // We'll need to get the nickname from localStorage or another source
    return false;
  });

  // For authenticated users, use their nickname from participant record
  // For anonymous users, get from localStorage (set during join)
  const currentUserNickname = currentParticipant?.nickname ||
    (!session ? localStorage.getItem('syncjam_guest_nickname') : null);

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
            <Crown size={20} className="host-badge-small" />
          )}
          <button
            className="share-button-icon"
            onClick={copyShareLink}
            title="Share room"
          >
            <Share2 size={18} />
          </button>
          <button
            className="leave-button-icon"
            onClick={handleLeaveRoom}
            title="Leave room"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Inactive Room Warning Banner - shown only to guests when host disconnects */}
      {!currentRoom.is_active && !isHost && (
        <div className="inactive-room-banner">
          <AlertTriangle size={24} className="banner-icon" />
          <div className="banner-content">
            <h3 className="banner-title">Host Disconnected</h3>
            <p className="banner-message">
              The host has left the room. You can wait for them to return or leave the room.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area with Tab Switching */}
      <main className="room-main-content">
        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <QueueTab
            roomId={currentRoom.id}
            isHost={isHost}
            currentUserId={session?.user_id}
            currentUserNickname={currentUserNickname}
            participants={participants}
          />
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <SearchTab onAddToQueue={handleAddToQueue} />
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
                  <Avatar
                    src={participant.spotify_user?.images?.[0]?.url}
                    name={participant.nickname || participant.spotify_user?.display_name || 'Anonymous'}
                    size="md"
                  />
                  <div className="participant-details">
                    <div className="participant-name-row">
                      <span className="participant-name">
                        {participant.nickname || participant.spotify_user?.display_name || 'Anonymous'}
                      </span>
                      {participant.is_host && (
                        <Crown size={14} className="host-badge-inline" />
                      )}
                    </div>
                    {participant.spotify_user?.product === 'premium' && (
                      <Badge variant="premium" size="sm">Premium</Badge>
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
                <MessageCircle size={64} className="empty-icon" />
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
          <Music size={24} className="nav-icon" />
          <span className="nav-label">Queue</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={24} className="nav-icon" />
          <span className="nav-label">Search</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          <Users size={24} className="nav-icon" />
          <span className="nav-label">Participants</span>
          {connectedCount > 0 && (
            <span className="nav-badge">{connectedCount}</span>
          )}
        </button>
        <button
          className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageCircle size={24} className="nav-icon" />
          <span className="nav-label">Chat</span>
        </button>
      </nav>

      {/* Notification Toast */}
      {showCopied && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
