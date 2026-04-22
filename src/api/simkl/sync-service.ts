import { createDebugLogger } from '@/utils/debug';
import type { SimklActivities, SimklIds, SimklWatchedItem } from '@/types/simkl';
import { getActivities, getAllItems, postHistory, postWatchlist } from './client';
import { resolveSimklIds } from './id-resolver';
import {
  listExportableWatchHistoryForProfile,
  listWatchHistoryForProfile,
  upsertWatchProgress,
  removeProfileWatchHistory,
} from '@/db/queries/watchHistory';
import { addToMyList, listExportableMyListForProfile } from '@/db/queries/myList';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { SimklConnection, SimklMediaType, SimklSyncCursors } from '@/types/integrations';
import type { ContentType } from '@/types/stremio';
import { parseVideoId } from '@/utils/id';

const debug = createDebugLogger('SimklSyncService');

const SIMKL_SYNC_CATEGORIES: {
  key: keyof SimklSyncCursors;
  type: SimklMediaType;
  getActivityTimestamp: (activities: SimklActivities) => string | undefined;
}[] = [
  {
    key: 'movies',
    type: 'movies',
    getActivityTimestamp: (activities) => activities.movies?.all,
  },
  {
    key: 'shows',
    type: 'shows',
    getActivityTimestamp: (activities) => activities.tv_shows?.all,
  },
  {
    key: 'anime',
    type: 'anime',
    getActivityTimestamp: (activities) => activities.anime?.all,
  },
];

const IMPORT_PROGRESS_SECONDS = 1;
const IMPORT_DURATION_SECONDS = 1;

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


/**
 * Import watch history from Simkl into local DB.
 * Fail-safe: errors are logged, never thrown.
 */
export async function runImport(
  profileId: string,
  token: string,
  clientId: string,
  cursors?: SimklConnection['syncCursors'],
  opts?: { clearLocalFirst?: boolean }
): Promise<boolean> {
  try {
    debug('importStart', { profileId, hasCursors: !!cursors });

    // 1. Get current activities timestamps
    const activities = await getActivities(token, clientId);
    const newCursors: NonNullable<SimklConnection['syncCursors']> = {};

    if (opts?.clearLocalFirst) {
      await removeProfileWatchHistory(profileId);
    }

    for (const { key, type, getActivityTimestamp } of SIMKL_SYNC_CATEGORIES) {
      const activityTimestamp = getActivityTimestamp(activities);

      const cursor = cursors?.[key];

      // Skip if cursor exists and activity hasn't changed
      // Also skip if activityTimestamp is falsy (category has no items at all)
      if ((cursor && activityTimestamp && cursor >= activityTimestamp) || !activityTimestamp) {
        debug('categorySkipped', { key, cursor, activityTimestamp });
        if (cursor) newCursors[key] = cursor;
        continue;
      }

      debug('fetchingCategory', { key, type, dateFrom: cursor });
      const response = await getAllItems(token, clientId, type, cursor);
      const items = response?.[key] ?? [];
      debug('fetchedItems', { key, count: items.length });

      await importItems(profileId, items, type);

      if (activityTimestamp) {
        newCursors[key] = activityTimestamp;
      }
    }

    // 6. Save new cursors
    useIntegrationsStore.getState().updateSimklCursors(profileId, newCursors);
    debug('importComplete', { profileId, newCursors });
    return true;
  } catch (error) {
    debug('importError', { profileId, error });
    return false;
  }
}

