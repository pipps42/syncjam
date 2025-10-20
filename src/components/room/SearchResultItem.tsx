/**
 * SearchResultItem Component
 * Displays a single track search result with add to queue button
 */

import { useState } from 'react';
import { Button } from '../common';
import { Plus, Music } from 'lucide-react';
import type { SpotifyTrack } from '../../types/spotify';
import { formatDuration } from '../../types/spotify';
import './SearchResultItem.css';

interface SearchResultItemProps {
  track: SpotifyTrack;
  onAddToQueue: (track: SpotifyTrack) => Promise<void>;
  isAdding?: boolean;
}

export function SearchResultItem({ track, onAddToQueue, isAdding = false }: SearchResultItemProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleAdd() {
    setIsLoading(true);
    try {
      await onAddToQueue(track);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="search-result-item">
      <div className="result-album-art">
        {track.albumImage ? (
          <img src={track.albumImage} alt={track.album} />
        ) : (
          <div className="result-album-placeholder">
            <Music size={24} />
          </div>
        )}
      </div>

      <div className="result-info">
        <div className="result-name-row">
          <span className="result-name">{track.name}</span>
          {track.explicit && (
            <span className="explicit-badge">E</span>
          )}
        </div>
        <span className="result-artist">{track.artistNames}</span>
        <span className="result-album">{track.album}</span>
      </div>

      <div className="result-meta">
        <span className="result-duration">{formatDuration(track.duration_ms)}</span>
      </div>

      <div className="result-actions">
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={18} />}
          onClick={handleAdd}
          isLoading={isLoading || isAdding}
          disabled={isLoading || isAdding}
          aria-label={`Add ${track.name} to queue`}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
