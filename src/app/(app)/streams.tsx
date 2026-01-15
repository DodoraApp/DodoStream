import { useLocalSearchParams, Stack } from 'expo-router';
import theme, { Box } from '@/theme/theme';
import { ContentType } from '@/types/stremio';
import { Container } from '@/components/basic/Container';
import { StreamList } from '@/components/media/StreamList';
import { MediaDetailsHeader } from '@/components/media/MediaDetailsHeader';
import { useMeta } from '@/api/stremio';
import { useMemo } from 'react';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { ScrollView } from 'react-native-gesture-handler';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { formatPlayerTitle } from '@/utils/format';
import { useAutoPlay } from '@/hooks/useAutoPlay';

export default function StreamsPage() {
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

  const { effectiveAutoPlay } = useAutoPlay({
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
      <Container disablePadding safeAreaEdges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Box flex={1} backgroundColor="mainBackground">
          <LoadingIndicator message="Auto playing..." />
        </Box>
      </Container>
    );
  }

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Select Stream',
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
