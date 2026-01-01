import { memo } from 'react';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

export interface StreamListSkeletonProps {
  count?: number;
}

export const StreamListSkeleton = memo(({ count }: StreamListSkeletonProps) => {
  const theme = useTheme<Theme>();
  const { isPlatformTV } = useResponsiveLayout();

  const horizontal = isPlatformTV;
  const defaultCount = horizontal ? 6 : 4;

  return (
    <CardListSkeleton
      horizontal={horizontal}
      count={count ?? defaultCount}
      cardWidth={horizontal ? theme.cardSizes.stream.width : '100%'}
      cardHeight={theme.cardSizes.stream.width * 0.56}
      cardBorderRadius="m"
      withLabel={false}
    />
  );
});

StreamListSkeleton.displayName = 'StreamListSkeleton';
