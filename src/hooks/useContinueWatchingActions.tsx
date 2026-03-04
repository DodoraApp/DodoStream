import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
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

export const useContinueWatchingActions = () => {
  const { navigateToDetails, pushToStreams } = useMediaNavigation();
  const profileId = useProfileStore((state) => state.activeProfileId);

  const [isVisible, setIsVisible] = useState(false);
  const [activeEntry, setActiveEntry] = useState<ContinueWatchingEntry | null>(null);

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

      const videoId = entry.videoId ?? entry.metaId;

      switch (action) {
        case 'details':
          navigateToDetails(entry.metaId, entry.type);
          return;
        case 'play':
        case 'resume':
          pushToStreams({ metaId: entry.metaId, videoId, type: entry.type });
          return;
        case 'play-from-start': {
          if (profileId) {
            void (async () => {
              const historyItem = await getWatchHistoryItem(profileId, entry.metaId, videoId);
              resetProgressToStart({
                metaId: entry.metaId,
                videoId,
                durationSeconds: historyItem?.durationSeconds,
                updateProgress: (metaKey, selectedVideoId, progressSeconds, durationSeconds) => {
                  void upsertWatchProgress({
                    profileId,
                    metaId: metaKey,
                    videoId: selectedVideoId,
                    type: entry.type,
                    progressSeconds,
                    durationSeconds,
                  });
                },
              });
            })();
          }
          pushToStreams({ metaId: entry.metaId, videoId, type: entry.type });
          return;
        }
        case 'hide':
          if (profileId) {
            void dismissFromContinueWatching(profileId, entry.metaId);
          }
          return;
        case 'remove-from-history':
          if (profileId) {
            void removeWatchHistoryMeta(profileId, entry.metaId);
          }
          return;
      }
    },
    [activeEntry, navigateToDetails, profileId, pushToStreams]
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
