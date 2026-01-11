import { memo } from 'react';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';

export interface ContinueWatchingListSkeletonProps {
  count?: number;
}

export const ContinueWatchingListSkeleton = memo(
  ({ count = 6 }: ContinueWatchingListSkeletonProps) => {
    const theme = useTheme<Theme>();

    // Total height = image height + gap (s=8) + title line + gap (xs=4) + subtitle line
    // Title line height approximately matches cardTitle font size (18)
    // Subtitle line height approximately matches caption font size (14)
    const totalCardHeight =
      theme.cardSizes.continueWatching.height + theme.spacing.s + 18 + theme.spacing.xs + 14;

    return (
      <CardListSkeleton
        horizontal
        count={count}
        cardWidth={theme.cardSizes.continueWatching.width}
        cardHeight={totalCardHeight}
        cardBorderRadius="l"
        withLabel={false}
        contentPaddingHorizontal="m"
        contentPaddingVertical="s"
      />
    );
  }
);

ContinueWatchingListSkeleton.displayName = 'ContinueWatchingListSkeleton';
