import { memo, useCallback, useMemo } from 'react';
import { Platform, TVFocusGuideView } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';

import { MOBILE_HORIZONTAL_DRAW_DISTANCE, TV_HORIZONTAL_DRAW_DISTANCE } from '@/constants/ui';
import type { Theme } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';
import { getMediaSectionHeight } from '@/utils/layout';

import { MediaCard } from './MediaCard';

interface MediaListProps {
  data: MetaPreview[];
  onMediaPress: (media: MetaPreview) => void;
  /** Pass true to give the first item TV preferred focus */
  hasTVPreferredFocus?: boolean;
  /** Called whenever any card in this row receives focus (TV only at call site) */
  onItemFocused?: () => void;
}

export const MediaList = memo(
  ({ data, onMediaPress, hasTVPreferredFocus = false, onItemFocused }: MediaListProps) => {
    const theme = useTheme<Theme>();
    const gap = theme.spacing.s + theme.spacing.xs;
    const itemSize = theme.cardSizes.media.width + gap;
    const listHeight = getMediaSectionHeight(theme);
    const listStyle = useMemo(() => ({ height: listHeight }), [listHeight]);

    const getFixedItemSize = useCallback(() => itemSize, [itemSize]);

    const keyExtractor = useCallback(
      (item: MetaPreview, index: number) => item.id + '_' + index,
      []
    );

    const renderItem = useCallback(
      ({ item, index }: { item: MetaPreview; index: number }) => (
        <MediaCard
          media={item}
          onPress={onMediaPress}
          hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
          onFocused={onItemFocused}
        />
      ),
      [onMediaPress, hasTVPreferredFocus, onItemFocused]
    );

    return (
      <TVFocusGuideView trapFocusRight autoFocus>
        <LegendList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          nestedScrollEnabled
          recycleItems
          getFixedItemSize={getFixedItemSize}
          drawDistance={
            Platform.isTV ? TV_HORIZONTAL_DRAW_DISTANCE : MOBILE_HORIZONTAL_DRAW_DISTANCE
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m,
            paddingVertical: theme.spacing.s,
          }}
          style={listStyle}
        />
      </TVFocusGuideView>
    );
  }
);

MediaList.displayName = 'MediaList';
