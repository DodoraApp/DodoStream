import { memo, useCallback, useMemo } from 'react';
import { ContinueWatchingCard } from '@/components/media/ContinueWatchingCard';
import { ContinueWatchingItemSkeleton } from '@/components/media/ContinueWatchingItemSkeleton';
import { useMeta } from '@/api/stremio/hooks';
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
 * When cache is empty (e.g. after migration), useMeta fetches on demand.
 */
export const ContinueWatchingItem = memo(
  ({ entry, hasTVPreferredFocus = false, onFocused, onLongPress }: ContinueWatchingItemProps) => {
    const { pushToStreams } = useMediaNavigation();
    const isMissingMeta = !entry.metaName;
    const { data: resolvedMeta } = useMeta(entry.type, entry.metaId, isMissingMeta);
    const { data: lastStreamTarget } = useLastStreamTarget(
      entry.metaId,
      entry.videoId ?? entry.metaId
    );

    const displayName = entry.metaName ?? resolvedMeta?.name;
    const displayImage = entry.imageUrl ?? resolvedMeta?.poster;

    const resolvedEntry = useMemo(
      () =>
        isMissingMeta && displayName
          ? { ...entry, metaName: displayName, imageUrl: displayImage }
          : entry,
      [entry, isMissingMeta, displayName, displayImage]
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
    if (!displayName) {
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
