import { useLocalSearchParams, Stack } from 'expo-router';
import theme from '@/theme/theme';
import { useMeta } from '@/api/stremio';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { EpisodeList } from '@/components/media/EpisodeList';
import { ContentType, MetaVideo } from '@/types/stremio';
import { Container } from '@/components/basic/Container';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { DetailsShell } from '@/components/media/DetailsShell';
import FadeIn from '@/components/basic/FadeIn';
import { MediaButtons } from '@/components/media/MediaButtons';

export default function MediaDetails() {
  const { id, type = 'movie' } = useLocalSearchParams<{ id: string; type?: ContentType }>();
  const { pushToStreams } = useMediaNavigation();
  const { data: meta, isLoading, isError } = useMeta(type, id);

  const handleEpisodePress = (video: MetaVideo) => {
    if (!meta) return;
    pushToStreams({ metaId: id, videoId: video.id, type });
  };

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: theme.colors.mainForeground,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerShadowVisible: false,
        }}
      />

      <LoadingQuery
        isLoading={isLoading}
        isError={isError}
        data={meta}
        loadingMessage="Loading details..."
        loadingComponent={<MediaDetailsSkeleton />}
        emptyMessage={`No details available for ID ${id}. Try installing a metadata addon that supports this ID.`}
        errorMessage="Failed to load details">
        {(mediaData) => (
          <DetailsShell
            media={mediaData}
            headerChildren={
              <FadeIn>
                <MediaButtons metaId={id} type={type} media={mediaData} />
              </FadeIn>
            }>
            {mediaData.videos && mediaData.videos.length > 1 && (
              <EpisodeList
                metaId={id}
                videos={mediaData.videos}
                onEpisodePress={handleEpisodePress}
              />
            )}
          </DetailsShell>
        )}
      </LoadingQuery>
    </Container>
  );
}
