import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ContentType, MetaDetail, MetaVideo } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import {
  getContinueWatchingWithUpNext,
  getVideoForEntry,
  listWatchHistoryForMeta,
  type DbWatchHistoryItem,
} from '@/db';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';

// ============================================================================
// Types
// ============================================================================

export interface ContinueWatchingEntry {
  /** Unique key for list rendering: `${metaId}::${videoId}` or just metaId */
  key: string;
  /** The content type (movie, series, etc.) */
  type: ContentType;
  /** The meta/show ID */
  metaId: string;
  /** Episode video ID (for series) */
  videoId?: string;
  /** Progress in seconds */
  progressSeconds: number;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Progress ratio (0-1), 0 for up-next entries */
  progressRatio: number;
  /** Timestamp of last watch activity */
  lastWatchedAt: number;
  /** True when this entry represents the next unwatched episode */
  isUpNext: boolean;
  /** The resolved video metadata (for series episodes) */
  video?: MetaVideo;
  /** Meta name for display */
  metaName?: string;
  /** Background or poster image URL */
  imageUrl?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

const getEntryKey = (metaId: string, videoId?: string): string =>
  videoId ? `${metaId}::${videoId}` : metaId;

const getProgressRatio = (progressSeconds: number, durationSeconds: number): number =>
  durationSeconds > 0 ? progressSeconds / durationSeconds : 0;

const isMetaDetail = (meta: unknown): meta is MetaDetail =>
  typeof meta === 'object' && meta !== null && 'name' in meta;

/**
 * Find the next unwatched video in the sequence.
 * Looks for the first video after currentIndex that hasn't been fully watched.
 * Videos are expected to be pre-sorted with season 0 (Specials) last.
 */
const findNextUnwatchedVideo = (
  videos: MetaVideo[],
  currentIndex: number,
  getProgressRatioForVideo: (videoId: string) => number
): MetaVideo | undefined => {
  for (let i = currentIndex + 1; i < videos.length; i++) {
    const video = videos[i];
    const ratio = getProgressRatioForVideo(video.id);
    if (ratio < PLAYBACK_FINISHED_RATIO) {
      return video;
    }
  }
  return undefined;
};

/**
 * Select the latest continue watching item per meta.
 * Returns one item per metaId, sorted by lastWatchedAt descending.
 */

// ============================================================================
// Hooks
// ============================================================================

/**
 * Returns the list of all continue watching entries for the home screen.
 * Each entry contains basic info from watch history.
 * The ContinueWatchingItem component is responsible for fetching meta data.
 * Uses React Query for automatic cache invalidation when watch history changes.
 */
export function useContinueWatching(): { data: ContinueWatchingEntry[]; isLoading: boolean } {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { data = [], isLoading } = useQuery<ContinueWatchingEntry[]>({
    queryKey: activeProfileId
      ? watchHistoryKeys.continueWatching(activeProfileId)
      : watchHistoryKeys.all,
    queryFn: async () => {
      if (!activeProfileId) return [];
      const items = await getContinueWatchingWithUpNext(activeProfileId, 50);

      // Resolve video metadata from SQLite for series entries.
      // This avoids calling useMeta (a network fetcher) per card on the home screen.
      const entries = await Promise.all(
        items.map(async (item): Promise<ContinueWatchingEntry> => {
          let video: MetaVideo | undefined;
          if (item.videoId) {
            video = (await getVideoForEntry(item.metaId, item.videoId)) ?? undefined;
          }
          return {
            key: getEntryKey(item.metaId, item.videoId),
            metaId: item.metaId,
            type: item.type,
            videoId: item.videoId,
            progressSeconds: item.progressSeconds,
            durationSeconds: item.durationSeconds,
            progressRatio: item.progressRatio,
            lastWatchedAt: item.lastWatchedAt,
            isUpNext: item.isUpNext,
            video,
            metaName: item.metaName,
            imageUrl: item.imageUrl,
          };
        })
      );

      return entries;
    },
    enabled: !!activeProfileId,
  });

  return { data, isLoading };
}

/**
 * Returns the continue watching entry for a specific meta.
 * Resolves the correct video to show (current in-progress or next unwatched).
 * Uses React Query for automatic cache invalidation when watch history changes.
 */
export function useContinueWatchingForMeta(
  metaId: string,
  meta: MetaDetail | { videos?: MetaVideo[] } | undefined
): { entry: ContinueWatchingEntry | undefined; isLoading: boolean } {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { data: itemsForMeta = [], isLoading } = useQuery<DbWatchHistoryItem[]>({
    queryKey: activeProfileId
      ? watchHistoryKeys.itemsForMeta(activeProfileId, metaId)
      : watchHistoryKeys.all,
    queryFn: async () => {
      if (!activeProfileId) return [];
      return listWatchHistoryForMeta(activeProfileId, metaId);
    },
    enabled: !!activeProfileId,
  });

  const entry = useMemo(() => {
    const videos = meta?.videos ?? [];
    if (itemsForMeta.length === 0) return undefined;

    // Find the most recently watched item for this meta
    const latestItem = itemsForMeta.reduce<DbWatchHistoryItem | undefined>(
      (best: DbWatchHistoryItem | undefined, item: DbWatchHistoryItem) =>
        !best || item.lastWatchedAt > best.lastWatchedAt ? item : best,
      undefined
    );
    if (!latestItem) return undefined;

    const progressRatio = getProgressRatio(latestItem.progressSeconds, latestItem.durationSeconds);
    const isFinished = progressRatio >= PLAYBACK_FINISHED_RATIO;

    // Extract meta details if available
    const metaName = isMetaDetail(meta) ? meta.name : undefined;
    const imageUrl = isMetaDetail(meta) ? (meta.background ?? meta.poster) : undefined;

    // Helper to get progress ratio for any video
    const getVideoProgressRatio = (videoId: string): number => {
      const item = itemsForMeta.find((i: DbWatchHistoryItem) => i.videoId === videoId);
      return item ? getProgressRatio(item.progressSeconds, item.durationSeconds) : 0;
    };

    // Movies or single-video content
    if (videos.length <= 1) {
      if (isFinished) return undefined; // Nothing to continue

      return {
        key: getEntryKey(latestItem.id, latestItem.videoId),
        metaId: latestItem.id,
        type: latestItem.type,
        videoId: latestItem.videoId,
        progressSeconds: latestItem.progressSeconds,
        durationSeconds: latestItem.durationSeconds,
        progressRatio,
        lastWatchedAt: latestItem.lastWatchedAt,
        isUpNext: false,
        video: videos[0],
        metaName,
        imageUrl,
      };
    }

    // Series: find the current video index
    const currentVideoId = latestItem.videoId;
    const currentIndex = currentVideoId ? videos.findIndex((v) => v.id === currentVideoId) : -1;

    if (isFinished) {
      // Find next unwatched episode
      const nextVideo = findNextUnwatchedVideo(videos, currentIndex, getVideoProgressRatio);
      if (!nextVideo) return undefined; // All watched or no more episodes

      return {
        key: getEntryKey(latestItem.id, nextVideo.id),
        metaId: latestItem.id,
        type: latestItem.type,
        videoId: nextVideo.id,
        progressSeconds: 0,
        durationSeconds: 0,
        progressRatio: 0,
        lastWatchedAt: latestItem.lastWatchedAt,
        isUpNext: true,
        video: nextVideo,
        metaName,
        imageUrl,
      };
    }

    // In progress - show current episode
    const currentVideo = currentIndex >= 0 ? videos[currentIndex] : undefined;
    return {
      key: getEntryKey(latestItem.id, latestItem.videoId),
      metaId: latestItem.id,
      type: latestItem.type,
      videoId: latestItem.videoId,
      progressSeconds: latestItem.progressSeconds,
      durationSeconds: latestItem.durationSeconds,
      progressRatio,
      lastWatchedAt: latestItem.lastWatchedAt,
      isUpNext: false,
      video: currentVideo,
      metaName,
      imageUrl,
    };
  }, [itemsForMeta, meta]);

  return { entry, isLoading };
}

/**
 * Returns the next video in sequence (for UpNext popup).
 * This is the immediate next video, not based on watch history.
 */
export function useNextVideo(
  videos: MetaVideo[] | undefined,
  currentVideoId: string | undefined
): MetaVideo | undefined {
  return useMemo(() => {
    if (!videos || !currentVideoId) return undefined;
    const currentIndex = videos.findIndex((v) => v.id === currentVideoId);
    return currentIndex >= 0 ? videos[currentIndex + 1] : undefined;
  }, [videos, currentVideoId]);
}
