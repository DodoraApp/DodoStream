import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { Stream as StreamType, ContentType } from '@/types/stremio';
import { useDebugLogger } from '@/utils/debug';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';
import { useStreams } from '@/api/stremio';
import { useProfileSettingsStore } from '@/store/profile-settings.store';

const isStreamAvailable = (stream: StreamType) =>
  Boolean(stream.url || stream.externalUrl || stream.ytId);

const parseBooleanParam = (value?: string): boolean => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};
interface UseAutoPlayParams {
  metaId: string;
  videoId: string;
  type: ContentType;
  bingeGroup?: string;
  autoPlay?: string;
  playerTitle?: string;
  /** Background image URL for player loading screen. */
  backgroundImage?: string;
  /** Logo image URL for player loading screen. */
  logoImage?: string;
}

export const useAutoPlay = ({
  metaId,
  videoId,
  type,
  bingeGroup,
  playerTitle,
  autoPlay,
  backgroundImage,
  logoImage,
}: UseAutoPlayParams) => {
  const debug = useDebugLogger('useAutoPlay');
  const [autoPlayFailed, setAutoPlayFailed] = useState(false);
  const { autoPlayFirstStream } = useProfileSettingsStore((state) => ({
    autoPlayFirstStream: state.activeProfileId
      ? state.byProfile[state.activeProfileId]?.autoPlayFirstStream
      : false,
  }));

  const autoPlayFromParams = parseBooleanParam(autoPlay);
  const autoPlayFromSetting = !autoPlay && autoPlayFirstStream;
  const shouldAutoPlay = autoPlayFromParams || autoPlayFromSetting;
  const effectiveAutoPlay = shouldAutoPlay && !autoPlayFailed;

  const autoPlayAttemptRef = useRef(0);
  const didAutoNavigateRef = useRef(false);

  const lastStreamTarget = useWatchHistoryStore((state) =>
    state.getLastStreamTarget(metaId, videoId)
  );
  const { data: streams, isLoading } = useStreams(type, metaId, videoId, effectiveAutoPlay);

  const { openStreamTarget, openStreamFromStream } = useMediaNavigation();

  useEffect(() => {
    if (!effectiveAutoPlay || didAutoNavigateRef.current || isLoading) return;
    didAutoNavigateRef.current = true;

    if (lastStreamTarget) {
      debug('autoPlayLastTarget', { lastStreamTarget });

      openStreamTarget({
        metaId,
        videoId,
        type,
        title: playerTitle,
        bingeGroup,
        backgroundImage,
        logoImage,
        target: lastStreamTarget,
        navigation: 'replace',
        fromAutoPlay: lastStreamTarget.type === 'url',
        onExternalOpened: () => setAutoPlayFailed(true),
        onExternalOpenFailed: () => setAutoPlayFailed(true),
      });
      return;
    }

    const playableStreams = streams.filter(isStreamAvailable);
    const candidates = bingeGroup
      ? playableStreams.filter((s) => s.behaviorHints?.group === bingeGroup)
      : playableStreams;

    if (!candidates.length) {
      showToast({
        title: 'No playable stream found',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      setAutoPlayFailed(true);
      return;
    }

    const tryNextStream = () => {
      if (autoPlayAttemptRef.current >= MAX_AUTO_PLAY_ATTEMPTS) {
        debug('autoPlayExhausted');
        setAutoPlayFailed(true);
        return;
      }

      const stream = candidates[autoPlayAttemptRef.current++];
      if (!stream) return setAutoPlayFailed(true);

      openStreamFromStream({
        metaId,
        videoId,
        type,
        title: playerTitle,
        backgroundImage,
        logoImage,
        stream,
        navigation: 'replace',
        fromAutoPlay: true,
        onExternalOpened: () => setAutoPlayFailed(true),
        onExternalOpenFailed: () => tryNextStream(),
      });
    };

    tryNextStream();
  }, [effectiveAutoPlay, streams, metaId, videoId, type, bingeGroup, lastStreamTarget, openStreamFromStream, openStreamTarget, playerTitle, debug, isLoading, backgroundImage, logoImage]);

  return {
    effectiveAutoPlay,
  };
};
