import { AppState, type AppStateStatus } from 'react-native';
import * as Burnt from 'burnt';
import { simklGetActivities, simklGetAllItems, simklGetPlaybackSessions } from '@/api/simkl/sync';
import type { SimklAllItemsResponse, SimklPlaybackItem } from '@/api/simkl/types';
import { SIMKL_SYNC_INTERVAL_MS } from '@/constants/tracking';
import { useSimklStore } from '@/store/simkl.store';
import { useTrackingStore } from '@/store/tracking.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { createDebugLogger } from '@/utils/debug';
import { buildStremioEpisodeVideoId } from '@/utils/video-id';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';

const debug = createDebugLogger('TrackingSync');

let isSyncing = false;
let intervalId: ReturnType<typeof setInterval> | undefined;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
let lastAppState: AppStateStatus | undefined;

const clampRatio = (ratio: number): number => {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
};

const getPlaybackKeyData = (
  item: SimklPlaybackItem
): { metaId: string; videoId?: string; type: 'movie' | 'series' } | undefined => {
  if (item.type === 'movie') {
    const imdb = item.movie?.ids?.imdb;
    if (!imdb) {
      debug('getPlaybackKeyData', { type: 'movie', result: 'skip', reason: 'no-imdb' });
      return undefined;
    }
    return { metaId: imdb, videoId: undefined, type: 'movie' };
  }

  const imdb = item.show?.ids?.imdb;
  const season = item.episode?.season;
  const episode = item.episode?.number;
  if (!imdb || !season || !episode) {
    debug('getPlaybackKeyData', { type: 'episode', result: 'skip', reason: 'missing-data', hasImdb: !!imdb, hasSeason: !!season, hasEpisode: !!episode });
    return undefined;
  }
  return {
    metaId: imdb,
    videoId: buildStremioEpisodeVideoId(imdb, season, episode),
    type: 'series',
  };
};

const applySimklPlaybackToWatchHistory = async (items: SimklPlaybackItem[]): Promise<number> => {
  const activeProfileId = useWatchHistoryStore.getState().activeProfileId;
  if (!activeProfileId) {
    debug('applyPlayback', { result: 'skip', reason: 'no-profile' });
    return 0;
  }

  debug('applyPlayback', { profileId: activeProfileId, itemCount: items.length });

  let updated = 0;
  for (const item of items) {
    const keyData = getPlaybackKeyData(item);
    if (!keyData) continue;

    const ratio = clampRatio((item.progress ?? 0) / 100);
    if (ratio <= 0) {
      debug('applyPlaybackItemSkip', { metaId: keyData.metaId, reason: 'zero-ratio' });
      continue;
    }

    const pausedAtMs = item.paused_at ? new Date(item.paused_at).getTime() : NaN;
    const lastWatchedAt = Number.isFinite(pausedAtMs) ? pausedAtMs : Date.now();

    debug('applyPlaybackItem', {
      metaId: keyData.metaId,
      videoId: keyData.videoId,
      type: keyData.type,
      ratio: ratio.toFixed(2),
      pausedAt: item.paused_at,
    });

    useWatchHistoryStore.getState().upsertItem({
      id: keyData.metaId,
      type: keyData.type as any,
      videoId: keyData.videoId,
      progressSeconds: 0,
      durationSeconds: 0,
      progressRatio: ratio,
      lastWatchedAt,
    });
    updated += 1;
  }

  debug('applyPlaybackComplete', { updated });
  return updated;
};

/**
 * Process /sync/all-items response and update local watch history.
 * This syncs the user's full watched history from Simkl.
 * Note: Simkl returns null if there are no items/updates.
 */
