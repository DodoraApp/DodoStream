import { memo, useCallback, useMemo } from 'react';
import { Box } from '@/theme/theme';
import { Button } from '@/components/basic/Button';
import { ProgressButton } from '@/components/basic/ProgressButton';
import { MyListHeaderButton } from '@/components/media/MyListHeaderButton';
import type { ContentType, MetaDetail } from '@/types/stremio';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import {
  useWatchHistoryActions,
  useWatchHistoryItem,
  useWatchProgress,
  useWatchState,
} from '@/hooks/useWatchHistoryDb';
import { useIsInMyList, useMyListActions } from '@/hooks/useMyListDb';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useContinueWatchingForMeta } from '@/hooks/useContinueWatching';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import { useDebugLogger } from '@/utils/debug';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { showToast } from '@/store/toast.store';
import { resetProgressToStart } from '@/utils/playback';

interface MediaButtonsProps {
  metaId: string;
  type: ContentType;
  media: MetaDetail;
}

export const MediaButtons = memo(({ metaId, type, media }: MediaButtonsProps) => {
  const debug = useDebugLogger('MediaButtons');
  const { isPlatformTV } = useResponsiveLayout();
  const { pushToStreams } = useMediaNavigation();

  const videos = media.videos;
  const isMultiVideo = (videos?.length ?? 0) > 1;
  const videoId = videos?.[0]?.id ?? metaId;

  const { entry: continueWatching } = useContinueWatchingForMeta(metaId, media);

  const watchState = useWatchState(metaId, videoId);
  const progressRatio = useWatchProgress(metaId, videoId);
  const { data: historyItem } = useWatchHistoryItem(metaId, videoId);
  const { upsert } = useWatchHistoryActions();

  // My List state
  const isInMyList = useIsInMyList(metaId, type);
  const { toggleMyList } = useMyListActions();

  const handleToggleMyList = useCallback(() => {
    const nowInList = toggleMyList({
      id: metaId,
      type,
      currentlyInList: isInMyList,
    });
    showToast({
      title: nowInList ? 'Added to My List' : 'Removed from My List',
      message: media.name,
      preset: 'success',
      duration: TOAST_DURATION_SHORT,
    });
  }, [isInMyList, media.name, metaId, toggleMyList, type]);

  // Handlers for single-video content
  const handlePlay = useCallback(() => {
    debug('navigateSingle', { metaId, videoId, type, mode: 'play' });
    pushToStreams({ metaId, videoId, type });
  }, [debug, metaId, pushToStreams, videoId, type]);

  const handleStartOver = useCallback(() => {
    resetProgressToStart({
      metaId,
      videoId,
      durationSeconds: historyItem?.durationSeconds,
      updateProgress: (id, selectedVideoId, progressSeconds, durationSeconds) => {
        upsert({
          metaId: id,
          videoId: selectedVideoId,
          type,
          progressSeconds,
          durationSeconds,
        });
      },
    });
    debug('navigateSingle', { metaId, videoId, type, mode: 'start-over' });
    pushToStreams({ metaId, videoId, type });
  }, [debug, historyItem?.durationSeconds, metaId, pushToStreams, type, upsert, videoId]);

  // Handler for multi-video content
  const handleContinue = useCallback(() => {
    const targetVideoId = continueWatching?.videoId ?? videos?.[0]?.id;
    if (!targetVideoId) return;
    debug('navigateContinue', { metaId, type, videoId: targetVideoId });
    pushToStreams({ metaId, videoId: targetVideoId, type });
  }, [continueWatching?.videoId, debug, metaId, pushToStreams, type, videos]);

  // Multi-video button labels and state
  const multiVideoIsInProgress =
    continueWatching?.progressRatio != null && continueWatching.progressRatio > 0;
  const multiVideoProgressRatio = continueWatching?.progressRatio ?? 0;

  const resumeLabel = useMemo(() => {
    const label = formatSeasonEpisodeLabel(continueWatching?.video);
    return label ? `Resume ${label}` : 'Resume';
  }, [continueWatching?.video]);

  const playLabel = useMemo(() => {
    // For multi-video, show the target episode label (continue watching or first)
    const targetVideo = continueWatching?.video ?? videos?.[0];
    const label = formatSeasonEpisodeLabel(targetVideo);
    return label ? `Play ${label}` : 'Play';
  }, [continueWatching?.video, videos]);

  // Common button style props - 100% width on mobile, auto on TV
  const buttonFlex = isPlatformTV ? undefined : 1;

  // Render buttons based on content type and watch state
  if (isMultiVideo) {
    const hasWatchedBefore = !!continueWatching;

    return (
      <Box width="100%" flexDirection="row" gap="s" flexWrap={isPlatformTV ? 'nowrap' : 'wrap'}>
        {hasWatchedBefore ? (
          multiVideoIsInProgress ? (
            <ProgressButton
              title={resumeLabel}
              icon="play"
              progress={multiVideoProgressRatio}
              onPress={handleContinue}
              hasTVPreferredFocus={isPlatformTV}
              flex={buttonFlex}
            />
          ) : (
            <Button
              title={playLabel}
              icon="play"
              variant="primary"
              onPress={handleContinue}
              hasTVPreferredFocus={isPlatformTV}
              paddingHorizontal="l"
              paddingVertical="m"
              flex={buttonFlex}
            />
          )
        ) : (
          <Button
            title={playLabel}
            icon="play"
            variant="primary"
            onPress={handleContinue}
            hasTVPreferredFocus={isPlatformTV}
            paddingHorizontal="l"
            paddingVertical="m"
            flex={buttonFlex}
          />
        )}
        <MyListHeaderButton isInMyList={isInMyList} onPress={handleToggleMyList} />
      </Box>
    );
  }

  // Single video content - in progress
  if (watchState === 'in-progress') {
    return (
      <Box width="100%" flexDirection="row" gap="s" flexWrap={isPlatformTV ? 'nowrap' : 'wrap'}>
        <ProgressButton
          title="Resume"
          icon="play"
          progress={progressRatio}
          onPress={handlePlay}
          hasTVPreferredFocus={isPlatformTV}
          flex={buttonFlex}
        />
        <Button
          icon="refresh"
          variant="secondary"
          onPress={handleStartOver}
          paddingHorizontal="l"
          paddingVertical="m"
        />
        <MyListHeaderButton isInMyList={isInMyList} onPress={handleToggleMyList} />
      </Box>
    );
  }

  // Not watched or fully watched - show Play
  return (
    <Box width="100%" flexDirection="row" gap="s" flexWrap={isPlatformTV ? 'nowrap' : 'wrap'}>
      <Button
        title="Play"
        icon="play"
        variant="primary"
        onPress={handlePlay}
        hasTVPreferredFocus={isPlatformTV}
        paddingHorizontal="l"
        paddingVertical="m"
        flex={buttonFlex}
      />
      <MyListHeaderButton isInMyList={isInMyList} onPress={handleToggleMyList} />
    </Box>
  );
});

MediaButtons.displayName = 'MediaButtons';
