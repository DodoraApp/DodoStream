import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { Stream as StreamType, ContentType } from '@/types/stremio';
import { useDebugLogger } from '@/utils/debug';
import { useMediaNavigation, type StreamTarget } from '@/hooks/useMediaNavigation';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';
import { useStreams } from '@/api/stremio';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { parseBooleanParam } from '@/utils/params';
import { getLastStreamTarget } from '@/db';

const isStreamAvailable = (stream: StreamType) =>
  Boolean(stream.url || stream.externalUrl || stream.ytId);

interface UseAutoPlayParams {
  metaId: string;
  videoId: string;
  type: ContentType;
  bingeGroup?: string;
  autoPlay?: string;
  /**
   * Tracks which candidate stream index to start from when retrying after a
   * player error. Passed back from play.tsx via URL params.
   * - `undefined` → fresh auto-play, use lastStreamTarget if available
   * - `'0'` → first candidate failed (or lastStreamTarget URL failed), start from index 0
   * - `'N'` → candidates 0…N-1 failed, start from index N
   */
  autoPlayAttempt?: string;
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
  autoPlayAttempt,
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

  // Parse the retry index coming back from play.tsx.
  // undefined → fresh start; number → retry from that candidate index.
  const parsedAutoPlayAttempt =
    autoPlayAttempt !== undefined
      ? (() => {
          const n = parseInt(autoPlayAttempt, 10);
          return isNaN(n) ? undefined : n;
        })()
      : undefined;

  const autoPlayAttemptRef = useRef(parsedAutoPlayAttempt ?? 0);
  const didAutoNavigateRef = useRef(false);
  const [lastStreamTarget, setLastStreamTarget] = useState<StreamTarget | undefined>();

  useEffect(() => {
    let isCancelled = false;
    const profileId = useProfileSettingsStore.getState().activeProfileId;
    if (!profileId) {
      setLastStreamTarget(undefined);
      return;
    }

    void (async () => {
      const target = await getLastStreamTarget(profileId, metaId, videoId);
      if (!isCancelled) setLastStreamTarget(target);
    })();

    return () => {
      isCancelled = true;
    };
  }, [metaId, videoId]);
  const { data: streams, isLoading } = useStreams(type, metaId, videoId, effectiveAutoPlay);

  const { openStreamTarget, openStreamFromStream } = useMediaNavigation();

  useEffect(() => {
    if (!effectiveAutoPlay || didAutoNavigateRef.current) return;

    // Fast-fail when all retry attempts coming back from play.tsx are exhausted.
    if (parsedAutoPlayAttempt !== undefined && parsedAutoPlayAttempt >= MAX_AUTO_PLAY_ATTEMPTS) {
      debug('autoPlayExhausted');
      setAutoPlayFailed(true);
      return;
    }

    if (isLoading) return;
    didAutoNavigateRef.current = true;

    const playableStreams = (streams ?? []).filter(isStreamAvailable);
    const candidates = bingeGroup
      ? playableStreams.filter((s) => s.behaviorHints?.group === bingeGroup)
      : playableStreams;

    // Inner retry function: tries the next candidate stream.
    const tryNextStream = () => {
      if (autoPlayAttemptRef.current >= MAX_AUTO_PLAY_ATTEMPTS) {
        debug('autoPlayExhausted');
        setAutoPlayFailed(true);
        return;
      }

      const streamIdx = autoPlayAttemptRef.current;
      autoPlayAttemptRef.current++;
      const stream = candidates[streamIdx];
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
        autoPlayAttempt: streamIdx,
        onExternalOpened: () => setAutoPlayFailed(true),
        onExternalOpenFailed: () => tryNextStream(),
      });
    };

    // Use lastStreamTarget only on a fresh auto-play (no retry in progress).
    // When parsedAutoPlayAttempt is defined we are already retrying and must
    // not loop back to the same failed target.
    if (lastStreamTarget && parsedAutoPlayAttempt === undefined) {
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
        // Fall back to candidate streams when the saved target cannot be opened.
        onExternalOpenFailed: () => tryNextStream(),
      });
      return;
    }

    if (!candidates.length) {
      showToast({
        title: 'No playable stream found',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      setAutoPlayFailed(true);
      return;
    }

    tryNextStream();
  }, [
    effectiveAutoPlay,
    streams,
    metaId,
    videoId,
    type,
    bingeGroup,
    lastStreamTarget,
    parsedAutoPlayAttempt,
    openStreamFromStream,
    openStreamTarget,
    playerTitle,
    debug,
    isLoading,
    backgroundImage,
    logoImage,
  ]);

  return {
    effectiveAutoPlay,
  };
};