const applySimklAllItemsToWatchHistory = async (
  data: SimklAllItemsResponse | null
): Promise<number> => {
  // Simkl returns null when there are no items or no updates since date_from
  if (!data) {
    debug('applyAllItems', { result: 'skip', reason: 'null-response' });
    return 0;
  }

  const activeProfileId = useWatchHistoryStore.getState().activeProfileId;
  if (!activeProfileId) {
    debug('applyAllItems', { result: 'skip', reason: 'no-profile' });
    return 0;
  }

  let updated = 0;
  const { upsertItem } = useWatchHistoryStore.getState();

  // Process movies
  const movies = data.movies ?? [];
  debug('applyAllItemsMovies', { count: movies.length });

  for (const movieItem of movies) {
    const imdb = movieItem.movie?.ids?.imdb;
    if (!imdb) {
      debug('applyAllItemsMovieSkip', { reason: 'no-imdb', title: movieItem.movie?.title });
      continue;
    }

    // Only mark as watched if completed status
    const isCompleted = movieItem.status === 'completed';
    const watchedAtMs = movieItem.last_watched_at
      ? new Date(movieItem.last_watched_at).getTime()
      : Date.now();

    debug('applyAllItemsMovie', {
      imdb,
      status: movieItem.status,
      isCompleted,
      lastWatchedAt: movieItem.last_watched_at,
    });

    if (isCompleted) {
      upsertItem({
        id: imdb,
        type: 'movie',
        videoId: undefined,
        progressSeconds: 0,
        durationSeconds: 0,
        progressRatio: 1, // Completed = 100%
        lastWatchedAt: watchedAtMs,
      });
      updated += 1;
    }
  }

  // Process TV shows
  const shows = data.shows ?? [];
  debug('applyAllItemsShows', { count: shows.length });

  for (const showItem of shows) {
    const imdb = showItem.show?.ids?.imdb;
    if (!imdb) {
      debug('applyAllItemsShowSkip', { reason: 'no-imdb', title: showItem.show?.title });
      continue;
    }

    // Process episodes from seasons
    const seasons = showItem.seasons ?? [];
    for (const season of seasons) {
      const seasonNum = season.number;
      const episodes = season.episodes ?? [];

      for (const ep of episodes) {
        const episodeNum = ep.number;
        const videoId = buildStremioEpisodeVideoId(imdb, seasonNum, episodeNum);
        const watchedAtMs = ep.watched_at
          ? new Date(ep.watched_at).getTime()
          : showItem.last_watched_at
            ? new Date(showItem.last_watched_at).getTime()
            : Date.now();

        debug('applyAllItemsEpisode', {
          imdb,
          season: seasonNum,
          episode: episodeNum,
          watchedAt: ep.watched_at,
        });

        upsertItem({
          id: imdb,
          type: 'series',
          videoId,
          progressSeconds: 0,
          durationSeconds: 0,
          progressRatio: 1, // Watched = 100%
          lastWatchedAt: watchedAtMs,
        });
        updated += 1;
      }
    }
  }

  // Process anime (same structure as shows)
  const anime = data.anime ?? [];
  debug('applyAllItemsAnime', { count: anime.length });

  for (const animeItem of anime) {
    // Anime can have either 'show' or 'anime' key
    const animeData = animeItem.anime ?? animeItem.show;
    const imdb = animeData?.ids?.imdb;
    if (!imdb) {
      debug('applyAllItemsAnimeSkip', { reason: 'no-imdb', title: animeData?.title });
      continue;
    }

    const seasons = animeItem.seasons ?? [];
    for (const season of seasons) {
      const seasonNum = season.number;
      const episodes = season.episodes ?? [];

      for (const ep of episodes) {
        const episodeNum = ep.number;
        const videoId = buildStremioEpisodeVideoId(imdb, seasonNum, episodeNum);
        const watchedAtMs = ep.watched_at
          ? new Date(ep.watched_at).getTime()
          : animeItem.last_watched_at
            ? new Date(animeItem.last_watched_at).getTime()
            : Date.now();

        debug('applyAllItemsAnimeEpisode', {
          imdb,
          season: seasonNum,
          episode: episodeNum,
          watchedAt: ep.watched_at,
        });

        upsertItem({
          id: imdb,
          type: 'series',
          videoId,
          progressSeconds: 0,
          durationSeconds: 0,
          progressRatio: 1,
          lastWatchedAt: watchedAtMs,
        });
        updated += 1;
      }
    }
  }

  debug('applyAllItemsComplete', { updated });
  return updated;
};

