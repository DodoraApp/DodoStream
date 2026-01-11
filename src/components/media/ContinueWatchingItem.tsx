import { memo, useCallback } from 'react';
import { ContinueWatchingCard } from '@/components/media/ContinueWatchingCard';
import { ContinueWatchingItemSkeleton } from '@/components/media/ContinueWatchingItemSkeleton';
import { useMeta } from '@/api/stremio';
import {
  useContinueWatchingForMeta,
  type ContinueWatchingEntry,
} from '@/hooks/useContinueWatching';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useWatchHistoryStore } from '@/store/watch-history.store';

interface ContinueWatchingItemProps {
  /** Basic entry from useContinueWatching (without resolved meta) */
  entry: ContinueWatchingEntry;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  onLongPress?: (entry: ContinueWatchingEntry) => void;
}

/**
 * Wrapper component for home screen continue watching items.
 * Fetches meta data and resolves the full entry before rendering the card.
 */
export const ContinueWatchingItem = memo(
  ({ entry, hasTVPreferredFocus = false, onFocused, onLongPress }: ContinueWatchingItemProps) => {
    const { pushToStreams } = useMediaNavigation();
    const getLastStreamTarget = useWatchHistoryStore((state) => state.getLastStreamTarget);

    // Fetch meta data for this entry
    const { data: meta, isLoading } = useMeta(entry.type, entry.metaId, true);

    // Get the fully resolved entry with up-next logic
    const resolvedEntry = useContinueWatchingForMeta(entry.metaId, meta);

    const handlePress = useCallback(() => {
      if (!resolvedEntry) return;

      const streamId = resolvedEntry.videoId ?? resolvedEntry.metaId;
      const lastStreamTarget = getLastStreamTarget(resolvedEntry.metaId, streamId);

      // Only autoplay when we have a previously selected stream
      pushToStreams(
        { metaId: resolvedEntry.metaId, videoId: streamId, type: resolvedEntry.type },
        lastStreamTarget ? { autoPlay: '1' } : undefined
      );
    }, [resolvedEntry, getLastStreamTarget, pushToStreams]);

    const handleLongPress = useCallback(() => {
      if (!resolvedEntry) return;
      onLongPress?.(resolvedEntry);
    }, [onLongPress, resolvedEntry]);

    // Show skeleton while loading
    if (isLoading || !resolvedEntry) {
      return <ContinueWatchingItemSkeleton />;
    }

    return (
      <ContinueWatchingCard
        entry={resolvedEntry}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onFocused={onFocused}
        hasTVPreferredFocus={hasTVPreferredFocus}
      />
    );
  }
);

ContinueWatchingItem.displayName = 'ContinueWatchingItem';
