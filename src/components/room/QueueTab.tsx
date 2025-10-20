import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Music, Trash2, GripVertical, User } from 'lucide-react';
import type { QueueItem } from '../../types/queue';
import type { Participant } from '../../types/room';
import { useParticipantsWithUser } from '../../hooks/useParticipantsWithUser';
import './QueueTab.css';

interface QueueTabProps {
  roomId: string;
  isHost: boolean;
  currentUserId?: string | null;
  currentUserNickname?: string | null;
  participants: Participant[];
}

// Helper component to check text overflow and apply animation conditionally
function QueueItemText({ text, className, badge }: { text: string; className: string; badge?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setHasOverflow(textWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div ref={containerRef} className={`${className} ${hasOverflow ? 'has-overflow' : ''}`}>
      <span ref={textRef}>{text}</span>
      {badge}
    </div>
  );
}

export function QueueTab({ roomId, isHost, currentUserId, currentUserNickname, participants }: QueueTabProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getParticipantInfo } = useParticipantsWithUser(participants);

  useEffect(() => {
    loadQueue();

    // Subscribe to real-time queue updates
    console.log('[QueueTab] Setting up Realtime subscription for room:', roomId);

    const channel = supabase
      .channel(`queue:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_items',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('[QueueTab] Real-time update received:', payload);

          if (payload.eventType === 'INSERT') {
            console.log('[QueueTab] INSERT event, adding item:', payload.new);
            setQueueItems(prev => [...prev, payload.new as QueueItem].sort((a, b) => a.position - b.position));
          } else if (payload.eventType === 'UPDATE') {
            console.log('[QueueTab] UPDATE event, updating item:', payload.new);
            setQueueItems(prev =>
              prev.map(item => item.id === payload.new.id ? payload.new as QueueItem : item)
            );
          } else if (payload.eventType === 'DELETE') {
            console.log('[QueueTab] DELETE event, removing item:', payload.old);
            setQueueItems(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[QueueTab] Subscription status:', status, err);
      });

    return () => {
      console.log('[QueueTab] Unsubscribing from Realtime');
      channel.unsubscribe();
    };
  }, [roomId]);

  async function loadQueue() {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('queue_items')
        .select('*')
        .eq('room_id', roomId)
        .eq('played', false)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setQueueItems(data || []);
    } catch (err) {
      console.error('[QueueTab] Failed to load queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemove(itemId: string) {
    try {
      const { error } = await supabase
        .from('queue_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Optimistic update
      setQueueItems(prev => prev.filter(q => q.id !== itemId));
    } catch (err) {
      console.error('[QueueTab] Failed to remove track:', err);
      alert('Failed to remove track');
    }
  }

  function canRemoveTrack(item: QueueItem): boolean {
    if (isHost) return true;
    if (currentUserId && item.added_by === currentUserId) return true;
    if (!currentUserId && currentUserNickname && item.added_by_nickname === currentUserNickname) return true;
    return false;
  }


  if (isLoading) {
    return (
      <div className="queue-tab">
        <div className="queue-loading">
          <div className="spinner"></div>
          <p>Loading queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="queue-tab">
        <div className="queue-error">
          <p>{error}</p>
          <button onClick={loadQueue} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (queueItems.length === 0) {
    return (
      <div className="queue-tab">
        <div className="queue-empty">
          <Music size={48} />
          <h3>Queue is Empty</h3>
          <p>Search for tracks and add them to the queue to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-tab">
      <div className="queue-header">
        <h3>Queue</h3>
        <span className="queue-count">{queueItems.length} track{queueItems.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="queue-list">
        {queueItems.map((item, index) => (
          <div key={item.id} className="queue-item">
            {isHost && (
              <div className="queue-item-drag-handle">
                <GripVertical size={20} />
              </div>
            )}

            <div className="queue-item-position">
              {index + 1}
            </div>

            <div className="queue-item-album">
              {item.metadata.albumImage ? (
                <img src={item.metadata.albumImage} alt={item.metadata.album} />
              ) : (
                <div className="queue-item-album-placeholder">
                  <Music size={24} />
                </div>
              )}
            </div>

            <div className="queue-item-info">
              <QueueItemText
                text={item.metadata.name}
                className="queue-item-name"
                badge={item.metadata.explicit ? <span className="explicit-badge">E</span> : undefined}
              />
              <QueueItemText
                text={item.metadata.artistNames}
                className="queue-item-artist"
              />
            </div>

            <div className="queue-item-meta">
              {(() => {
                const userInfo = getParticipantInfo(item.added_by, item.added_by_nickname);
                return userInfo.avatarUrl ? (
                  <img src={userInfo.avatarUrl} alt={userInfo.displayName} className="added-by-avatar" />
                ) : (
                  <User size={24} className="added-by-avatar-placeholder" />
                );
              })()}
            </div>

            {canRemoveTrack(item) && (
              <button
                className="queue-item-remove"
                onClick={() => handleRemove(item.id)}
                title="Remove track"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
