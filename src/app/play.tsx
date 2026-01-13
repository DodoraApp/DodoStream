import { VideoPlayer } from '@/components/video/VideoPlayer';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Box } from '@/theme/theme';
import { showToast } from '@/store/toast.store';
import type { ContentType } from '@/types/stremio';
import { useDebugLogger } from '@/utils/debug';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useTVBackButton } from '@/hooks/useTVBackButton';

const parseBooleanParam = (value?: string): boolean => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};

const Play = () => {
  const {
    source,
    title,
    metaId,
    type,
    videoId,
    bingeGroup,
    fromAutoPlay,
    backgroundImage,
    logoImage,
  } = useLocalSearchParams<{
    source: string;
    title?: string;
    metaId?: string;
    type?: ContentType;
    videoId?: string;
    bingeGroup?: string;
    fromAutoPlay?: string;
    backgroundImage?: string;
    logoImage?: string;
  }>();
  const router = useRouter();
  const { replaceToStreams } = useMediaNavigation();

  const debug = useDebugLogger('Play');
  const shouldReturnToStreams = parseBooleanParam(fromAutoPlay);

  const returnToStreams = useCallback(() => {
    if (!metaId || !type || !videoId) {
      debug('returnToStreamsMissingParams', { metaId, type, videoId, shouldReturnToStreams });
      router.back();
      return;
    }

    debug('returnToStreams', { metaId, type, videoId, bingeGroup });
    // When returning from playback we want to show the stream list,
    // not immediately auto-restart the last stream.
    replaceToStreams({ metaId, videoId, type }, { bingeGroup, autoPlay: '0' });
  }, [bingeGroup, debug, metaId, replaceToStreams, router, shouldReturnToStreams, type, videoId]);

  const handleStop = useCallback(() => {
    debug('handleStop');
    if (shouldReturnToStreams) {
      returnToStreams();
      return;
    }
    router.back();
  }, [debug, returnToStreams, router, shouldReturnToStreams]);

  useTVBackButton(() => {
    debug('backButtonPressed');
    handleStop();
    return true;
  });

  const handleError = useCallback(
    (message: string) => {
      debug('handleError', { message });
      showToast({ title: 'Playback Error', message, preset: 'error' });
      if (shouldReturnToStreams) {
        returnToStreams();
        return;
      }
      router.back();
    },
    [debug, returnToStreams, router, shouldReturnToStreams]
  );

  if (!metaId || !type) {
    showToast({ title: 'Missing playback info', preset: 'error' });
    router.back();
    return null;
  }

  return (
    <Box flex={1} backgroundColor="playerBackground">
      <Stack.Screen
        options={{
          headerShown: false,
          orientation: 'landscape',
        }}
      />
      <VideoPlayer
        source={source}
        title={title}
        mediaType={type}
        metaId={metaId}
        videoId={videoId}
        bingeGroup={bingeGroup}
        backgroundImage={backgroundImage}
        logoImage={logoImage}
        onStop={handleStop}
        onError={handleError}
      />
    </Box>
  );
};

export default Play;
