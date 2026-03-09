import { memo, useCallback } from 'react';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { MediaCard } from '@/components/media/MediaCard';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import { useMeta } from '@/api/stremio/hooks';
import type { ContentType, MetaPreview } from '@/types/stremio';
import type { DbWatchedMetaSummary } from '@/db';
import { NO_POSTER_PORTRAIT } from '@/constants/images';

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
    const isMissingMeta = !entry.metaName;
    const { data: resolvedMeta } = useMeta(entry.type, entry.id, isMissingMeta);

    const displayName = entry.metaName ?? resolvedMeta?.name;
    const displayImage = entry.imageUrl ?? resolvedMeta?.poster;

    const handlePress = useCallback(
      (media: MetaPreview) => {
        onPress(media.id, media.type);
      },
      [onPress]
    );

    // Show placeholder if meta_cache hasn't been populated yet (first launch)
    if (!displayName) {
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
          name: displayName ?? '',
          poster: displayImage ?? NO_POSTER_PORTRAIT,
          background: displayImage,
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
