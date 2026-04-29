import { batchProcess, guardedImport } from '@/api/integrations/sync-guard';
import { upsertMinimalMetaCache } from '@/db/queries/metaCache';
import { addToMyList, listExportableMyListForProfile, removeFromMyList } from '@/db/queries/myList';
import { deleteFromSyncQueue, listSyncQueueForProvider } from '@/db/queries/syncQueue';
import {
  listExportableWatchHistoryForProfile,
  listWatchHistoryForProfile,
  removeWatchHistoryItem,
  upsertWatchProgress,
} from '@/db/queries/watchHistory';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { TraktSyncCursors } from '@/types/integrations';
import type { ContentType } from '@/types/stremio';
import type { TraktSyncItem } from '@/types/trakt';
import { createDebugLogger } from '@/utils/debug';
import { parseVideoId } from '@/utils/id';
import { getTraktPosterUrl } from '@/utils/media-artwork';

import {
  getLastActivities,
  getWatchedMovies,
  getWatchedShowsWithSeasons,
  getWatchlistMovies,
  getWatchlistShows,
  postHistory,
  postWatchlist,
  removeFromHistory,
  removeFromWatchlist,
} from './client';
import { buildTraktIdsFromMetaId, resolveTraktIds } from './id-resolver';

const debug = createDebugLogger('TraktSyncService');

/**
 * Compare timestamps to see if we need to sync.
 */
function needsSync(remoteTimestamp?: string, localTimestamp?: string): boolean {
  if (!remoteTimestamp) return false;
  if (!localTimestamp) return true;
  return new Date(remoteTimestamp) > new Date(localTimestamp);
}

type TraktSeason = { number: number; episodes: { number: number; watched_at?: string }[] };

function findOrCreateShow(
  shows: NonNullable<TraktSyncItem['shows']>,
  ids: { imdb?: string | null; tmdb?: number | null }
) {
  const existing = shows.find(
    (s) =>
      'ids' in s && ((ids.imdb && s.ids.imdb === ids.imdb) || (ids.tmdb && s.ids.tmdb === ids.tmdb))
  );
  if (existing) return existing;
  shows.push({ ids, seasons: [] as TraktSeason[] });
  return shows[shows.length - 1]!;
}

function findOrCreateSeason(
  show: { seasons?: TraktSeason[] | null },
  seasonNumber: number
): TraktSeason {
  if (!show.seasons) show.seasons = [];
  const existing = show.seasons.find((s) => s.number === seasonNumber);
  if (existing) return existing;
  const season: TraktSeason = { number: seasonNumber, episodes: [] };
  show.seasons.push(season);
  return season;
}

