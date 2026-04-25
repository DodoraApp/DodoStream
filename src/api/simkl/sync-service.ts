import { createDebugLogger } from '@/utils/debug';
import { getSimklPosterUrl } from '@/utils/media-artwork';
import type { SimklActivities, SimklActivityCategory, SimklIds, SimklWatchedItem, SimklStatus, SimklAllItemsResponse } from '@/types/simkl';
import { getActivities, getAllItems, postHistory, postWatchlist, removeFromHistory } from './client';
import { resolveSimklIds } from './id-resolver';
import {
  listExportableWatchHistoryForProfile,
  listWatchHistoryForProfile,
  upsertWatchProgress,
  removeProfileWatchHistory,
  removeWatchHistoryMeta,
} from '@/db/queries/watchHistory';
import {
  listExportableMyListForProfile,
  removeFromMyList,
  removeProfileMyList,
  addToMyList,
} from '@/db/queries/myList';
import { listSyncQueueForProvider, deleteFromSyncQueue } from '@/db/queries/syncQueue';
import { upsertMinimalMetaCache } from '@/db/queries/metaCache';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { SimklConnection, SimklMediaType, SimklSyncCursors, SimklSyncCursor } from '@/types/integrations';
import type { ContentType } from '@/types/stremio';
import { parseVideoId } from '@/utils/id';

const debug = createDebugLogger('SimklSyncService');

const BATCH_SIZE = 50;

// Simple mutex to prevent concurrent imports for the same profile
const activeImports = new Set<string>();

interface HistoryIdsPayload {
  ids: Record<string, string | number>;
}

interface HistoryShowPayload extends HistoryIdsPayload {
  seasons: {
    number: number;
    episodes: { number: number }[];
  }[];
}

interface HistoryPayload {
  movies: HistoryIdsPayload[];
  shows: HistoryShowPayload[];
}

const SYNC_STATUSES: (keyof SimklSyncCursor)[] = [
  'all',
  'playback',
  'plantowatch',
  'watching',
  'completed',
  'hold',
  'dropped',
];

/**
 * Checks if a specific activity status needs synchronization.
 * Simkl activities provide timestamps for when a category or status last changed.
 */
function needsSync(activityCursor: string | object | undefined, storedCursor?: string): boolean {
  if (typeof activityCursor !== 'string') return false;
  if (!storedCursor) return true;
  return activityCursor > storedCursor;
}

