import { memo } from 'react';
import { Skeleton } from '@/components/basic/Skeleton';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import type { Theme } from '@/theme/theme';
import { Box } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

export interface MediaDetailsSkeletonProps {
  variant?: 'minimal' | 'full';
}

export const MediaDetailsSkeleton = memo(({ variant = 'full' }: MediaDetailsSkeletonProps) => {
  const theme = useTheme<Theme>();
  const { isPlatformTV, width } = useResponsiveLayout();

  if (isPlatformTV) {
    return (
      <Box flex={1} padding="xl" gap="l">
        <Box alignItems="center" paddingTop="xxl" gap="m">
          <Skeleton
            width={Math.min(width - theme.spacing.xl * 2, theme.sizes.logoMaxWidth)}
            height={theme.sizes.logoHeight}
            borderRadius="m"
          />
          <Skeleton width={Math.min(width * 0.6, 520)} height={theme.spacing.l} borderRadius="s" />
          <Skeleton width={Math.min(width * 0.45, 420)} height={theme.spacing.l} borderRadius="s" />
        </Box>

        <Box gap="m">
          <Skeleton width="100%" height={theme.spacing.xxl} borderRadius="m" />
          <Skeleton width="100%" height={theme.spacing.xxl} borderRadius="m" />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {variant !== 'minimal' && (
        <Skeleton width="100%" height={theme.sizes.mediaDetailsHeader} borderRadius="m" />
      )}

      <Box padding="l" gap="m">
        {variant !== 'minimal' && (
          <Box alignItems="center" gap="s">
            <Skeleton
              width={Math.min(width - theme.spacing.l * 2, theme.sizes.logoMaxWidth)}
              height={theme.sizes.logoHeight}
              borderRadius="m"
            />
          </Box>
        )}

        <Skeleton width="65%" height={theme.spacing.l} borderRadius="s" />
        <Skeleton width="45%" height={theme.spacing.l} borderRadius="s" />

        <Box gap="m" paddingTop="m">
          <Skeleton width="100%" height={theme.spacing.xxl} borderRadius="m" />
        </Box>

        <Box paddingTop="m">
          <CardListSkeleton
            horizontal={isPlatformTV}
            count={isPlatformTV ? 6 : 4}
            cardWidth={isPlatformTV ? theme.cardSizes.continueWatching.width : '100%'}
            cardHeight={
              theme.cardSizes.episode.imageHeight + theme.spacing.m * 2 + theme.spacing.xl
            }
            cardBorderRadius="m"
            withLabel={false}
            contentPaddingHorizontal="s"
            contentPaddingVertical="s"
          />
        </Box>
      </Box>
    </Box>
  );
});

MediaDetailsSkeleton.displayName = 'MediaDetailsSkeleton';
