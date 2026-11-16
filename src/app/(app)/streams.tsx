import { useCallback, useMemo } from 'react';
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
import { DOWNLOADS_ENABLED } from '@/constants/downloads';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import { useDownloadActions } from '@/hooks/useDownloads';
import { Box, Text, type Theme } from '@/theme/theme';
import { ContentType, type Stream } from '@/types/stremio';
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

  const { startDownload } = useDownloadActions();

  const handleDownload = useCallback(
    (stream: Stream) => {
      startDownload({ metaId, videoId, type, title: playerTitle ?? meta?.name ?? metaId, stream });
    },
    [meta?.name, metaId, playerTitle, startDownload, type, videoId]
  );

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
    <Container
      disablePadding
      safeAreaEdges={['left', 'right', 'top', 'bottom']}
      preserveVerticalInsetsInLandscape>
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
                  onDownload={DOWNLOADS_ENABLED ? handleDownload : undefined}
                />
              </Box>
            </Box>
          </ScrollView>
        )}
      </LoadingQuery>
    </Container>
  );
}
