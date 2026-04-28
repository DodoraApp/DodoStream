import { memo, useMemo } from 'react';
import { ScrollView } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { ContinueWatchingItemSkeleton } from '@/components/media/ContinueWatchingItemSkeleton';
import type { Theme } from '@/theme/theme';
import { getContinueWatchingSectionHeight } from '@/utils/layout';

export interface ContinueWatchingListSkeletonProps {
  count?: number;
}

export const ContinueWatchingListSkeleton = memo(
  ({ count = 6 }: ContinueWatchingListSkeletonProps) => {
    const theme = useTheme<Theme>();
    const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: getContinueWatchingSectionHeight(theme) }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.m,
          paddingVertical: theme.spacing.s,
          gap: theme.spacing.s + theme.spacing.xs,
        }}>
        {items.map((item) => (
          <ContinueWatchingItemSkeleton key={item} />
        ))}
      </ScrollView>
    );
  }
);

ContinueWatchingListSkeleton.displayName = 'ContinueWatchingListSkeleton';
