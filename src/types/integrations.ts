export type SyncMode = 'pull' | 'push' | 'full';
export type SimklMediaType = 'movies' | 'shows' | 'anime';
export type IntegrationProvider = 'simkl';
export type IntegrationSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SimklSyncCursor {
  all?: string;
  playback?: string;
  plantowatch?: string;
  watching?: string;
  completed?: string;
  hold?: string;
  dropped?: string;
  removed_from_list?: string;
}

export interface SimklSyncCursors {
  tv_shows?: SimklSyncCursor;
  movies?: SimklSyncCursor;
  anime?: SimklSyncCursor;
}

export interface SimklConnection {
  accessToken: string;
  userId: string;
  username: string;
  /** ISO timestamp cursors from last /sync/activities response.
   * Presence of any cursor means initial sync has been done for that category. */
  syncCursors?: SimklSyncCursors;
}

export interface ProfileIntegrationSettings {
  simkl?: {
    connection?: SimklConnection;
    syncMode: SyncMode;
  };
}
