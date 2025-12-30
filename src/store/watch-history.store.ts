import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ContentType } from '@/types/stremio';
import {
  PLAYBACK_CONTINUE_WATCHING_MIN_RATIO,
  PLAYBACK_FINISHED_RATIO,
} from '@/constants/playback';
import { createDebugLogger } from '@/utils/debug';

export interface WatchHistoryItem {
  id: string;
  type: ContentType;
  /**
   * For series episodes: the specific video id (stream id).
   * For movies: undefined.
   */
  videoId?: string;

  progressSeconds: number;
  durationSeconds: number;


  /** Last playable target type for resume (preferred over lastStreamId). */
  lastStreamTargetType?: 'url' | 'external' | 'yt';
  /** Last playable target value for resume (preferred over lastStreamId). */
  lastStreamTargetValue?: string;

  lastWatchedAt: number;
}

/**
 * Nested structure: byProfile[profileId][metaId][videoKey] = WatchHistoryItem
 * videoKey is the videoId for episodes, or "_" for movies/meta-level entries.
 */
type WatchHistoryByMeta = Record<string, WatchHistoryItem>;
type WatchHistoryByProfile = Record<string, WatchHistoryByMeta>;

/** The videoKey used for movies or meta-level stream preferences */
const MOVIE_VIDEO_KEY = '_';

export type WatchState = 'not-watched' | 'in-progress' | 'watched';

interface WatchHistoryState {
  activeProfileId?: string;

  byProfile: Record<string, WatchHistoryByProfile>;

  // Cross-store sync
  setActiveProfileId: (profileId?: string) => void;

  // Queries
  getContinueWatching: () => WatchHistoryItem[];
  getItemsForMeta: (metaId: string) => WatchHistoryItem[];
  getItem: (id: string, videoId?: string) => WatchHistoryItem | undefined;
  getProgressRatio: (id: string, videoId?: string) => number;
  getWatchState: (id: string, videoId?: string) => WatchState;
  getLatestItemForMeta: (metaId: string) => WatchHistoryItem | undefined;
  hasWatchedEpisode: (id: string, videoId: string) => boolean;
  getLastStreamTarget: (
    id: string,
    videoId?: string
  ) => { type: 'url' | 'external' | 'yt'; value: string } | undefined;

  // Mutations
  upsertItem: (item: Omit<WatchHistoryItem, 'lastWatchedAt'> & { lastWatchedAt?: number }) => void;
  /**
   * Set the last stream target for resuming playback.
   * If videoId is provided, sets only for that specific video.
   * If videoId is undefined, sets only for the meta (movie-level).
   */
  setLastStreamTarget: (
    metaId: string,
    videoId: string | undefined,
    contentType: ContentType,
    target: { type: 'url' | 'external' | 'yt'; value: string }
  ) => void;
  updateProgress: (
    id: string,
    videoId: string | undefined,
    progressSeconds: number,
    durationSeconds: number
  ) => void;
  remove: (id: string, videoId?: string) => void;
}

export const isContinueWatching = (
  progressSeconds: number,
  durationSeconds: number,
  videoId?: string
): boolean => {
  if (durationSeconds <= 0) return false;
  const ratio = progressSeconds / durationSeconds;
  // In-progress items
  if (ratio >= PLAYBACK_CONTINUE_WATCHING_MIN_RATIO && ratio < PLAYBACK_FINISHED_RATIO) return true;
  // Finished item can still be an Up Next candidate if it references a specific video.
  if (ratio >= PLAYBACK_FINISHED_RATIO && !!videoId) return true;
  return false;
};

/** Get the video key for storage: videoId for episodes, "_" for movies */
const getVideoKey = (videoId?: string): string => videoId ?? MOVIE_VIDEO_KEY;

const debug = createDebugLogger('WatchHistoryStore');

