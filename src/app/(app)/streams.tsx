import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native-gesture-handler';

import { useTheme } from '@shopify/restyle';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useMeta } from '@/api/stremio';
import { Button } from '@/components/basic/Button';
import { Container } from '@/components/basic/Container';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { MediaDetailsHeader } from '@/components/media/MediaDetailsHeader';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { StreamList } from '@/components/media/StreamList';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { Box, Text, type Theme } from '@/theme/theme';
import { ContentType } from '@/types/stremio';
import { formatPlayerTitle } from '@/utils/format';

export default function StreamsPage() {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const {
    metaId,
    videoId,
    type = 'movie',
    autoPlay,
    bingeGroup,
  } = useLocalSearchParams<{
    metaId: string;
    videoId: string;
    type: ContentType;
    autoPlay?: string;
    bingeGroup?: string;
  }>();

  const { data: meta, isLoading, isError, error } = useMeta(type, metaId, true);

  const selectedVideo = useMemo(() => meta?.videos?.find((v) => v.id === videoId), [meta, videoId]);
  const playerTitle = useMemo(() => formatPlayerTitle(meta, selectedVideo), [meta, selectedVideo]);

  const { effectiveAutoPlay, cancelAutoPlay } = useAutoPlay({
    metaId,
    videoId,
    type,
    playerTitle,
    bingeGroup,
    autoPlay,
    backgroundImage: meta?.background,
    logoImage: meta?.logo,
  });

  if (effectiveAutoPlay) {
    return (
      <Container disablePadding safeAreaEdges={['left', 'right', 'top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Box flex={1} backgroundColor="mainBackground" alignItems="center" justifyContent="center">
          <Box alignItems="center" gap="l">
            <LoadingIndicator noFlex />
            <Text variant="body" color="textSecondary" textAlign="center">
              {t('auto_playing')}
            </Text>
            <Button
              title={t('manual_select_stream')}
              variant="secondary"
              onPress={cancelAutoPlay}
              hasTVPreferredFocus
            />
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top', 'bottom']}>
      <Stack.Screen
        options={{
          title: t('select_stream'),
          headerStyle: { backgroundColor: theme.colors.cardBackground },
          headerTintColor: theme.colors.mainForeground,
          headerTitleStyle: {
            color: theme.colors.mainForeground,
            fontFamily: 'Outfit_600SemiBold',
          },
        }}
      />
      <LoadingQuery
        data={meta}
        isLoading={isLoading}
        isError={isError}
        error={error}
        loadingComponent={<MediaDetailsSkeleton variant="minimal" />}>
        {(mediaData) => (
          <ScrollView>
            <Box flex={1} backgroundColor="mainBackground">
              <MediaDetailsHeader media={mediaData} video={selectedVideo} variant="minimal" />
              <Box paddingHorizontal="l">
                <StreamList
                  type={type}
                  id={metaId}
                  videoId={videoId}
                  title={playerTitle}
                  backgroundImage={mediaData.background}
                  logoImage={mediaData.logo}
                />
              </Box>
            </Box>
          </ScrollView>
        )}
      </LoadingQuery>
    </Container>
  );
}