export async function runImport(
  profileId: string,
  token: string,
  cursors?: SimklSyncCursors,
  opts?: { clearLocalFirst?: boolean }
): Promise<boolean> {
  if (activeImports.has(profileId)) {
    debug('importSkipped:Concurrent', { profileId });
    return true;
  }
  activeImports.add(profileId);

  try {
    debug('importStart', { profileId, hasCursors: !!cursors });

    const activities = await getActivities(token);
    const newCursors: SimklSyncCursors = { ...cursors };

    if (opts?.clearLocalFirst) {
      await removeProfileWatchHistory(profileId);
      await removeProfileMyList(profileId);
    }

    // Mapping Simkl internal keys to our display and response keys
    const typesToSync: {
      type: SimklMediaType;
      key: keyof SimklActivities;
      responseKey: keyof SimklAllItemsResponse;
    }[] = [
      { type: 'movies', key: 'movies', responseKey: 'movies' },
      { type: 'shows', key: 'tv_shows', responseKey: 'shows' },
      { type: 'anime', key: 'anime', responseKey: 'anime' },
    ];

    // 1. Process Removals First (Category-based to prevent cross-category deletion)
    // We group by our local ContentType because Simkl "Anime" can be either a movie or a series.
    // If we only checked Simkl's "Shows" list, we might accidentally delete Anime series.
    const removalCategories = [
      { contentType: 'movie' as ContentType, types: [typesToSync[0], typesToSync[2]] },
      { contentType: 'series' as ContentType, types: [typesToSync[1], typesToSync[2]] },
    ];

    for (const cat of removalCategories) {
      // Check if any Simkl type that maps to this local category had removals
      const typesNeedingSync = cat.types.filter((t) =>
        needsSync(activities[t.key]?.removed_from_list, cursors?.[t.key]?.removed_from_list)
      );

      if (typesNeedingSync.length > 0) {
        debug('syncRemovals', { profileId, contentType: cat.contentType });
        const currentMetaIds = new Set<string>();
        let anyFailed = false;

        // Fetch IDs for ALL Simkl types in this category to build a complete set of "what should stay"
        for (const t of cat.types) {
          const idsResponse = await getAllItems(token, t.type, undefined, 'ids_only');
          if (!idsResponse) {
            anyFailed = true; // Safety: abort cleanup if API fails to prevent DB wipe
            break;
          }
          const items =
            idsResponse?.[t.responseKey] ||
            idsResponse?.shows ||
            idsResponse?.movies ||
            idsResponse?.anime ||
            [];
          for (const item of items) {
            // Only add to the "stay" set if it actually matches the current category we are cleaning
            const itemContentType: ContentType = item.movie ? 'movie' : 'series';

            if (itemContentType === cat.contentType) {
              const metaId = getMetaIdFromWatchedItem(item);
              if (metaId) currentMetaIds.add(metaId);
            }
          }
        }

        if (!anyFailed) {
          await cleanupRemovedItems(profileId, cat.contentType, currentMetaIds);
          // Update cursors for all Simkl types that were checked
          for (const t of typesNeedingSync) {
            const timestamp = activities[t.key]?.removed_from_list;
            if (typeof timestamp === 'string') {
              if (!newCursors[t.key]) newCursors[t.key] = { ...cursors?.[t.key] };
              newCursors[t.key]!.removed_from_list = timestamp;
            }
          }
        }
      }
    }

    // 2. Process Additions and Updates
    for (const { type, key, responseKey } of typesToSync) {
      const typeActivities = activities[key];
      if (!typeActivities) continue;

      const typeCursors = cursors?.[key] || {};
      const newTypeCursors: SimklSyncCursor = { ...typeCursors, ...newCursors[key] };
      newCursors[key] = newTypeCursors;

      let oldestOutdatedCursor: string | undefined;
      let fullSyncRequired = false;
      let anyUpdates = false;

      const pendingTypeCursors: Partial<SimklSyncCursor> = {};

      for (const statusKey of SYNC_STATUSES) {
        if (statusKey === 'removed_from_list') continue; // Handled above

        const activity = typeActivities[statusKey];
        const cursor = typeCursors[statusKey];
        if (needsSync(activity, cursor)) {
          anyUpdates = true;
          if (typeof activity === 'string') {
            pendingTypeCursors[statusKey] = activity;
          }
          // If we have no local cursor for this status, we must fetch everything (full sync)
          if (!cursor) {
            fullSyncRequired = true;
          } else if (!oldestOutdatedCursor || cursor < oldestOutdatedCursor) {
            // Track the oldest cursor to fetch all items changed since then
            oldestOutdatedCursor = cursor;
          }
        }
      }

      if (anyUpdates) {
        const dateFrom = fullSyncRequired ? undefined : oldestOutdatedCursor;
        debug('syncUpdates', { profileId, type, dateFrom, fullSyncRequired });

        const extended = type === 'anime' ? 'full_anime_seasons' : 'full';
        const itemsResponse = await getAllItems(token, type, dateFrom, extended);
        const items = itemsResponse?.[responseKey] || itemsResponse?.shows || itemsResponse?.movies || itemsResponse?.anime || [];
        
        debug('syncUpdates:fetched', { type, count: items.length });

        const myListAdditions: { metaId: string; type: ContentType; addedAt?: number }[] = [];
        const historyUpserts: Parameters<typeof upsertImportedProgress>[0][] = [];
        const removals: { metaId: string; type: ContentType }[] = [];

        for (const item of items) {
          const itemStatus = item.status;
          // Content categorization: presence of 'movie' key determines type
          const contentType: ContentType = item.movie ? 'movie' : 'series';
          const metaId = getMetaIdFromWatchedItem(item);
          if (!metaId) continue;

          const mediaData = item.movie ?? item.show ?? item.anime;
          if (mediaData?.title) {
            await upsertMinimalMetaCache({
              metaId,
              type: contentType,
              name: mediaData.title,
              poster: getSimklPosterUrl(mediaData.poster),
              year: mediaData.year?.toString(),
            });
          }

          // Map Simkl status to our "My List"
          if (item.status === 'plantowatch' || item.status === 'watching' || item.status === 'hold') {
            myListAdditions.push({
              metaId,
              type: contentType,
              addedAt: item.added_to_watchlist_at ? new Date(item.added_to_watchlist_at).getTime() : undefined,
            });
          }

          // Map Simkl status to local watch history
          if (item.status === 'watching' || item.status === 'completed' || item.status === 'hold') {
            if (contentType === 'movie') {
              const param = collectMovieParam(profileId, item);
              if (param) historyUpserts.push(param);
            } else {
              const params = collectShowParams(profileId, item, contentType);
              historyUpserts.push(...params);
            }
          } else if (itemStatus === 'dropped') {
            // Dropped items are removed from local history/watchlist to keep it clean
            removals.push({ metaId, type: contentType });
          }
        }

        // Apply changes in batches for performance
        for (let i = 0; i < myListAdditions.length; i += BATCH_SIZE) {
          const batch = myListAdditions.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map((p) => addToMyList(profileId, p.metaId, p.type, p.addedAt)));
        }

        for (let i = 0; i < historyUpserts.length; i += BATCH_SIZE) {
          const batch = historyUpserts.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map((p) => upsertImportedProgress(p)));
        }

        for (const removal of removals) {
          await removeWatchHistoryMeta(profileId, removal.metaId);
          await removeFromMyList(profileId, removal.metaId);
        }

        // Success! Now update the cursors locally.
        Object.assign(newTypeCursors, pendingTypeCursors);
      }
    }

    useIntegrationsStore.getState().updateSimklCursors(profileId, newCursors);
    debug('importComplete', { profileId, newCursors });
    return true;
  } catch (error) {
    debug('importError', { profileId, error });
    return false;
  } finally {
    activeImports.delete(profileId);
  }
}

