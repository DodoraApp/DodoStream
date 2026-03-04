import { memo, useCallback } from 'react';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { MediaCard } from '@/components/media/MediaCard';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import type { ContentType, MetaPreview } from '@/types/stremio';
import type { DbWatchedMetaSummary } from '@/db';

interface HistoryCardProps {
  /** The watch history summary for this meta */
  entry: DbWatchedMetaSummary;
  /** Callback when the card is pressed */
  onPress: (metaId: string, type: ContentType) => void;
  /** Whether this card should receive TV focus by default */
  hasTVPreferredFocus?: boolean;
  testID?: string;
}

export const HistoryCard = memo(
  ({ entry, onPress, hasTVPreferredFocus = false, testID }: HistoryCardProps) => {
    const theme = useTheme<Theme>();

    const handlePress = useCallback(
      (media: MetaPreview) => {
        onPress(media.id, media.type);
      },
      [onPress]
    );

    // Show placeholder if meta_cache hasn't been populated yet (first launch)
    if (!entry.metaName && !entry.imageUrl) {
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
    const episodeLabel = entry.latestVideo
      ? formatSeasonEpisodeLabel(entry.latestVideo)
      : undefined;

    // Only show progress if in-progress (not completed)
    const progress = entry.isInProgress ? entry.progressRatio : undefined;

    return (
      <MediaCard
        media={{
          id: entry.id,
          type: entry.type,
          name: entry.metaName ?? '',
          poster: entry.imageUrl,
          background: entry.imageUrl,
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
