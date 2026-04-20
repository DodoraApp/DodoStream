import { FC, useCallback } from 'react';
import { Linking } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { TrailerCard } from '@/components/media/TrailerCard';
import { MediaSectionHeader } from '@/components/media/MediaSectionHeader';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import FadeIn from '@/components/basic/FadeIn';

interface TrailerStream {
  title: string;
  ytId: string;
  lang?: string;
}

interface TrailersTabProps {
  trailers: TrailerStream[];
  isActive: boolean;
}

export const TrailersTab: FC<TrailersTabProps> = ({ trailers, isActive }) => {
  const theme = useTheme<Theme>();

  const handleTrailerPress = useCallback((ytId: string) => {
    Linking.openURL(`https://www.youtube.com/watch?v=${ytId}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TrailerStream }) => (
      <TrailerCard
        trailer={item}
        onPress={() => handleTrailerPress(item.ytId)}
        recyclingKey={item.ytId}
      />
    ),
    [handleTrailerPress]
  );

  const keyExtractor = useCallback((item: TrailerStream) => item.ytId, []);

  if (!isActive) return null;

  if (trailers.length === 0) {
    return (
      <Box padding="l" alignItems="center">
        <Text variant="body" color="textSecondary">
          No trailers available
        </Text>
      </Box>
    );
  }
  return (
    <FadeIn>
      <Box gap="m">
        <MediaSectionHeader title="Trailers" />
        <LegendList<TrailerStream>
          data={trailers}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingVertical: theme.spacing.s,
            paddingHorizontal: theme.spacing.s,
          }}
          ItemSeparatorComponent={HorizontalSpacer}
        />
      </Box>
    </FadeIn>
  );
};