export const useWatchHistoryStore = create<WatchHistoryState>()(
  persist(
    (set, get) => ({
      activeProfileId: undefined,
      byProfile: {},

      setActiveProfileId: (profileId) => {
        set({ activeProfileId: profileId });
      },

      getContinueWatching: () => {
        const profileId = get().activeProfileId;
        if (!profileId) return [];
        const profileData = get().byProfile[profileId] ?? {};

        // Flatten all items from all metas
        const allItems: WatchHistoryItem[] = [];
        for (const metaItems of Object.values(profileData)) {
          for (const item of Object.values(metaItems)) {
            if (isContinueWatching(item.progressSeconds, item.durationSeconds, item.videoId)) {
              allItems.push(item);
            }
          }
        }

        return allItems.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
      },

      getItemsForMeta: (metaId) => {
        const profileId = get().activeProfileId;
        if (!profileId) return [];
        const metaItems = get().byProfile[profileId]?.[metaId];
        if (!metaItems) return [];
        return Object.values(metaItems);
      },

      getItem: (id, videoId) => {
        const profileId = get().activeProfileId;
        if (!profileId) return undefined;
        return get().byProfile[profileId]?.[id]?.[getVideoKey(videoId)];
      },

      getProgressRatio: (id, videoId) => {
        const item = get().getItem(id, videoId);
        if (!item) return 0;
        if (item.durationSeconds <= 0) return 0;
        return item.progressSeconds / item.durationSeconds;
      },

      getWatchState: (id, videoId) => {
        const item = get().getItem(id, videoId);
        if (!item || item.durationSeconds <= 0) return 'not-watched';
        const ratio = item.progressSeconds / item.durationSeconds;
        if (ratio >= PLAYBACK_FINISHED_RATIO) return 'watched';
        if (ratio > 0) return 'in-progress';
        return 'not-watched';
      },

      getLatestItemForMeta: (metaId) => {
        const items = get().getItemsForMeta(metaId);
        if (items.length === 0) return undefined;
        return items.reduce<WatchHistoryItem | undefined>(
          (best, item) => (!best || item.lastWatchedAt > best.lastWatchedAt ? item : best),
          undefined
        );
      },

      getLastStreamTarget: (id, videoId) => {
        const profileId = get().activeProfileId;
        if (!profileId) return undefined;

        const metaItems = get().byProfile[profileId]?.[id];
        if (!metaItems) return undefined;

        const videoKey = getVideoKey(videoId);
        const episodeItem = metaItems[videoKey];
        const metaItem = metaItems[MOVIE_VIDEO_KEY];

        const type = episodeItem?.lastStreamTargetType ?? metaItem?.lastStreamTargetType;
        const value = episodeItem?.lastStreamTargetValue ?? metaItem?.lastStreamTargetValue;
        if (!type || !value) return undefined;
        return { type, value };
      },

      hasWatchedEpisode: (id, videoId) => {
        const ratio = get().getProgressRatio(id, videoId);
        return ratio >= PLAYBACK_FINISHED_RATIO;
      },

      upsertItem: (item) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const videoKey = getVideoKey(item.videoId);

        const existingBefore = get().byProfile[profileId]?.[item.id]?.[videoKey];
        // Don't create new history entries for tiny progress.
        // This avoids a short-started episode becoming the latest-by-show and hiding
        // a legitimate continue-watching entry for the same series.
        if (!existingBefore) {
          if (item.durationSeconds <= 0) return;
          const ratio = item.progressSeconds / item.durationSeconds;
          if (ratio < PLAYBACK_CONTINUE_WATCHING_MIN_RATIO) {
            debug('skipUpsertBelowThreshold', {
              metaId: item.id,
              videoKey,
              videoId: item.videoId,
              progressSeconds: item.progressSeconds,
              durationSeconds: item.durationSeconds,
              ratio,
              minContinueRatio: PLAYBACK_CONTINUE_WATCHING_MIN_RATIO,
            });
            return;
          }
        }

        debug('upsertItem', {
          metaId: item.id,
          videoKey,
          videoId: item.videoId,
          progressSeconds: item.progressSeconds,
          durationSeconds: item.durationSeconds,
          lastWatchedAt: item.lastWatchedAt,
        });

        set((state) => {
          const existing = state.byProfile[profileId]?.[item.id]?.[videoKey];
          return {
            byProfile: {
              ...state.byProfile,
              [profileId]: {
                ...(state.byProfile[profileId] ?? {}),
                [item.id]: {
                  ...(state.byProfile[profileId]?.[item.id] ?? {}),
                  [videoKey]: {
                    ...(existing ?? {
                      id: item.id,
                      type: item.type,
                      videoId: item.videoId,
                      progressSeconds: 0,
                      durationSeconds: 0,
                      lastWatchedAt: Date.now(),
                    }),
                    ...item,
                    lastWatchedAt: item.lastWatchedAt ?? Date.now(),
                  },
                },
              },
            },
          };
        });
      },

      setLastStreamTarget: (
        metaId: string,
        videoId: string | undefined,
        contentType: ContentType,
        target: { type: 'url' | 'external' | 'yt'; value: string }
      ) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const videoKey = getVideoKey(videoId);
        const now = Date.now();

        debug('setLastStreamTarget', { metaId, videoKey, videoId, contentType, target });

        set((state) => {
          const currentProfile = state.byProfile[profileId] ?? {};
          const currentMeta = currentProfile[metaId] ?? {};
          const existing = currentMeta[videoKey];

          const baseItem: WatchHistoryItem = {
            id: metaId,
            type: existing?.type ?? contentType,
            videoId,
            progressSeconds: existing?.progressSeconds ?? 0,
            durationSeconds: existing?.durationSeconds ?? 0,
            lastWatchedAt: existing?.lastWatchedAt ?? now,
            lastStreamTargetType: target.type,
            lastStreamTargetValue: target.value,
          };

          return {
            byProfile: {
              ...state.byProfile,
              [profileId]: {
                ...currentProfile,
                [metaId]: {
                  ...currentMeta,
                  [videoKey]: {
                    ...(existing ?? baseItem),
                    lastStreamTargetType: target.type,
                    lastStreamTargetValue: target.value,
                  },
                },
              },
            },
          };
        });
      },

      updateProgress: (id, videoId, progressSeconds, durationSeconds) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const videoKey = getVideoKey(videoId);

        debug('updateProgress', { metaId: id, videoKey, videoId, progressSeconds, durationSeconds });

        set((state) => {
          const existing = state.byProfile[profileId]?.[id]?.[videoKey];
          if (!existing) {
            return state;
          }
          return {
            byProfile: {
              ...state.byProfile,
              [profileId]: {
                ...(state.byProfile[profileId] ?? {}),
                [id]: {
                  ...(state.byProfile[profileId]?.[id] ?? {}),
                  [videoKey]: {
                    ...existing,
                    progressSeconds,
                    durationSeconds,
                    lastWatchedAt: Date.now(),
                  },
                },
              },
            },
          };
        });
      },

      remove: (id, videoId) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const videoKey = getVideoKey(videoId);

        set((state) => {
          const currentMeta = state.byProfile[profileId]?.[id];
          if (!currentMeta) return state;

          const { [videoKey]: removed, ...restItems } = currentMeta;

          // If no items left for this meta, remove the meta entry entirely
          const hasRemainingItems = Object.keys(restItems).length > 0;

          if (hasRemainingItems) {
            return {
              byProfile: {
                ...state.byProfile,
                [profileId]: {
                  ...(state.byProfile[profileId] ?? {}),
                  [id]: restItems,
                },
              },
            };
          } else {
            const { [id]: removedMeta, ...restMetas } = state.byProfile[profileId] ?? {};
            return {
              byProfile: {
                ...state.byProfile,
                [profileId]: restMetas,
              },
            };
          }
        });
      },
    }),
    {
      name: 'watch-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
    }
  )
);