async function importItems(
  profileId: string,
  items: SimklWatchedItem[],
  type: SimklMediaType
): Promise<void> {
  // Collect all progress params first, then batch-write
  const historyParams: Parameters<typeof upsertImportedProgress>[0][] = [];
  const myListParams: { metaId: string; type: ContentType; addedAt?: number }[] = [];

  for (const item of items) {
    try {
      const status = item.status;

      // Skip dropped items completely
      if (status === 'dropped') {
        continue;
      }

      // Add plan to watch items to My List
      if (status === 'plantowatch') {
        const ids = type === 'movies' ? item.movie?.ids : item.show?.ids;
        if (!ids) continue;

        const metaId = getMetaIdFromIds(ids);
        if (metaId) {
          myListParams.push({
            metaId,
            type: type === 'movies' ? 'movie' : 'series',
            addedAt: item.added_at ? new Date(item.added_at).getTime() : undefined,
          });
        }
        continue;
      }

      // Add watching and completed (and any other status like 'hold' or undefined) to history
      if (type === 'movies' && item.movie) {
        collectMovieParams(profileId, item, historyParams);
      } else if ((type === 'shows' || type === 'anime') && item.show) {
        collectShowParams(profileId, item, historyParams);
      }
    } catch (error) {
      debug('importItemError', { error });
    }
  }

  const BATCH_SIZE = 50;

  // Write history in parallel batches
  for (let i = 0; i < historyParams.length; i += BATCH_SIZE) {
    const batch = historyParams.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((params) => upsertImportedProgress(params)));
  }

  // Write My List in parallel batches
  for (let i = 0; i < myListParams.length; i += BATCH_SIZE) {
    const batch = myListParams.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((params) => addToMyList(profileId, params.metaId, params.type, params.addedAt))
    );
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

function collectMovieParams(
  profileId: string,
  item: SimklWatchedItem,
  out: Parameters<typeof upsertImportedProgress>[0][]
): void {
  if (!item.movie) return;
  const metaId = getMetaIdFromIds(item.movie.ids);
  if (!metaId) return;

  out.push({ profileId, metaId, type: 'movie', watchedAt: item.last_watched_at });
}

function collectShowParams(
  profileId: string,
  item: SimklWatchedItem,
  out: Parameters<typeof upsertImportedProgress>[0][]
): void {
  if (!item.show) return;
  const metaId = getMetaIdFromIds(item.show.ids);
  if (!metaId) return;

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
    return;
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
}

function getMetaIdFromIds(ids: { imdb?: string; simkl?: number; kitsu?: number; mal?: number }): string | null {
  if (ids.imdb) return ids.imdb;
  if (ids.kitsu) return `kitsu:${ids.kitsu}`;
  if (ids.simkl) return String(ids.simkl);
  return null;
}

/**
 * Export local watch history to Simkl.
 * Fail-safe: errors are logged, never thrown.
 */
export async function runExport(profileId: string, token: string, clientId: string): Promise<boolean> {
  try {
    debug('exportStart', { profileId });

    const lastSyncAt = useIntegrationsStore.getState().lastSyncAt[profileId] || 0;
    
    // 1. Export Watch History
    const completed = await listExportableWatchHistoryForProfile(profileId, {
      status: 'completed',
      excludeSource: 'simkl',
      minLastWatchedAt: lastSyncAt,
    });

    debug('exportHistoryItems', { completed: completed.length });

    const historyPayload = await buildExportPayload(completed, clientId);

    if (historyPayload.movies.length > 0 || historyPayload.shows.length > 0) {
      await postHistory(token, clientId, historyPayload);
      debug('exportHistoryComplete', { movies: historyPayload.movies.length, shows: historyPayload.shows.length });
    }

    // 2. Export Watchlist (My List)
    const myListItems = await listExportableMyListForProfile(profileId, {
      minAddedAt: lastSyncAt,
    });

    debug('exportWatchlistItems', { count: myListItems.length });

    const watchlistPayload = await buildWatchlistPayload(myListItems, clientId);

    if (watchlistPayload.movies.length > 0 || watchlistPayload.shows.length > 0) {
      await postWatchlist(token, clientId, watchlistPayload);
      debug('exportWatchlistComplete', { movies: watchlistPayload.movies.length, shows: watchlistPayload.shows.length });
    }

    return true;
  } catch (error) {
    debug('exportError', { profileId, error });
    return false;
  }
}

async function buildWatchlistPayload(
  items: Awaited<ReturnType<typeof listExportableMyListForProfile>>,
  clientId: string
): Promise<HistoryPayload> {
  const movies: any[] = [];
  const shows: any[] = [];

  for (const item of items) {
    const ids = await resolveSimklIds(item.id, item.type, clientId);
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

async function buildExportPayload(
  completed: Awaited<ReturnType<typeof listWatchHistoryForProfile>>,
  clientId: string
): Promise<HistoryPayload> {
  const movies: HistoryIdsPayload[] = [];
  const showsMap = new Map<string, { ids: Record<string, string | number>; seasons: Map<number, Set<number>> }>();

  for (const item of completed) {
    const ids = await resolveSimklIds(item.id, item.type, clientId);
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
