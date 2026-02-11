import { memo, useCallback } from 'react';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { MediaCard } from '@/components/media/MediaCard';
import { useMeta } from '@/api/stremio';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import type { WatchedMetaSummary } from '@/store/watch-history.store';
import type { MetaPreview } from '@/types/stremio';

interface HistoryCardProps {
  /** The watch history summary for this meta */
  entry: WatchedMetaSummary;
  /** Callback when the card is pressed */
  onPress: (metaId: string, type: string) => void;
  /** Whether this card should receive TV focus by default */
  hasTVPreferredFocus?: boolean;
  testID?: string;
}

export const HistoryCard = memo(
  ({ entry, onPress, hasTVPreferredFocus = false, testID }: HistoryCardProps) => {
    const theme = useTheme<Theme>();
    const { data: meta, isLoading } = useMeta(entry.type, entry.id);

    const handlePress = useCallback(
      (media: MetaPreview) => {
        onPress(media.id, media.type);
      },
      [onPress]
    );

    // Loading state - show skeleton
    if (isLoading) {
      return (
        <Box
          width={theme.cardSizes.media.width}
          height={theme.cardSizes.media.height}
          justifyContent="center"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="l">
          <LoadingIndicator type="simple" size="small" />
        </Box>
      );
    }

    // No meta found
    if (!meta) {
      return (
        <Box
          width={theme.cardSizes.media.width}
          height={theme.cardSizes.media.height}
          justifyContent="center"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="l">
          <Text variant="caption" color="textSecondary">
            Unavailable
          </Text>
        </Box>
      );
    }

    // Get episode label for series with a latest watched episode
    const episodeLabel = entry.latestItem?.videoId
      ? formatSeasonEpisodeLabel(
          (meta as { videos?: { id: string; season?: number; episode?: number }[] }).videos?.find(
            (v) => v.id === entry.latestItem?.videoId
          )
        )
      : undefined;

    // Only show progress if in-progress (not completed)
    const progress = entry.isInProgress ? entry.progressRatio : undefined;

    return (
      <MediaCard
        media={{
          id: meta.id,
          type: meta.type ?? entry.type,
          name: meta.name,
          poster: meta.poster,
          background: meta.background,
        }}
        onPress={handlePress}
        badgeLabel={episodeLabel}
        progress={progress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        testID={testID}
      />
    );
  }
);

HistoryCard.displayName = 'HistoryCard';
