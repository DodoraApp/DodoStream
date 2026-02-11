import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PickerItem } from '@/components/basic/PickerModal';
import { useContinueWatchingStore } from '@/store/continue-watching.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import type { ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import type { ContinueWatchingAction } from '@/types/continue-watching';
import { resetProgressToStart } from '@/utils/playback';

export const useContinueWatchingActions = () => {
  const { navigateToDetails, pushToStreams } = useMediaNavigation();

  const setHidden = useContinueWatchingStore((state) => state.setHidden);
  const updateProgress = useWatchHistoryStore((state) => state.updateProgress);
  const getItem = useWatchHistoryStore((state) => state.getItem);
  const removeMeta = useWatchHistoryStore((state) => state.removeMeta);

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
          const historyItem = getItem(entry.metaId, videoId);
          resetProgressToStart({
            metaId: entry.metaId,
            videoId,
            durationSeconds: historyItem?.durationSeconds,
            updateProgress,
          });
          pushToStreams({ metaId: entry.metaId, videoId, type: entry.type });
          return;
        }
        case 'hide':
          setHidden(entry.metaId, true);
          return;
        case 'remove-from-history':
          removeMeta(entry.metaId);
          return;
      }
    },
    [activeEntry, getItem, navigateToDetails, pushToStreams, removeMeta, setHidden, updateProgress]
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
