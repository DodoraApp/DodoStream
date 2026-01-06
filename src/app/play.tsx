import { VideoPlayer } from '@/components/video/VideoPlayer';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Box } from '@/theme/theme';
import { Alert, Platform, StatusBar } from 'react-native';
import type { ContentType } from '@/types/stremio';
import { useDebugLogger } from '@/utils/debug';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useTVBackButton } from '@/hooks/useTVBackButton';
import ImmersiveMode from 'react-native-immersive-mode';

const parseBooleanParam = (value?: string): boolean => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};

const Play = () => {
  const { source, title, metaId, type, videoId, bingeGroup, fromAutoPlay } = useLocalSearchParams<{
    source: string;
    title?: string;
    metaId?: string;
    type?: ContentType;
    videoId?: string;
    bingeGroup?: string;
    fromAutoPlay?: string;
  }>();
  const router = useRouter();
  const { replaceToStreams } = useMediaNavigation();

  const debug = useDebugLogger('Play');
  const shouldReturnToStreams = parseBooleanParam(fromAutoPlay);

  // Enable immersive mode (hide navigation bar) on Android
  useEffect(() => {
    // Hide status bar on all platforms
    StatusBar.setHidden(true);

    if (Platform.OS === 'android') {
      ImmersiveMode.fullLayout(true);
      ImmersiveMode.setBarMode('FullSticky');
    }

    return () => {
      StatusBar.setHidden(false);
      if (Platform.OS === 'android') {
        ImmersiveMode.fullLayout(false);
        ImmersiveMode.setBarMode('Normal');
      }
    };
  }, []);

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
      Alert.alert(message);
      if (shouldReturnToStreams) {
        returnToStreams();
        return;
      }
      router.back();
    },
    [debug, returnToStreams, router, shouldReturnToStreams]
  );

  if (!metaId || !type) {
    Alert.alert('Missing playback info');
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
        onStop={handleStop}
        onError={handleError}
      />
    </Box>
  );
};

export default Play;