export async function runImport(
  profileId: string,
  token: string,
  cursors?: TraktSyncCursors,
  opts?: { clearLocalFirst?: boolean; activities?: TraktSyncCursors }
): Promise<boolean> {
  return guardedImport('trakt', profileId, opts, async () => {
    debug('importStart', { profileId, hasCursors: !!cursors });

    const activities = opts?.activities ?? (await getLastActivities(token));
    const newCursors: TraktSyncCursors = JSON.parse(JSON.stringify(cursors || {}));

    // 1. Check if we need to sync movies
    if (needsSync(activities.movies?.watched_at, cursors?.movies?.watched_at)) {
      debug('syncUpdates', { profileId, type: 'movies' });
      const movies = await getWatchedMovies(token);

      const historyUpserts: Parameters<typeof upsertWatchProgress>[0][] = [];
      const currentlyImportedIds = new Set<string>();

      for (const item of movies) {
        const metaId = resolveTraktIds(item.movie.ids, 'movie');
        if (!metaId) continue;

        currentlyImportedIds.add(metaId);

        await upsertMinimalMetaCache({
          metaId,
          type: 'movie',
          name: item.movie.title,
          poster: getTraktPosterUrl(item.movie.images),
          year: item.movie.year?.toString(),
        });

        historyUpserts.push({
          profileId,
          metaId,
          type: 'movie',
          source: 'trakt',
          progressSeconds: 100, // trakt watched items are completed
          durationSeconds: 100,
          lastWatchedAt: new Date(item.last_watched_at).getTime(),
          onlyIfNewer: true,
        });
      }

      await batchProcess(historyUpserts, (p) => upsertWatchProgress(p));

      await cleanupRemovedItems(profileId, 'history', currentlyImportedIds, 'movie');

      if (!newCursors.movies) newCursors.movies = {};
      newCursors.movies.watched_at = activities.movies?.watched_at;
    }

    // 2. Check if we need to sync shows/episodes
    const showsNeedsSync = needsSync(
      activities.episodes?.watched_at,
      cursors?.episodes?.watched_at
    );

    if (showsNeedsSync) {
      debug('syncUpdates', { profileId, type: 'shows' });
      const shows = await getWatchedShowsWithSeasons(token);

      const historyUpserts: Parameters<typeof upsertWatchProgress>[0][] = [];
      const currentlyImportedIds = new Set<string>();

      for (const item of shows) {
        const metaId = resolveTraktIds(item.show.ids, 'series');
        if (!metaId) continue;

        currentlyImportedIds.add(metaId);

        await upsertMinimalMetaCache({
          metaId,
          type: 'series',
          name: item.show.title,
          poster: getTraktPosterUrl(item.show.images),
          year: item.show.year?.toString(),
        });

        for (const season of item.seasons || []) {
          for (const episode of season.episodes || []) {
            const videoId = `${metaId}:${season.number}:${episode.number}`;
            currentlyImportedIds.add(videoId);

            historyUpserts.push({
              profileId,
              metaId,
              videoId,
              type: 'series',
              source: 'trakt',
              progressSeconds: 100,
              durationSeconds: 100,
              lastWatchedAt: new Date(episode.last_watched_at || item.last_watched_at).getTime(),
              onlyIfNewer: true,
            });
          }
        }
      }

      await batchProcess(historyUpserts, (p) => upsertWatchProgress(p));

      await cleanupRemovedItems(profileId, 'history', currentlyImportedIds, 'series');

      if (!newCursors.episodes) newCursors.episodes = {};
      newCursors.episodes.watched_at = activities.episodes?.watched_at;
    }

    // 3. Check if we need to sync watchlist
    if (needsSync(activities.watchlist?.updated_at, cursors?.watchlist?.updated_at)) {
      debug('syncUpdates', { profileId, type: 'watchlist' });

      const movies = await getWatchlistMovies(token);
      const shows = await getWatchlistShows(token);

      const watchlistUpserts: { metaId: string; type: string; addedAt?: number }[] = [];
      const currentlyImportedIds = new Set<string>();

      for (const item of movies) {
        if (!item.movie) continue;
        const metaId = resolveTraktIds(item.movie.ids, 'movie');
        if (!metaId) continue;

        currentlyImportedIds.add(metaId);

        await upsertMinimalMetaCache({
          metaId,
          type: 'movie',
          name: item.movie.title,
          poster: getTraktPosterUrl(item.movie.images),
          year: item.movie.year?.toString(),
        });

        watchlistUpserts.push({
          metaId,
          type: 'movie',
          addedAt: item.listed_at ? new Date(item.listed_at).getTime() : undefined,
        });
      }

      for (const item of shows) {
        if (!item.show) continue;
        const metaId = resolveTraktIds(item.show.ids, 'series');
        if (!metaId) continue;

        currentlyImportedIds.add(metaId);

        await upsertMinimalMetaCache({
          metaId,
          type: 'series',
          name: item.show.title,
          poster: getTraktPosterUrl(item.show.images),
          year: item.show.year?.toString(),
        });

        watchlistUpserts.push({
          metaId,
          type: 'series',
          addedAt: item.listed_at ? new Date(item.listed_at).getTime() : undefined,
        });
      }

      await batchProcess(watchlistUpserts, (p) =>
        addToMyList(profileId, p.metaId, p.type as ContentType, p.addedAt, 'trakt')
      );

      await cleanupRemovedItems(profileId, 'watchlist', currentlyImportedIds);

      if (!newCursors.watchlist) newCursors.watchlist = {};
      newCursors.watchlist.updated_at = activities.watchlist?.updated_at;
    }

    useIntegrationsStore.getState().updateTraktCursors(profileId, newCursors);
    debug('importComplete', { profileId, newCursors });
    return true;
  });
}

/**
 * Removes local items that are no longer present in Trakt.
 */
async function cleanupRemovedItems(
  profileId: string,
  type: 'history' | 'watchlist',
  currentlyImportedIds: Set<string>,
  contentType?: ContentType
): Promise<void> {
  try {
    if (type === 'history') {
      const localHistory = await listWatchHistoryForProfile(profileId);
      for (const item of localHistory) {
        if (item.source !== 'trakt') continue;
        if (contentType && item.type !== contentType) continue;

        const key = item.type === 'series' && item.videoId ? item.videoId : item.id;
        if (!currentlyImportedIds.has(key)) {
          debug('cleanupRemovingHistoryItem', { metaId: item.id, videoId: item.videoId });
          await removeWatchHistoryItem(profileId, item.id, item.videoId, 'trakt');
        }
      }
    } else {
      const localWatchlist = await listExportableMyListForProfile(profileId);
      for (const item of localWatchlist) {
        if (item.source !== 'trakt') continue;
        if (contentType && item.type !== contentType) continue;

        if (!currentlyImportedIds.has(item.id)) {
          debug('cleanupRemovingWatchlistItem', { metaId: item.id });
          await removeFromMyList(profileId, item.id, 'trakt');
        }
      }
    }
  } catch (error) {
    debug('cleanupError', { error });
  }
}

