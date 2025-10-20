/**
 * Hook to get participant info with user data (display name, avatar)
 * Used by Queue, Participants tab, Chat to display user info consistently
 */

import { useMemo } from 'react';
import type { Participant } from '../types/room';

export interface ParticipantInfo {
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

export function useParticipantsWithUser(participants: Participant[]) {
  /**
   * Get participant info by user_id or nickname
   * Returns display name and avatar URL
   */
  const getParticipantInfo = useMemo(() => {
    return (userId: string | null, nickname: string | null): ParticipantInfo => {
      // Find participant by user_id or nickname
      const participant = participants.find(p => {
        if (userId && p.user_id === userId) return true;
        if (!userId && nickname && p.nickname === nickname) return true;
        return false;
      });

      if (!participant) {
        return {
          displayName: nickname || 'Unknown',
          avatarUrl: null,
          isAnonymous: true,
        };
      }

      // Anonymous user (guest)
      if (!participant.user_id) {
        return {
          displayName: participant.nickname || 'Guest',
          avatarUrl: null,
          isAnonymous: true,
        };
      }

      // Authenticated user
      const spotifyUser = participant.spotify_user;
      return {
        displayName: spotifyUser?.display_name || participant.user_id,
        avatarUrl: spotifyUser?.images?.[0]?.url || null,
        isAnonymous: false,
      };
    };
  }, [participants]);

  return { getParticipantInfo };
}
