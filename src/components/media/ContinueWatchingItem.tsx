import { memo, useCallback } from 'react';
import { ContinueWatchingCard } from '@/components/media/ContinueWatchingCard';
import { ContinueWatchingItemSkeleton } from '@/components/media/ContinueWatchingItemSkeleton';
import { type ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useLastStreamTarget } from '@/hooks/useWatchHistoryDb';

interface ContinueWatchingItemProps {
  /** Basic entry from useContinueWatching (without resolved meta) */
  entry: ContinueWatchingEntry;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  onLongPress?: (entry: ContinueWatchingEntry) => void;
}

/**
 * Wrapper component for home screen continue watching items.
 * All display data (metaName, imageUrl, video) is pre-resolved in useContinueWatching
 * from the SQLite cache — no network fetch needed here.
 */
export const ContinueWatchingItem = memo(
  ({ entry, hasTVPreferredFocus = false, onFocused, onLongPress }: ContinueWatchingItemProps) => {
    const { pushToStreams } = useMediaNavigation();
    const { data: lastStreamTarget } = useLastStreamTarget(
      entry.metaId,
      entry.videoId ?? entry.metaId
    );

    const handlePress = useCallback(() => {
      const streamId = entry.videoId ?? entry.metaId;
      pushToStreams(
        { metaId: entry.metaId, videoId: streamId, type: entry.type },
        lastStreamTarget ? { autoPlay: '1' } : undefined
      );
    }, [lastStreamTarget, pushToStreams, entry]);

    const handleLongPress = useCallback(() => {
      onLongPress?.(entry);
    }, [onLongPress, entry]);

    // Show skeleton if we don't have enough data to render the card yet
    // (e.g. on first launch before meta_cache is populated)
    if (!entry.metaName && !entry.imageUrl) {
      return <ContinueWatchingItemSkeleton />;
    }

    return (
      <ContinueWatchingCard
        entry={entry}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onFocused={onFocused}
        hasTVPreferredFocus={hasTVPreferredFocus}
      />
    );
  }
);

ContinueWatchingItem.displayName = 'ContinueWatchingItem';