function getMetaIdFromWatchedItem(item: SimklWatchedItem): string | undefined {
  const ids = item.movie?.ids ?? item.show?.ids ?? item.anime?.ids;
  if (!ids) return undefined;
  return getMetaIdFromIds(ids);
}

/**
 * Removes local items that are no longer present in the Simkl list for a specific category.
 */
async function cleanupRemovedItems(
  profileId: string,
  contentType: ContentType,
  currentlyImportedMetaIds: Set<string>
): Promise<void> {
  try {
    const localHistory = await listWatchHistoryForProfile(profileId);

    const itemsToRemove = new Set<string>();
    for (const item of localHistory) {
      if (
        item.source === 'simkl' &&
        item.type === contentType &&
        !currentlyImportedMetaIds.has(item.id)
      ) {
        itemsToRemove.add(item.id);
      }
    }

    for (const metaId of itemsToRemove) {
      debug('cleanupRemovingItem', { metaId, type: contentType });
      await removeWatchHistoryMeta(profileId, metaId);
      await removeFromMyList(profileId, metaId);
    }
  } catch (error) {
    debug('cleanupError', { error });
  }
}

/**
 * Persists Simkl watch progress to local DB.
 * We use artificial duration (100) and progress (1 or 100) to represent state
 * since Simkl doesn't always provide second-accurate progress.
 */
