/**
 * In-memory database store for sync E2E tests.
 *
 * Implements the same interface as @/db/queries/* so the real sync services
 * (runImport / runExport) operate on this store instead of SQLite.
 *
 * Key design decisions:
 *  - Full functional implementation (not just call recording) so that
 *    import → export roundtrips work correctly.
 *  - Mirrors the exact function signatures from the real query modules.
 *  - Exposes `store` for assertions and `resetStore()` between test cases.
 */

import type { ContentType } from '../../src/types/stremio';

// ─── Types (mirrors src/db/queries/*) ───────────────────────────────────────

export type WatchHistorySource = 'internal' | 'simkl' | 'trakt';
export type WatchHistoryStatus = 'watching' | 'completed' | 'dismissed';
export type SyncAction = 'remove_history' | 'remove_watchlist';
export type SyncProvider = 'simkl' | 'trakt';

export interface DbWatchHistoryItem {
  id: string;
  type: ContentType;
  status: WatchHistoryStatus;
  source: WatchHistorySource;
  videoId?: string;
  progressSeconds: number;
  durationSeconds: number;
  lastWatchedAt: number;
}

export interface DbMyListItem {
  id: string;
  type: ContentType;
  addedAt: number;
  source?: WatchHistorySource;
}

export interface SyncQueueItem {
  id: number;
  profileId: string;
  provider: SyncProvider;
  action: SyncAction;
  metaId: string;
  type: ContentType;
  videoId: string | null;
  createdAt: number;
}

// ─── Store state ─────────────────────────────────────────────────────────────

/** Key: `${profileId}::${metaId}::${videoId ?? ''}` */
const watchHistoryMap = new Map<string, DbWatchHistoryItem & { profileId: string }>();

/** Key: `${profileId}::${metaId}` */
const myListMap = new Map<string, DbMyListItem & { profileId: string }>();

/** Auto-incrementing ID */
let syncQueueIdSeq = 1;
const syncQueueItems: SyncQueueItem[] = [];

/** Key: metaId */
const metaCacheMap = new Map<
  string,
  { metaId: string; type: string; name: string; poster?: string; year?: string; isPartial: boolean }
>();

/** Tracks which providers are "connected" per profile (for syncQueue logic) */
export const connectedProviders = new Map<string, Set<SyncProvider>>();

// ─── Public store accessor ───────────────────────────────────────────────────

export const store = {
  get watchHistory() {
    return watchHistoryMap;
  },
  get myList() {
    return myListMap;
  },
  get syncQueue() {
    return syncQueueItems;
  },
  get metaCache() {
    return metaCacheMap;
  },
};

export function resetStore(): void {
  watchHistoryMap.clear();
  myListMap.clear();
  syncQueueItems.length = 0;
  syncQueueIdSeq = 1;
  metaCacheMap.clear();
  connectedProviders.clear();
}

