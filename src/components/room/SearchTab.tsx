/**
 * SearchTab Component
 * Main search interface for finding and adding tracks to the queue
 */

import { useSpotifySearch } from '../../hooks/useSpotifySearch';
import { SearchResultItem } from './SearchResultItem';
import { Button } from '../common';
import { Search as SearchIcon, AlertCircle, Loader2 } from 'lucide-react';
import type { SpotifyTrack } from '../../types/spotify';
import './SearchTab.css';

interface SearchTabProps {
  onAddToQueue: (track: SpotifyTrack) => Promise<void>;
}

export function SearchTab({ onAddToQueue }: SearchTabProps) {
  const {
    query,
    setQuery,
    tracks,
    isLoading,
    error,
    hasMore,
    loadMore,
  } = useSpotifySearch();

  const showEmptyState = !query.trim() && tracks.length === 0;
  const showResults = tracks.length > 0;
  const showNoResults = query.trim() && !isLoading && tracks.length === 0 && !error;

  return (
    <div className="search-tab">
      {/* Search Input */}
      <div className="search-input-wrapper">
        <div className="search-input-container">
          <SearchIcon size={20} className="search-icon" />
          <input
            type="search"
            placeholder="Search for songs, artists, or albums..."
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>

      {/* Results Container */}
      <div className="search-results-container">
        {/* Empty State */}
        {showEmptyState && (
          <div className="search-empty-state">
            <SearchIcon size={64} className="empty-icon" />
            <h3>Search for music</h3>
            <p>Find songs to add to the queue</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="search-error-state">
            <AlertCircle size={48} className="error-icon" />
            <h3>Search failed</h3>
            <p>{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setQuery(query)} // Re-trigger search
            >
              Try again
            </Button>
          </div>
        )}

        {/* Loading State (initial) */}
        {isLoading && tracks.length === 0 && (
          <div className="search-loading-state">
            <Loader2 size={48} className="loading-icon" />
            <p>Searching...</p>
          </div>
        )}

        {/* No Results */}
        {showNoResults && (
          <div className="search-no-results">
            <SearchIcon size={48} className="empty-icon" />
            <h3>No results found</h3>
            <p>Try a different search term</p>
          </div>
        )}

        {/* Results List */}
        {showResults && (
          <>
            <div className="search-results-list">
              {tracks.map((track) => (
                <SearchResultItem
                  key={track.id}
                  track={track}
                  onAddToQueue={onAddToQueue}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="load-more-container">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={loadMore}
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  Load more
                </Button>
              </div>
            )}

            {/* Loading More Indicator */}
            {isLoading && tracks.length > 0 && (
              <div className="loading-more">
                <Loader2 size={24} className="loading-icon-small" />
                <span>Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
