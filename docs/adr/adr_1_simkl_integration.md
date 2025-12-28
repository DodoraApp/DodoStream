---
id: adr-XXXX
title: External Watch History & Scrobbling Integration (Simkl, Trakt)
status: Proposed
date: 2025-12-27
tags:
  - feature
  - scrobbling
  - external-api
  - watch-history
  - simkl
  - trakt
  - cross-device-sync
---

# ADR-XXXX: External Watch History & Scrobbling Integration (Simkl, Trakt)

## Context

DodoStream currently tracks watch history locally per profile. However, **DodoStream does not offer user accounts or cloud sync**. Users who install DodoStream on multiple devices have no way to sync their watch progress.

By integrating with Simkl and/or Trakt, we enable cross-device sync without building our own account system.

### Key User Story

> "I set up Simkl on my Android TV once. Later, I watch a movie on my phone. When I open DodoStream on my TV again, it automatically knows I've already watched that movie - no manual sync needed."

---

## Decision

### Design Principles

1. **Functional over classes** - All modules use pure functions, not classes
2. **Arrow functions for components** - Use `FC` types and arrow functions
3. **Environment variables** - API keys via `EXPO_PUBLIC_*` env vars
4. **PIN auth only** - No OAuth (requires `client_secret` we can't include)
5. **Reactive store subscriptions** - Scrobbling via store middleware
6. **Scrobble state in provider stores** - Each integration manages its own state
7. **Reusable utilities** - Shared video ID parsing/formatting utils

---

## Environment Configuration

```typescript
// . env (or .env.local)
EXPO_PUBLIC_SIMKL_CLIENT_ID = your - simkl - client - id - here;
// EXPO_PUBLIC_TRAKT_CLIENT_ID=your-trakt-client-id-here  # Future

// NOTE: client_id is safe to publish (public identifier)
// NEVER include client_secret in client-side code
```

```typescript
// src/utils/env.ts

/**
 * Get Simkl client ID from environment
 * @throws if not configured
 */
export const getSimklClientId = (): string => {
  const clientId = process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID;
  if (!clientId) {
    throw new Error('EXPO_PUBLIC_SIMKL_CLIENT_ID not configured. Add it to your .env file.');
  }
  return clientId;
};

/**
 * Check if Simkl is configured
 */
export const isSimklConfigured = (): boolean => {
  return Boolean(process.env.EXPO_PUBLIC_SIMKL_CLIENT_ID);
};
```

---

## Video ID Utilities

Reusable utils for splitting/joining video IDs with consistent separators:

```typescript
// src/utils/video-id. ts

/**
 * Separator for show ID + video ID composite key
 * Example: "tt1234567:: tt1234567:1:5"
 */
const COMPOSITE_KEY_SEPARATOR = '::';

/**
 * Separator within video ID for season: episode
 * Example: "tt1234567:1:5" (imdb: season:episode)
 */
const VIDEO_ID_SEPARATOR = ':';

export interface ParsedVideoId {
  showId: string;
  season: number;
  episode: number;
}

export interface CompositeKey {
  mediaId: string;
  videoId: string | undefined;
}

/**
 * Create a video ID from season and episode
 * Format: "{showId}:{season}:{episode}"
 */
export const createVideoId = (
  showId:  string,
  season: number,
  episode: number
): string => {
  return `${showId}${VIDEO_ID_SEPARATOR}${season}${VIDEO_ID_SEPARATOR}${episode}`;
};

/**
 * Parse a video ID into components
 * Returns undefined if format is invalid
 */
export const parseVideoId = (videoId: string): ParsedVideoId | undefined => {
  const parts = videoId.split(VIDEO_ID_SEPARATOR);
  if (parts.length < 3) return undefined;

  const showId = parts[0];
  const season = parseInt(parts[1], 10);
  const episode = parseInt(parts[2], 10);

  if (isNaN(season) || isNaN(episode)) return undefined;

  return { showId, season, episode };
};

/**
 * Create a composite key for watch history storage
 * Format: "{mediaId}: :{videoId}" or just "{mediaId}" for movies
 */
export const createCompositeKey = (
  mediaId: string,
  videoId?:  string
): string => {
  if (! videoId) return mediaId;
  return `${mediaId}${COMPOSITE_KEY_SEPARATOR}${videoId}`;
};

/**
 * Parse a composite key back into components
 */
export const parseCompositeKey = (key: string): CompositeKey => {
  const separatorIndex = key. indexOf(COMPOSITE_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { mediaId: key, videoId: undefined };
  }
  return {
    mediaId: key.slice(0, separatorIndex),
    videoId: key.slice(separatorIndex + COMPOSITE_KEY_SEPARATOR.length),
  };
};

/**
 * Check if a media ID is an IMDB ID
 */
export const isImdbId = (id: string): boolean => {
  return id.startsWith('tt') && /^tt\d+$/.test(id);
};

/**
 * Extract IMDB ID from various formats
 * Returns undefined if not an IMDB ID
 */
export const extractImdbId = (id: string): string | undefined => {
  if (isImdbId(id)) return id;

  // Try to extract from URL format
  const match = id.match(/tt\d+/);
  return match? .[0];
};
```

---

## Media ID Resolution

When the ID is not an IMDB ID, we can use Simkl's lookup endpoints:

```typescript
// src/api/simkl/lookup.ts

import { getSimklClientId } from '@/utils/env';
import { isImdbId } from '@/utils/video-id';

const SIMKL_API_URL = 'https://api.simkl.com';

export interface SimklIds {
  simkl?: number;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  mal?: number;
}

export interface LookupResult {
  ids: SimklIds;
  title?: string;
  year?: number;
}

/**
 * Lookup a media item on Simkl by various IDs
 *
 * Simkl supports lookup by:  imdb, tmdb, tvdb, mal, anidb, hulu, netflix, etc.
 * If we only have a non-standard ID, we try title+year search as fallback.
 */
export const lookupMedia = async (
  mediaId: string,
  metadata?: {
    title?: string;
    year?: number;
    type?: 'movie' | 'show' | 'anime';
    tmdbId?: number;
    tvdbId?: number;
  }
): Promise<LookupResult | null> => {
  // Priority 1: IMDB ID - direct lookup
  if (isImdbId(mediaId)) {
    return { ids: { imdb: mediaId } };
  }

  // Priority 2:  TMDB/TVDB ID if provided in metadata
  if (metadata?.tmdbId) {
    const result = await lookupByExternalId('tmdb', metadata.tmdbId, metadata.type);
    if (result) return result;
  }

  if (metadata?.tvdbId) {
    const result = await lookupByExternalId('tvdb', metadata.tvdbId, metadata.type);
    if (result) return result;
  }

  // Priority 3: Title + year search
  if (metadata?.title) {
    const result = await searchByTitle(metadata.title, metadata.year, metadata.type);
    if (result) return result;
  }

  // No match found - cannot track this item
  return null;
};

const lookupByExternalId = async (
  idType: 'tmdb' | 'tvdb' | 'mal',
  idValue: number,
  type?: 'movie' | 'show' | 'anime'
): Promise<LookupResult | null> => {
  try {
    const params = new URLSearchParams({
      [idType]: String(idValue),
      client_id: getSimklClientId(),
    });

    if (type) {
      params.set('type', type === 'show' ? 'tv' : type);
    }

    const response = await fetch(`${SIMKL_API_URL}/search/id? ${params}`);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    return {
      ids: data[0].ids,
      title: data[0].title,
      year: data[0].year,
    };
  } catch {
    return null;
  }
};

const searchByTitle = async (
  title: string,
  year?: number,
  type?: 'movie' | 'show' | 'anime'
): Promise<LookupResult | null> => {
  try {
    const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
    const params = new URLSearchParams({
      q: title,
      client_id: getSimklClientId(),
    });

    if (year) {
      params.set('year', String(year));
    }

    const response = await fetch(`${SIMKL_API_URL}${endpoint}?${params}`);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    return {
      ids: data[0].ids,
      title: data[0].title,
      year: data[0].year,
    };
  } catch {
    return null;
  }
};

/**
 * Check if we can track this media item
 * Returns true if we have enough info to identify it on Simkl
 */
export const canTrackMedia = (
  mediaId: string,
  metadata?: { title?: string; tmdbId?: number; tvdbId?: number }
): boolean => {
  // IMDB IDs always work
  if (isImdbId(mediaId)) return true;

  // TMDB/TVDB IDs work
  if (metadata?.tmdbId || metadata?.tvdbId) return true;

  // Title search can work but is less reliable
  if (metadata?.title) return true;

  // No way to identify this content
  return false;
};
```

---

## Scrobble Thresholds

Reuse existing playback constants:

```typescript
// src/constants/tracking.ts

import { PLAYBACK_CONTINUE_WATCHING_MIN_RATIO, PLAYBACK_FINISHED_RATIO } from './playback';

/**
 * Scrobble thresholds - reuse existing playback ratios
 */
export const SCROBBLE_THRESHOLDS = {
  /** Start scrobbling ("now watching") - 5% */
  START: PLAYBACK_CONTINUE_WATCHING_MIN_RATIO,

  /** Mark as watched/finished - 90% */
  FINISH: PLAYBACK_FINISHED_RATIO,
} as const;

/** Minimum time between sync attempts */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Debounce time for scrobble updates */
export const SCROBBLE_DEBOUNCE_MS = 5000; // 5 seconds
```

---

## Simkl Store with Scrobble State

```typescript
// src/store/simkl. store.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

interface ScrobbleSession {
  mediaKey: string;
  startedAt: number;
  hasStarted: boolean;
  hasFinished: boolean;
  lastProgress: number;
}

interface SimklUser {
  id: number;
  name: string;
  avatar?: string;
}

interface SimklState {
  // Connection
  isConnected: boolean;
  accessToken: string | null;
  user: SimklUser | null;

  // Settings
  scrobblingEnabled: boolean;
  autoSyncEnabled: boolean;

  // Sync timestamps
  lastPullAt: number | null;
  lastPushAt: number | null;

  // Scrobble sessions (per media item)
  scrobbleSessions: Record<string, ScrobbleSession>;

  // Sync stats
  syncStats: {
    itemsPulled: number;
    itemsPushed: number;
    lastError?: string;
  } | null;

  // Offline queue
  offlineQueue: Array<{
    type: 'scrobble-start' | 'scrobble-finish' | 'history-add';
    payload: unknown;
    createdAt: number;
  }>;
}

interface SimklActions {
  connect: (accessToken: string, user: SimklUser) => void;
  disconnect: () => void;

  setScrobblingEnabled: (enabled: boolean) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;

  setLastPullAt: (timestamp: number) => void;
  setLastPushAt: (timestamp: number) => void;
  setSyncStats: (stats: SimklState['syncStats']) => void;

  // Scrobble session management
  getOrCreateSession: (mediaKey: string) => ScrobbleSession;
  updateSession: (mediaKey: string, updates: Partial<ScrobbleSession>) => void;
  clearSession: (mediaKey: string) => void;
  clearExpiredSessions: () => void;

  // Offline queue
  addToOfflineQueue: (item: SimklState['offlineQueue'][0]) => void;
  clearOfflineQueue: () => void;
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useSimklStore = create<SimklState & SimklActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        isConnected: false,
        accessToken: null,
        user: null,
        scrobblingEnabled: true,
        autoSyncEnabled: true,
        lastPullAt: null,
        lastPushAt: null,
        scrobbleSessions: {},
        syncStats: null,
        offlineQueue: [],

        // Actions
        connect: (accessToken, user) =>
          set({
            isConnected: true,
            accessToken,
            user,
          }),

        disconnect: () =>
          set({
            isConnected: false,
            accessToken: null,
            user: null,
            lastPullAt: null,
            lastPushAt: null,
            scrobbleSessions: {},
            syncStats: null,
            offlineQueue: [],
          }),

        setScrobblingEnabled: (enabled) => set({ scrobblingEnabled: enabled }),
        setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),

        setLastPullAt: (timestamp) => set({ lastPullAt: timestamp }),
        setLastPushAt: (timestamp) => set({ lastPushAt: timestamp }),
        setSyncStats: (stats) => set({ syncStats: stats }),

        getOrCreateSession: (mediaKey) => {
          const sessions = get().scrobbleSessions;
          if (sessions[mediaKey]) {
            return sessions[mediaKey];
          }

          const newSession: ScrobbleSession = {
            mediaKey,
            startedAt: Date.now(),
            hasStarted: false,
            hasFinished: false,
            lastProgress: 0,
          };

          set({
            scrobbleSessions: {
              ...sessions,
              [mediaKey]: newSession,
            },
          });

          return newSession;
        },

        updateSession: (mediaKey, updates) => {
          const sessions = get().scrobbleSessions;
          if (!sessions[mediaKey]) return;

          set({
            scrobbleSessions: {
              ...sessions,
              [mediaKey]: { ...sessions[mediaKey], ...updates },
            },
          });
        },

        clearSession: (mediaKey) => {
          const sessions = { ...get().scrobbleSessions };
          delete sessions[mediaKey];
          set({ scrobbleSessions: sessions });
        },

        clearExpiredSessions: () => {
          const now = Date.now();
          const sessions = get().scrobbleSessions;
          const validSessions: Record<string, ScrobbleSession> = {};

          for (const [key, session] of Object.entries(sessions)) {
            if (now - session.startedAt < SESSION_EXPIRY_MS) {
              validSessions[key] = session;
            }
          }

          set({ scrobbleSessions: validSessions });
        },

        addToOfflineQueue: (item) =>
          set((state) => ({
            offlineQueue: [...state.offlineQueue, item],
          })),

        clearOfflineQueue: () => set({ offlineQueue: [] }),
      }),
      {
        name: 'simkl-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          isConnected: state.isConnected,
          accessToken: state.accessToken,
          user: state.user,
          scrobblingEnabled: state.scrobblingEnabled,
          autoSyncEnabled: state.autoSyncEnabled,
          lastPullAt: state.lastPullAt,
          lastPushAt: state.lastPushAt,
          scrobbleSessions: state.scrobbleSessions,
          syncStats: state.syncStats,
          offlineQueue: state.offlineQueue,
        }),
      }
    )
  )
);
```

---

## Tracking Store (Global)

```typescript
// src/store/tracking.store.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncStats {
  itemsPulled: number;
  itemsPushed: number;
  lastError?: string;
}

interface TrackingState {
  autoSyncEnabled: boolean;
  syncState: SyncState;
  lastSyncAt: number | null;
  syncStats: SyncStats | null;
}

interface TrackingActions {
  setAutoSyncEnabled: (enabled: boolean) => void;
  setSyncState: (state: SyncState) => void;
  setLastSyncAt: (timestamp: number) => void;
  setSyncStats: (stats: SyncStats) => void;
}

export const useTrackingStore = create<TrackingState & TrackingActions>()(
  persist(
    (set) => ({
      autoSyncEnabled: true,
      syncState: 'idle',
      lastSyncAt: null,
      syncStats: null,

      setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
      setSyncState: (syncState) => set({ syncState }),
      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
      setSyncStats: (stats) => set({ syncStats: stats }),
    }),
    {
      name: 'tracking-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        autoSyncEnabled: state.autoSyncEnabled,
        lastSyncAt: state.lastSyncAt,
        syncStats: state.syncStats,
      }),
    }
  )
);
```

---

## PIN Authentication

```typescript
// src/api/simkl/auth.ts

import { getSimklClientId } from '@/utils/env';
import { useSimklStore } from '@/store/simkl.store';
import { getSimklUser } from './client';

const SIMKL_API_URL = 'https://api.simkl.com';

interface PinCodeResponse {
  result: 'OK';
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface PinStatusResponse {
  result: 'OK' | 'KO';
  message?: 'Authorization pending' | 'Slow down';
  access_token?: string;
}

/**
 * Request a PIN code to display to the user
 */
export const requestPinCode = async (): Promise<PinCodeResponse> => {
  const response = await fetch(`${SIMKL_API_URL}/oauth/pin? client_id=${getSimklClientId()}`);

  if (!response.ok) {
    throw new Error('Failed to get PIN code');
  }

  return response.json();
};

/**
 * Poll for user authorization
 * Returns access_token when user enters the code on simkl.com/pin/
 */
export const pollPinStatus = async (
  userCode: string,
  options: {
    interval: number;
    expiresIn: number;
    onPending?: () => void;
    signal?: AbortSignal;
  }
): Promise<string> => {
  const { interval, expiresIn, onPending, signal } = options;
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    if (signal?.aborted) {
      throw new Error('PIN auth cancelled');
    }

    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const response = await fetch(
      `${SIMKL_API_URL}/oauth/pin/${userCode}? client_id=${getSimklClientId()}`
    );

    const data: PinStatusResponse = await response.json();

    if (data.result === 'OK' && data.access_token) {
      return data.access_token;
    }

    if (data.message === 'Slow down') {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }

    onPending?.();
  }

  throw new Error('PIN code expired');
};

/**
 * Complete PIN auth flow
 */
export const completePinAuth = async (accessToken: string): Promise<boolean> => {
  try {
    const user = await getSimklUser(accessToken);
    useSimklStore.getState().connect(accessToken, user);
    return true;
  } catch {
    return false;
  }
};
```

---

## Scrobbling via Store Middleware

```typescript
// src/api/tracking/scrobble-middleware.ts

import { useWatchHistoryStore, WatchHistoryItem } from '@/store/watch-history. store';
import { useSimklStore } from '@/store/simkl.store';
import { SCROBBLE_THRESHOLDS, SCROBBLE_DEBOUNCE_MS } from '@/constants/tracking';
import { createCompositeKey } from '@/utils/video-id';
import { scrobbleToSimkl, finishScrobbleOnSimkl } from '@/api/simkl/scrobble';
import { canTrackMedia } from '@/api/simkl/lookup';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('ScrobbleMiddleware');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const getProgressRatio = (item: WatchHistoryItem): number => {
  if (item.durationSeconds <= 0) return 0;
  return item.progressSeconds / item.durationSeconds;
};

const handleSimklScrobble = async (item: WatchHistoryItem): Promise<void> => {
  const simkl = useSimklStore.getState();

  if (!simkl.isConnected || !simkl.scrobblingEnabled) return;

  if (!canTrackMedia(item.id)) {
    debug('cannotTrack', { id: item.id, reason: 'no valid ID' });
    return;
  }

  const mediaKey = createCompositeKey(item.id, item.videoId);
  const progressRatio = getProgressRatio(item);
  const session = simkl.getOrCreateSession(mediaKey);

  // Start scrobble at threshold
  if (progressRatio >= SCROBBLE_THRESHOLDS.START && !session.hasStarted) {
    debug('scrobbleStart', { mediaKey, progressRatio });
    simkl.updateSession(mediaKey, { hasStarted: true, lastProgress: progressRatio });

    try {
      await scrobbleToSimkl(item, progressRatio);
    } catch (error) {
      debug('scrobbleStartFailed', { mediaKey, error });
      simkl.addToOfflineQueue({
        type: 'scrobble-start',
        payload: { item, progressRatio },
        createdAt: Date.now(),
      });
    }
  }

  // Finish scrobble at threshold
  if (progressRatio >= SCROBBLE_THRESHOLDS.FINISH && !session.hasFinished) {
    debug('scrobbleFinish', { mediaKey, progressRatio });
    simkl.updateSession(mediaKey, { hasFinished: true });

    try {
      await finishScrobbleOnSimkl(item);
      simkl.clearSession(mediaKey);
    } catch (error) {
      debug('scrobbleFinishFailed', { mediaKey, error });
      simkl.addToOfflineQueue({
        type: 'scrobble-finish',
        payload: { item },
        createdAt: Date.now(),
      });
    }
  }

  simkl.updateSession(mediaKey, { lastProgress: progressRatio });
};

/**
 * Initialize scrobble middleware
 * Subscribes to watch history store and triggers scrobbles
 */
export const initializeScrobbleMiddleware = (): (() => void) => {
  useSimklStore.getState().clearExpiredSessions();

  const unsubscribe = useWatchHistoryStore.subscribe(
    (state) => state.byProfile,
    (byProfile, prevByProfile) => {
      const activeProfileId = useWatchHistoryStore.getState().activeProfileId;
      if (!activeProfileId) return;

      const currentItems = byProfile[activeProfileId] ?? {};
      const prevItems = prevByProfile[activeProfileId] ?? {};

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        for (const [key, item] of Object.entries(currentItems)) {
          const prevItem = prevItems[key];

          if (
            prevItem &&
            prevItem.progressSeconds === item.progressSeconds &&
            prevItem.lastWatchedAt === item.lastWatchedAt
          ) {
            continue;
          }

          handleSimklScrobble(item).catch((err) => {
            debug('handleScrobbleFailed', { key, error: err });
          });
        }
      }, SCROBBLE_DEBOUNCE_MS);
    },
    { fireImmediately: false }
  );

  debug('initialized');

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debug('destroyed');
  };
};
```

---

## Sync Manager (Functional)

```typescript
// src/api/tracking/sync. ts

import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { useSimklStore } from '@/store/simkl.store';
import { useTrackingStore } from '@/store/tracking.store';
import { pullFromSimkl, pushToSimkl, processSimklOfflineQueue } from '@/api/simkl/sync';
import { SYNC_INTERVAL_MS } from '@/constants/tracking';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('Sync');

let lastSyncAt = 0;
let isSyncing = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let netInfoSubscription: ReturnType<typeof NetInfo.addEventListener> | null = null;

type Provider = {
  id: string;
  pull: () => Promise<number>;
  push: () => Promise<number>;
  processQueue: () => Promise<void>;
};

const getEnabledProviders = (): Provider[] => {
  const providers: Provider[] = [];

  const simkl = useSimklStore.getState();
  if (simkl.isConnected) {
    providers.push({
      id: 'simkl',
      pull: pullFromSimkl,
      push: pushToSimkl,
      processQueue: processSimklOfflineQueue,
    });
  }

  // Future:  Add Trakt here

  return providers;
};

export const performSync = async (): Promise<{ pulled: number; pushed: number }> => {
  if (isSyncing) {
    debug('syncSkipped', { reason: 'already syncing' });
    return { pulled: 0, pushed: 0 };
  }

  const providers = getEnabledProviders();
  if (providers.length === 0) {
    debug('syncSkipped', { reason: 'no providers' });
    return { pulled: 0, pushed: 0 };
  }

  const { autoSyncEnabled } = useTrackingStore.getState();
  if (!autoSyncEnabled) {
    debug('syncSkipped', { reason: 'auto-sync disabled' });
    return { pulled: 0, pushed: 0 };
  }

  isSyncing = true;
  useTrackingStore.getState().setSyncState('syncing');

  let totalPulled = 0;
  let totalPushed = 0;

  try {
    for (const provider of providers) {
      try {
        const pulled = await provider.pull();
        totalPulled += pulled;
        debug('pullComplete', { provider: provider.id, pulled });

        const pushed = await provider.push();
        totalPushed += pushed;
        debug('pushComplete', { provider: provider.id, pushed });
      } catch (error) {
        debug('providerSyncFailed', { provider: provider.id, error });
      }
    }

    lastSyncAt = Date.now();
    useTrackingStore.getState().setLastSyncAt(lastSyncAt);
    useTrackingStore.getState().setSyncStats({
      itemsPulled: totalPulled,
      itemsPushed: totalPushed,
    });
    useTrackingStore.getState().setSyncState('idle');

    debug('syncComplete', { pulled: totalPulled, pushed: totalPushed });
  } catch (error) {
    useTrackingStore.getState().setSyncState('error');
    debug('syncFailed', { error });
  } finally {
    isSyncing = false;
  }

  return { pulled: totalPulled, pushed: totalPushed };
};

export const triggerSyncIfNeeded = async (): Promise<void> => {
  const timeSinceLastSync = Date.now() - lastSyncAt;
  if (timeSinceLastSync < SYNC_INTERVAL_MS) {
    debug('syncSkipped', { reason: 'too recent', timeSinceLastSync });
    return;
  }

  await performSync();
};

const processOfflineQueues = async (): Promise<void> => {
  const providers = getEnabledProviders();
  for (const provider of providers) {
    try {
      await provider.processQueue();
    } catch (error) {
      debug('offlineQueueFailed', { provider: provider.id, error });
    }
  }
};

export const initializeSyncListeners = (): (() => void) => {
  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      triggerSyncIfNeeded();
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  netInfoSubscription = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      processOfflineQueues();
      triggerSyncIfNeeded();
    } else {
      useTrackingStore.getState().setSyncState('offline');
    }
  });

  debug('listenersInitialized');

  return () => {
    appStateSubscription?.remove();
    netInfoSubscription?.();
    debug('listenersDestroyed');
  };
};
```

---

## Sync Status Indicator (Continue Watching Header)

```typescript
// src/components/tracking/TrackingSyncIndicator.tsx

import React from 'react';
import type { FC } from 'react';
import { ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Box } from '@/theme/theme';
import { useTrackingStore } from '@/store/tracking. store';
import { useSimklStore } from '@/store/simkl.store';

const SIMKL_ICON_URL = 'https://simkl.com/favicon.ico';

type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

interface ProviderIndicatorProps {
  iconUrl: string;
  syncState: SyncState;
  providerName: string;
}

const ProviderIndicator:  FC<ProviderIndicatorProps> = ({
  iconUrl,
  syncState,
  providerName,
}) => {
  const getIndicatorColor = (): string => {
    switch (syncState) {
      case 'syncing':
        return 'primary';
      case 'error':
        return 'error';
      case 'offline':
        return 'warning';
      default:
        return 'success';
    }
  };

  return (
    <Box
      position="relative"
      width={24}
      height={24}
      accessibilityLabel={`${providerName} sync status:  ${syncState}`}
    >
      <Image
        source={{ uri: iconUrl }}
        style={{
          width: 20,
          height:  20,
          borderRadius: 4,
          opacity: syncState === 'error' ? 0.5 : 1,
        }}
        contentFit="contain"
      />

      <Box
        position="absolute"
        bottom={-2}
        right={-2}
        width={10}
        height={10}
        borderRadius="full"
        backgroundColor={getIndicatorColor()}
        alignItems="center"
        justifyContent="center"
      >
        {syncState === 'syncing' && <ActivityIndicator size={6} color="white" />}
      </Box>
    </Box>
  );
};

export const TrackingSyncIndicator: FC = () => {
  const simklConnected = useSimklStore((s) => s.isConnected);
  const syncState = useTrackingStore((s) => s.syncState);

  if (!simklConnected) {
    return null;
  }

  return (
    <Box flexDirection="row" alignItems="center" gap="xs">
      {simklConnected && (
        <ProviderIndicator
          iconUrl={SIMKL_ICON_URL}
          syncState={syncState}
          providerName="Simkl"
        />
      )}
    </Box>
  );
};
```

---

## Update Home Screen Section Header

```typescript
// src/app/(tabs)/index.tsx - Update HomeSectionHeader

import { TrackingSyncIndicator } from '@/components/tracking/TrackingSyncIndicator';

interface HomeSectionHeaderProps {
  section: SectionModel;
}

const HomeSectionHeader:  FC<HomeSectionHeaderProps> = ({ section }) => (
  <Box
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    marginTop="m"
    marginBottom="s"
    marginHorizontal="m"
  >
    <Box>
      <Text variant="subheader">{section.title}</Text>
      {section.type && (
        <Text variant="caption" color="textSecondary" textTransform="capitalize">
          {section.type}
        </Text>
      )}
    </Box>

    {/* Show sync indicator on Continue Watching section */}
    {section. key === 'continue-watching' && <TrackingSyncIndicator />}
  </Box>
);
```

---

## Settings: Integrations Page

### Add to Menu

```typescript
// src/constants/settings.ts - Add integrations

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  // ... existing items ...
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect Simkl, Trakt for cross-device sync',
    icon: 'cloud-outline',
    href: '/settings/integrations',
  },
];
```

### Main Content

```typescript
// src/components/settings/IntegrationsSettingsContent.tsx

import React from 'react';
import type { FC } from 'react';
import { ScrollView } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { SimklIntegrationSection } from './integrations/SimklIntegrationSection';
import { TraktComingSoonSection } from './integrations/TraktComingSoonSection';
import { SyncSettingsSection } from './integrations/SyncSettingsSection';

export const IntegrationsSettingsContent: FC = () => {
  return (
    <ScrollView>
      <Box gap="l" padding="m">
        <Box>
          <Text variant="header" color="textPrimary">
            Integrations
          </Text>
          <Text variant="caption" color="textSecondary" marginTop="xs">
            Connect external services to sync watch history across devices.
          </Text>
        </Box>

        <SimklIntegrationSection />
        <TraktComingSoonSection />
        <SyncSettingsSection />
      </Box>
    </ScrollView>
  );
};
```

### Simkl Section

```typescript
// src/components/settings/integrations/SimklIntegrationSection.tsx

import React, { useState, useCallback } from 'react';
import type { FC } from 'react';
import { Image } from 'expo-image';
import { Box, Text } from '@/theme/theme';
import { Switch } from '@/components/basic/Switch';
import { Focusable } from '@/components/basic/Focusable';
import { useSimklStore } from '@/store/simkl.store';
import { isSimklConfigured } from '@/utils/env';
import { SimklPinAuthFlow } from './SimklPinAuthFlow';

const SIMKL_LOGO_URL = 'https://simkl.com/favicon. ico';

interface ProviderHeaderProps {
  logoUrl: string;
  name: string;
  description: string;
  isConnected: boolean;
}

const ProviderHeader: FC<ProviderHeaderProps> = ({
  logoUrl,
  name,
  description,
  isConnected,
}) => (
  <Box flexDirection="row" alignItems="center" gap="m">
    <Image
      source={{ uri:  logoUrl }}
      style={{ width: 32, height: 32, borderRadius: 8 }}
      contentFit="contain"
    />
    <Box flex={1}>
      <Text variant="body" color="textPrimary">
        {name}
      </Text>
      <Text variant="caption" color="textSecondary">
        {description}
      </Text>
    </Box>
    <Box
      backgroundColor={isConnected ?  'success' : 'surfaceTertiary'}
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="s"
    >
      <Text variant="caption" color={isConnected ? 'textPrimary' : 'textSecondary'}>
        {isConnected ? 'Connected' : 'Not connected'}
      </Text>
    </Box>
  </Box>
);

interface ConnectedStateProps {
  userName?:  string;
  scrobblingEnabled:  boolean;
  onScrobblingChange: (enabled: boolean) => void;
  onDisconnect: () => void;
}

const ConnectedState:  FC<ConnectedStateProps> = ({
  userName,
  scrobblingEnabled,
  onScrobblingChange,
  onDisconnect,
}) => (
  <Box gap="m">
    <Box flexDirection="row" gap="s" paddingVertical="s">
      <Text variant="caption" color="textSecondary">
        Logged in as:
      </Text>
      <Text variant="body" color="textPrimary">
        {userName ??  'Unknown'}
      </Text>
    </Box>

    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Box flex={1}>
        <Text variant="body" color="textPrimary">
          Scrobbling
        </Text>
        <Text variant="caption" color="textSecondary">
          Track "Now Watching" status
        </Text>
      </Box>
      <Switch value={scrobblingEnabled} onValueChange={onScrobblingChange} />
    </Box>

    <Focusable onPress={onDisconnect}>
      <Box backgroundColor="error" padding="s" borderRadius="s" alignItems="center">
        <Text variant="caption" color="textPrimary">
          Disconnect
        </Text>
      </Box>
    </Focusable>
  </Box>
);

export const SimklIntegrationSection: FC = () => {
  const isConnected = useSimklStore((s) => s.isConnected);
  const user = useSimklStore((s) => s.user);
  const scrobblingEnabled = useSimklStore((s) => s.scrobblingEnabled);
  const setScrobblingEnabled = useSimklStore((s) => s.setScrobblingEnabled);
  const disconnect = useSimklStore((s) => s.disconnect);

  const [showAuth, setShowAuth] = useState(false);

  const handleConnected = useCallback(() => {
    setShowAuth(false);
  }, []);

  const handleCancel = useCallback(() => {
    setShowAuth(false);
  }, []);

  if (!isSimklConfigured()) {
    return (
      <Box backgroundColor="surfaceTertiary" borderRadius="m" padding="m">
        <Text variant="body" color="textSecondary">
          Simkl integration not configured
        </Text>
      </Box>
    );
  }

  return (
    <Box backgroundColor="surfaceSecondary" borderRadius="m" padding="m" gap="m">
      <ProviderHeader
        logoUrl={SIMKL_LOGO_URL}
        name="Simkl"
        description="Track movies, TV shows & anime"
        isConnected={isConnected}
      />

      {! isConnected ?  (
        showAuth ? (
          <SimklPinAuthFlow onComplete={handleConnected} onCancel={handleCancel} />
        ) : (
          <Focusable onPress={() => setShowAuth(true)}>
            <Box backgroundColor="primary" padding="m" borderRadius="m" alignItems="center">
              <Text variant="body" color="textPrimary">
                Connect to Simkl
              </Text>
            </Box>
          </Focusable>
        )
      ) : (
        <ConnectedState
          userName={user?. name}
          scrobblingEnabled={scrobblingEnabled}
          onScrobblingChange={setScrobblingEnabled}
          onDisconnect={disconnect}
        />
      )}
    </Box>
  );
};
```

### Simkl PIN Auth Flow

```typescript
// src/components/settings/integrations/SimklPinAuthFlow.tsx

import React, { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { Box, Text } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { requestPinCode, pollPinStatus, completePinAuth } from '@/api/simkl/auth';

type AuthState = 'idle' | 'loading' | 'showing-pin' | 'polling' | 'success' | 'error' | 'expired';

interface SimklPinAuthFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const SimklPinAuthFlow: FC<SimklPinAuthFlowProps> = ({ onComplete, onCancel }) => {
  const [state, setState] = useState<AuthState>('idle');
  const [pinCode, setPinCode] = useState<string>('');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const startAuth = useCallback(async () => {
    setState('loading');
    setError('');

    try {
      const pinData = await requestPinCode();
      setPinCode(pinData.user_code);
      setVerificationUrl(pinData.verification_url);
      setState('showing-pin');

      const controller = new AbortController();
      setAbortController(controller);
      setState('polling');

      const accessToken = await pollPinStatus(pinData.user_code, {
        interval: pinData.interval,
        expiresIn: pinData.expires_in,
        signal:  controller.signal,
      });

      const success = await completePinAuth(accessToken);

      if (success) {
        setState('success');
        setTimeout(onComplete, 1500);
      } else {
        setState('error');
        setError('Failed to get user info');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'PIN code expired') {
          setState('expired');
        } else if (err.message === 'PIN auth cancelled') {
          setState('idle');
        } else {
          setState('error');
          setError(err.message);
        }
      } else {
        setState('error');
        setError('Unknown error');
      }
    }
  }, [onComplete]);

  const cancelAuth = useCallback(() => {
    abortController?.abort();
    onCancel();
  }, [abortController, onCancel]);

  useEffect(() => {
    startAuth();

    return () => {
      abortController?.abort();
    };
  }, []);

  if (state === 'loading') {
    return (
      <Box alignItems="center" padding="m">
        <LoadingIndicator />
        <Text variant="caption" color="textSecondary" marginTop="s">
          Getting PIN code...
        </Text>
      </Box>
    );
  }

  if (state === 'showing-pin' || state === 'polling') {
    return (
      <Box alignItems="center" gap="m">
        <Box backgroundColor="surfaceTertiary" padding="l" borderRadius="m" alignItems="center">
          <Text variant="caption" color="textSecondary" textAlign="center">
            On your phone or computer, go to:
          </Text>
          <Text variant="subheader" color="primary" textAlign="center" marginTop="s">
            {verificationUrl}
          </Text>
          <Text variant="caption" color="textSecondary" textAlign="center" marginTop="m">
            And enter this code:
          </Text>
          <Text
            variant="header"
            color="textPrimary"
            textAlign="center"
            marginTop="s"
            style={{ fontSize: 36, letterSpacing: 8 }}
          >
            {pinCode}
          </Text>
        </Box>

        {state === 'polling' && (
          <Box flexDirection="row" alignItems="center" gap="s">
            <LoadingIndicator size="small" />
            <Text variant="caption" color="textSecondary">
              Waiting for authorization...
            </Text>
          </Box>
        )}

        <Focusable onPress={cancelAuth}>
          <Box padding="s">
            <Text variant="caption" color="textSecondary">
              Cancel
            </Text>
          </Box>
        </Focusable>
      </Box>
    );
  }

  if (state === 'success') {
    return (
      <Box alignItems="center" gap="m" padding="m">
        <Text variant="subheader" color="success">
          ✓ Connected!
        </Text>
        <Text variant="caption" color="textSecondary" textAlign="center">
          Your watch history will now sync across all your devices.
        </Text>
      </Box>
    );
  }

  if (state === 'expired') {
    return (
      <Box alignItems="center" gap="m">
        <Text variant="body" color="error">
          PIN code expired
        </Text>
        <Focusable onPress={startAuth}>
          <Box backgroundColor="primary" padding="m" borderRadius="m">
            <Text variant="body" color="textPrimary">
              Try Again
            </Text>
          </Box>
        </Focusable>
        <Focusable onPress={cancelAuth}>
          <Box padding="s">
            <Text variant="caption" color="textSecondary">
              Cancel
            </Text>
          </Box>
        </Focusable>
      </Box>
    );
  }

  if (state === 'error') {
    return (
      <Box alignItems="center" gap="m">
        <Text variant="body" color="error">
          {error || 'Something went wrong'}
        </Text>
        <Focusable onPress={startAuth}>
          <Box backgroundColor="primary" padding="m" borderRadius="m">
            <Text variant="body" color="textPrimary">
              Try Again
            </Text>
          </Box>
        </Focusable>
        <Focusable onPress={cancelAuth}>
          <Box padding="s">
            <Text variant="caption" color="textSecondary">
              Cancel
            </Text>
          </Box>
        </Focusable>
      </Box>
    );
  }

  return null;
};
```

### Trakt Coming Soon

```typescript
// src/components/settings/integrations/TraktComingSoonSection.tsx

import React from 'react';
import type { FC } from 'react';
import { Box, Text } from '@/theme/theme';

export const TraktComingSoonSection: FC = () => (
  <Box backgroundColor="surfaceTertiary" borderRadius="m" padding="m" opacity={0.6}>
    <Box flexDirection="row" alignItems="center" gap="m">
      <Box
        width={32}
        height={32}
        borderRadius="m"
        backgroundColor="surfaceSecondary"
        alignItems="center"
        justifyContent="center"
      >
        <Text variant="caption" color="textSecondary">
          T
        </Text>
      </Box>
      <Box flex={1}>
        <Text variant="body" color="textSecondary">
          Trakt
        </Text>
        <Text variant="caption" color="textTertiary">
          Coming soon
        </Text>
      </Box>
    </Box>
  </Box>
);
```

### Sync Settings Section

```typescript
// src/components/settings/integrations/SyncSettingsSection.tsx

import React, { useState, useCallback } from 'react';
import type { FC } from 'react';
import { Box, Text } from '@/theme/theme';
import { Switch } from '@/components/basic/Switch';
import { Focusable } from '@/components/basic/Focusable';
import { useTrackingStore } from '@/store/tracking. store';
import { useSimklStore } from '@/store/simkl.store';
import { performSync } from '@/api/tracking/sync';
import { formatDistanceToNow } from 'date-fns';

export const SyncSettingsSection: FC = () => {
  const simklConnected = useSimklStore((s) => s.isConnected);

  const autoSyncEnabled = useTrackingStore((s) => s.autoSyncEnabled);
  const setAutoSyncEnabled = useTrackingStore((s) => s.setAutoSyncEnabled);
  const lastSyncAt = useTrackingStore((s) => s.lastSyncAt);
  const syncStats = useTrackingStore((s) => s.syncStats);
  const syncState = useTrackingStore((s) => s.syncState);

  const [isSyncing, setIsSyncing] = useState(false);

  const hasConnectedProvider = simklConnected;
  if (!hasConnectedProvider) return null;

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await performSync();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const isCurrentlySyncing = isSyncing || syncState === 'syncing';

  return (
    <Box backgroundColor="surfaceSecondary" borderRadius="m" padding="m" gap="m">
      <Text variant="subheader" color="textPrimary">
        Sync Settings
      </Text>

      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flex={1}>
          <Text variant="body" color="textPrimary">
            Auto-Sync
          </Text>
          <Text variant="caption" color="textSecondary">
            Sync automatically on app launch
          </Text>
        </Box>
        <Switch value={autoSyncEnabled} onValueChange={setAutoSyncEnabled} />
      </Box>

      <Box gap="xs" paddingTop="s" borderTopWidth={1} borderTopColor="border">
        <Text variant="caption" color="textSecondary">
          Last synced:{' '}
          {lastSyncAt ? formatDistanceToNow(lastSyncAt, { addSuffix: true }) : 'Never'}
        </Text>
        {syncStats && (
          <>
            <Text variant="caption" color="textSecondary">
              Items pulled: {syncStats. itemsPulled}
            </Text>
            <Text variant="caption" color="textSecondary">
              Items pushed: {syncStats. itemsPushed}
            </Text>
          </>
        )}
        {syncState === 'error' && syncStats?. lastError && (
          <Text variant="caption" color="error">
            Error: {syncStats.lastError}
          </Text>
        )}
      </Box>

      <Focusable onPress={handleSyncNow} disabled={isCurrentlySyncing}>
        <Box
          backgroundColor={isCurrentlySyncing ? 'surfaceTertiary' : 'primary'}
          padding="m"
          borderRadius="m"
          alignItems="center"
        >
          <Text variant="body" color="textPrimary">
            {isCurrentlySyncing ? 'Syncing...' : 'Sync Now'}
          </Text>
        </Box>
      </Focusable>
    </Box>
  );
};
```

---

## App Layout Integration

```typescript
// src/app/_layout.tsx - Add initialization

import { useEffect } from 'react';
import { initializeScrobbleMiddleware } from '@/api/tracking/scrobble-middleware';
import { initializeSyncListeners, triggerSyncIfNeeded } from '@/api/tracking/sync';

export default function RootLayout() {
  // ...  existing code ...

  useEffect(() => {
    // Initialize scrobble middleware (watches store changes)
    const unsubscribeScrobble = initializeScrobbleMiddleware();

    // Initialize sync listeners (app state, network)
    const unsubscribeSync = initializeSyncListeners();

    // Trigger initial sync
    triggerSyncIfNeeded();

    return () => {
      unsubscribeScrobble();
      unsubscribeSync();
    };
  }, []);

  // ... rest of component
}
```

---

## File Structure

```
src/
├── api/
│   ├── simkl/
│   │   ├── auth.ts           # PIN auth functions
│   │   ├── client.ts         # API client functions
│   │   ├── lookup.ts         # Media ID resolution
│   │   ├── scrobble. ts       # Scrobble API calls
│   │   └── sync.ts           # Sync API calls
│   └── tracking/
│       ├── scrobble-middleware. ts  # Store subscription
│       └── sync. ts                 # Generic sync manager
├── components/
│   ├── settings/
│   │   ├── IntegrationsSettingsContent.tsx
│   │   └── integrations/
│   │       ├── SimklIntegrationSection.tsx
│   │       ├── SimklPinAuthFlow.tsx
│   │       ├── SyncSettingsSection. tsx
│   │       └── TraktComingSoonSection. tsx
│   └── tracking/
│       └── TrackingSyncIndicator.tsx
├── constants/
│   └── tracking.ts           # Thresholds, intervals
├── store/
│   ├── simkl.store. ts        # Simkl state + scrobble sessions
│   └── tracking.store.ts     # Global tracking state
└── utils/
    ├── env.ts                # Environment helpers
    └── video-id.ts           # ID parsing/formatting
```

---

## Summary

| Feature             | Implementation                                           |
| ------------------- | -------------------------------------------------------- |
| Environment config  | `EXPO_PUBLIC_SIMKL_CLIENT_ID` via `src/utils/env.ts`     |
| Auth flow           | PIN only (all devices), no OAuth                         |
| Components          | Arrow functions with `FC` types                          |
| Video ID utils      | `createVideoId`, `parseVideoId`, `createCompositeKey`    |
| Non-IMDB matching   | Simkl lookup by TMDB/TVDB/title, skip if no match        |
| Scrobble state      | In `useSimklStore. scrobbleSessions`                     |
| Reactive scrobbling | Store middleware via `subscribeWithSelector`             |
| Sync indicator      | `TrackingSyncIndicator` in Continue Watching header      |
| Settings            | Separate file-local components in `integrations/` folder |

---

## References

- **REF-001**: [Simkl API Documentation](https://simkl.docs.apiary.io/)
- **REF-002**: [Simkl PIN Authentication](https://simkl.docs.apiary.io/#reference/authentication-pin)
- **REF-003**: [DodoStream playback. ts](https://github.com/Kombustor/dodostream/blob/main/src/constants/playback.ts)
- **REF-004**: [DodoStream settings](https://github.com/Kombustor/dodostream/blob/main/src/constants/settings. ts)
