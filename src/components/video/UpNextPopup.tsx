import { FC, useEffect, useMemo, useRef } from 'react';
import { Box } from '@/theme/theme';
import type { ContentType } from '@/types/stremio';
import { useMeta } from '@/api/stremio';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import { ContinueWatchingCard } from '@/components/media/ContinueWatchingCard';
import { useNextVideo, type ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import { useDebugLogger } from '@/utils/debug';
import { Button } from '@/components/basic/Button';

export interface UpNextResolved {
  videoId: string;
  title?: string;
  episodeLabel?: string;
  imageUrl?: string;
}

export interface UpNextPopupProps {
  enabled: boolean;
  metaId: string;
  mediaType: ContentType;
  videoId?: string;
  progressRatio: number;
  dismissed: boolean;
  autoplayCancelled: boolean;
  onCancelAutoplay: () => void;
  onDismiss: () => void;
  onPlayNext: () => void;
  onUpNextResolved: (next?: UpNextResolved) => void;
}

export const UpNextPopup: FC<UpNextPopupProps> = ({
  enabled,
  metaId,
  mediaType,
  videoId,
  progressRatio,
  dismissed,
  autoplayCancelled,
  onCancelAutoplay,
  onDismiss,
  onPlayNext,
  onUpNextResolved,
}) => {
  const debug = useDebugLogger('UpNextPopup');

  const shouldLoadMeta = enabled && !!videoId;
  const { data: meta } = useMeta(mediaType, metaId, shouldLoadMeta);

  // Use the simple next video hook - just finds next in sequence
  const upNextVideo = useNextVideo(meta?.videos, videoId);

  const resolved = useMemo<UpNextResolved | undefined>(() => {
    if (!enabled) return undefined;
    if (!upNextVideo?.id) return undefined;
    return {
      videoId: upNextVideo.id,
      title: upNextVideo.title,
      episodeLabel: formatSeasonEpisodeLabel(upNextVideo),
      imageUrl: meta?.background ?? meta?.poster,
    };
  }, [enabled, meta?.background, meta?.poster, upNextVideo]);

  const resolvedKey = useMemo(() => {
    return resolved
      ? `${resolved.videoId}::${resolved.title ?? ''}::${resolved.episodeLabel ?? ''}::${resolved.imageUrl ?? ''}`
      : '';
  }, [resolved]);

  // Notify parent when the resolved next-episode changes.
  const lastResolvedKeyRef = useRef('');
  useEffect(() => {
    if (resolvedKey === lastResolvedKeyRef.current) return;
    lastResolvedKeyRef.current = resolvedKey;

    if (__DEV__) {
      debug('nextEpisodeResolved', {
        enabled,
        shouldLoadMeta,
        metaLoaded: !!meta,
        metaId,
        mediaType,
        videoId,
        nextVideoId: resolved?.videoId,
      });
    }

    onUpNextResolved(resolved);
  }, [
    debug,
    enabled,
    mediaType,
    meta,
    metaId,
    onUpNextResolved,
    resolved,
    resolvedKey,
    shouldLoadMeta,
    videoId,
  ]);

  const upNextImageUrl = meta?.background ?? meta?.poster;

  // Build a ContinueWatchingEntry for the card
  const upNextEntry = useMemo((): ContinueWatchingEntry | undefined => {
    if (!upNextVideo?.id) return undefined;
    return {
      key: `${metaId}::${upNextVideo.id}::up-next-popup`,
      metaId,
      type: mediaType,
      videoId: upNextVideo.id,
      progressSeconds: 0,
      durationSeconds: 0,
      progressRatio: 0,
      lastWatchedAt: Date.now(),
      isUpNext: true,
      video: upNextVideo,
      metaName: meta?.name,
      imageUrl: upNextImageUrl,
    };
  }, [metaId, mediaType, upNextVideo, meta?.name, upNextImageUrl]);

  const shouldShow =
    enabled &&
    !autoplayCancelled &&
    !dismissed &&
    progressRatio >= PLAYBACK_FINISHED_RATIO &&
    !!videoId &&
    !!upNextEntry;

  const lastShouldShowRef = useRef(false);
  useEffect(() => {
    if (shouldShow === lastShouldShowRef.current) return;
    lastShouldShowRef.current = shouldShow;
    if (__DEV__) {
      debug('visibilityChange', {
        shouldShow,
        progressRatio,
        finishedRatio: PLAYBACK_FINISHED_RATIO,
        autoplayCancelled,
        dismissed,
        nextVideoId: upNextVideo?.id,
      });
    }
  }, [autoplayCancelled, debug, dismissed, progressRatio, shouldShow, upNextVideo?.id]);

  if (!shouldShow || !upNextEntry) return null;

  return (
    <Box
      position="absolute"
      right={24}
      top={24}
      gap="s"
      alignItems="center"
      justifyContent="center">
      <ContinueWatchingCard
        entry={upNextEntry}
        hideText
        hasTVPreferredFocus={true}
        onPress={() => {
          debug('playNextPressed', {
            metaId,
            mediaType,
            videoId,
            nextVideoId: upNextVideo?.id,
          });
          onPlayNext();
        }}
      />

      <Button
        icon="close"
        onPress={() => {
          debug('autoplayCancelledByUser', {
            metaId,
            mediaType,
            videoId,
            nextVideoId: upNextVideo?.id,
          });
          onCancelAutoplay();
          onDismiss();
        }}
      />
    </Box>
  );
};
