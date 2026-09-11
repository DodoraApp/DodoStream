import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useStreams } from '@/api/stremio';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { getLastStreamTarget } from '@/db';
import { type StreamTarget, useMediaNavigation } from '@/hooks/useMediaNavigation';
import { usePlaybackStore } from '@/store/playback.store';
import { showToast } from '@/store/toast.store';
import { ContentType, Stream as StreamType } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import { parseBooleanParam } from '@/utils/params';
import { getStreamStableId, isStreamAvailable, normalizeStreamUrl } from '@/utils/stream';
const debug = createDebugLogger('useAutoPlay');

const findLastStream = (
  streams: StreamType[] | undefined,
  target: StreamTarget | undefined
): StreamType | undefined => {
  if (!streams || target?.type !== 'url') return undefined;

  if (target.streamId) {
    return streams.find((stream) => getStreamStableId(stream) === target.streamId);
  }

  const normalizedTargetUrl = normalizeStreamUrl(target.value);
  return streams.find(
    (stream) => !!stream.url && normalizeStreamUrl(stream.url) === normalizedTargetUrl
  );
};

const resolveLastStreamTarget = (
  target: StreamTarget | undefined,
  stream: StreamType | undefined
): StreamTarget | undefined => {
  if (!target || target.type !== 'url' || !stream?.url) return target;

  return {
    type: 'url',
    value: stream.url,
    streamId: getStreamStableId(stream),
  };
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
  const { t } = useTranslation('media');
  const [autoPlayFailed, setAutoPlayFailed] = useState(false);
  const [autoPlayCancelled, setAutoPlayCancelled] = useState(false);
  // zustand v5 + React 19: primitive selectors keep the snapshot cached.
  const autoPlayFirstStream = usePlaybackStore((state) =>
    state.activeProfileId ? state.byProfile[state.activeProfileId]?.autoPlayFirstStream : false
  );

  const autoPlayFromParams = parseBooleanParam(autoPlay);
  const autoPlayFromSetting = !autoPlay && autoPlayFirstStream;
  const shouldAutoPlay = autoPlayFromParams || autoPlayFromSetting;
  const effectiveAutoPlay = shouldAutoPlay && !autoPlayFailed && !autoPlayCancelled;
  const cancelAutoPlay = useCallback(() => setAutoPlayCancelled(true), []);

  const autoPlayAttemptRef = useRef(0);
  const didAutoNavigateRef = useRef(false);
  const [lastStreamTarget, setLastStreamTarget] = useState<StreamTarget | undefined>();

  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      const profileId = usePlaybackStore.getState().activeProfileId;
      if (!profileId) {
        if (!isCancelled) setLastStreamTarget(undefined);
        return;
      }

      const target = await getLastStreamTarget(profileId, metaId, videoId);
      if (!isCancelled) setLastStreamTarget(target);
    })();

    return () => {
      isCancelled = true;
    };
  }, [metaId, videoId]);
  const { data: streams, isLoading } = useStreams(type, metaId, videoId, effectiveAutoPlay);

  const lastStream = findLastStream(streams, lastStreamTarget);
  const lastStreamTargetForPlayback = resolveLastStreamTarget(lastStreamTarget, lastStream);
  const lastStreamId = lastStreamTargetForPlayback?.streamId;
  const { openStreamTarget, openStreamFromStream } = useMediaNavigation();

  useEffect(() => {
    if (!effectiveAutoPlay || didAutoNavigateRef.current || isLoading) return;
    didAutoNavigateRef.current = true;

    if (lastStreamTargetForPlayback) {
      debug('autoPlayLastTarget', {
        lastStreamTarget: lastStreamTargetForPlayback,
        lastStreamId,
        matchedStreamUrl: lastStream?.url,
      });

      openStreamTarget({
        metaId,
        videoId,
        type,
        title: playerTitle,
        bingeGroup,
        backgroundImage,
        logoImage,
        target: lastStreamTargetForPlayback,
        streamId: lastStreamId,
        navigation: 'replace',
        fromAutoPlay: lastStreamTargetForPlayback.type === 'url',
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
        title: t('no_playable_stream'),
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      // Async so the compiler does not flag synchronous setState in effects
      queueMicrotask(() => setAutoPlayFailed(true));
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
  }, [
    effectiveAutoPlay,
    streams,
    metaId,
    videoId,
    type,
    bingeGroup,
    lastStreamTargetForPlayback,
    lastStream,
    lastStreamId,
    openStreamFromStream,
    openStreamTarget,
    playerTitle,
    isLoading,
    backgroundImage,
    logoImage,
    t,
  ]);

  return {
    effectiveAutoPlay,
    cancelAutoPlay,
  };
};
