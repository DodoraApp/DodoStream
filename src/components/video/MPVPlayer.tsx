/**
 * MPV Player React Native Component
 * Based on NuvioStreaming's implementation (GPL-3.0 license)
 * https://github.com/tapframe/NuvioStreaming
 */
import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState, memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { MpvView, MpvViewRef } from 'modules/mpv';
import { PlayerRef, AudioTrack, TextTrack, PlayerProps } from '@/types/player';
import { useDebugLogger } from '@/utils/debug';

export const MPVPlayer = memo(
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
        fitMode = 'contain',
      },
      ref
    ) => {
      const debug = useDebugLogger('MPVPlayer');
      const nativeRef = useRef<MpvViewRef>(null);
      const [isReady, setIsReady] = useState(false);
      const isReadyRef = useRef(false);
      const lastAudioTrackRef = useRef<number | undefined>(undefined);
      const lastSubtitleTrackRef = useRef<number | undefined>(undefined);

      useImperativeHandle(
        ref,
        () => ({
          seekTo: async (time: number, _duration: number) => {
            if (!isReadyRef.current) {
              debug('seekToAborted', { time, reason: 'not-ready' });
              return;
            }
            debug('seekTo', { time });
            await nativeRef.current?.seek(time);
          },
        }),
        [debug]
      );

      // Handle audio track changes
      React.useEffect(() => {
        if (!isReady || selectedAudioTrack === undefined) return;
        const trackId = selectedAudioTrack?.index ?? -1;
        if (trackId !== lastAudioTrackRef.current) {
          lastAudioTrackRef.current = trackId;
          debug('setAudioTrack', { trackId });
          nativeRef.current?.setAudioTrack(trackId);
        }
      }, [debug, isReady, selectedAudioTrack]);

      // Handle subtitle track changes
      React.useEffect(() => {
        if (!isReady) return;
        // Only set video-source subtitles (addon subtitles are handled by CustomSubtitles)
        const trackId =
          selectedTextTrack?.source === 'video'
            ? (selectedTextTrack?.playerIndex ?? selectedTextTrack?.index ?? -1)
            : -1;
        if (trackId !== lastSubtitleTrackRef.current) {
          lastSubtitleTrackRef.current = trackId;
          debug('setSubtitleTrack', { trackId, source: selectedTextTrack?.source });
          nativeRef.current?.setSubtitleTrack(trackId);
        }
      }, [debug, isReady, selectedTextTrack]);

      const handleLoad = useCallback(
        (event: { nativeEvent: { duration: number; width: number; height: number } }) => {
          debug('load', { duration: event.nativeEvent.duration });
          isReadyRef.current = true;
          setIsReady(true);
          onLoad?.({ duration: event.nativeEvent.duration });
        },
        [debug, onLoad]
      );

      const handleProgress = useCallback(
        (event: { nativeEvent: { currentTime: number; duration: number } }) => {
          onProgress?.({
            currentTime: event.nativeEvent.currentTime,
            duration: event.nativeEvent.duration,
          });
        },
        [onProgress]
      );

      const handleEnd = useCallback(() => {
        debug('end');
        onEnd?.();
      }, [debug, onEnd]);

      const handleError = useCallback(
        (event: { nativeEvent: { error: string } }) => {
          debug('error', { error: event.nativeEvent.error });
          onError?.(event.nativeEvent.error || 'MPV playback error');
        },
        [debug, onError]
      );

      const handleBuffering = useCallback(
        (event: { nativeEvent: { isBuffering: boolean } }) => {
          debug('buffering', { isBuffering: event.nativeEvent.isBuffering });
          onBuffer?.(event.nativeEvent.isBuffering);
        },
        [debug, onBuffer]
      );

      const handleTracksChanged = useCallback(
        (event: {
          nativeEvent: {
            audioTracks: { id: number; name: string; language: string }[];
            subtitleTracks: { id: number; name: string; language: string }[];
          };
        }) => {
          const { audioTracks, subtitleTracks } = event.nativeEvent;
          debug('tracksChanged', {
            audioCount: audioTracks?.length,
            subtitleCount: subtitleTracks?.length,
          });

          // Process audio tracks
          if (audioTracks) {
            const processedAudioTracks: AudioTrack[] = audioTracks.map((track) => ({
              index: track.id,
              title: track.name || `Audio ${track.id}`,
              language: track.language,
            }));
            onAudioTracks?.(processedAudioTracks);
          }

          // Process subtitle tracks (in-stream video subtitles)
          if (subtitleTracks) {
            const processedTextTracks: TextTrack[] = subtitleTracks.map((track) => ({
              source: 'video' as const,
              index: track.id,
              title: track.name || `Subtitle ${track.id}`,
              language: track.language,
              playerIndex: track.id,
            }));
            onTextTracks?.(processedTextTracks);
          }
        },
        [debug, onAudioTracks, onTextTracks]
      );

      // Fallback for non-Android platforms
      if (Platform.OS !== 'android') {
        return <View style={[styles.player, { backgroundColor: 'black' }]} />;
      }

      return (
        <MpvView
          ref={nativeRef}
          style={styles.player}
          source={source}
          paused={paused}
          resizeMode={fitMode}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onEnd={handleEnd}
          onError={handleError}
          onBuffering={handleBuffering}
          onTracksChanged={handleTracksChanged}
        />
      );
    }
  )
);

MPVPlayer.displayName = 'MPVPlayer';

const styles = StyleSheet.create({
  player: {
    flex: 1,
  },
});
