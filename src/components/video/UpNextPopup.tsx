import { FC, memo, useEffect, useMemo, useRef, useState } from 'react';
import { MotiView } from 'moti';
import type { ContentType } from '@/types/stremio';
import { useMeta } from '@/api/stremio';
import {
  UPNEXT_POPUP_SERIES_RATIO,
  UPNEXT_POPUP_MOVIE_RATIO,
  UPNEXT_POPUP_INACTIVE_DELAY_MS,
} from '@/constants/playback';
import { ContinueWatchingCard } from '@/components/media/ContinueWatchingCard';
import { useNextVideo, type ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { formatSeasonEpisodeLabel } from '@/utils/format';
import { useDebugLogger } from '@/utils/debug';
import { Button } from '@/components/basic/Button';
import theme from '@/theme/theme';

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
  controlsVisible: boolean;
  onCancelAutoplay: () => void;
  onDismiss: () => void;
  onPlayNext: () => void;
  onUpNextResolved: (next?: UpNextResolved) => void;
}

export const UpNextPopup: FC<UpNextPopupProps> = memo(
  ({
    enabled,
    metaId,
    mediaType,
    videoId,
    progressRatio,
    dismissed,
    autoplayCancelled,
    controlsVisible,
    onCancelAutoplay,
    onDismiss,
    onPlayNext,
    onUpNextResolved,
  }) => {
    const debug = useDebugLogger('UpNextPopup');

    // Determine threshold based on media type (series = 95%, movie = 90%)
    const showThreshold =
      mediaType === 'series' ? UPNEXT_POPUP_SERIES_RATIO : UPNEXT_POPUP_MOVIE_RATIO;

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
      progressRatio >= showThreshold &&
      !!videoId &&
      !!upNextEntry;

    // Track when popup first became visible to trigger inactive state after delay
    const showStartTimeRef = useRef<number | null>(null);
    const [isInactive, setIsInactive] = useState(false);

    // Reset inactive state and track when popup becomes visible
    useEffect(() => {
      if (shouldShow) {
        if (showStartTimeRef.current === null) {
          showStartTimeRef.current = Date.now();
          setIsInactive(false);
        }
      } else {
        showStartTimeRef.current = null;
        setIsInactive(false);
      }
    }, [shouldShow]);

    // Set inactive state after UPNEXT_POPUP_INACTIVE_DELAY_MS
    useEffect(() => {
      if (!shouldShow || controlsVisible) {
        setIsInactive(false);
        return;
      }

      const timer = setTimeout(() => {
        setIsInactive(true);
      }, UPNEXT_POPUP_INACTIVE_DELAY_MS);

      return () => clearTimeout(timer);
    }, [shouldShow, controlsVisible]);

    // When controls become visible, reset inactive state
    useEffect(() => {
      if (controlsVisible && shouldShow) {
        setIsInactive(false);
      }
    }, [controlsVisible, shouldShow]);

    const lastShouldShowRef = useRef(false);
    useEffect(() => {
      if (shouldShow === lastShouldShowRef.current) return;
      lastShouldShowRef.current = shouldShow;
      if (__DEV__) {
        debug('visibilityChange', {
          shouldShow,
          progressRatio,
          threshold: showThreshold,
          autoplayCancelled,
          dismissed,
          nextVideoId: upNextVideo?.id,
        });
      }
    }, [
      autoplayCancelled,
      debug,
      dismissed,
      progressRatio,
      shouldShow,
      showThreshold,
      upNextVideo?.id,
    ]);

    if (!shouldShow || !upNextEntry) return null;

    // Animation values based on inactive state
    const animatedOpacity = isInactive ? 0.3 : 1;
    const animatedScale = isInactive ? 0.6 : 1;

    const pivotTranslateX = (1 - animatedScale) * theme.cardSizes.continueWatching.width;
    const pivotTranslateY = (animatedScale - 1) * theme.cardSizes.continueWatching.height;
    return (
      <MotiView
        animate={{
          opacity: animatedOpacity,
          scale: animatedScale,
          translateX: pivotTranslateX,
          translateY: pivotTranslateY,
        }}
        transition={{
          type: 'timing',
          duration: 300,
        }}
        style={{
          position: 'absolute',
          right: theme.spacing.l,
          top: theme.spacing.l,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.s,
        }}>
        <ContinueWatchingCard
          entry={upNextEntry}
          hideText
          hasTVPreferredFocus={controlsVisible && !isInactive}
          onPress={onPlayNext}
        />

        {!isInactive && (
          <Button
            variant="secondary"
            icon="close"
            onPress={() => {
              onCancelAutoplay();
              onDismiss();
            }}
          />
        )}
      </MotiView>
    );
  }
);

UpNextPopup.displayName = 'UpNextPopup';
