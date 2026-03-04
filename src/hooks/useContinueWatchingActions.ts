import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import type { PickerItem } from '@/components/basic/PickerModal';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import type { ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import type { ContinueWatchingAction } from '@/types/continue-watching';
import { resetProgressToStart } from '@/utils/playback';
import { useProfileStore } from '@/store/profile.store';
import {
  dismissFromContinueWatching,
  getWatchHistoryItem,
  removeWatchHistoryMeta,
  upsertWatchProgress,
} from '@/db';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';

export const useContinueWatchingActions = () => {
  const { navigateToDetails, pushToStreams } = useMediaNavigation();
  const profileId = useProfileStore((state) => state.activeProfileId);
  const queryClient = useQueryClient();

  const [isVisible, setIsVisible] = useState(false);
  const [activeEntry, setActiveEntry] = useState<ContinueWatchingEntry | null>(null);

  const invalidateWatchHistory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: watchHistoryKeys.all });
  }, [queryClient]);

  const openActions = useCallback((entry: ContinueWatchingEntry) => {
    if (!Platform.isTV) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setActiveEntry(entry);
    setIsVisible(true);
  }, []);

  const closeActions = useCallback(() => {
    setIsVisible(false);
  }, []);

  const items = useMemo<PickerItem<ContinueWatchingAction>[]>(() => {
    const entry = activeEntry;
    if (!entry) return [];

    const inProgress = entry.progressRatio > 0;

    const next: PickerItem<ContinueWatchingAction>[] = [
      { label: 'Details', value: 'details', icon: 'information-circle-outline' },
    ];

    if (inProgress) {
      next.push(
        { label: 'Play from start', value: 'play-from-start', icon: 'refresh' },
        { label: 'Resume', value: 'resume', icon: 'play' }
      );
    } else {
      next.push({ label: 'Play', value: 'play', icon: 'play' });
    }

    next.push(
      { label: 'Hide', value: 'hide', icon: 'eye-off-outline' },
      {
        label: 'Remove from history',
        value: 'remove-from-history',
        icon: 'trash-outline',
        tone: 'destructive',
      }
    );

    return next;
  }, [activeEntry]);

  const handleAction = useCallback(
    (action: ContinueWatchingAction) => {
      const entry = activeEntry;
      if (!entry) return;

      // For navigation: streams screen needs a videoId (falls back to metaId for movies)
      const navVideoId = entry.videoId ?? entry.metaId;
      // For DB lookups: movies are stored with videoId=null, so use entry.videoId as-is
      const dbVideoId = entry.videoId;

      switch (action) {
        case 'details':
          navigateToDetails(entry.metaId, entry.type);
          return;
        case 'play':
        case 'resume':
          pushToStreams({ metaId: entry.metaId, videoId: navVideoId, type: entry.type });
          return;
        case 'play-from-start': {
          if (profileId) {
            void (async () => {
              const historyItem = await getWatchHistoryItem(profileId, entry.metaId, dbVideoId);
              resetProgressToStart({
                metaId: entry.metaId,
                videoId: dbVideoId,
                durationSeconds: historyItem?.durationSeconds,
                updateProgress: (metaKey, selectedVideoId, progressSeconds, durationSeconds) => {
                  void (async () => {
                    await upsertWatchProgress({
                      profileId,
                      metaId: metaKey,
                      videoId: selectedVideoId,
                      type: entry.type,
                      progressSeconds,
                      durationSeconds,
                    });
                    await invalidateWatchHistory();
                  })();
                },
              });
              pushToStreams({ metaId: entry.metaId, videoId: navVideoId, type: entry.type });
            })();
          } else {
            pushToStreams({ metaId: entry.metaId, videoId: navVideoId, type: entry.type });
          }
          return;
        }
        case 'hide':
          if (profileId) {
            void (async () => {
              await dismissFromContinueWatching(profileId, entry.metaId);
              await invalidateWatchHistory();
            })();
          }
          return;
        case 'remove-from-history':
          if (profileId) {
            void (async () => {
              await removeWatchHistoryMeta(profileId, entry.metaId);
              await invalidateWatchHistory();
            })();
          }
          return;
      }
    },
    [activeEntry, invalidateWatchHistory, navigateToDetails, profileId, pushToStreams]
  );

  const label = activeEntry?.metaName ?? 'Continue Watching';

  return {
    isVisible,
    label,
    items,
    openActions,
    closeActions,
    handleAction,
  };
};
