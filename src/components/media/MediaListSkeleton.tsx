import { memo } from 'react';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';

export interface MediaListSkeletonProps {
  count?: number;
}

export const MediaListSkeleton = memo(({ count = 8 }: MediaListSkeletonProps) => {
  const theme = useTheme<Theme>();

  return (
    <CardListSkeleton
      horizontal
      count={count}
      cardWidth={theme.cardSizes.media.width}
      cardHeight={theme.cardSizes.media.height}
      cardBorderRadius="l"
      withLabel
      contentPaddingHorizontal="m"
      contentPaddingVertical="s"
    />
  );
});

MediaListSkeleton.displayName = 'MediaListSkeleton';
