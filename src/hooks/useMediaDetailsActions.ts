import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { PickerItem } from '@/components/basic/PickerModal';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import type { DbWatchHistoryItem } from '@/db';
import {
  listWatchHistoryForMeta,
  removeWatchHistoryItem,
  removeWatchHistoryMeta,
  upsertWatchProgress,
} from '@/db';
import { useContinueWatchingForMeta } from '@/hooks/useContinueWatching';
import { useWatchHistoryItem, useWatchState, watchHistoryKeys } from '@/hooks/useWatchHistoryDb';
import { useProfileStore } from '@/store/profile.store';
import { showToast } from '@/store/toast.store';
import type { ContentType, MetaVideo } from '@/types/stremio';

export type MediaDetailsAction = 'mark-as-watched' | 'remove-from-history';

interface UseMediaDetailsActionsParams {
  metaId: string;
  type: ContentType;
  metaName: string;
  /** Videos array — when provided (length > 1), enables multi-video (series) mode. */
  videos?: MetaVideo[];
  /** Override: specific video to target for mark/remove. Auto-detected when omitted. */
  targetVideoId?: string;
  /** Override: duration for the target video. Auto-read from history when omitted. */
  targetDurationSeconds?: number;
  /** Whether to remove history for the entire meta or just the specific item. Default: 'meta' */
  removalScope?: 'meta' | 'item';
}

/**
 * Self-contained hook for the media details context menu.
 * Derives all state (hasHistory, canMarkAsWatched, target video, duration)
 * from internal queries — callers only pass the raw context.
 */
export function useMediaDetailsActions({
  metaId,
  type,
  metaName,
  videos,
  targetVideoId,
  targetDurationSeconds,
  removalScope = 'meta',
}: UseMediaDetailsActionsParams) {
  const { t } = useTranslation('media');
  const [isVisible, setIsVisible] = useState(false);
  const profileId = useProfileStore((state) => state.activeProfileId);
  const queryClient = useQueryClient();

  const isMultiVideo = (videos?.length ?? 0) > 1;

  // ── Data fetching ────────────────────────────────────────

  // Continue watching entry (meaningful for multi-video; returns undefined for single)
  const { entry: continueWatching } = useContinueWatchingForMeta(
    metaId,
    isMultiVideo ? { videos } : undefined
  );

  // Resolve the videoId to query for single-video / episode-level state
  const effectiveVideoId = targetVideoId ?? continueWatching?.videoId ?? videos?.[0]?.id;

  // Watch state & history for the resolved video
  const watchState = useWatchState(metaId, effectiveVideoId);
  const { data: historyItem } = useWatchHistoryItem(metaId, effectiveVideoId);

  // For multi-video: check whether ANY history exists for the entire meta
  const { data: metaHistoryItems } = useQuery<DbWatchHistoryItem[]>({
    queryKey: profileId ? watchHistoryKeys.itemsForMeta(profileId, metaId) : watchHistoryKeys.all,
    queryFn: async () => {
      if (!profileId) return [];
      return listWatchHistoryForMeta(profileId, metaId);
    },
    enabled: !!profileId && isMultiVideo,
  });

  // ── Derived state ────────────────────────────────────────

  const hasHistory = isMultiVideo
    ? (metaHistoryItems?.length ?? 0) > 0
    : watchState !== 'not-watched';

  const canMarkAsWatched = isMultiVideo
    ? true // always available for series; fallback duration handles never-watched episodes
    : watchState !== 'watched';

  const videoIdToMark =
    targetVideoId ?? (isMultiVideo ? continueWatching?.videoId : historyItem?.videoId);

  const durationSeconds =
    targetDurationSeconds ??
    (isMultiVideo ? continueWatching?.durationSeconds : historyItem?.durationSeconds);

  const videosToMark = isMultiVideo
    ? videos?.map((v) => ({ videoId: v.id, durationSeconds: undefined as number | undefined }))
    : undefined;

  // ── Picker items ─────────────────────────────────────────

  const openActions = useCallback(() => setIsVisible(true), []);
  const closeActions = useCallback(() => setIsVisible(false), []);

  const invalidateWatchHistory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: watchHistoryKeys.all });
  }, [queryClient]);

  const items = useMemo<PickerItem<MediaDetailsAction>[]>(() => {
    const next: PickerItem<MediaDetailsAction>[] = [];

    if (canMarkAsWatched) {
      next.push({
        label: t('mark_as_watched'),
        value: 'mark-as-watched',
        icon: 'checkmark-circle-outline',
      });
    }

    if (hasHistory) {
      next.push({
        label: t('remove_from_history'),
        value: 'remove-from-history',
        icon: 'trash-outline',
        tone: 'destructive',
      });
    }

    return next;
  }, [canMarkAsWatched, hasHistory, t]);

  // ── Action handlers ──────────────────────────────────────

  const handleAction = useCallback(
    (action: MediaDetailsAction) => {
      if (!profileId) return;

      switch (action) {
        case 'mark-as-watched': {
          const targets = videosToMark ?? [{ videoId: videoIdToMark, durationSeconds }];

          const upserts = targets.map((v) => {
            const effectiveDuration =
              v.durationSeconds && v.durationSeconds > 0 ? v.durationSeconds : 1;
            return upsertWatchProgress({
              profileId,
              metaId,
              videoId: v.videoId,
              type,
              progressSeconds: effectiveDuration,
              durationSeconds: effectiveDuration,
            });
          });

          void Promise.all(upserts).then(() => {
            void invalidateWatchHistory();
            showToast({
              title: t('completed'),
              message: metaName,
              preset: 'success',
              duration: TOAST_DURATION_SHORT,
            });
          });
          break;
        }
        case 'remove-from-history': {
          const removePromise =
            removalScope === 'item'
              ? removeWatchHistoryItem(profileId, metaId, videoIdToMark)
              : removeWatchHistoryMeta(profileId, metaId);
          void removePromise.then(() => {
            void invalidateWatchHistory();
            showToast({
              title: t('remove_from_history'),
              message: metaName,
              preset: 'success',
              duration: TOAST_DURATION_SHORT,
            });
          });
          break;
        }
      }

      setIsVisible(false);
    },
    [
      profileId,
      metaId,
      type,
      metaName,
      videoIdToMark,
      durationSeconds,
      videosToMark,
      removalScope,
      invalidateWatchHistory,
      t,
    ]
  );

  return {
    isVisible,
    items,
    openActions,
    closeActions,
    handleAction,
  };
}
