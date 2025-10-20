import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Music, ThumbsUp, ThumbsDown, Trash2, GripVertical, User } from 'lucide-react';
import type { QueueItem } from '../../types/queue';
import type { Participant } from '../../types/room';
import { formatDuration } from '../../types/spotify';
import { useParticipantsWithUser } from '../../hooks/useParticipantsWithUser';
import './QueueTab.css';

interface QueueTabProps {
  roomId: string;
  isHost: boolean;
  currentUserId?: string | null;
  currentUserNickname?: string | null;
  participants: Participant[];
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
        .order('votes', { ascending: false })
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

  async function handleVote(itemId: string, increment: number) {
    try {
      const item = queueItems.find(q => q.id === itemId);
      if (!item) return;

      const { error } = await supabase
        .from('queue_items')
        .update({ votes: item.votes + increment })
        .eq('id', itemId);

      if (error) throw error;

      // Optimistic update
      setQueueItems(prev =>
        prev.map(q => q.id === itemId ? { ...q, votes: q.votes + increment } : q)
      );
    } catch (err) {
      console.error('[QueueTab] Failed to vote:', err);
      alert('Failed to vote');
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
              <div className="queue-item-name">
                {item.metadata.name}
                {item.metadata.explicit && (
                  <span className="explicit-badge">E</span>
                )}
              </div>
              <div className="queue-item-artist">
                {item.metadata.artistNames}
              </div>
              <div className="queue-item-meta">
                <span className="queue-item-duration">
                  {formatDuration(item.metadata.duration_ms)}
                </span>
                <span className="queue-item-added-by">
                  {(() => {
                    const userInfo = getParticipantInfo(item.added_by, item.added_by_nickname);
                    return (
                      <>
                        {userInfo.avatarUrl ? (
                          <img src={userInfo.avatarUrl} alt={userInfo.displayName} className="added-by-avatar" />
                        ) : (
                          <User size={14} className="added-by-avatar-placeholder" />
                        )}
                        <span>{userInfo.displayName}</span>
                      </>
                    );
                  })()}
                </span>
              </div>
            </div>

            <div className="queue-item-votes">
              <button
                className="vote-button vote-up"
                onClick={() => handleVote(item.id, 1)}
                title="Upvote"
              >
                <ThumbsUp size={18} />
              </button>
              <span className="vote-count">{item.votes}</span>
              <button
                className="vote-button vote-down"
                onClick={() => handleVote(item.id, -1)}
                title="Downvote"
              >
                <ThumbsDown size={18} />
              </button>
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
