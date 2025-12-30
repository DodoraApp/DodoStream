import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import theme, { Box } from '@/theme/theme';

import { ContentType, Stream as StreamType } from '@/types/stremio';
import { Container } from '@/components/basic/Container';
import { StreamList } from '@/components/media/StreamList';
import { MediaDetailsHeader } from '@/components/media/MediaDetailsHeader';
import { useMeta, useStreams } from '@/api/stremio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { MediaDetailsSkeleton } from '@/components/media/MediaDetailsSkeleton';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { ScrollView } from 'react-native-gesture-handler';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import * as Burnt from 'burnt';
import { useDebugLogger } from '@/utils/debug';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { Button } from '@/components/basic/Button';

const parseBooleanParam = (value?: string): boolean => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};

const isStreamAvailable = (stream: StreamType): boolean => {
  return !!(stream.url || stream.externalUrl || stream.ytId);
};

export default function StreamsPage() {
  const router = useRouter();
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

  const shouldAutoPlay = parseBooleanParam(autoPlay);
  const [autoPlayFailed, setAutoPlayFailed] = useState(false);
  const effectiveAutoPlay = shouldAutoPlay && !autoPlayFailed;

  const debug = useDebugLogger('StreamsPage');

  const { data: meta, isLoading, isError, error } = useMeta(type, metaId, true);
  const { data: streams } = useStreams(type, metaId, videoId, effectiveAutoPlay);

  const lastStreamTarget = useWatchHistoryStore((state) =>
    state.getLastStreamTarget(metaId, videoId)
  );
  const { openStreamTarget, openStreamFromStream } = useMediaNavigation();

  const didAutoNavigateRef = useRef(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const selectedVideo = useMemo(() => {
    if (!meta) return undefined;
    return meta.videos?.find((v) => v.id === videoId);
  }, [meta, videoId]);

  const streamListTitle = useMemo(() => {
    if (!meta) return 'Select Stream';
    return selectedVideo?.title ?? meta.name;
  }, [meta, selectedVideo?.title]);

  useEffect(() => {
    if (!effectiveAutoPlay) return;
    if (didAutoNavigateRef.current) return;
    if (!meta) return;

    debug('autoPlayStart', {
      metaId,
      videoId,
      type,
      bingeGroup,
      streamsCount: streams.length,
    });

    // If we have a stored last stream target, use it directly (stream lists can be non-deterministic).
    if (lastStreamTarget) {
      didAutoNavigateRef.current = true;

      debug('autoPlayLastTarget', { metaId, videoId, type, lastStreamTarget });

      openStreamTarget({
        metaId,
        videoId,
        type,
        title: streamListTitle,
        bingeGroup,
        target: lastStreamTarget,
        navigation: 'replace',
        fromAutoPlay: lastStreamTarget.type === 'url',
        onExternalOpened: () => setAutoPlayFailed(true),
        onExternalOpenFailed: () => {
          didAutoNavigateRef.current = true;
          setAutoPlayFailed(true);
        },
      });
      return;
    }

    // No stored target: fall back to choosing a stream from the fetched list.
    if (!streams || streams.length === 0) return;
    const matching = bingeGroup
      ? streams.find((s) => s.behaviorHints?.group === bingeGroup && isStreamAvailable(s))
      : undefined;

    const candidate = matching ?? streams.find(isStreamAvailable);

    debug('autoPlayCandidate', {
      bingeGroup,
      lastStreamTarget,
      matchedByGroup: !!matching,
      candidateName: candidate?.name,
      candidateGroup: candidate?.behaviorHints?.group,
      candidateHasUrl: !!candidate?.url,
      candidateHasExternalUrl: !!candidate?.externalUrl,
      candidateHasYtId: !!candidate?.ytId,
    });

    if (!candidate) {
      Burnt.toast({
        title: 'No playable stream found',
        preset: 'error',
        haptic: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      didAutoNavigateRef.current = true;
      setAutoPlayFailed(true);
      return;
    }

    didAutoNavigateRef.current = true;

    if (candidate.url) {
      debug('navigateToPlay', {
        source: 'url',
        group: candidate.behaviorHints?.group ?? bingeGroup,
      });
      openStreamFromStream({
        metaId,
        videoId,
        type,
        title: streamListTitle,
        stream: candidate,
        navigation: 'replace',
        fromAutoPlay: true,
      });
    } else {
      openStreamFromStream({
        metaId,
        videoId,
        type,
        title: streamListTitle,
        stream: candidate,
        navigation: 'replace',
        onExternalOpened: () => setAutoPlayFailed(true),
        onExternalOpenFailed: () => {
          didAutoNavigateRef.current = true;
          setAutoPlayFailed(true);
        },
      });
    }
  }, [
    bingeGroup,
    debug,
    effectiveAutoPlay,
    lastStreamTarget,
    meta,
    metaId,
    openStreamFromStream,
    openStreamTarget,
    streamListTitle,
    streams,
    type,
    videoId,
  ]);

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
          headerStyle: {
            backgroundColor: theme.colors.cardBackground,
          },
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
                <StreamList title={streamListTitle} type={type} id={metaId} videoId={videoId} />
              </Box>
            </Box>
          </ScrollView>
        )}
      </LoadingQuery>
    </Container>
  );
}
