/* eslint-disable max-lines-per-function -- large TV-focused component; see AGENTS.md refactor note */
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import {
  LibVlcPlayerView,
  LibVlcPlayerViewRef,
  MediaInfo,
  MediaTracks,
  VideoAspectRatio,
} from 'expo-libvlc-player';
import { useFocusEffect } from 'expo-router';

import { PLAYER_END_TOLERANCE_SECONDS } from '@/constants/playback';
import { DEFAULT_SUBTITLE_STYLE } from '@/constants/subtitles';
import { usePlaybackStore } from '@/store/playback.store';
import { useProfileStore } from '@/store/profile.store';
import { AudioTrack, PlayerProps, PlayerRef, TextTrack } from '@/types/player';
import type { SubtitleStyle } from '@/types/subtitles';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('VLCPlayer');

/**
 * Convert a hex color to VLC integer format.
 * VLC uses integer colors: 0xRRGGBB
 */
const hexToVLCColor = (hex: string): number => {
  const hexWithoutHash = hex.replace('#', '');
  return parseInt(hexWithoutHash, 16);
};

const getVLCFontFamilyOption = (fontFamily: SubtitleStyle['fontFamily']): string | undefined => {
  switch (fontFamily) {
    case 'System':
      return undefined; // VLC default
    case 'Serif':
      return 'Serif';
    case 'Monospace':
      return 'Monospace';
    default:
      // For explicit font names, pass through directly to VLC.
      return fontFamily;
  }
};

/**
 * Get platform-specific VLC performance options for mobile.
 * Only includes options that are confirmed to work with expo-libvlc-player.
 * These help reduce stuttering through better buffering/caching.
 */
const getVLCPerformanceOptions = (): string[] => {
  const options: string[] = [];

  // Buffering/caching for smoother playback
  // These are the most universally supported options in mobile LibVLC
  options.push('--file-caching=1000'); // 1 second file cache
  options.push('--network-caching=2000'); // 2 seconds network cache
  options.push('--live-caching=1000'); // 1 second live stream cache

  return options;
};

/**
 * Convert SubtitleStyle to VLC freetype options.
 */
const getVLCSubtitleOptions = (style: SubtitleStyle | undefined): string[] => {
  if (!style) return [];

  const options: string[] = [];

  // Font size: VLC's freetype-fontsize expects a pixel value.
  // SubtitleStyle.fontSize is defined as "Font size in pixels (scaled relative to 1080p)",
  // so we pass it through directly without additional scaling here.
  options.push(`--freetype-fontsize=${Math.round(style.fontSize)}`);

  // Font family
  const vlcFontFamily = getVLCFontFamilyOption(style.fontFamily);
  if (vlcFontFamily) {
    options.push(`--freetype-font=${vlcFontFamily}`);
  }

  // Font color - VLC uses integer format
  options.push(`--freetype-color=${hexToVLCColor(style.fontColor)}`);

  // Font opacity (0-255 in VLC)
  options.push(`--freetype-opacity=${Math.round(style.fontOpacity * 255)}`);

  // Background settings
  if (style.backgroundOpacity > 0) {
    options.push(`--freetype-background-color=${hexToVLCColor(style.backgroundColor)}`);
    options.push(`--freetype-background-opacity=${Math.round(style.backgroundOpacity * 255)}`);
  }

  // Vertical position: map bottomPosition (0–100, from bottom) to VLC sub-margin.
  // This is a heuristic mapping; VLC interprets sub-margin in "lines".
  const clampedBottom = Math.max(0, Math.min(100, style.bottomPosition));
  const maxMarginLines = 20;
  const marginLines = Math.round(((100 - clampedBottom) / 100) * maxMarginLines);
  if (marginLines > 0) {
    options.push(`--sub-margin=${marginLines}`);
  }

  return options;
};