async function upsertImportedProgress(params: {
  profileId: string;
  metaId: string;
  type: 'movie' | 'series';
  videoId?: string;
  watchedAt?: string;
  isCompleted?: boolean;
}): Promise<void> {
  const progressSeconds = params.isCompleted ? 100 : 1;
  const durationSeconds = 100;

  await upsertWatchProgress({
    profileId: params.profileId,
    metaId: params.metaId,
    videoId: params.videoId,
    type: params.type,
    source: 'simkl',
    progressSeconds,
    durationSeconds,
    lastWatchedAt: params.watchedAt ? new Date(params.watchedAt).getTime() : undefined,
  });
}

function collectMovieParam(
  profileId: string,
  item: SimklWatchedItem,
): Parameters<typeof upsertImportedProgress>[0] | undefined {
  const mediaData = item.movie ?? item.anime;
  if (!mediaData) return;
  const metaId = getMetaIdFromIds(mediaData.ids);
  if (!metaId) return;

  return {
    profileId,
    metaId,
    type: 'movie',
    watchedAt: item.last_watched_at,
    isCompleted: item.status === 'completed',
  };
}

function parseSimklLastWatched(lastWatched: string): { season: number; episode: number } | undefined {
  const match = lastWatched.match(/S(\d+)E(\d+)/i);
  if (match) {
    return {
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10),
    };
  }
  const matchE = lastWatched.match(/E(\d+)/i);
  if (matchE) {
    return {
      season: 1,
      episode: parseInt(matchE[1], 10),
    };
  }
  return undefined;
}

function collectShowParams(
  profileId: string,
  item: SimklWatchedItem,
  contentType: 'series' = 'series'
): Parameters<typeof upsertImportedProgress>[0][] {
  const out: Parameters<typeof upsertImportedProgress>[0][] = [];

  const mediaData = item.show ?? item.anime;
  if (!mediaData) return out;
  const metaId = getMetaIdFromIds(mediaData.ids);
  if (!metaId) return out;

  const hasEpisodeArrays = !!item.seasons || !!item.episodes;

  // Process per-episode history if detailed data is available
  if (item.seasons) {
    for (const season of item.seasons) {
      for (const episode of season.episodes) {
        out.push({
          profileId,
          metaId,
          videoId: `${metaId}:${season.number}:${episode.number}`,
          type: contentType,
          watchedAt: episode.watched_at || item.last_watched_at,
          isCompleted: item.status === 'completed' || !!episode.watched_at,
        });
      }
    }
    return out;
  }

  if (item.episodes) {
    for (const episode of item.episodes) {
      out.push({
        profileId,
        metaId,
        videoId: `${metaId}:1:${episode.number}`,
        type: contentType,
        watchedAt: episode.watched_at || item.last_watched_at,
        isCompleted: item.status === 'completed' || !!episode.watched_at,
      });
    }
    return out;
  }

  // Optimization: If a show is fully completed, we only store a series-level record.
  // Storing individual episode history for a finished show would trigger the app's
  // "Up Next" logic and make it appear in "Continue Watching".
  if (item.status === 'completed') {
    out.push({
      profileId,
      metaId,
      type: contentType,
      watchedAt: item.last_watched_at,
      isCompleted: true,
    });
    return out;
  }

  // Fallback for simple "last watched" strings (e.g. "S01E05")
  if (!hasEpisodeArrays) {
    if (item.last_watched) {
      const parsed = parseSimklLastWatched(item.last_watched);
      if (parsed) {
        out.push({
          profileId,
          metaId,
          videoId: `${metaId}:${parsed.season}:${parsed.episode}`,
          type: contentType,
          watchedAt: item.last_watched_at,
          isCompleted: false,
        });
      }
    } else if ((item.watched_episodes_count ?? 0) > 0) {
      // Final fallback: just store series-level progress if only a count is known
      out.push({
        profileId,
        metaId,
        type: contentType,
        watchedAt: item.last_watched_at,
        isCompleted: false,
      });
    }
  }

  return out;
}

