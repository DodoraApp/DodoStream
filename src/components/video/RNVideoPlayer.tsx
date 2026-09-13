import React, { forwardRef, memo, useCallback, useImperativeHandle, useRef } from 'react';
import Video, {
  OnAudioTracksData,
  OnBandwidthUpdateData,
  OnBufferData,
  OnLoadData,
  OnProgressData,
  OnTextTracksData,
  OnVideoErrorData,
  OnVideoStatisticsData,
  SelectedTrack,
  SelectedTrackType,
  VideoRef,
} from 'react-native-video';

import { useShallow } from 'zustand/react/shallow';

import { DEFAULT_PROFILE_PLAYBACK_SETTINGS, usePlaybackStore } from '@/store/playback.store';
import { useProfileStore } from '@/store/profile.store';
import { AudioTrack, PlayerProps, PlayerRef, PlayerStatistics, TextTrack } from '@/types/player';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('RNVideoPlayer');

const composeErrorString = (error?: Partial<OnVideoErrorData['error']>): string => {
  if (!error || typeof error !== 'object') return 'Unknown player error';

  const errorParts = [error.errorCode, error.errorString, error.errorException, error.error].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  return errorParts.length > 0
    ? errorParts.join(' ')
    : (JSON.stringify(error) ?? 'Unknown player error');
};

export const RNVideoPlayer = memo(
  forwardRef<PlayerRef, PlayerProps>((props, ref) => {
    const {
      source,
      paused,
      onProgress,
      onBuffer,
      onPlaying,
      onLoad,
      onEnd,
      onError,
      onAudioTracks,
      onTextTracks,
      onStatistics,
      onBandwidthUpdate,
      selectedAudioTrack,
      selectedTextTrack,
      subtitleStyle,
      fitMode = 'contain',
    } = props;
    const videoRef = useRef<VideoRef>(null);

    const activeProfileId = useProfileStore((state) => state.activeProfileId);
    const {
      tunneled,
      audioPassthrough,
      enableWorkarounds,
      showVideoStatistics,
      matchFrameRate,
      enableVideoSoftwareDecoding,
    } = usePlaybackStore(
      useShallow((state) => {
        const settings = activeProfileId
          ? state.byProfile[activeProfileId]
          : DEFAULT_PROFILE_PLAYBACK_SETTINGS;
        return {
          tunneled: settings?.tunneled ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.tunneled,
          audioPassthrough:
            settings?.audioPassthrough ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.audioPassthrough,
          enableWorkarounds:
            settings?.enableWorkarounds ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableWorkarounds,
          showVideoStatistics:
            settings?.showVideoStatistics ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.showVideoStatistics,
          matchFrameRate:
            settings?.matchFrameRate ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.matchFrameRate,
          enableVideoSoftwareDecoding:
            settings?.enableVideoSoftwareDecoding ??
            DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableVideoSoftwareDecoding,
        };
      })
    );

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        videoRef.current?.seek(time);
      },
    }));

    const handleProgress = useCallback(
      (data: OnProgressData) => {
        if (!paused) onPlaying?.();
        onProgress?.({
          currentTime: data.currentTime,
          duration: data.seekableDuration || 0,
          bufferedDuration: data.playableDuration || 0,
          seekableDuration: data.seekableDuration || 0,
        });
      },
      [onPlaying, onProgress, paused]
    );
    const handleBuffer = useCallback(
      (data: OnBufferData) => {
        debug('buffering', { buffering: data.isBuffering });
        onBuffer?.(data.isBuffering);
      },
      [onBuffer]
    );

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        debug('load', { duration: data.duration, naturalSize: data.naturalSize });
        onLoad?.({ duration: data.duration });
      },
      [onLoad]
    );

    const handleError = useCallback(
      (data: OnVideoErrorData) => {
        const error = data?.error;
        debug('error', { error });
        onError?.(composeErrorString(error));
      },
      [onError]
    );

    const handleAudioTracks = useCallback(
      (data: OnAudioTracksData) => {
        const audioTracks = Array.isArray(data?.audioTracks) ? data.audioTracks : [];
        debug('audioTracks', { count: audioTracks.length });
        const tracks: AudioTrack[] = audioTracks.map((track, index) => ({
          index,
          title: track.title,
          language: track.language,
          type: track.type,
        }));
        onAudioTracks?.(tracks);
      },
      [onAudioTracks]
    );

    const handleTextTracks = useCallback(
      (data: OnTextTracksData) => {
        const textTracks = Array.isArray(data?.textTracks) ? data.textTracks : [];
        debug('textTracks', { count: textTracks.length });
        const tracks: TextTrack[] = textTracks.map((track, idx) => ({
          source: 'video' as const,
          index: idx,
          title: track.title,
          language: track.language,
          playerIndex: track.index, // Use the player's track index for selection
        }));
        onTextTracks?.(tracks);
      },
      [onTextTracks]
    );
    const handleVideoStatistics = useCallback(
      (data: OnVideoStatisticsData) => {
        onStatistics?.(data as PlayerStatistics);
      },
      [onStatistics]
    );

    const handleBandwidthUpdate = useCallback(
      (data: OnBandwidthUpdateData) => {
        debug('bandwidth', data);
        onBandwidthUpdate?.({
          bitrate: data.bitrate,
          width: data.width,
          height: data.height,
          trackId: data.trackId,
        });
      },
      [onBandwidthUpdate]
    );

    const audioTrackSelection: SelectedTrack | undefined = selectedAudioTrack
      ? {
          type: 'index' as SelectedTrackType,
          value: selectedAudioTrack.index,
        }
      : undefined;

    // Only select video-source subtitles (addon subtitles are rendered by CustomSubtitles)
    // When no video-source track is selected, explicitly disable to hide any default subtitles
    const textTrackSelection: SelectedTrack = selectedTextTrack
      ? {
          type: 'index' as SelectedTrackType,
          value: selectedTextTrack.playerIndex ?? selectedTextTrack.index,
        }
      : {
          type: 'disabled' as SelectedTrackType,
          value: '',
        };

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
        tunneled={tunneled}
        audioPassthrough={audioPassthrough}
        enableWorkarounds={enableWorkarounds}
        matchFrameRate={matchFrameRate}
        enableVideoSoftwareDecoding={enableVideoSoftwareDecoding}
        reportStatistics={showVideoStatistics}
        reportBandwidth={showVideoStatistics}
        onVideoStatistics={handleVideoStatistics}
        onBandwidthUpdate={handleBandwidthUpdate}
        style={{ flex: 1 }}
        paused={paused}
        controls={false}
        resizeMode={fitMode}
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
        subtitleStyle={subtitleStyle}
        // Event handlers
        onProgress={handleProgress}
        onBuffer={handleBuffer}
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