export const performTrackingSync = async (params?: {
  reason?: 'manual' | 'interval' | 'app-active';
  showToast?: boolean;
}): Promise<{ pulled: number }> => {
  const reason = params?.reason ?? 'manual';
  const showToast = params?.showToast ?? reason === 'manual';

  debug('performSync', { reason, showToast });

  if (isSyncing) {
    debug('syncSkipped', { reason: 'already-syncing', trigger: reason });
    return { pulled: 0 };
  }

  const tracking = useTrackingStore.getState().getActiveTracking();
  if (!tracking.enabled || tracking.provider !== 'simkl') {
    debug('syncSkipped', { reason: 'tracking-disabled', trigger: reason });
    return { pulled: 0 };
  }

  if (!tracking.autoSyncEnabled && reason !== 'manual') {
    debug('syncSkipped', { reason: 'auto-sync-disabled', trigger: reason });
    return { pulled: 0 };
  }

  const token = useSimklStore.getState().getAccessToken();
  if (!token) {
    debug('syncSkipped', { reason: 'no-token', trigger: reason });
    return { pulled: 0 };
  }

  isSyncing = true;
  useTrackingStore.getState().setSyncStatus('syncing');
  debug('syncStarted', { reason });

  try {
    // Step 1: Get activities to know what has changed
    const activities = await simklGetActivities(token);
    useSimklStore.getState().setLastActivitiesAt(Date.now());
    debug('activitiesFetched', {
      all: activities.all,
      moviesAll: activities.movies?.all,
      tvShowsAll: activities.tv_shows?.all,
      animeAll: activities.anime?.all,
    });

    // Step 2: Determine if this is first sync or incremental
    const lastSyncAt = tracking.lastSyncAt;
    const isFirstSync = !lastSyncAt;

    debug('syncStrategy', {
      isFirstSync,
      lastSyncAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
    });

    let totalPulled = 0;

    // Step 3: Fetch watch history from /sync/all-items
    // According to Simkl docs:
    // - First sync: fetch ALL items without date_from
    // - Subsequent syncs: use date_from from saved timestamp
    const allItemsDateFrom = isFirstSync
      ? undefined
      : new Date(lastSyncAt).toISOString();

    debug('fetchingAllItems', {
      isFirstSync,
      dateFrom: allItemsDateFrom ?? 'none (full sync)',
    });

    const allItems = await simklGetAllItems({
      token,
      dateFromIso: allItemsDateFrom,
      extended: true, // Get episode details
    });

    const historyPulled = await applySimklAllItemsToWatchHistory(allItems);
    totalPulled += historyPulled;

    debug('allItemsSynced', {
      historyPulled,
      isNull: allItems === null,
      showCount: allItems?.shows?.length ?? 0,
      animeCount: allItems?.anime?.length ?? 0,
      movieCount: allItems?.movies?.length ?? 0,
    });

    // Step 4: Also sync playback sessions for in-progress items (paused/stopped < 80%)
    // This is separate from watch history - these are resumable sessions
    const playbackDateFrom = isFirstSync
      ? undefined
      : new Date(lastSyncAt).toISOString();

    debug('fetchingPlayback', { dateFrom: playbackDateFrom ?? 'none' });

    const playback = await simklGetPlaybackSessions({ token, dateFromIso: playbackDateFrom });
    const playbackPulled = await applySimklPlaybackToWatchHistory(playback);
    totalPulled += playbackPulled;

    debug('playbackSynced', { playbackPulled, playbackCount: playback.length });

    // Step 5: Save sync timestamp
    useTrackingStore.getState().setLastSyncAt(Date.now());
    useTrackingStore.getState().setSyncStatus('idle');

    debug('syncComplete', {
      trigger: reason,
      totalPulled,
      historyPulled,
      playbackPulled,
      isFirstSync,
    });

    if (showToast) {
      Burnt.toast({
        title: 'Sync complete',
        message: totalPulled > 0 ? `Updated ${totalPulled} item(s).` : 'No updates found.',
        preset: 'done',
        duration: TOAST_DURATION_MEDIUM,
      });
    }

    return { pulled: totalPulled };
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Sync failed';
    useTrackingStore.getState().setSyncStatus('error', message);
    debug('syncFailed', { trigger: reason, error: message });

    if (showToast) {
      Burnt.toast({
        title: 'Sync failed',
        message,
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
    }

    return { pulled: 0 };
  } finally {
    isSyncing = false;
  }
};

export const initializeTrackingSync = (): (() => void) => {
  debug('initialize');

  if (!intervalId) {
    intervalId = setInterval(() => {
      performTrackingSync({ reason: 'interval', showToast: false });
    }, SIMKL_SYNC_INTERVAL_MS);
  }

  if (!appStateSubscription) {
    lastAppState = AppState.currentState;
    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const prev = lastAppState;
      lastAppState = nextState;
      if (prev !== 'active' && nextState === 'active') {
        performTrackingSync({ reason: 'app-active', showToast: false });
      }
    });
  }

  return () => {
    debug('destroy');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    appStateSubscription?.remove();
    appStateSubscription = undefined;
  };
};