function getMetaIdFromIds(ids: { imdb?: string; simkl?: number; kitsu?: number; mal?: number }): string | undefined {
  if (ids.imdb) return ids.imdb;
  if (ids.kitsu) return `kitsu:${ids.kitsu}`;
  if (ids.simkl) return String(ids.simkl);
  return undefined;
}

/**
 * Export local watch history to Simkl.
 * Fail-safe: errors are logged, never thrown.
 */
export async function runExport(profileId: string, token: string): Promise<boolean> {
  try {
    debug('exportStart', { profileId });

    const lastSyncAt = useIntegrationsStore.getState().lastSyncAt[profileId] || 0;

    // 0. Export Removals (Sync Queue)
    const queueItems = await listSyncQueueForProvider(profileId, 'simkl');
    const newRemovals = queueItems.filter((q) => q.createdAt > lastSyncAt);

    if (newRemovals.length > 0) {
      debug('exportRemovals', { count: newRemovals.length });
      const removalPayload = await buildRemovalPayload(newRemovals);

      if (removalPayload.movies.length > 0 || removalPayload.shows.length > 0) {
        await removeFromHistory(token, removalPayload);
        debug('exportRemovalsComplete', { movies: removalPayload.movies.length, shows: removalPayload.shows.length });
      }

      // Cleanup processed items
      const processedIds = newRemovals.map(r => r.id);
      await deleteFromSyncQueue(processedIds);
    }

    // 1. Export Watch History
    const completed = await listExportableWatchHistoryForProfile(profileId, {
      status: 'completed',
      excludeSource: 'simkl',
      minLastWatchedAt: lastSyncAt,
    });

    debug('exportHistoryItems', { completed: completed.length });

    const historyPayload = await buildExportPayload(completed);

    if (historyPayload.movies.length > 0 || historyPayload.shows.length > 0) {
      await postHistory(token, historyPayload);
      debug('exportHistoryComplete', { movies: historyPayload.movies.length, shows: historyPayload.shows.length });
    }

    // 2. Export Watchlist (My List)
    const myListItems = await listExportableMyListForProfile(profileId, {
      minAddedAt: lastSyncAt,
    });

    debug('exportWatchlistItems', { count: myListItems.length });

    const watchlistPayload = await buildWatchlistPayload(myListItems);

    if (watchlistPayload.movies.length > 0 || watchlistPayload.shows.length > 0) {
      await postWatchlist(token, watchlistPayload);
      debug('exportWatchlistComplete', { movies: watchlistPayload.movies.length, shows: watchlistPayload.shows.length });
    }

    return true;
  } catch (error) {
    debug('exportError', { profileId, error });
    return false;
  }
}

async function buildWatchlistPayload(
  items: Awaited<ReturnType<typeof listExportableMyListForProfile>>
): Promise<HistoryPayload> {
  const movies: any[] = [];
  const shows: any[] = [];

  for (const item of items) {
    const ids = await resolveSimklIds(item.id, item.type);
    if (!ids || Object.keys(ids).length === 0) {
      debug('exportWatchlistItemNotFound', { metaId: item.id });
      continue;
    }

    if (item.type === 'movie') {
      movies.push({ ids, to: 'plantowatch' });
    } else {
      shows.push({ ids, to: 'plantowatch' });
    }
  }

  return { movies, shows } as any;
}

