import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@/theme/theme';
import * as Burnt from 'burnt';

import { RNVideoPlayer } from './RNVideoPlayer';
import { VLCPlayer } from './VLCPlayer';
import { PlayerControls } from './PlayerControls';
import { UpNextPopup, type UpNextResolved } from './UpNextPopup';
import { CustomSubtitles } from './CustomSubtitles';

import { AudioTrack, PlayerRef, TextTrack } from '@/types/player';
import type { ContentType } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { usePlaybackStore } from '@/store/playback.store';
import {
  findBestTrackByLanguage,
  getPreferredLanguageCodes,
  normalizeLanguageCode,
} from '@/utils/languages';
import { combineSubtitles } from '@/utils/subtitles';
import {
  SKIP_FORWARD_SECONDS,
  SKIP_BACKWARD_SECONDS,
  PLAYBACK_RATIO_PERSIST_INTERVAL,
} from '@/constants/playback';
import { TOAST_DURATION_LONG, TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { useDebugLogger } from '@/utils/debug';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { getVideoSessionId } from '@/utils/stream';
import { useSubtitles } from '@/api/stremio';
import { useNativeSubtitleStyle } from '@/hooks/useSubtitleStyle';

export interface VideoPlayerProps {
  source: string;
  title?: string;
  mediaType: ContentType;
  metaId: string;
  videoId?: string;
  /** Stream behaviorHints.group of the currently playing stream (if any). */
  bingeGroup?: string;
  onStop?: () => void;
  onError?: (message: string) => void;
}

export interface VideoPlayerSessionProps extends VideoPlayerProps {
  usedPlayerType: 'vlc' | 'exoplayer';
  setUsedPlayerType: (next: 'vlc' | 'exoplayer') => void;
  playerType: 'vlc' | 'exoplayer';
  automaticFallback: boolean;
}

// Combine subtitle tracks from addon sources and the internal video player.
// Group by language, sort preferred languages first (in order), then a divider and the rest alphabetically.
// Within a language group: addon-provided subtitles first (sorted by addonName/title), then video source tracks.
const useSubtitleCombiner = (mediaType: ContentType, metaId: string, videoId?: string) => {
  const [videoSubtitles, setVideoSubtitles] = useState<TextTrack[] | undefined>();
  const { data: addonSubtitles = [], isLoading: areSubtitlesLoading } = useSubtitles(
    mediaType,
    metaId,
    videoId
  );

  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const preferredSubtitleLanguages = useProfileSettingsStore((state) =>
    activeProfileId ? state.byProfile[activeProfileId]?.preferredSubtitleLanguages : undefined
  );

  const combinedSubtitles = useMemo(() => {
    if (areSubtitlesLoading) return [] as TextTrack[];
    return combineSubtitles(videoSubtitles, addonSubtitles, preferredSubtitleLanguages);
  }, [addonSubtitles, areSubtitlesLoading, preferredSubtitleLanguages, videoSubtitles]);

  return {
    combinedSubtitles,
    areSubtitlesLoading,
    setVideoSubtitles,
  };
};

export const VideoPlayerSession: FC<VideoPlayerSessionProps> = ({
  source,
  title,
  mediaType,
  metaId,
  videoId,
  bingeGroup,
  onStop,
  onError,
  usedPlayerType,
  setUsedPlayerType,
  playerType,
  automaticFallback,
}) => {
  const debug = useDebugLogger('VideoPlayer');

  const playerRef = useRef<PlayerRef>(null);
  const { replaceToStreams } = useMediaNavigation();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { preferredAudioLanguages } = useProfileSettingsStore((state) => ({
    preferredAudioLanguages: activeProfileId
      ? state.byProfile[activeProfileId]?.preferredAudioLanguages
      : undefined,
    preferredSubtitleLanguages: activeProfileId
      ? state.byProfile[activeProfileId]?.preferredSubtitleLanguages
      : undefined,
  }));

  const nativeSubtitleStyle = useNativeSubtitleStyle();

  // Local subtitle delay state (not persisted)
  const [subtitleDelay, setSubtitleDelay] = useState(0);

  const resumeHistoryItem = useWatchHistoryStore((state) => {
    if (!activeProfileId) return undefined;
    const videoKey = videoId ?? '_';
    return state.byProfile[activeProfileId]?.[metaId]?.[videoKey];
  });

  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  const progressRatio = useMemo(() => {
    if (duration <= 0) return 0;
    return currentTime / duration;
  }, [currentTime, duration]);

  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack>();
  const [selectedTextTrack, setSelectedTextTrack] = useState<TextTrack>();

  const { combinedSubtitles, areSubtitlesLoading, setVideoSubtitles } = useSubtitleCombiner(
    mediaType,
    metaId,
    videoId
  );

  const lastPersistAtRef = useRef(0);
  const lastKnownTimeRef = useRef(0);
  const lastKnownDurationRef = useRef(0);
  const resumeAppliedKeyRef = useRef<string | null>(null);
  const didPersistLastTargetRef = useRef(false);
  const subtitlePreferenceAppliedRef = useRef(false);

  // Auto-apply saved subtitle preference when subtitles are loaded
  useEffect(() => {
    if (subtitlePreferenceAppliedRef.current) return;
    if (areSubtitlesLoading || combinedSubtitles.length === 0) return;
    if (selectedTextTrack) return; // Don't override if already selected

    const savedPreference = usePlaybackStore.getState().getActivePlaybackState().subtitlePreference;
    if (!savedPreference) return;

    debug('autoApplySubtitlePreference', {
      savedPreference,
      availableCount: combinedSubtitles.length,
    });

    // Try to find a matching track based on saved preference
    const normalizedSavedLang = normalizeLanguageCode(savedPreference.language);
    let bestMatch: TextTrack | undefined;

    // Priority 1: Exact match (same source, addon, and language)
    if (savedPreference.source === 'addon' && savedPreference.addonId) {
      bestMatch = combinedSubtitles.find(
        (t) =>
          t.source === 'addon' &&
          t.addonId === savedPreference.addonId &&
          normalizeLanguageCode(t.language) === normalizedSavedLang
      );
    }

    // Priority 2: Same source and language (any addon or video track)
    if (!bestMatch) {
      bestMatch = combinedSubtitles.find(
        (t) =>
          t.source === savedPreference.source &&
          normalizeLanguageCode(t.language) === normalizedSavedLang
      );
    }

    // Priority 3: Same language, any source
    if (!bestMatch && normalizedSavedLang) {
      bestMatch = combinedSubtitles.find(
        (t) => normalizeLanguageCode(t.language) === normalizedSavedLang
      );
    }

    if (bestMatch) {
      debug('autoApplySubtitlePreference:matched', {
        index: bestMatch.index,
        source: bestMatch.source,
        language: bestMatch.language,
        addonId: bestMatch.addonId,
      });
      subtitlePreferenceAppliedRef.current = true;
      setSelectedTextTrack(bestMatch);
    } else {
      debug('autoApplySubtitlePreference:noMatch');
      subtitlePreferenceAppliedRef.current = true;
    }
  }, [activeProfileId, areSubtitlesLoading, combinedSubtitles, debug, selectedTextTrack]);

  const didStartNextRef = useRef(false);
  const [autoplayCancelled, setAutoplayCancelled] = useState(false);
  const [upNextDismissed, setUpNextDismissed] = useState(false);

  const upNextVideoIdRef = useRef<string | undefined>(undefined);
  const [upNextResolved, setUpNextResolved] = useState<UpNextResolved | undefined>(undefined);

  const handleUpNextResolved = useCallback(
    (next?: UpNextResolved) => {
      debug('upNextResolved', {
        metaId,
        videoId,
        bingeGroup,
        nextVideoId: next?.videoId,
        nextEpisodeLabel: next?.episodeLabel,
      });
      upNextVideoIdRef.current = next?.videoId;
      setUpNextResolved(next);
    },
    [bingeGroup, debug, metaId, videoId]
  );

  const persistProgress = useCallback(
    (progressSeconds: number, durationSeconds: number, force = false) => {
      if (!activeProfileId) return;
      if (durationSeconds === 0) return;

      const now = Date.now();
      if (!force && now - lastPersistAtRef.current < PLAYBACK_RATIO_PERSIST_INTERVAL) return;

      lastPersistAtRef.current = now;
      useWatchHistoryStore.getState().upsertItem({
        id: metaId,
        type: mediaType,
        videoId,
        progressSeconds,
        durationSeconds,
      });
    },
    [activeProfileId, mediaType, metaId, videoId]
  );

  const startNextEpisode = useCallback(() => {
    if (didStartNextRef.current) return;
    const nextVideoId = upNextVideoIdRef.current;
    if (!nextVideoId) return;

    debug('startNextEpisode', {
      metaId,
      fromVideoId: videoId,
      nextVideoId,
      mediaType,
      bingeGroup,
    });

    didStartNextRef.current = true;
    setUpNextDismissed(true);
    persistProgress(lastKnownTimeRef.current, lastKnownDurationRef.current, true);

    replaceToStreams(
      { metaId, videoId: nextVideoId, type: mediaType },
      { autoPlay: '1', bingeGroup }
    );
  }, [bingeGroup, debug, mediaType, metaId, persistProgress, replaceToStreams, videoId]);

  const handleProgress = useCallback(
    (data: { currentTime: number; duration?: number }) => {
      setCurrentTime(data.currentTime);
      lastKnownTimeRef.current = data.currentTime;
      if (data.duration) {
        setDuration(data.duration);
        lastKnownDurationRef.current = data.duration;
      }
      persistProgress(data.currentTime, lastKnownDurationRef.current ?? 0);
    },
    [persistProgress]
  );

  const handleBuffering = useCallback(
    (buffering: boolean) => {
      debug('buffering', { buffering });
      setIsBuffering(buffering);
    },
    [debug]
  );

  const handleLoad = useCallback(
    (data: { duration: number }) => {
      debug('load', { duration: data.duration, usedPlayerType, playerType, automaticFallback });

      // Only remember the last stream if playback actually starts loading successfully.
      // This prevents a broken stream URL from being remembered and re-tried forever.
      if (!didPersistLastTargetRef.current && data.duration > 0) {
        didPersistLastTargetRef.current = true;
        useWatchHistoryStore
          .getState()
          .setLastStreamTarget(metaId, videoId, mediaType, { type: 'url', value: source });
      }

      const resumeKey = getVideoSessionId(source, metaId, videoId, usedPlayerType);
      const shouldApplyResume = resumeAppliedKeyRef.current !== resumeKey;
      if (shouldApplyResume) {
        resumeAppliedKeyRef.current = resumeKey;
      }

      const rawResumeSeconds = resumeHistoryItem?.progressSeconds ?? 0;
      const durationSeconds = data.duration;
      const resumeSeconds = shouldApplyResume
        ? Math.min(Math.max(rawResumeSeconds, 0), Math.max(0, durationSeconds - 1))
        : 0;

      setDuration(data.duration);
      setIsVideoLoading(false);
      setPaused(false);
      lastKnownDurationRef.current = data.duration;

      if (resumeSeconds > 0) {
        lastKnownTimeRef.current = resumeSeconds;
        setCurrentTime(resumeSeconds);
        setTimeout(() => {
          playerRef.current?.seekTo(resumeSeconds, durationSeconds);
        }, 0);
        persistProgress(resumeSeconds, durationSeconds, true);
      } else {
        persistProgress(lastKnownTimeRef.current, durationSeconds, true);
      }
    },
    [
      automaticFallback,
      debug,
      metaId,
      mediaType,
      persistProgress,
      playerType,
      resumeHistoryItem?.progressSeconds,
      source,
      usedPlayerType,
      videoId,
    ]
  );

  const handleEnd = useCallback(() => {
    debug('end');
    persistProgress(lastKnownDurationRef.current, lastKnownDurationRef.current, true);
    if (!autoplayCancelled && !!upNextVideoIdRef.current) {
      debug('autoStartNextOnEnd', {
        metaId,
        videoId,
        nextVideoId: upNextVideoIdRef.current,
        autoplayCancelled,
      });
      startNextEpisode();
      return;
    }
    onStop?.();
  }, [autoplayCancelled, debug, metaId, onStop, persistProgress, startNextEpisode, videoId]);

  const handleError = useCallback(
    (message: string) => {
      debug('error', { message, automaticFallback, playerType, usedPlayerType });

      if (automaticFallback && playerType === usedPlayerType) {
        const newPlayer = usedPlayerType === 'exoplayer' ? 'vlc' : 'exoplayer';
        debug('attemptingFallback', { from: usedPlayerType, to: newPlayer });
        Burnt.toast({
          title: `Switching to ${newPlayer === 'vlc' ? 'VLC' : 'ExoPlayer'}`,
          preset: 'error',
          haptic: 'warning',
          duration: TOAST_DURATION_MEDIUM,
        });
        setIsVideoLoading(true);
        setUsedPlayerType(newPlayer);
      } else {
        Burnt.toast({
          title: 'Playback Error',
          message: message,
          preset: 'error',
          haptic: 'error',
          duration: TOAST_DURATION_LONG,
        });
        onError?.(message);
      }
    },
    [automaticFallback, debug, playerType, usedPlayerType, setUsedPlayerType, onError]
  );

  const handlePlayPause = useCallback(() => {
    debug('togglePlayPause');
    setPaused((prev) => !prev);
  }, [debug]);

  const handleSeek = useCallback(
    (time: number) => {
      debug('seek', { time, duration });
      playerRef.current?.seekTo(time, duration);
      setCurrentTime(time);
      persistProgress(time, duration, true);
      lastKnownTimeRef.current = time;
    },
    [debug, duration, persistProgress]
  );

  const handleSkipBackward = useCallback(() => {
    debug('skipBackward');
    const newTime = Math.max(0, currentTime - SKIP_BACKWARD_SECONDS);
    handleSeek(newTime);
  }, [currentTime, debug, handleSeek]);

  const handleSkipForward = useCallback(() => {
    debug('skipForward');
    const newTime = Math.min(duration, currentTime + SKIP_FORWARD_SECONDS);
    handleSeek(newTime);
  }, [currentTime, debug, duration, handleSeek]);

  const handleAudioTracksLoaded = useCallback(
    (tracks: AudioTrack[]) => {
      debug('audioTracksLoaded', { count: tracks.length });
      setAudioTracks(tracks);

      if (selectedAudioTrack || tracks.length === 0) return;

      const preferredAudioLanguageCodes = getPreferredLanguageCodes(preferredAudioLanguages);
      const bestAudio = findBestTrackByLanguage(tracks, preferredAudioLanguageCodes) ?? tracks[0];
      setSelectedAudioTrack(bestAudio);
    },
    [debug, preferredAudioLanguages, selectedAudioTrack]
  );

  const handleTextTracksLoaded = useCallback(
    (tracks: TextTrack[]) => {
      debug('textTracksLoaded', { count: tracks.length });
      setVideoSubtitles(tracks);
    },
    [debug, setVideoSubtitles]
  );

  const handleSelectAudioTrack = useCallback(
    (index: number) => {
      debug('selectAudioTrack', { index });
      const chosenAudioTrack = audioTracks.find((at) => at.index === index);
      if (chosenAudioTrack && (!selectedAudioTrack || selectedAudioTrack.index !== index)) {
        setSelectedAudioTrack(chosenAudioTrack);
      }
    },
    [audioTracks, debug, selectedAudioTrack]
  );

  const handleSelectTextTrack = useCallback(
    (index?: number, isAutoSelect = false) => {
      debug('selectTextTrack', { index, isAutoSelect });

      // If already selected, do nothing
      if (selectedTextTrack?.index === index) return;

      if (index === undefined) {
        setSelectedTextTrack(undefined);
        if (!isAutoSelect && activeProfileId) {
          usePlaybackStore.getState().clearSubtitlePreference();
          debug('subtitlePreferenceCleared');
        }
        return;
      }

      const chosenTextTrack = combinedSubtitles?.find((tt) => tt.index === index);
      if (!chosenTextTrack) {
        debug('selectTextTrack:notFound', { index });
        return;
      }

      debug('selectTextTrack:selected', {
        index,
        source: chosenTextTrack.source,
        language: chosenTextTrack.language,
        addonId: chosenTextTrack.addonId,
        addonName: chosenTextTrack.addonName,
      });
      setSelectedTextTrack(chosenTextTrack);

      // Remember subtitle preference when user manually selects (not auto-select)
      if (!isAutoSelect && activeProfileId) {
        usePlaybackStore.getState().setSubtitlePreference({
          source: chosenTextTrack.source,
          language: normalizeLanguageCode(chosenTextTrack.language) ?? chosenTextTrack.language,
          addonId: chosenTextTrack.addonId,
          addonName: chosenTextTrack.addonName,
        });
        debug('subtitlePreferenceSaved', {
          source: chosenTextTrack.source,
          language: chosenTextTrack.language,
          addonId: chosenTextTrack.addonId,
        });
      }
    },
    [activeProfileId, combinedSubtitles, debug, selectedTextTrack]
  );

  const PlayerComponent = usedPlayerType === 'vlc' ? VLCPlayer : RNVideoPlayer;
  const isLoading = isVideoLoading || areSubtitlesLoading;

  return (
    <Box flex={1} backgroundColor="playerBackground">
      <PlayerComponent
        key={`player-${usedPlayerType}`}
        ref={playerRef}
        source={source}
        paused={paused}
        onProgress={handleProgress}
        onLoad={handleLoad}
        onBuffer={handleBuffering}
        onEnd={handleEnd}
        onError={handleError}
        onAudioTracks={handleAudioTracksLoaded}
        onTextTracks={handleTextTracksLoaded}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack?.source === 'video' ? selectedTextTrack : undefined}
        subtitleStyle={nativeSubtitleStyle}
      />

      {/* Custom subtitles overlay for addon-provided subtitles */}
      {selectedTextTrack?.source === 'addon' && selectedTextTrack.uri && (
        <CustomSubtitles
          url={selectedTextTrack.uri}
          currentTime={currentTime}
          delay={subtitleDelay}
        />
      )}

      <PlayerControls
        paused={paused}
        currentTime={currentTime}
        duration={duration}
        showLoadingIndicator={isLoading || isBuffering}
        title={title}
        audioTracks={audioTracks}
        textTracks={combinedSubtitles}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}
        subtitleDelay={subtitleDelay}
        onSubtitleDelayChange={setSubtitleDelay}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSkipBackward={handleSkipBackward}
        onSkipForward={handleSkipForward}
        showSkipEpisode={!!upNextResolved?.videoId}
        skipEpisodeLabel={upNextResolved?.episodeLabel}
        onSkipEpisode={startNextEpisode}
        onBack={onStop}
        onSelectAudioTrack={handleSelectAudioTrack}
        onSelectTextTrack={handleSelectTextTrack}
      />

      <UpNextPopup
        enabled={!didStartNextRef.current}
        metaId={metaId}
        mediaType={mediaType}
        videoId={videoId}
        progressRatio={progressRatio}
        dismissed={upNextDismissed}
        autoplayCancelled={autoplayCancelled}
        onCancelAutoplay={() => setAutoplayCancelled(true)}
        onDismiss={() => setUpNextDismissed(true)}
        onPlayNext={startNextEpisode}
        onUpNextResolved={handleUpNextResolved}
      />
    </Box>
  );
};
