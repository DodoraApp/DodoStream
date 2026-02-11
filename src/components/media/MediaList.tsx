import { memo, useCallback } from 'react';
import { HWEvent, Platform, TVFocusGuideView, useTVEventHandler, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { MediaCard } from './MediaCard';
import { MetaPreview } from '@/types/stremio';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import { TV_DRAW_DISTANCE } from '@/constants/ui';

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

    return (
      <TVFocusGuideView trapFocusRight autoFocus>
        <FlashList
          horizontal
          data={data}
          renderItem={({ item, index }) => (
            <MediaCard
              media={item}
              onPress={onMediaPress}
              hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
              onFocused={onItemFocused}
            />
          )}
          nestedScrollEnabled
          keyExtractor={(item, index) => item.id + '_' + index}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={HorizontalSpacer}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m,
            paddingVertical: theme.spacing.s,
          }}
        />
      </TVFocusGuideView>
    );
  }
);

MediaList.displayName = 'MediaList';
