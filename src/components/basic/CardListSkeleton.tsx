import { Fragment, memo, useMemo } from 'react';
import { ScrollView } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { Skeleton } from '@/components/basic/Skeleton';
import { HorizontalSpacer, VerticalSpacer } from '@/components/basic/Spacer';
import type { Theme } from '@/theme/theme';
import { Box } from '@/theme/theme';
import { getTextLineHeight } from '@/utils/layout';

export interface CardListSkeletonProps {
  horizontal: boolean;
  count: number;
  cardWidth: number | `${number}%`;
  cardHeight: number;
  cardBorderRadius?: keyof Theme['borderRadii'];
  withLabel?: boolean;
  /** Number of columns for vertical grid layout. Default is 1 (single column). */
  numColumns?: number;
  contentPaddingHorizontal?: keyof Theme['spacing'];
  contentPaddingVertical?: keyof Theme['spacing'];
}

const SkeletonCard = memo(
  ({
    cardWidth,
    cardHeight,
    cardBorderRadius,
    withLabel,
  }: Pick<
    CardListSkeletonProps,
    'cardWidth' | 'cardHeight' | 'cardBorderRadius' | 'withLabel'
  >) => {
    const theme = useTheme<Theme>();

    return (
      <Box width={cardWidth} gap="s">
        <Skeleton width={cardWidth} height={cardHeight} borderRadius={cardBorderRadius} />
        {withLabel ? (
          <Skeleton width="75%" height={getTextLineHeight(theme, 'cardTitle')} borderRadius="s" />
        ) : null}
      </Box>
    );
  }
);

SkeletonCard.displayName = 'SkeletonCard';

export const CardListSkeleton = memo(
  ({
    horizontal,
    count,
    cardWidth,
    cardHeight,
    cardBorderRadius = 'l',
    withLabel = true,
    numColumns = 1,
    contentPaddingHorizontal,
    contentPaddingVertical,
  }: CardListSkeletonProps) => {
    const theme = useTheme<Theme>();

    const data = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);

    const contentPaddingStyle = {
      paddingHorizontal: contentPaddingHorizontal
        ? theme.spacing[contentPaddingHorizontal]
        : undefined,
      paddingVertical: contentPaddingVertical ? theme.spacing[contentPaddingVertical] : undefined,
    };

    if (horizontal) {
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={contentPaddingStyle}>
          <Box flexDirection="row">
            {data.map((item, index) => (
              <Fragment key={`card-skeleton-${item}`}>
                <SkeletonCard
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  cardBorderRadius={cardBorderRadius}
                  withLabel={withLabel}
                />
                {index < data.length - 1 &&
                  (horizontal ? <HorizontalSpacer /> : <VerticalSpacer />)}
              </Fragment>
            ))}
          </Box>
        </ScrollView>
      );
    }

    if (numColumns > 1) {
      const cellWidth = `${100 / numColumns}%` as `${number}%`;
      return (
        <Box flexDirection="row" flexWrap="wrap" style={contentPaddingStyle}>
          {data.map((item) => (
            <Box
              key={`card-skeleton-${item}`}
              width={cellWidth}
              alignItems="center"
              paddingBottom="m">
              <SkeletonCard
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                cardBorderRadius={cardBorderRadius}
                withLabel={withLabel}
              />
            </Box>
          ))}
        </Box>
      );
    }

    return (
      <Box style={contentPaddingStyle}>
        {data.map((item, index) => (
          <Fragment key={`card-skeleton-${item}`}>
            <SkeletonCard
              cardWidth="100%"
              cardHeight={cardHeight}
              cardBorderRadius={cardBorderRadius}
              withLabel={withLabel}
            />
            {index < data.length - 1 && <VerticalSpacer />}
          </Fragment>
        ))}
      </Box>
    );
  }
);

CardListSkeleton.displayName = 'CardListSkeleton';
