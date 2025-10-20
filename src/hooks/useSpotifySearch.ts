/**
 * Custom hook for Spotify search functionality
 * Handles search state, debouncing, and API calls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SpotifyTrack, SpotifySearchResponse, SpotifySearchError } from '../types/spotify';

interface UseSpotifySearchResult {
  query: string;
  setQuery: (query: string) => void;
  tracks: SpotifyTrack[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

const DEBOUNCE_DELAY = 300; // ms
const SEARCH_LIMIT = 20;

export function useSpotifySearch(): UseSpotifySearchResult {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0); // Reset offset when query changes
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setTracks([]);
      setError(null);
      setHasMore(false);
      return;
    }

    performSearch(debouncedQuery, 0);
  }, [debouncedQuery]);

  const performSearch = useCallback(async (searchQuery: string, searchOffset: number) => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: SEARCH_LIMIT.toString(),
        offset: searchOffset.toString(),
      });

      const response = await fetch(`/api/spotify?action=search&${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData: SpotifySearchError = await response.json();
        throw new Error(errorData.details || 'Failed to search');
      }

      const data: SpotifySearchResponse = await response.json();

      if (searchOffset === 0) {
        // New search, replace tracks
        setTracks(data.tracks);
      } else {
        // Load more, append tracks
        setTracks(prev => [...prev, ...data.tracks]);
      }

      setHasMore(data.hasMore);
      setOffset(searchOffset + data.tracks.length);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }

      console.error('[Search] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search');
      setTracks([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && debouncedQuery.trim()) {
      performSearch(debouncedQuery, offset);
    }
  }, [isLoading, hasMore, debouncedQuery, offset, performSearch]);

  const reset = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setTracks([]);
    setError(null);
    setOffset(0);
    setHasMore(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    query,
    setQuery,
    tracks,
    isLoading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