async function buildRemovalPayload(
  removals: { metaId: string; type: ContentType; videoId: string | null }[]
): Promise<HistoryPayload> {
  const movies: HistoryIdsPayload[] = [];
  const showsMap = new Map<string, { ids: Record<string, string | number>; seasons: Map<number, Set<number>> }>();

  for (const item of removals) {
    const ids = await resolveSimklIds(item.metaId, item.type);
    if (!ids || Object.keys(ids).length === 0) {
      debug('exportRemovalItemNotFound', { metaId: item.metaId });
      continue;
    }

    const payloadIds = toHistoryIdsPayload(ids);
    if (!payloadIds) {
      debug('exportRemovalItemInvalidIds', { metaId: item.metaId });
      continue;
    }

    if (item.type === 'movie') {
      movies.push({ ids: payloadIds });
      continue;
    }

    if (!item.videoId) {
      // Remove whole show
      if (!showsMap.has(item.metaId)) {
        showsMap.set(item.metaId, { ids: payloadIds, seasons: new Map() });
      }
      continue;
    }

    const episodeRef = parseVideoId(item.videoId);
    if (!episodeRef) continue;

    if (!showsMap.has(item.metaId)) {
      showsMap.set(item.metaId, {
        ids: payloadIds,
        seasons: new Map(),
      });
    }
    const show = showsMap.get(item.metaId);
    if (!show) continue;
    if (!show.seasons.has(episodeRef.season)) {
      show.seasons.set(episodeRef.season, new Set());
    }
    show.seasons.get(episodeRef.season)?.add(episodeRef.episode);
  }

  const shows: HistoryShowPayload[] = Array.from(showsMap.values()).map((show) => {
    if (show.seasons.size === 0) {
      return { ids: show.ids } as unknown as HistoryShowPayload; // Valid for whole show removal
    }
    return {
      ids: show.ids,
      seasons: Array.from(show.seasons.entries()).map(([seasonNum, episodes]) => ({
        number: seasonNum,
        episodes: Array.from(episodes).map((episodeNumber) => ({ number: episodeNumber })),
      })),
    };
  });

  return { movies, shows };
}

async function buildExportPayload(
  completed: Awaited<ReturnType<typeof listWatchHistoryForProfile>>
): Promise<HistoryPayload> {
  const movies: HistoryIdsPayload[] = [];
  const showsMap = new Map<string, { ids: Record<string, string | number>; seasons: Map<number, Set<number>> }>();

  for (const item of completed) {
    const ids = await resolveSimklIds(item.id, item.type);
    if (!ids || Object.keys(ids).length === 0) {
      debug('exportItemNotFound', { metaId: item.id });
      continue;
    }

    const payloadIds = toHistoryIdsPayload(ids);
    if (!payloadIds) {
      debug('exportItemInvalidIds', { metaId: item.id });
      continue;
    }

    if (item.type === 'movie') {
      movies.push({ ids: payloadIds });
      continue;
    }

    const episodeRef = item.videoId ? parseVideoId(item.videoId) : null;
    if (!episodeRef) {
      debug('exportItemInvalidVideoId', { metaId: item.id, videoId: item.videoId });
      continue;
    }

    if (!showsMap.has(item.id)) {
      showsMap.set(item.id, {
        ids: payloadIds,
        seasons: new Map(),
      });
    }

    const show = showsMap.get(item.id);
    if (!show) continue;
    if (!show.seasons.has(episodeRef.season)) {
      show.seasons.set(episodeRef.season, new Set());
    }
    show.seasons.get(episodeRef.season)?.add(episodeRef.episode);
  }

  const shows: HistoryShowPayload[] = Array.from(showsMap.values()).map((show) => ({
    ids: show.ids,
    seasons: Array.from(show.seasons.entries()).map(([seasonNum, episodes]) => ({
      number: seasonNum,
      episodes: Array.from(episodes).map((episodeNumber) => ({ number: episodeNumber })),
    })),
  }));

  return { movies, shows };
}

function toHistoryIdsPayload(ids: SimklIds): Record<string, string | number> | null {
  const payload: Record<string, string | number> = {};
  if (ids.simkl) payload.simkl = ids.simkl;
  if (ids.imdb) payload.imdb = ids.imdb;
  if (ids.tmdb) payload.tmdb = ids.tmdb;

  return Object.keys(payload).length > 0 ? payload : null;
}
