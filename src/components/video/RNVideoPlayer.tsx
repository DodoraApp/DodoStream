import React, { forwardRef, useImperativeHandle, useRef, useCallback, memo } from 'react';
import Video, {
  VideoRef,
  OnLoadData,
  OnProgressData,
  OnAudioTracksData,
  OnTextTracksData,
  SelectedTrack,
  SelectedTrackType,
  OnVideoErrorData,
} from 'react-native-video';
import { PlayerRef, AudioTrack, TextTrack, PlayerProps } from '@/types/player';
import { useDebugLogger } from '@/utils/debug';

const composeErrorString = (error: OnVideoErrorData['error']): string => {
  const errorParts: string[] = [
    error.errorCode,
    error.errorString,
    error.errorException,
    error.error,
  ].filter((str) => str !== undefined);

  return errorParts.length > 0 ? errorParts.join(' ') : JSON.stringify(error);
};

export const RNVideoPlayer = memo(
  forwardRef<PlayerRef, PlayerProps>((props, ref) => {
    const debug = useDebugLogger('RNVideoPlayer');
    const {
      source,
      paused,
      onProgress,
      onLoad,
      onEnd,
      onError,
      onAudioTracks,
      onTextTracks,
      selectedAudioTrack,
      selectedTextTrack,
    } = props;
    const videoRef = useRef<VideoRef>(null);
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        videoRef.current?.seek(time);
      },
    }));

    const handleProgress = useCallback(
      (data: OnProgressData) => {
        onProgress?.({
          currentTime: data.currentTime,
          duration: data.seekableDuration || 0,
        });
      },
      [onProgress]
    );

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        debug('load', { duration: data.duration, naturalSize: data.naturalSize });
        onLoad?.({ duration: data.duration });
      },
      [debug, onLoad]
    );

    const handleError = useCallback(
      (data: OnVideoErrorData) => {
        debug('error', { error: data.error });
        onError?.(composeErrorString(data.error));
      },
      [debug, onError]
    );

    const handleAudioTracks = useCallback(
      (data: OnAudioTracksData) => {
        debug('audioTracks', { count: data.audioTracks?.length });
        const tracks: AudioTrack[] = data.audioTracks.map((track, index) => ({
          index,
          title: track.title,
          language: track.language,
          type: track.type,
        }));
        onAudioTracks?.(tracks);
      },
      [debug, onAudioTracks]
    );

    const handleTextTracks = useCallback(
      (data: OnTextTracksData) => {
        debug('textTracks', { count: data.textTracks?.length });
        const tracks: TextTrack[] = data.textTracks.map((track, index) => ({
          index,
          title: track.title,
          language: track.language,
          type: track.type || undefined,
        }));
        onTextTracks?.(tracks);
      },
      [debug, onTextTracks]
    );

    const audioTrackSelection: SelectedTrack | undefined = selectedAudioTrack
      ? {
          type: 'index' as SelectedTrackType,
          value: selectedAudioTrack.index,
        }
      : undefined;
    const textTrackSelection: SelectedTrack | undefined = selectedTextTrack
      ? {
          type: 'index' as SelectedTrackType,
          value: selectedTextTrack.index,
        }
      : undefined;
    return (
      <Video
        ref={videoRef}
        source={{
          uri: source,
          bufferConfig: {
            minBufferMs: 30000, // 30 seconds minimum buffer for smooth playback
            maxBufferMs: 120000, // 120 seconds (2 minutes) maximum buffer
            bufferForPlaybackMs: 5000, // Start playback after 5s buffered
            bufferForPlaybackAfterRebufferMs: 10000, // Resume after 10s buffered on rebuffer
            maxHeapAllocationPercent: 0.3, // Use up to 30% of heap for buffering
            minBackBufferMemoryReservePercent: 0.1, // Keep 10% back buffer
            minBufferMemoryReservePercent: 0.2, // Keep 20% forward buffer
          },
        }}
        style={{ flex: 1 }}
        paused={paused}
        controls={false}
        resizeMode="contain"
        maxBitRate={0} // 0 = no limit, let adaptive streaming decide (best for VOD)
        automaticallyWaitsToMinimizeStalling={true}
        // Network and caching
        allowsExternalPlayback={false}
        playWhenInactive={false}
        playInBackground={false}
        // Progressive download optimization for HTTP/HTTPS
        progressUpdateInterval={250} // Update progress every 250ms for smooth UI
        // Adaptive streaming
        selectedAudioTrack={audioTrackSelection}
        selectedTextTrack={textTrackSelection}
        // Event handlers
        onProgress={handleProgress}
        onLoad={handleLoad}
        onEnd={onEnd}
        onError={handleError}
        onAudioTracks={handleAudioTracks}
        onTextTracks={handleTextTracks}
        // TV support
        hasTVPreferredFocus={false}
        focusable={false}
        tvFocusable={false}
        preventsDisplaySleepDuringVideoPlayback={true}
        // Debug (disable in production)
        debug={{
          enable: __DEV__,
          thread: __DEV__,
        }}
      />
    );
  })
);

RNVideoPlayer.displayName = 'RNVideoPlayer';
