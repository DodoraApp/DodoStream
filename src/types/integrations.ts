// ── Shared integration abstractions ──────────────────────────────────────

/** Common connection fields shared by all providers */
export interface BaseConnection {
  accessToken: string;
  userId: string;
  username: string;
}

export type PinAuthStatus = 'idle' | 'pending' | 'success' | 'expired';

export interface PinAuthState {
  userCode: string | null;
  verificationUrl: string | null;
  status: PinAuthStatus;
  start: () => void;
  cancel: () => void;
}

/** Common sync state returned by useIntegrationSync */
export interface IntegrationSyncState {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncAt?: number;
}

// ── Provider-specific types ─────────────────────────────────────────────

export type SyncMode = 'pull' | 'push' | 'full';
export type SimklMediaType = 'movies' | 'shows' | 'anime';
export type IntegrationProvider = 'simkl' | 'trakt';
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

export interface SimklConnection extends BaseConnection {
  /** ISO timestamp cursors from last /sync/activities response.
   * Presence of any cursor means initial sync has been done for that category. */
  syncCursors?: SimklSyncCursors;
}

export interface TraktSyncCursors {
  movies?: {
    watched_at?: string;
    collected_at?: string;
    rated_at?: string;
    watchlisted_at?: string;
    favorited_at?: string;
    commented_at?: string;
    paused_at?: string;
    hidden_at?: string;
  };
  episodes?: {
    watched_at?: string;
    collected_at?: string;
    rated_at?: string;
    watchlisted_at?: string;
    commented_at?: string;
    paused_at?: string;
  };
  shows?: {
    rated_at?: string;
    watchlisted_at?: string;
    favorited_at?: string;
    commented_at?: string;
    hidden_at?: string;
    dropped_at?: string;
  };
  seasons?: {
    rated_at?: string;
    watchlisted_at?: string;
    commented_at?: string;
    hidden_at?: string;
  };
  watchlist?: {
    updated_at?: string;
  };
  favorites?: {
    updated_at?: string;
  };
}

export interface TraktConnection extends BaseConnection {
  refreshToken: string;
  expiresAt: number;
  syncCursors?: TraktSyncCursors;
}

export interface ProfileIntegrationSettings {
  simkl?: {
    connection?: SimklConnection;
    syncMode: SyncMode;
  };
  trakt?: {
    connection?: TraktConnection;
    syncMode: SyncMode;
  };
}