/** Register a provider as connected for a profile (needed for syncQueue writes) */
export function setConnectedProvider(profileId: string, provider: SyncProvider): void {
  if (!connectedProviders.has(profileId)) connectedProviders.set(profileId, new Set());
  connectedProviders.get(profileId)!.add(provider);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const PLAYBACK_FINISHED_RATIO = 0.9;

function watchHistoryKey(profileId: string, metaId: string, videoId: string): string {
  return `${profileId}::${metaId}::${videoId}`;
}

function myListKey(profileId: string, metaId: string): string {
  return `${profileId}::${metaId}`;
}

// ─── watchHistory queries ────────────────────────────────────────────────────

export const watchHistoryQueries = {
  async listWatchHistoryForProfile(profileId: string): Promise<DbWatchHistoryItem[]> {
    return Array.from(watchHistoryMap.values())
      .filter((r) => r.profileId === profileId)
      .map(({ profileId: _p, ...rest }) => rest as DbWatchHistoryItem);
  },

  async listExportableWatchHistoryForProfile(
    profileId: string,
    options: {
      status: WatchHistoryStatus;
      excludeSource: WatchHistorySource;
      minLastWatchedAt: number;
    }
  ): Promise<DbWatchHistoryItem[]> {
    return Array.from(watchHistoryMap.values())
      .filter(
        (r) =>
          r.profileId === profileId &&
          r.status === options.status &&
          r.source !== options.excludeSource &&
          r.lastWatchedAt > options.minLastWatchedAt
      )
      .map(({ profileId: _p, ...rest }) => rest as DbWatchHistoryItem);
  },

  async upsertWatchProgress(params: {
    profileId: string;
    metaId: string;
    videoId?: string;
    type: ContentType;
    progressSeconds: number;
    durationSeconds: number;
    source?: WatchHistorySource;
    lastWatchedAt?: number;
    onlyIfNewer?: boolean;
  }): Promise<void> {
    const videoId = params.videoId ?? '';
    const key = watchHistoryKey(params.profileId, params.metaId, videoId);
    const now = params.lastWatchedAt ?? Date.now();
    const ratio = params.durationSeconds > 0 ? params.progressSeconds / params.durationSeconds : 0;
    const status: WatchHistoryStatus = ratio >= PLAYBACK_FINISHED_RATIO ? 'completed' : 'watching';

    const existing = watchHistoryMap.get(key);
    if (params.onlyIfNewer && existing && existing.lastWatchedAt >= now) return;

    watchHistoryMap.set(key, {
      profileId: params.profileId,
      id: params.metaId,
      type: params.type,
      status,
      source: params.source ?? 'internal',
      videoId: videoId !== '' ? videoId : undefined,
      progressSeconds: params.progressSeconds,
      durationSeconds: params.durationSeconds,
      lastWatchedAt: now,
    });

    // Cancel pending sync removals for this item
    const toRemove = syncQueueItems.filter(
      (q) =>
        q.profileId === params.profileId &&
        q.metaId === params.metaId &&
        (q.action === 'remove_history' || q.action === 'remove_watchlist')
    );
    for (const item of toRemove) {
      const idx = syncQueueItems.indexOf(item);
      if (idx !== -1) syncQueueItems.splice(idx, 1);
    }
  },

  async getWatchHistoryItem(
    profileId: string,
    metaId: string,
    videoId?: string
  ): Promise<DbWatchHistoryItem | undefined> {
    for (const [, v] of watchHistoryMap) {
      if (
        v.profileId === profileId &&
        v.id === metaId &&
        (videoId === undefined || v.videoId === videoId)
      ) {
        const { profileId: _p, ...rest } = v;
        return rest as DbWatchHistoryItem;
      }
    }
    return undefined;
  },

  async dismissFromContinueWatching(profileId: string, metaId: string): Promise<void> {
    for (const [key, v] of watchHistoryMap) {
      if (v.profileId === profileId && v.id === metaId) {
        watchHistoryMap.set(key, { ...v, status: 'dismissed' });
      }
    }
  },

  async removeWatchHistoryItem(
    profileId: string,
    metaId: string,
    videoId?: string,
    ignoreProvider?: SyncProvider
  ): Promise<void> {
    const vid = videoId ?? '';
    const key = watchHistoryKey(profileId, metaId, vid);
    const existing = watchHistoryMap.get(key);
    if (!existing) return;
    watchHistoryMap.delete(key);
    await _addToSyncQueue(
      profileId,
      'remove_history',
      metaId,
      existing.type,
      vid || undefined,
      ignoreProvider
    );
  },

  async removeWatchHistoryMeta(
    profileId: string,
    metaId: string,
    ignoreProvider?: SyncProvider
  ): Promise<void> {
    const toDelete = Array.from(watchHistoryMap.entries()).filter(
      ([, v]) => v.profileId === profileId && v.id === metaId
    );
    if (toDelete.length === 0) return;
    const type = toDelete[0][1].type;
    for (const [key] of toDelete) watchHistoryMap.delete(key);
    await _addToSyncQueue(profileId, 'remove_history', metaId, type, undefined, ignoreProvider);
  },

  async removeProfileWatchHistory(profileId: string): Promise<void> {
    for (const [key, v] of watchHistoryMap.entries()) {
      if (v.profileId === profileId) watchHistoryMap.delete(key);
    }
  },
};

// ─── myList queries ──────────────────────────────────────────────────────────

export const myListQueries = {
  async addToMyList(
    profileId: string,
    metaId: string,
    type: ContentType,
    addedAt?: number,
    source?: WatchHistorySource
  ): Promise<void> {
    const key = myListKey(profileId, metaId);
    const now = addedAt ?? Date.now();
    myListMap.set(key, { profileId, id: metaId, type, addedAt: now, source: source ?? 'internal' });

    // Cancel pending watchlist removals
    const toRemove = syncQueueItems.filter(
      (q) => q.profileId === profileId && q.metaId === metaId && q.action === 'remove_watchlist'
    );
    for (const item of toRemove) {
      const idx = syncQueueItems.indexOf(item);
      if (idx !== -1) syncQueueItems.splice(idx, 1);
    }
  },

  async listExportableMyListForProfile(
    profileId: string,
    options?: { minAddedAt?: number }
  ): Promise<DbMyListItem[]> {
    return Array.from(myListMap.values())
      .filter(
        (r) => r.profileId === profileId && (!options?.minAddedAt || r.addedAt > options.minAddedAt)
      )
      .map(({ profileId: _p, ...rest }) => rest as DbMyListItem);
  },

  async removeFromMyList(
    profileId: string,
    metaId: string,
    ignoreProvider?: SyncProvider
  ): Promise<void> {
    const key = myListKey(profileId, metaId);
    const existing = myListMap.get(key);
    if (!existing) return;
    myListMap.delete(key);
    await _addToSyncQueue(
      profileId,
      'remove_watchlist',
      metaId,
      existing.type,
      undefined,
      ignoreProvider
    );
  },

  async removeProfileMyList(profileId: string): Promise<void> {
    for (const [key, v] of myListMap.entries()) {
      if (v.profileId === profileId) myListMap.delete(key);
    }
  },

  async listMyListForProfile(profileId: string): Promise<DbMyListItem[]> {
    return Array.from(myListMap.values())
      .filter((r) => r.profileId === profileId)
      .map(({ profileId: _p, ...rest }) => rest as DbMyListItem);
  },

  async countMyListForProfile(profileId: string): Promise<number> {
    return Array.from(myListMap.values()).filter((r) => r.profileId === profileId).length;
  },
};

// ─── syncQueue queries ───────────────────────────────────────────────────────

async function _addToSyncQueue(
  profileId: string,
  action: SyncAction,
  metaId: string,
  type: ContentType,
  videoId?: string,
  ignoreProvider?: SyncProvider
): Promise<void> {
  // Determine which providers are active for this profile
  const providers = connectedProviders.get(profileId) ?? new Set<SyncProvider>();
  const now = Date.now();

  for (const provider of providers) {
    if (provider === ignoreProvider) continue;
    syncQueueItems.push({
      id: syncQueueIdSeq++,
      profileId,
      provider,
      action,
      metaId,
      type,
      videoId: videoId ?? null,
      createdAt: now,
    });
  }
}

export const syncQueueQueries = {
  async addToSyncQueue(
    profileId: string,
    action: SyncAction,
    metaId: string,
    type: ContentType,
    videoId?: string,
    ignoreProvider?: SyncProvider
  ): Promise<void> {
    await _addToSyncQueue(profileId, action, metaId, type, videoId, ignoreProvider);
  },

  async cancelPendingSyncRemovals(
    profileId: string,
    metaId: string,
    actions: SyncAction[]
  ): Promise<void> {
    for (let i = syncQueueItems.length - 1; i >= 0; i--) {
      const q = syncQueueItems[i];
      if (q.profileId === profileId && q.metaId === metaId && actions.includes(q.action)) {
        syncQueueItems.splice(i, 1);
      }
    }
  },

  async listSyncQueueForProvider(
    profileId: string,
    provider: SyncProvider
  ): Promise<SyncQueueItem[]> {
    return syncQueueItems.filter((q) => q.profileId === profileId && q.provider === provider);
  },

  async deleteFromSyncQueue(ids: number[]): Promise<void> {
    for (let i = syncQueueItems.length - 1; i >= 0; i--) {
      if (ids.includes(syncQueueItems[i].id)) syncQueueItems.splice(i, 1);
    }
  },
};

// ─── metaCache queries ───────────────────────────────────────────────────────

export const metaCacheQueries = {
  async upsertMinimalMetaCache(params: {
    metaId: string;
    type: 'movie' | 'series';
    name: string;
    poster?: string;
    year?: string;
  }): Promise<void> {
    const existing = metaCacheMap.get(params.metaId);
    // Only update if not already a full (non-partial) entry
    if (!existing || existing.isPartial) {
      metaCacheMap.set(params.metaId, { ...params, isPartial: true });
    }
  },

  async upsertMetaCache(meta: {
    id: string;
    type: string;
    name: string;
    poster?: string;
  }): Promise<void> {
    metaCacheMap.set(meta.id, {
      metaId: meta.id,
      type: meta.type,
      name: meta.name,
      poster: meta.poster,
      isPartial: false,
    });
  },

  async isMetaCacheStale(): Promise<boolean> {
    return false;
  },
  async getStaleMetaIds(ids: string[]): Promise<string[]> {
    return [];
  },
  async getVideoForEntry(): Promise<null> {
    return null;
  },
  async getVideosForEntries(): Promise<Map<string, unknown>> {
    return new Map();
  },
};
