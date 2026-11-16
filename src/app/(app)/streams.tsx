import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useTheme } from '@shopify/restyle';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useMeta } from '@/api/stremio';
import { Button } from '@/components/basic/Button';
import { Container } from '@/components/basic/Container';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { DownloadItem } from '@/components/media/DownloadItem';
import { MediaDetailsHeader } from '@/components/media/MediaDetailsHeader';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { StreamList } from '@/components/media/StreamList';
import { useAutoPlay } from '@/hooks/useAutoPlay';
import {
  useDownloadActions,
  useDownloadForVideo,
  useDownloadItemHandlers,
} from '@/hooks/useDownloads';
import { Box, Text, type Theme } from '@/theme/theme';
import { ContentType, type Stream } from '@/types/stremio';
import { formatPlayerTitle } from '@/utils/format';

export default function StreamsPage() {
  const { t } = useTranslation(['media', 'common']);
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

  // Downloads are a phone feature; TV layouts keep the plain stream list.
  const { data: download } = useDownloadForVideo(metaId, videoId);
  const { startDownload, startSeasonDownload } = useDownloadActions();
  const downloadHandlers = useDownloadItemHandlers();
  const canStartDownload = !Platform.isTV && (download === null || download?.status === 'failed');

  // All episodes of the selected episode's season, in the order of the addon.
  const seasonEpisodes = useMemo(() => {
    if (selectedVideo?.season == null) return [];
    return (meta?.videos ?? [])
      .filter((video) => video.season === selectedVideo.season)
      .map((video) => ({
        videoId: video.id,
        title: formatPlayerTitle(meta, video) ?? meta?.name ?? video.id,
      }));
  }, [meta, selectedVideo]);

  const handleDownload = useCallback(
    (stream: Stream) => {
      const downloadEpisode = () =>
        startDownload({
          metaId,
          videoId,
          type,
          title: playerTitle ?? meta?.name ?? metaId,
          stream,
        });

      if (seasonEpisodes.length <= 1 || !stream.addonManifestUrl) {
        downloadEpisode();
        return;
      }

      Alert.alert(
        t('download_season_title'),
        t('download_season_message', { count: seasonEpisodes.length }),
        [
          { text: t('common:cancel'), style: 'cancel' },
          { text: t('download_this_episode'), onPress: downloadEpisode },
          {
            text: t('download_whole_season'),
            onPress: () => {
              // The picked episode uses exactly the chosen stream; the others are looked up.
              downloadEpisode();
              startSeasonDownload({
                metaId,
                type,
                referenceStream: stream,
                episodes: seasonEpisodes.filter((episode) => episode.videoId !== videoId),
              });
            },
          },
        ]
      );
    },
    [
      meta?.name,
      metaId,
      playerTitle,
      seasonEpisodes,
      startDownload,
      startSeasonDownload,
      t,
      type,
      videoId,
    ]
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
                {!Platform.isTV && download ? (
                  <Box paddingBottom="m">
                    <DownloadItem
                      download={download}
                      onPlay={downloadHandlers.onPlay}
                      onRetry={downloadHandlers.onRetry}
                      onRemove={downloadHandlers.onRemove}
                    />
                  </Box>
                ) : null}
                <StreamList
                  type={type}
                  id={metaId}
                  videoId={videoId}
                  title={playerTitle}
                  backgroundImage={mediaData.background}
                  logoImage={mediaData.logo}
                  onDownload={canStartDownload ? handleDownload : undefined}
                />
              </Box>
            </Box>
          </ScrollView>
        )}
      </LoadingQuery>
    </Container>
  );
}
