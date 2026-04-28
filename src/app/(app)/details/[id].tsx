import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@shopify/restyle';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useMeta } from '@/api/stremio';
import { Container } from '@/components/basic/Container';
import FadeIn from '@/components/basic/FadeIn';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { PickerModal } from '@/components/basic/PickerModal';
import { DetailsShell } from '@/components/media/DetailsShell';
import { MediaButtons } from '@/components/media/MediaButtons';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { MediaDetailsTabs } from '@/components/media/MediaDetailsTabs';
import { useMediaDetailsActions } from '@/hooks/useMediaDetailsActions';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import type { Theme } from '@/theme/theme';
import { ContentType, MetaVideo } from '@/types/stremio';

export default function MediaDetails() {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const { id, type = 'movie' } = useLocalSearchParams<{ id: string; type?: ContentType }>();
  const { pushToStreams } = useMediaNavigation();
  const { data: meta, isLoading, isError } = useMeta(type, id);

  // Episode long-press context menu
  const [activeEpisode, setActiveEpisode] = useState<MetaVideo | null>(null);

  const episodeActions = useMediaDetailsActions({
    metaId: id,
    type,
    metaName: activeEpisode?.title ?? activeEpisode?.name ?? '',
    targetVideoId: activeEpisode?.id,
    removalScope: 'item',
  });

  const handleEpisodePress = useCallback(
    (video: MetaVideo) => {
      if (!meta) return;
      pushToStreams({ metaId: id, videoId: video.id, type });
    },
    [meta, id, type, pushToStreams]
  );

  const { openActions: openEpisodeActions } = episodeActions;
  const handleEpisodeLongPress = useCallback(
    (video: MetaVideo) => {
      setActiveEpisode(video);
      openEpisodeActions();
    },
    [openEpisodeActions]
  );

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: undefined,
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
        loadingMessage={t('loading_details')}
        loadingComponent={<MediaDetailsSkeleton />}
        emptyMessage={t('no_details')}
        errorMessage={t('failed_load_details')}>
        {(mediaData) => (
          <DetailsShell
            media={mediaData}
            headerChildren={
              <FadeIn>
                <MediaButtons metaId={id} type={type} media={mediaData} />
              </FadeIn>
            }>
            <MediaDetailsTabs
              media={mediaData}
              onEpisodePress={handleEpisodePress}
              onEpisodeLongPress={handleEpisodeLongPress}
            />
          </DetailsShell>
        )}
      </LoadingQuery>

      <PickerModal
        visible={episodeActions.isVisible}
        onClose={episodeActions.closeActions}
        label={activeEpisode?.title ?? activeEpisode?.name ?? ''}
        items={episodeActions.items}
        onValueChange={episodeActions.handleAction}
      />
    </Container>
  );
}
