import { memo } from 'react';
import { Skeleton } from '@/components/basic/Skeleton';
import { Box } from '@/theme/theme';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { getTextLineHeight } from '@/utils/layout';

/**
 * Skeleton for a single continue watching card.
 * Used when ContinueWatchingItem is loading its meta data.
 */
export const ContinueWatchingItemSkeleton = memo(() => {
  const theme = useTheme<Theme>();

  return (
    <Box width={theme.cardSizes.continueWatching.width} gap="s">
      {/* Image skeleton */}
      <Skeleton
        width={theme.cardSizes.continueWatching.width}
        height={theme.cardSizes.continueWatching.height}
        borderRadius="l"
      />
      {/* Text area: mirrors the Pressable > Box gap="xs" in ContinueWatchingCard */}
      <Box gap="xs">
        {/* Title skeleton */}
        <Skeleton width="75%" height={getTextLineHeight(theme, 'cardTitle')} borderRadius="s" />
        {/* Subtitle skeleton */}
        <Skeleton width="50%" height={getTextLineHeight(theme, 'bodySmall')} borderRadius="s" />
      </Box>
    </Box>
  );
});

ContinueWatchingItemSkeleton.displayName = 'ContinueWatchingItemSkeleton';