export async function runExport(profileId: string, token: string): Promise<boolean> {
  try {
    debug('exportStart', { profileId });

    const lastSyncAt = useIntegrationsStore.getState().lastSyncAt[profileId] || 0;

    // 0. Export Removals (Sync Queue)
    const queueItems = await listSyncQueueForProvider(profileId, 'trakt');
    const newRemovals = queueItems.filter((q) => q.createdAt > lastSyncAt);

    if (newRemovals.length > 0) {
      debug('exportRemovals', { count: newRemovals.length });

      const historyRemovals = newRemovals.filter((r) => r.action === 'remove_history');
      if (historyRemovals.length > 0) {
        const payload = buildRemovalPayload(historyRemovals);
        if (
          (payload.movies && payload.movies.length > 0) ||
          (payload.shows && payload.shows.length > 0)
        ) {
          await removeFromHistory(token, payload);
        }
      }

      const watchlistRemovals = newRemovals.filter((r) => r.action === 'remove_watchlist');
      if (watchlistRemovals.length > 0) {
        const payload = buildRemovalPayload(watchlistRemovals);
        if (
          (payload.movies && payload.movies.length > 0) ||
          (payload.shows && payload.shows.length > 0)
        ) {
          await removeFromWatchlist(token, payload);
        }
      }

      debug('exportRemovalsComplete', { count: newRemovals.length });
      const processedIds = newRemovals.map((r) => r.id);
      await deleteFromSyncQueue(processedIds);
    }

    // 1. Export Watch History
    const completed = await listExportableWatchHistoryForProfile(profileId, {
      status: 'completed',
      excludeSource: 'trakt',
      minLastWatchedAt: lastSyncAt,
    });

    debug('exportHistoryItems', { completed: completed.length });

    const historyPayload = buildExportPayload(completed);

    if (
      (historyPayload.movies && historyPayload.movies.length > 0) ||
      (historyPayload.episodes && historyPayload.episodes.length > 0)
    ) {
      await postHistory(token, historyPayload);
      debug('exportHistoryComplete', {
        movies: historyPayload.movies?.length,
        episodes: historyPayload.episodes?.length,
      });
    }

    // 2. Export Watchlist
    const watchlistItems = await listExportableMyListForProfile(profileId, {
      minAddedAt: lastSyncAt,
    });

    debug('exportWatchlistItems', { count: watchlistItems.length });

    const watchlistPayload: TraktSyncItem = { movies: [], shows: [] };
    for (const item of watchlistItems) {
      const ids = buildTraktIdsFromMetaId(item.id);
      if (!ids.imdb && !ids.tmdb) continue;

      if (item.type === 'movie') {
        watchlistPayload.movies!.push({ ids });
      } else if (item.type === 'series') {
        watchlistPayload.shows!.push({ ids });
      }
    }

    if (watchlistPayload.movies!.length > 0 || watchlistPayload.shows!.length > 0) {
      await postWatchlist(token, watchlistPayload);
      debug('exportWatchlistComplete', {
        movies: watchlistPayload.movies!.length,
        shows: watchlistPayload.shows!.length,
      });
    }

    return true;
  } catch (error) {
    debug('exportError', { profileId, error });
    return false;
  }
}

function buildExportPayload(
  items: Awaited<ReturnType<typeof listExportableWatchHistoryForProfile>>
): TraktSyncItem {
  const payload: TraktSyncItem = { movies: [], episodes: [] };

  for (const item of items) {
    const ids = buildTraktIdsFromMetaId(item.id);
    if (!ids.imdb && !ids.tmdb) continue;

    const watched_at = new Date(item.lastWatchedAt).toISOString();

    if (item.type === 'movie') {
      payload.movies!.push({ ids, watched_at });
    } else if (item.type === 'series' && item.videoId) {
      const parsed = parseVideoId(item.videoId);
      if (!parsed) continue;

      if (!payload.shows) payload.shows = [];
      const show = findOrCreateShow(payload.shows, ids);
      const season = findOrCreateSeason(show as { seasons?: TraktSeason[] | null }, parsed.season);
      season.episodes.push({ number: parsed.episode, watched_at });
    }
  }

  return payload;
}

function buildRemovalPayload(
  removals: { metaId: string; type: ContentType; videoId: string | null }[]
): TraktSyncItem {
  const payload: TraktSyncItem = { movies: [], shows: [] };

  for (const item of removals) {
    const ids = buildTraktIdsFromMetaId(item.metaId);
    if (!ids.imdb && !ids.tmdb) continue;

    if (item.type === 'movie') {
      payload.movies!.push({ ids });
    } else if (item.type === 'series') {
      if (!item.videoId) {
        payload.shows!.push({ ids });
      } else {
        const parsed = parseVideoId(item.videoId);
        if (!parsed) continue;

        const show = findOrCreateShow(payload.shows!, ids);
        const season = findOrCreateSeason(
          show as { seasons?: TraktSeason[] | null },
          parsed.season
        );
        season.episodes.push({ number: parsed.episode });
      }
    }
  }

  return payload;
}
