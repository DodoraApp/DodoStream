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

const IMPORT_PROGRESS_SECONDS = 100;
const IMPORT_DURATION_SECONDS = 100;

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

const SYNC_STATUSES: (keyof SimklSyncCursor)[] = ['plantowatch', 'watching', 'completed', 'dropped'];

function needsSync(activityCursor: string | object | undefined, storedCursor?: string): boolean {
  if (!activityCursor || typeof activityCursor === 'object') return false;
  if (!storedCursor) return true;
  return activityCursor > storedCursor;
}

export async function runImport(
  profileId: string,
  token: string,
  cursors?: SimklSyncCursors,
  opts?: { clearLocalFirst?: boolean }
): Promise<boolean> {
  try {
    debug('importStart', { profileId, hasCursors: !!cursors });

    const activities = await getActivities(token);
    const newCursors: SimklSyncCursors = { ...cursors };

    if (opts?.clearLocalFirst) {
      await removeProfileWatchHistory(profileId);
      await removeProfileMyList(profileId);
    }

    const typesToSync: { type: SimklMediaType; key: keyof SimklActivities; responseKey: keyof SimklAllItemsResponse }[] = [
      { type: 'movies', key: 'movies', responseKey: 'movies' },
      { type: 'shows', key: 'tv_shows', responseKey: 'shows' },
      { type: 'anime', key: 'anime', responseKey: 'anime' },
    ];

    for (const { type, key, responseKey } of typesToSync) {
      const typeActivities = activities[key];
      if (!typeActivities) continue;

      const typeCursors = cursors?.[key] || {};
      const newTypeCursors: SimklSyncCursor = { ...typeCursors };
      newCursors[key] = newTypeCursors;

      // 1. Process Removals First
      // When items are removed from a Simkl list, the `removed_from_list` activity timestamp updates.
      // To identify what was removed, we must fetch the entire list using `extended=ids_only` 
      // (without a date filter) and compare the returned IDs against our local database.
      const removedActivity = typeActivities.removed_from_list;
      const removedCursor = typeCursors.removed_from_list;
      const hasRemovals = needsSync(removedActivity, removedCursor);

      if (hasRemovals) {
        debug('syncRemovals', { profileId, type });
        const idsResponse = await getAllItems(token, type, undefined, 'ids_only');
        const items = idsResponse[responseKey] || [];
        const currentMetaIds = new Set<string>();
        for (const item of items) {
          const metaId = getMetaIdFromWatchedItem(item);
          if (metaId) currentMetaIds.add(metaId);
        }
        await cleanupRemovedItems(profileId, type, currentMetaIds);
        if (typeof removedActivity === 'string') {
          newTypeCursors.removed_from_list = removedActivity;
        }
      }

      // 2. Process Additions and Updates
      // Simkl tracks separate activity timestamps for each status (watching, completed, plantowatch, etc.).
      // Instead of making multiple API calls per status, we find the oldest outdated cursor among all statuses
      // and make a single API call to fetch all items updated since that time.
      // Track the earliest timestamp we need to fetch updates from.
      let oldestOutdatedCursor: string | undefined;
      // If any status is completely missing a cursor, we must do a full sync without a date filter.
      let fullSyncRequired = false;
      // Flag to track if there is any new activity across all tracked statuses.
      let anyUpdates = false;

      for (const status of SYNC_STATUSES) {
        const activity = typeActivities[status];
        const cursor = typeCursors[status];
        if (needsSync(activity, cursor)) {
          anyUpdates = true;
          if (typeof activity === 'string') {
            newTypeCursors[status] = activity;
          }
          if (!cursor) {
            fullSyncRequired = true;
          } else if (!oldestOutdatedCursor || cursor < oldestOutdatedCursor) {
            oldestOutdatedCursor = cursor;
          }
        }
      }

      if (anyUpdates) {
        const dateFrom = fullSyncRequired ? undefined : oldestOutdatedCursor;
        debug('syncUpdates', { profileId, type, dateFrom, fullSyncRequired });

        const itemsResponse = await getAllItems(token, type, dateFrom, 'full');
        const items = itemsResponse[responseKey] || [];

        const myListAdditions: { metaId: string; type: ContentType; addedAt?: number }[] = [];
        const historyUpserts: Parameters<typeof upsertImportedProgress>[0][] = [];
        const removals: { metaId: string; type: ContentType }[] = [];

        for (const item of items) {
          const contentType: ContentType = type === 'movies' ? 'movie' : 'series';
          const metaId = getMetaIdFromWatchedItem(item);
          if (!metaId) continue;

          const title = item.movie?.title ?? item.show?.title;
          const posterValue =
            item.movie?.poster ??
            item.show?.poster;
          if (title) {
            await upsertMinimalMetaCache({
              metaId,
              type: contentType,
              name: title,
              poster: getSimklPosterUrl(posterValue),
              year: (item.movie?.year ?? item.show?.year)?.toString(),
            });
          }

          // 3. Route items based on their status
          // 'plantowatch' items are added to My List.
          // 'watching' and 'completed' items update the Watch History with watch dates and episode counts.
          // 'dropped' items are actively removed from both My List and Watch History.
          if (item.status === 'plantowatch') {
            myListAdditions.push({
              metaId,
              type: contentType,
              addedAt: item.added_to_watchlist_at ? new Date(item.added_to_watchlist_at).getTime() : undefined,
            });
          } else if (item.status === 'watching' || item.status === 'completed') {
            if (type === 'movies' && item.movie) {
              const param = collectMovieParam(profileId, item);
              if (param) historyUpserts.push(param);
            } else if ((type === 'shows' || type === 'anime') && item.show) {
              const params = collectShowParams(profileId, item);
              historyUpserts.push(...params);
            }
          } else if (item.status === 'dropped') {
            removals.push({ metaId, type: contentType });
          }
        }

        // Apply changes in batches
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
      }
    }

    useIntegrationsStore.getState().updateSimklCursors(profileId, newCursors);
    debug('importComplete', { profileId, newCursors });
    return true;
  } catch (error) {
    debug('importError', { profileId, error });
    return false;
  }
}

