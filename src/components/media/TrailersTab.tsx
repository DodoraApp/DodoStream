import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';

import FadeIn from '@/components/basic/FadeIn';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import { MediaSectionHeader } from '@/components/media/MediaSectionHeader';
import { TrailerCard } from '@/components/media/TrailerCard';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';

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
  const { t } = useTranslation('media');
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
          {t('no_trailers')}
        </Text>
      </Box>
    );
  }
  return (
    <FadeIn>
      <Box gap="m">
        <MediaSectionHeader title={t('trailers')} />
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