export const VLCPlayer = memo(
  forwardRef<PlayerRef, PlayerProps>(
    (
      {
        source,
        paused,
        onProgress,
        onLoad,
        onBuffer,
        onEnd,
        onError,
        onAudioTracks,
        onTextTracks,
        selectedAudioTrack,
        selectedTextTrack,
        // Note: subtitleStyle prop is ignored for VLC - we use profile settings directly
        fitMode = 'contain',
      },
      ref
    ) => {
      const playerRef = useRef<LibVlcPlayerViewRef>(null);
      const [forceRemount, setForceRemount] = useState(false);
      const [vlcKey, setVlcKey] = useState('vlc-initial');
      const { width, height } = useWindowDimensions();

      // Get subtitle style from profile settings for VLC freetype options
      const activeProfileId = useProfileStore((state) => state.activeProfileId);
      const subtitleStyleFromStore = usePlaybackStore((state) =>
        activeProfileId
          ? (state.byProfile[activeProfileId]?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE)
          : DEFAULT_SUBTITLE_STYLE
      );

      // Compute VLC options: combine performance/quality and subtitle options
      const vlcOptions = useMemo(() => {
        const performanceOptions = getVLCPerformanceOptions();
        const subtitleOptions = getVLCSubtitleOptions(subtitleStyleFromStore);
        return [...performanceOptions, ...subtitleOptions];
      }, [subtitleStyleFromStore]);

      const screenAspectRatio = useMemo((): VideoAspectRatio | undefined => {
        if (!width || !height) return undefined;
        return `${Math.round(width)}:${Math.round(height)}`;
      }, [height, width]);

      const effectiveFitMode = useMemo(
        () => (fitMode === 'stretch' ? 'stretch' : 'contain'),
        [fitMode]
      );

      const aspectRatio = useMemo(() => {
        if (effectiveFitMode !== 'stretch') return undefined;
        return screenAspectRatio ?? undefined;
      }, [effectiveFitMode, screenAspectRatio]);

      // Track playing state - use ref for synchronous checks in callbacks
      const isPlayingRef = useRef(false);
      // Track whether the player is ready (after onFirstPlay has fired)
      // Use both state (for triggering effects) and ref (for synchronous checks in imperative methods)
      const [isReady, setIsReady] = useState(false);
      const isReadyRef = useRef(false);
      const isMountedRef = useRef(true);
      // End detection guards for the ambiguous v8+ onStopped event
      const lastTimeRef = useRef(0);
      const durationRef = useRef(0);
      const endFiredRef = useRef(false);

      // Workaround for VLC surface detach: force complete remount on focus
      useFocusEffect(
        useCallback(() => {
          debug('forceRemountOnFocusGain');
          // setRestoreTime(duration > 0 ? duration : 0); // Save current time for restoration
          setForceRemount(true);
          // Re-enable after a brief moment
          setTimeout(() => {
            if (isMountedRef.current) {
              setForceRemount(false);
              setVlcKey(`vlc-focus-${Date.now()}`);
            }
          }, 100);
          return () => {};
        }, [])
      );

      // Process URL for VLC compatibility
      const processedSource = useMemo((): string => {
        if (!source) {
          debug('invalidSource', { source });
          return source ?? '';
        }

        try {
          // Check if URL is already properly formatted
          const urlObj = new URL(source);

          // Handle special characters in the pathname that might cause issues
          const pathname = urlObj.pathname;
          const search = urlObj.search;
          const hash = urlObj.hash;

          // Decode and re-encode the pathname to handle double-encoding
          const decodedPathname = decodeURIComponent(pathname);
          const encodedPathname = encodeURI(decodedPathname);

          // Reconstruct the URL
          const processedUrl = `${urlObj.protocol}//${urlObj.host}${encodedPathname}${search}${hash}`;

          debug('sourceProcessed', { source, processedUrl });
          return processedUrl;
        } catch (error) {
          debug('sourceProcessingFailed', { source, error });
          return source;
        }
      }, [source]);

      // Track component mount/unmount
      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          debug('unmount');
        };
      }, []);

      // Reset end-detection guards whenever a new source is prepared
      useEffect(() => {
        lastTimeRef.current = 0;
        durationRef.current = 0;
        endFiredRef.current = false;
      }, [processedSource]);

      useImperativeHandle(ref, () => ({
        seekTo: async (time: number, durationParam: number) => {
          if (!playerRef.current || !isMountedRef.current) {
            debug('seekToAborted', { time, duration: durationParam, reason: 'player-not-ready' });
            return;
          }

          if (!isReadyRef.current) {
            debug('seekToAborted', { time, duration: durationParam, reason: 'not-ready-yet' });
            return;
          }

          debug('seekTo', { time, duration: durationParam });

          if (durationParam <= 0) {
            debug('seekToInvalidDuration', { time, duration: durationParam });
            return;
          }

          try {
            // expo-libvlc-player seek expects time in milliseconds
            await playerRef.current.seek(time * 1000, 'time');
          } catch (error) {
            debug('seekToFailed', { time, duration: durationParam, error });
          }
        },
      }));

      // Handle play/pause state changes - only when player is ready
      useEffect(() => {
        if (!isReady || !isMountedRef.current) {
          debug('playPauseSkipped', { paused, reason: 'not-ready' });
          return;
        }

        const applyPlayPause = async () => {
          try {
            if (paused) {
              debug('pause');
              await playerRef.current?.pause();
            } else {
              debug('play');
              await playerRef.current?.play();
            }
          } catch (error) {
            debug('playPauseFailed', { paused, error });
          }
        };

        applyPlayPause();
      }, [paused, isReady]);

      const handleBuffering = useCallback(() => {
        debug('buffering', { isPlaying: isPlayingRef.current });
        // Only show buffering indicator if not already playing
        if (!isPlayingRef.current) {
          onBuffer?.(true);
        }
      }, [onBuffer]);

      const handlePlaying = useCallback(() => {
        debug('playing');
        isPlayingRef.current = true;
        onBuffer?.(false);
      }, [onBuffer]);

      const handleTimeChanged = useCallback(
        (event: { value: number }) => {
          // value is in milliseconds, convert to seconds
          const timeInSeconds = event.value / 1000;
          lastTimeRef.current = timeInSeconds;
          onProgress?.({
            currentTime: timeInSeconds,
          });
        },
        [onProgress]
      );

      const handleFirstPlay = useCallback(
        (event: MediaInfo) => {
          debug('firstPlay', { lengthMs: event.length });
          // length is in milliseconds, convert to seconds
          const durationInSeconds = event.length / 1000;
          durationRef.current = durationInSeconds;

          // Mark player as ready - this enables play/pause/seek controls
          // Set ref first (synchronous) so imperative methods can use it immediately
          isReadyRef.current = true;
          setIsReady(true);

          onLoad?.({ duration: durationInSeconds });
        },
        [onLoad]
      );

      const handleESAdded = useCallback(
        (event: MediaTracks) => {
          debug('esAdded', { audio: event.audio?.length, subtitle: event.subtitle?.length });
          // v8+ reports track discovery through onESAdded instead of onFirstPlay
          if (event.audio) {
            const audioTracks: AudioTrack[] = event.audio
              .filter((t) => t.id !== -1)
              .map((track) => ({
                index: track.id,
                title: track.name || `Audio ${track.id}`,
              }));
            onAudioTracks?.(audioTracks);
          }

          // Process subtitle tracks (in-stream video subtitles)
          if (event.subtitle) {
            const textTracks: TextTrack[] = event.subtitle
              .filter((t) => t.id !== -1)
              .map((track) => ({
                source: 'video' as const,
                index: track.id,
                title: track.name || `Subtitle ${track.id}`,
                playerIndex: track.id,
              }));
            onTextTracks?.(textTracks);
          }
        },
        [onAudioTracks, onTextTracks]
      );

      const handleStopped = useCallback(() => {
        debug('stopped', {
          duration: durationRef.current,
          lastTime: lastTimeRef.current,
          endFired: endFiredRef.current,
        });
        // v8+ emits onStopped for both natural end and teardown. Only report an
        // end when the media actually ran to completion: a positive duration is
        // known, at least one progress tick was observed, and the last observed
        // time is within tolerance of the duration.
        if (
          !endFiredRef.current &&
          durationRef.current > 0 &&
          lastTimeRef.current > 0 &&
          durationRef.current - lastTimeRef.current <= PLAYER_END_TOLERANCE_SECONDS
        ) {
          endFiredRef.current = true;
          debug('endReached');
          onEnd?.();
        }
      }, [onEnd]);

      const handleError = useCallback(
        (event: { message: string }) => {
          debug('error', { event });
          onError?.(event.message || 'VLC playback error');
        },
        [onError]
      );

      // Don't render during forced remount
      if (forceRemount) {
        return null;
      }

      return (
        <LibVlcPlayerView
          key={vlcKey}
          ref={playerRef}
          source={processedSource}
          style={styles.player}
          autoplay={false}
          options={vlcOptions}
          contentFit={effectiveFitMode === 'stretch' ? 'fill' : 'contain'}
          aspectRatio={aspectRatio}
          tracks={{
            audio: selectedAudioTrack?.index,
            subtitle: selectedTextTrack?.playerIndex ?? selectedTextTrack?.index ?? -1,
          }}
          onBuffering={handleBuffering}
          onPlaying={handlePlaying}
          onTimeChanged={handleTimeChanged}
          onFirstPlay={handleFirstPlay}
          onESAdded={handleESAdded}
          onStopped={handleStopped}
          onEncounteredError={handleError}
        />
      );
    }
  )
);

VLCPlayer.displayName = 'VLCPlayer';

const styles = StyleSheet.create({
  player: {
    flex: 1,
  },
});
