import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { LibVlcPlayerView, LibVlcPlayerViewRef } from 'expo-libvlc-player';
import { StyleSheet } from 'react-native';
import { PlayerRef, AudioTrack, TextTrack, PlayerProps } from '@/types/player';
import type { SubtitleStyle } from '@/types/subtitles';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { DEFAULT_SUBTITLE_STYLE } from '@/constants/subtitles';
import { useDebugLogger } from '@/utils/debug';
import { useFocusEffect } from 'expo-router';

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
      },
      ref
    ) => {
      const debug = useDebugLogger('VLCPlayer');
      const playerRef = useRef<LibVlcPlayerViewRef>(null);
      const [forceRemount, setForceRemount] = useState(false);
      const [vlcKey, setVlcKey] = useState('vlc-initial');

      // Get subtitle style from profile settings for VLC freetype options
      const activeProfileId = useProfileStore((state) => state.activeProfileId);
      const subtitleStyleFromStore = useProfileSettingsStore((state) =>
        activeProfileId
          ? (state.byProfile[activeProfileId]?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE)
          : DEFAULT_SUBTITLE_STYLE
      );

      // Compute VLC subtitle options from subtitle style
      const vlcSubtitleOptions = useMemo(
        () => getVLCSubtitleOptions(subtitleStyleFromStore),
        [subtitleStyleFromStore]
      );
      // Track playing state - use ref for synchronous checks in callbacks
      const isPlayingRef = useRef(false);
      // Track whether the player is ready (after onFirstPlay has fired)
      // Use both state (for triggering effects) and ref (for synchronous checks in imperative methods)
      const [isReady, setIsReady] = useState(false);
      const isReadyRef = useRef(false);
      const isMountedRef = useRef(true);

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
        }, [debug])
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
      }, [debug, source]);

      // Track component mount/unmount
      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          debug('unmount');
        };
      }, [debug]);

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
      }, [debug, paused, isReady]);

      const handleBuffering = useCallback(() => {
        debug('buffering', { isPlaying: isPlayingRef.current });
        // Only show buffering indicator if not already playing
        if (!isPlayingRef.current) {
          onBuffer?.(true);
        }
      }, [debug, onBuffer]);

      const handlePlaying = useCallback(() => {
        debug('playing');
        isPlayingRef.current = true;
        onBuffer?.(false);
      }, [debug, onBuffer]);

      const handleTimeChanged = useCallback(
        (event: { time: number }) => {
          // time is in milliseconds, convert to seconds
          const timeInSeconds = event.time / 1000;
          onProgress?.({
            currentTime: timeInSeconds,
          });
        },
        [onProgress]
      );

      const handleFirstPlay = useCallback(
        (event: {
          length: number;
          tracks: {
            audio: { id: number; name: string }[];
            video: { id: number; name: string }[];
            subtitle: { id: number; name: string }[];
          };
        }) => {
          debug('firstPlay', { lengthMs: event.length });
          // length is in milliseconds, convert to seconds
          const durationInSeconds = event.length / 1000;

          // Mark player as ready - this enables play/pause/seek controls
          // Set ref first (synchronous) so imperative methods can use it immediately
          isReadyRef.current = true;
          setIsReady(true);

          onLoad?.({ duration: durationInSeconds });

          // Process audio tracks
          if (event.tracks.audio) {
            const audioTracks: AudioTrack[] = event.tracks.audio
              .filter((t) => t.id !== -1)
              .map((track) => ({
                index: track.id,
                title: track.name || `Audio ${track.id}`,
              }));
            onAudioTracks?.(audioTracks);
          }

          // Process subtitle tracks (in-stream video subtitles)
          if (event.tracks.subtitle) {
            const textTracks: TextTrack[] = event.tracks.subtitle
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
        [debug, onLoad, onAudioTracks, onTextTracks]
      );

      const handleEndReached = useCallback(() => {
        debug('endReached');
        onEnd?.();
      }, [debug, onEnd]);

      const handleError = useCallback(
        (event: { error: string }) => {
          debug('error', { event });
          onError?.(event.error || 'VLC playback error');
        },
        [debug, onError]
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
          options={vlcSubtitleOptions}
          tracks={{
            audio: selectedAudioTrack?.index,
            subtitle: selectedTextTrack?.playerIndex ?? selectedTextTrack?.index ?? -1,
          }}
          onBuffering={handleBuffering}
          onPlaying={handlePlaying}
          onTimeChanged={handleTimeChanged}
          onFirstPlay={handleFirstPlay}
          onEndReached={handleEndReached}
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