function getMetaIdFromWatchedItem(item: SimklWatchedItem): string | undefined {
  const ids = item.movie?.ids ?? item.show?.ids;
  if (!ids) return undefined;
  return getMetaIdFromIds(ids);
}

async function cleanupRemovedItems(
  profileId: string,
  type: SimklMediaType,
  currentlyImportedMetaIds: Set<string>
): Promise<void> {
  try {
    const localHistory = await listWatchHistoryForProfile(profileId);
    const contentType: ContentType = type === 'movies' ? 'movie' : 'series';

    for (const item of localHistory) {
      if (item.source === 'simkl' && item.type === contentType && !currentlyImportedMetaIds.has(item.id)) {
        debug('cleanupRemovingItem', { metaId: item.id, type: item.type });
        await removeWatchHistoryMeta(profileId, item.id);
        await removeFromMyList(profileId, item.id);
      }
    }
  } catch (error) {
    debug('cleanupError', { error });
  }
}

async function upsertImportedProgress(params: {
  profileId: string;
  metaId: string;
  type: 'movie' | 'series';
  videoId?: string;
  watchedAt?: string;
}): Promise<void> {
  await upsertWatchProgress({
    profileId: params.profileId,
    metaId: params.metaId,
    videoId: params.videoId,
    type: params.type,
    source: 'simkl',
    progressSeconds: IMPORT_PROGRESS_SECONDS,
    durationSeconds: IMPORT_DURATION_SECONDS,
    lastWatchedAt: params.watchedAt ? new Date(params.watchedAt).getTime() : undefined,
  });
}

function collectMovieParam(
  profileId: string,
  item: SimklWatchedItem,
): Parameters<typeof upsertImportedProgress>[0] | undefined {
  if (!item.movie) return;
  const metaId = getMetaIdFromIds(item.movie.ids);
  if (!metaId) return;

  return { profileId, metaId, type: 'movie', watchedAt: item.last_watched_at };
}

function collectShowParams(
  profileId: string,
  item: SimklWatchedItem,
): Parameters<typeof upsertImportedProgress>[0][] {
  const out: Parameters<typeof upsertImportedProgress>[0][] = [];

  if (!item.show) return out;
  const metaId = getMetaIdFromIds(item.show.ids);
  if (!metaId) return out;

  const hasEpisodeArrays = !!item.seasons || !!item.episodes;

  if (item.seasons) {
    for (const season of item.seasons) {
      for (const episode of season.episodes) {
        out.push({
          profileId,
          metaId,
          videoId: `${metaId}:${season.number}:${episode.number}`,
          type: 'series',
          watchedAt: episode.watched_at,
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
        type: 'series',
        watchedAt: episode.watched_at,
      });
    }
  }

  if (!hasEpisodeArrays && (item.watched_episodes_count ?? 0) > 0) {
    out.push({ profileId, metaId, type: 'series', watchedAt: item.last_watched_at });
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

    const payloadIds = toHistoryIdsPayload(ids);
    if (!payloadIds) continue;

    if (item.type === 'movie') {
      movies.push({ ids: payloadIds, to: 'plantowatch' });
    } else {
      shows.push({ ids: payloadIds, to: 'plantowatch' });
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

    const episodeRef = parseVideoId(item.videoId ?? '');
    if (!episodeRef) continue;

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
  const entries = Object.entries(ids).filter(
    (entry): entry is [string, string | number] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number'
  );
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}
