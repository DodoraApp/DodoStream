import { memo, useCallback, useMemo } from 'react';
import { Platform, TVFocusGuideView } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';

import { useMeta } from '@/api/stremio';
import { NO_POSTER_PORTRAIT } from '@/constants/images';
import { MOBILE_HORIZONTAL_DRAW_DISTANCE, TV_HORIZONTAL_DRAW_DISTANCE } from '@/constants/ui';
import type { Theme } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';
import { getMediaSectionHeight } from '@/utils/layout';

import { MediaCard } from './MediaCard';

interface HydratedMediaCardProps {
  media: MetaPreview;
  onPress: (media: MetaPreview) => void;
  onFocused?: () => void;
  hasTVPreferredFocus: boolean;
}

const HydratedMediaCard = memo(
  ({ media, onPress, onFocused, hasTVPreferredFocus }: HydratedMediaCardProps) => {
    const needsMetadata = !media.name || typeof media.poster !== 'string';
    const { data: meta } = useMeta(media.type, media.id, needsMetadata);
    const hydratedMedia = useMemo(() => {
      if (!meta) return media;

      return {
        ...media,
        name: meta.name || media.name,
        poster: meta.poster ?? meta.background ?? media.poster ?? NO_POSTER_PORTRAIT,
      };
    }, [media, meta]);

    return (
      <MediaCard
        media={hydratedMedia}
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocused={onFocused}
      />
    );
  }
);

HydratedMediaCard.displayName = 'HydratedMediaCard';

interface MediaListProps {
  data: MetaPreview[];
  onMediaPress: (media: MetaPreview) => void;
  /** Pass true to give the first item TV preferred focus */
  hasTVPreferredFocus?: boolean;
  /** Called whenever any card in this row receives focus (TV only at call site) */
  onItemFocused?: () => void;
  /** Fetch missing names and posters from active metadata addons. */
  hydrateMetadata?: boolean;
}

export const MediaList = memo(
  ({
    data,
    onMediaPress,
    hasTVPreferredFocus = false,
    onItemFocused,
    hydrateMetadata,
  }: MediaListProps) => {
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
      ({ item, index }: { item: MetaPreview; index: number }) =>
        hydrateMetadata ? (
          <HydratedMediaCard
            media={item}
            onPress={onMediaPress}
            hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
            onFocused={onItemFocused}
          />
        ) : (
          <MediaCard
            media={item}
            onPress={onMediaPress}
            hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
            onFocused={onItemFocused}
          />
        ),
      [onMediaPress, hasTVPreferredFocus, onItemFocused, hydrateMetadata]
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
