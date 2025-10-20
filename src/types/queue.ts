/**
 * Queue Item Types
 */

export interface QueueItem {
  id: string;
  room_id: string;
  track_uri: string;
  added_by: string | null;
  added_by_nickname: string | null;
  position: number;
  votes: number;
  metadata: {
    name: string;
    artists: string[];
    artistNames: string;
    album: string;
    albumImage: string | null;
    duration_ms: number;
    explicit: boolean;
  };
  played: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueItemWithUser extends QueueItem {
  added_by_user?: {
    id?: string;
    display_name?: string;
    images?: Array<{ url: string }>;
    nickname?: string;
  };
}
