/* eslint-disable max-lines-per-function -- large TV-focused component; see AGENTS.md refactor note */
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HWEvent, Platform, Pressable, StyleSheet, useTVEventHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Slider from '@react-native-community/slider';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';
import { useTheme } from '@shopify/restyle';
import { useShallow } from 'zustand/react/shallow';

import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { Modal } from '@/components/basic/Modal';
import { PickerModal } from '@/components/basic/PickerModal';
import { EpisodeList } from '@/components/media/EpisodeList';
import { StreamList } from '@/components/media/StreamList';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';
import { ControlButton } from '@/components/video/controls/ControlButton';
import { PlayerMenuOverlay } from '@/components/video/PlayerMenuOverlay';
import { SkipIntroButton } from '@/components/video/SkipIntroButton';
import { SubtitlePickerModal } from '@/components/video/SubtitlePickerModal';
import { TVSeekBar } from '@/components/video/TVSeekBar';
import { SKIP_BACKWARD_SECONDS, SKIP_FORWARD_SECONDS } from '@/constants/playback';
import { useControlsVisibility } from '@/hooks/useControlsVisibility';
import { usePlayerMenuController } from '@/hooks/usePlayerMenuController';
import { usePlayerSeek } from '@/hooks/usePlayerSeek';
import { usePlaybackStore } from '@/store/playback.store';
import { useProfileStore } from '@/store/profile.store';
import { Box, Text, Theme } from '@/theme/theme';
import type { IntroData } from '@/types/introdb';
import { AudioTrack, TextTrack, VideoFitMode } from '@/types/player';
import type { ContentType, MetaVideo, Stream } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import { formatFitModeLabel, formatPlaybackTime, formatWallClock } from '@/utils/format';
import { getLanguageDisplayName, getPreferredLanguageCodes } from '@/utils/languages';
import { getStreamStableId, isStreamSelected } from '@/utils/stream';
import { getTrackBadge, sortAudioTracksByPreference } from '@/utils/tracks';
const debug = createDebugLogger('PlayerControls');

// ============================================================================
// Types
// ============================================================================

interface PlayerControlsProps {
  paused: boolean;
  currentTime: number;
  duration: number;
  showLoadingIndicator: boolean;
  title?: string;
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  selectedAudioTrack?: AudioTrack;
  selectedTextTrack?: TextTrack;
  subtitleDelay: number;
  onSubtitleDelayChange: (delay: number) => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  showSkipEpisode?: boolean;
  skipEpisodeLabel?: string;
  onSkipEpisode?: () => void;
  onBack?: () => void;
  onSelectAudioTrack: (index: number) => void;
  onSelectTextTrack: (index?: number) => void;
  fitMode: VideoFitMode;
  onToggleFitMode: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  /** Intro data for skip intro feature */
  introData?: IntroData;
  /** Whether the intro was already skipped */
  introSkipped?: boolean;
  /** Called when skip intro button is pressed */
  onSkipIntro?: () => void;
  /** When true, the invisible overlay Pressable will not claim TV preferred focus */
  suppressPreferredFocus?: boolean;
  // Stream list and episode panel props
  mediaType: ContentType;
  metaId: string;
  videoId?: string;
  videos?: MetaVideo[];
  backgroundImage?: string;
  logoImage?: string;
  /** URL of the currently playing stream; fallback identity for autoplay targets. */
  currentStreamUrl?: string;
  /** Stable ID of currently playing stream for highlighting. */
  streamId?: string;
  onStreamSelect: (stream: Stream) => void;
  onEpisodeSelect: (video: MetaVideo) => void;
}
// ============================================================================
// ============================================================================
// Helper Functions
// ============================================================================

const getFitModeIcon = (
  fitMode: VideoFitMode
): 'fullscreen' | 'arrow-expand-all' | 'aspect-ratio' => {
  switch (fitMode) {
    case 'cover':
      return 'fullscreen';
    case 'stretch':
      return 'arrow-expand-all';
    default:
      return 'aspect-ratio';
  }
};

// ============================================================================
// Sub-Components (memoized for performance)
// ============================================================================

interface TopBarProps {
  title?: string;
  onBack: () => void;
  onOpenSettings: () => void;
  currentTime: number;
  duration: number;
}

interface ClockDisplayProps {
  /** Remaining seconds rounded to the nearest minute — changes at most once/min */
  remainingMinutes: number;
}

/**
 * Isolated clock component that owns its own 1s interval.
 * Accepts only a minute-precision remaining value so it is immune to the
 * high-frequency currentTime/duration prop churn from the player engine.
 */
const ClockDisplay = memo<ClockDisplayProps>(({ remainingMinutes }) => {
  const { t } = useTranslation('player');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const endsAtStr = useMemo(() => {
    if (remainingMinutes <= 0) return null;
    return formatWallClock(new Date(Date.now() + remainingMinutes * 60 * 1000));
  }, [remainingMinutes]);

  return (
    <Box alignItems="flex-end" justifyContent="center">
      <Text variant="body" color="mainForeground">
        {formatWallClock(now)}
      </Text>
      {endsAtStr !== null && (
        <Text variant="bodySmall" color="mainForeground">
          {t('ends_at', { time: endsAtStr })}
        </Text>
      )}
    </Box>
  );
});
ClockDisplay.displayName = 'ClockDisplay';

const TopBar = memo<TopBarProps>(({ title, onBack, onOpenSettings, currentTime, duration }) => {
  const { t } = useTranslation(['player', 'common']);
  // Round to the nearest minute so ClockDisplay only re-renders ~once/min,
  // not on every player progress tick (~4 Hz).
  const remainingMinutes = Math.round(Math.max(0, duration - currentTime) / 60);

  return (
    <Box flexDirection="row" alignItems="center" paddingHorizontal="l" paddingVertical="m" gap="m">
      <ControlButton
        onPress={onBack}
        icon="arrow-back"
        iconComponent={Ionicons}
        testID="player-back"
      />
      <Box flex={1}>
        <Text variant="cardTitle" color="mainForeground" numberOfLines={1}>
          {title || t('play')}
        </Text>
      </Box>
      <ClockDisplay remainingMinutes={remainingMinutes} />
      <ControlButton
        onPress={onOpenSettings}
        icon="settings"
        iconComponent={Ionicons}
        label={t('common:settings')}
        labelPosition="bottom"
        testID="player-settings"
      />
    </Box>
  );
});
TopBar.displayName = 'TopBar';

interface TimeDisplayProps {
  displayedTime: number;
  duration: number;
}

const TimeDisplay = memo<TimeDisplayProps>(({ displayedTime, duration }) => (
  <Box flexDirection="row" alignItems="center" justifyContent="space-between" paddingHorizontal="s">
    <Text variant="body" color="mainForeground">
      {formatPlaybackTime(displayedTime)}
    </Text>
    <Text variant="body" color="mainForeground">
      {formatPlaybackTime(duration)}
    </Text>
  </Box>
));
TimeDisplay.displayName = 'TimeDisplay';

interface SeekBarProps {
  sliderValue: number;
  sliderMaximumValue: number;
  effectiveDuration: number;
  isSeekFocused: boolean;
  onSlidingStart: () => void;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  onFocus: () => void;
  onBlur: () => void;
  // TV-specific props
  onTVSeekStart?: () => void;
  onTVSeekComplete?: (value: number) => void;
  onTVValueChange?: (value: number) => void;
  hasTVPreferredFocus?: boolean;
}

const SeekBar = memo<SeekBarProps>(
  ({
    sliderValue,
    sliderMaximumValue,
    effectiveDuration,
    isSeekFocused,
    onSlidingStart,
    onValueChange,
    onSlidingComplete,
    onFocus,
    onBlur,
    onTVSeekStart,
    onTVSeekComplete,
    onTVValueChange,
    hasTVPreferredFocus,
  }) => {
    const theme = useTheme<Theme>();

    // Use custom TVSeekBar on TV platforms for better D-pad handling
    if (Platform.isTV) {
      return (
        <TVSeekBar
          value={sliderValue}
          maximumValue={sliderMaximumValue}
          disabled={effectiveDuration <= 0}
          onValueChange={onTVValueChange}
          onSeekStart={onTVSeekStart}
          onSeekComplete={onTVSeekComplete}
          onFocus={onFocus}
          onBlur={onBlur}
          hasTVPreferredFocus={hasTVPreferredFocus}
        />
      );
    }

    return (
      <Slider
        style={{ width: '100%', height: theme.sizes.inputHeight }}
        minimumValue={0}
        maximumValue={sliderMaximumValue}
        value={sliderValue}
        onSlidingStart={onSlidingStart}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
        onFocus={onFocus}
        onBlur={onBlur}
        minimumTrackTintColor={
          isSeekFocused ? theme.colors.focusBackgroundPrimary : theme.colors.primaryBackground
        }
        maximumTrackTintColor={theme.colors.secondaryBackground}
        thumbTintColor={
          isSeekFocused ? theme.colors.focusBackgroundPrimary : theme.colors.primaryBackground
        }
        disabled={effectiveDuration <= 0}
      />
    );
  }
);
SeekBar.displayName = 'SeekBar';

interface LeftControlsProps {
  showLoadingIndicator: boolean;
  hasTextTracks: boolean;
  selectedAudioLanguage?: string;
  selectedTextLanguage?: string;
  fitMode: VideoFitMode;
  onToggleFitMode: () => void;
  onToggleAudioTracks: () => void;
  onToggleTextTracks: () => void;
  onFocusChange: () => void;
}

const LeftControls = memo<LeftControlsProps>(
  ({
    showLoadingIndicator,
    hasTextTracks,
    selectedAudioLanguage,
    selectedTextLanguage,
    fitMode,
    onToggleFitMode,
    onToggleAudioTracks,
    onToggleTextTracks,
    onFocusChange,
  }) => {
    const { t } = useTranslation('player');
    return (
      <Box flexDirection="row" alignItems="center" gap="s">
        {hasTextTracks && (
          <ControlButton
            onPress={onToggleTextTracks}
            icon="subtitles"
            iconComponent={MaterialCommunityIcons}
            disabled={showLoadingIndicator}
            onFocusChange={onFocusChange}
            label={t('subtitles')}
            badge={getTrackBadge(selectedTextLanguage)}
            badgeVariant="tertiary"
            testID="player-subtitles"
          />
        )}
        <ControlButton
          onPress={onToggleAudioTracks}
          icon="globe"
          iconComponent={Ionicons}
          disabled={showLoadingIndicator}
          onFocusChange={onFocusChange}
          label={t('audio')}
          badge={getTrackBadge(selectedAudioLanguage)}
          badgeVariant="tertiary"
          testID="player-audio"
        />
        <ControlButton
          onPress={onToggleFitMode}
          icon={getFitModeIcon(fitMode)}
          iconComponent={MaterialCommunityIcons}
          disabled={showLoadingIndicator}
          label={formatFitModeLabel(fitMode, t)}
          onFocusChange={onFocusChange}
          testID="player-fit-mode"
        />
      </Box>
    );
  }
);
LeftControls.displayName = 'LeftControls';

interface PlaybackControlsProps {
  paused: boolean;
  showLoadingIndicator: boolean;
  onPlayPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onFocusChange: () => void;
  hasTVPreferredFocus?: boolean;
}

const PlaybackControls = memo<PlaybackControlsProps>(
  ({
    paused,
    showLoadingIndicator,
    onPlayPause,
    onSkipBackward,
    onSkipForward,
    onFocusChange,
    hasTVPreferredFocus,
  }) => {
    const { t } = useTranslation('player');
    return (
      <Box flexDirection="row" alignItems="center" gap="s">
        <ControlButton
          onPress={onSkipBackward}
          icon="rotate-left"
          iconComponent={MaterialCommunityIcons}
          label={`-${SKIP_BACKWARD_SECONDS}s`}
          onFocusChange={onFocusChange}
        />

        <ControlButton
          onPress={onPlayPause}
          icon={paused ? 'play' : 'pause'}
          iconComponent={Ionicons}
          disabled={showLoadingIndicator}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocusChange={onFocusChange}
          variant="primary"
          label={paused ? t('play') : t('pause')}
        />
        <ControlButton
          onPress={onSkipForward}
          icon="rotate-right"
          iconComponent={MaterialCommunityIcons}
          label={`+${SKIP_FORWARD_SECONDS}s`}
          onFocusChange={onFocusChange}
        />
      </Box>
    );
  }
);
PlaybackControls.displayName = 'PlaybackControls';

interface RightControlsProps {
  showSkipEpisode: boolean;
  skipEpisodeLabel?: string;
  showLoadingIndicator: boolean;
  onSkipEpisode: () => void;
  onFocusChange: () => void;
  onOpenStreams: () => void;
  showEpisodes: boolean;
  onOpenEpisodes: () => void;
}

const RightControls = memo<RightControlsProps>(
  ({
    showSkipEpisode,
    skipEpisodeLabel,
    showLoadingIndicator,
    onSkipEpisode,
    onFocusChange,
    onOpenStreams,
    showEpisodes,
    onOpenEpisodes,
  }) => {
    const { t } = useTranslation('player');
    return (
      <Box flexDirection="row" alignItems="center" gap="s">
        {showEpisodes && (
          <ControlButton
            onPress={onOpenEpisodes}
            icon="playlist-play"
            iconComponent={MaterialCommunityIcons}
            disabled={showLoadingIndicator}
            label={t('episodes')}
            onFocusChange={onFocusChange}
          />
        )}
        <ControlButton
          onPress={onOpenStreams}
          icon="layers"
          iconComponent={MaterialCommunityIcons}
          disabled={showLoadingIndicator}
          label={t('streams')}
          onFocusChange={onFocusChange}
        />
        {showSkipEpisode && (
          <ControlButton
            onPress={onSkipEpisode}
            icon="skip-next"
            iconComponent={MaterialCommunityIcons}
            disabled={showLoadingIndicator}
            label={t('skip')}
            onFocusChange={onFocusChange}
            badge={skipEpisodeLabel}
            badgeVariant="tertiary"
          />
        )}
      </Box>
    );
  }
);
RightControls.displayName = 'RightControls';

// ============================================================================
// Main Component
// ============================================================================

export const PlayerControls: FC<PlayerControlsProps> = memo(
  ({
    paused,
    currentTime,
    duration,
    showLoadingIndicator,
    title,
    audioTracks,
    textTracks,
    selectedAudioTrack,
    selectedTextTrack,
    subtitleDelay,
    onSubtitleDelayChange,
    onPlayPause,
    onSeek,
    onSkipBackward,
    onSkipForward,
    showSkipEpisode = false,
    skipEpisodeLabel,
    onSkipEpisode,
    onBack,
    onSelectAudioTrack,
    onSelectTextTrack,
    fitMode,
    onToggleFitMode,
    onVisibilityChange,
    introData,
    introSkipped,
    onSkipIntro,
    suppressPreferredFocus = false,
    mediaType,
    metaId,
    videoId,
    videos,
    backgroundImage,
    logoImage,
    currentStreamUrl,
    streamId,
    onStreamSelect,
    onEpisodeSelect,
  }) => {
    const theme = useTheme<Theme>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation('player');
    const activeProfileId = useProfileStore((state) => state.activeProfileId);

    const { preferredAudioLanguages, preferredSubtitleLanguages } = usePlaybackStore(
      useShallow((state) => ({
        preferredAudioLanguages: activeProfileId
          ? state.byProfile[activeProfileId]?.preferredAudioLanguages
          : undefined,
        preferredSubtitleLanguages: activeProfileId
          ? state.byProfile[activeProfileId]?.preferredSubtitleLanguages
          : undefined,
      }))
    );

    const {
      activeMenu,
      closeSelectionMenu,
      isModalOpen,
      setActiveMenu,
      showAudioTracks,
      setShowAudioTracks,
      showTextTracks,
      setShowTextTracks,
      showSettingsModal,
      setShowSettingsModal,
    } = usePlayerMenuController({ paused, onPlayPause });
    // Track which element should receive focus when controls become visible
    const [focusTarget, setFocusTarget] = useState<'play-pause' | 'seek' | null>(null);

    const {
      isSeeking,
      seekTime,
      isSeekFocused,
      setIsSeekFocused,
      handleSeekStart,
      handleSeekChange,
      handleSeekEnd,
      setSeekTimeForDisplay,
      resetSeekingState,
      effectiveDuration,
      sliderValue,
      sliderMaximumValue,
    } = usePlayerSeek({
      currentTime,
      duration,
      paused,
      onPlayPause,
      onSeek,
    });

    const handleVisibilityChange = useCallback(
      (newVisible: boolean) => {
        onVisibilityChange?.(newVisible);
      },
      [onVisibilityChange]
    );

    const { visible, registerInteraction, showControls, toggleControls } = useControlsVisibility({
      paused,
      isSeeking,
      isModalOpen,
      onVisibilityChange: handleVisibilityChange,
    });

    const showSkipIntroButton = introData && !introSkipped;

    // Whether the Skip Intro button is actually rendered and visible right now.
    // introData exists and current time is within the intro range.
    // This is distinct from showSkipIntroButton, which is true whenever intro data is loaded
    // (even when the current time is outside the intro range and SkipIntroButton returns null).
    const isSkipIntroVisible = !!(
      showSkipIntroButton &&
      introData &&
      currentTime >= introData.start_ms / 1000 &&
      currentTime < introData.end_ms / 1000
    );

    // Refs so the TV event handler always reads fresh values without stale closures.
    // This avoids the window between setVisible(false) (auto-hide timer) and the re-render
    // where the old callback still captures visible=true and ignores the select press.
    const visibleRef = useRef(visible);
    visibleRef.current = visible;
    const isSkipIntroVisibleRef = useRef(isSkipIntroVisible);
    isSkipIntroVisibleRef.current = isSkipIntroVisible;
    const suppressPreferredFocusRef = useRef(suppressPreferredFocus);
    suppressPreferredFocusRef.current = suppressPreferredFocus;

    // Listen for TV D-pad events when controls are hidden to determine focus target
    const handleTVEvent = useCallback(
      (event: HWEvent) => {
        if (visibleRef.current || suppressPreferredFocusRef.current) return;
        if (event.eventType === 'up' || event.eventType === 'down') {
          setFocusTarget('play-pause');
          showControls();
        } else if (event.eventType === 'left' || event.eventType === 'right') {
          setFocusTarget('seek');
          showControls();
        } else if (event.eventType === 'select') {
          // Don't intercept select if Skip Intro button is actually visible - let it handle the press
          if (!isSkipIntroVisibleRef.current) {
            // Record the destination focus target only. When controls are hidden the
            // full-screen Pressable owns focus, so the native center/select press
            // already invokes its onPress={showControls}; revealing here as well
            // would let the same in-flight dispatch land on the newly focused
            // play/pause control and immediately toggle the UI.
            setFocusTarget('play-pause');
          }
        }
      },
      [showControls]
    );

    // Enable TV event handler
    useTVEventHandler(handleTVEvent);

    // Clear focus target after controls become visible
    useEffect(() => {
      if (visible && focusTarget) {
        const timer = setTimeout(() => setFocusTarget(null), 100);
        return () => clearTimeout(timer);
      }
    }, [visible, focusTarget]);

    // Memoized sorted audio tracks
    const audioTrackItems = useMemo(
      () => sortAudioTracksByPreference(audioTracks, preferredAudioLanguages),
      [audioTracks, preferredAudioLanguages]
    );

    // Memoized seek handlers with interaction registration
    const handleSeekStartWithInteraction = useCallback(() => {
      registerInteraction();
      handleSeekStart();
    }, [registerInteraction, handleSeekStart]);

    const handleSeekChangeWithInteraction = useCallback(
      (value: number) => {
        registerInteraction();
        handleSeekChange(value);
      },
      [registerInteraction, handleSeekChange]
    );

    const handleSeekEndWithInteraction = useCallback(
      (value: number) => {
        registerInteraction();
        handleSeekEnd(value);
      },
      [registerInteraction, handleSeekEnd]
    );

    const handleSeekFocus = useCallback(() => setIsSeekFocused(true), [setIsSeekFocused]);
    const handleSeekBlur = useCallback(() => setIsSeekFocused(false), [setIsSeekFocused]);

    // TV-specific seek handlers (for custom TVSeekBar)
    // Track if video was playing before TV seek started
    const wasPlayingBeforeTVSeekRef = useRef(false);

    const handleTVSeekStart = useCallback(() => {
      registerInteraction();
      // Remember if we need to resume after seeking
      wasPlayingBeforeTVSeekRef.current = !paused;
      // Pause video during seeking if playing
      if (!paused) {
        onPlayPause();
      }
    }, [registerInteraction, paused, onPlayPause]);

    const handleTVSeekComplete = useCallback(
      (value: number) => {
        registerInteraction();
        onSeek(value);
        // Reset seeking state in usePlayerSeek (so time display switches back to currentTime)
        resetSeekingState();
        // Resume video if it was playing before seeking
        if (wasPlayingBeforeTVSeekRef.current) {
          wasPlayingBeforeTVSeekRef.current = false;
          onPlayPause();
        }
      },
      [registerInteraction, onSeek, resetSeekingState, onPlayPause]
    );

    // TV-specific value change handler (updates seek time for display without triggering debounce)
    const handleTVValueChange = useCallback(
      (value: number) => {
        registerInteraction();
        setSeekTimeForDisplay(value);
      },
      [registerInteraction, setSeekTimeForDisplay]
    );

    // Memoized button handlers
    const handleButtonFocusChange = useCallback(() => registerInteraction(), [registerInteraction]);

    const handleBack = useCallback(() => {
      registerInteraction();
      onBack?.();
    }, [onBack, registerInteraction]);

    const handlePlayPause = useCallback(() => {
      registerInteraction();
      onPlayPause();
    }, [onPlayPause, registerInteraction]);

    const handleSkipBackward = useCallback(() => {
      registerInteraction();
      onSkipBackward();
    }, [onSkipBackward, registerInteraction]);

    const handleSkipForward = useCallback(() => {
      registerInteraction();
      onSkipForward();
    }, [onSkipForward, registerInteraction]);

    const handleSkipEpisode = useCallback(() => {
      if (!onSkipEpisode) return;
      registerInteraction();
      onSkipEpisode();
    }, [onSkipEpisode, registerInteraction]);

    const handleSkipIntro = useCallback(() => {
      if (!onSkipIntro) return;
      onSkipIntro();
    }, [onSkipIntro]);

    const handleToggleAudioTracks = useCallback(() => {
      registerInteraction();
      setShowAudioTracks((prev) => !prev);
    }, [registerInteraction, setShowAudioTracks]);

    const handleToggleTextTracks = useCallback(() => {
      registerInteraction();
      setShowTextTracks((prev) => !prev);
    }, [registerInteraction, setShowTextTracks]);

    const handleToggleFitMode = useCallback(() => {
      registerInteraction();
      onToggleFitMode();
    }, [onToggleFitMode, registerInteraction]);

    const handleOpenSettings = useCallback(() => {
      registerInteraction();
      setShowSettingsModal(true);
    }, [registerInteraction, setShowSettingsModal]);

    const handleCloseSettings = useCallback(() => {
      registerInteraction();
      setShowSettingsModal(false);
    }, [registerInteraction, setShowSettingsModal]);

    const handleSelectAudioTrack = useCallback(
      (value: string | number) => {
        registerInteraction();
        onSelectAudioTrack(Number(value));
      },
      [onSelectAudioTrack, registerInteraction]
    );

    const handleSelectTextTrack = useCallback(
      (index?: number) => {
        registerInteraction();
        onSelectTextTrack(index);
      },
      [onSelectTextTrack, registerInteraction]
    );

    const handleOpenStreams = useCallback(() => {
      debug('openStreamsMenu', {
        currentStreamUrl,
        streamId,
      });
      registerInteraction();
      setActiveMenu('streams');
    }, [currentStreamUrl, registerInteraction, setActiveMenu, streamId]);

    const handleCloseMenus = useCallback(() => {
      debug('closeSelectionMenu', { activeMenu });
      registerInteraction();
      closeSelectionMenu();
    }, [activeMenu, closeSelectionMenu, registerInteraction]);

    const handleOpenEpisodes = useCallback(() => {
      debug('openEpisodesMenu', { videoId });
      registerInteraction();
      setActiveMenu('episodes');
    }, [registerInteraction, setActiveMenu, videoId]);

    const handleStreamSelect = useCallback(
      (stream: Stream) => {
        const candidateStreamId = getStreamStableId(stream);
        const isCurrentStream = isStreamSelected(stream, streamId, currentStreamUrl);
        debug('streamSelect', {
          activeMenu,
          candidateStreamId,
          candidateUrl: stream.url,
          currentStreamUrl,
          streamId,
          isCurrentStream,
        });

        if (isCurrentStream) {
          closeSelectionMenu();
          return;
        }

        closeSelectionMenu({ resumePlayback: false });
        onStreamSelect(stream);
      },
      [activeMenu, closeSelectionMenu, currentStreamUrl, onStreamSelect, streamId]
    );

    const handleEpisodeSelect = useCallback(
      (video: MetaVideo) => {
        const isCurrentEpisode = video.id === videoId;
        debug('episodeSelect', {
          activeMenu,
          candidateVideoId: video.id,
          currentVideoId: videoId,
          isCurrentEpisode,
        });

        if (isCurrentEpisode) {
          closeSelectionMenu();
          return;
        }

        closeSelectionMenu({ resumePlayback: false });
        onEpisodeSelect(video);
      },
      [activeMenu, closeSelectionMenu, onEpisodeSelect, videoId]
    );

    // When hidden, render minimal touchable area + skip intro button
    if (!visible) {
      return (
        <>
          <Pressable
            testID="player-controls-invisible-area"
            style={StyleSheet.absoluteFill}
            onPress={showControls}
            hasTVPreferredFocus={!isSkipIntroVisible && !suppressPreferredFocus}
          />
          {/* Skip Intro button shown even when controls are hidden */}
          {showSkipIntroButton && (
            <SkipIntroButton
              introData={introData}
              currentTime={currentTime}
              onSkipIntro={handleSkipIntro}
            />
          )}
        </>
      );
    }

    const displayedTime = isSeeking ? seekTime : currentTime;

    return (
      <>
        <Pressable
          testID="player-controls-overlay"
          style={StyleSheet.absoluteFill}
          focusable={false}
          isTVSelectable={false}
          onPress={toggleControls}>
          <Box flex={1} justifyContent="space-between">
            <TopBar
              title={title}
              onBack={handleBack}
              onOpenSettings={handleOpenSettings}
              currentTime={currentTime}
              duration={duration}
            />

            {showLoadingIndicator && (
              <Box width="100%" alignItems="center" justifyContent="center">
                <LoadingIndicator />
              </Box>
            )}

            {/* Center area - contains Skip Intro button */}
            <Box flex={1}>
              {showSkipIntroButton && (
                <SkipIntroButton
                  introData={introData}
                  currentTime={currentTime}
                  onSkipIntro={handleSkipIntro}
                />
              )}
            </Box>
          </Box>
        </Pressable>

        {/* Bottom Controls */}
        <Box
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.colors.semiTransparentBackground,
          }}
          pointerEvents="box-none">
          <Box
            pointerEvents="box-none"
            paddingHorizontal="m"
            paddingTop="m"
            gap="s"
            style={{
              paddingBottom: insets.bottom > 0 ? insets.bottom + theme.spacing.m : theme.spacing.m,
            }}>
            {/* Time Display + Seek Bar */}
            <Box>
              <TimeDisplay displayedTime={displayedTime} duration={duration} />
              <SeekBar
                sliderValue={sliderValue}
                sliderMaximumValue={sliderMaximumValue}
                effectiveDuration={effectiveDuration}
                isSeekFocused={isSeekFocused}
                onSlidingStart={handleSeekStartWithInteraction}
                onValueChange={handleSeekChangeWithInteraction}
                onSlidingComplete={Platform.isTV ? undefined : handleSeekEndWithInteraction}
                onFocus={handleSeekFocus}
                onBlur={handleSeekBlur}
                onTVSeekStart={handleTVSeekStart}
                onTVSeekComplete={handleTVSeekComplete}
                onTVValueChange={handleTVValueChange}
                hasTVPreferredFocus={focusTarget === 'seek'}
              />
            </Box>

            {/* Control Buttons */}
            <Box flexDirection="row" alignItems="center" justifyContent="space-between">
              {/* Left controls - flex: 1, justify start */}
              <Box flex={1} flexDirection="row" justifyContent="flex-start">
                <LeftControls
                  showLoadingIndicator={showLoadingIndicator}
                  hasTextTracks={textTracks.length > 0}
                  selectedAudioLanguage={selectedAudioTrack?.language}
                  selectedTextLanguage={selectedTextTrack?.language}
                  fitMode={fitMode}
                  onToggleFitMode={handleToggleFitMode}
                  onToggleAudioTracks={handleToggleAudioTracks}
                  onToggleTextTracks={handleToggleTextTracks}
                  onFocusChange={handleButtonFocusChange}
                />
              </Box>

              {/* Center controls - flex to be pushed to center */}
              <Box flex={1} flexDirection="row" justifyContent="center">
                <PlaybackControls
                  paused={paused}
                  showLoadingIndicator={showLoadingIndicator}
                  onPlayPause={handlePlayPause}
                  onSkipBackward={handleSkipBackward}
                  onSkipForward={handleSkipForward}
                  onFocusChange={handleButtonFocusChange}
                  hasTVPreferredFocus={focusTarget === 'play-pause'}
                />
              </Box>

              {/* Right controls - flex: 1, justify end */}
              <Box flex={1} flexDirection="row" justifyContent="flex-end">
                <RightControls
                  showSkipEpisode={showSkipEpisode}
                  skipEpisodeLabel={skipEpisodeLabel}
                  showLoadingIndicator={showLoadingIndicator}
                  onSkipEpisode={handleSkipEpisode}
                  onFocusChange={handleButtonFocusChange}
                  onOpenEpisodes={handleOpenEpisodes}
                  showEpisodes={mediaType === 'series' && (videos?.length ?? 0) > 1}
                  onOpenStreams={handleOpenStreams}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Modals */}
        <PickerModal
          visible={showAudioTracks}
          onClose={() => setShowAudioTracks(false)}
          label={t('select_audio_track')}
          icon="language"
          items={audioTrackItems}
          selectedValue={selectedAudioTrack?.index}
          onValueChange={handleSelectAudioTrack}
          getItemGroupId={(item) => item.groupId ?? null}
          getGroupLabel={(id) => getLanguageDisplayName(id)}
          preferredGroupIds={getPreferredLanguageCodes(preferredAudioLanguages)}
        />

        <SubtitlePickerModal
          visible={showTextTracks}
          onClose={() => setShowTextTracks(false)}
          tracks={textTracks}
          selectedTrack={selectedTextTrack}
          onSelectTrack={handleSelectTextTrack}
          preferredLanguages={preferredSubtitleLanguages}
          currentTime={currentTime}
          delay={subtitleDelay}
          onDelayChange={onSubtitleDelayChange}
        />

        <Modal visible={showSettingsModal} onClose={handleCloseSettings} disablePadding>
          <PlaybackSettingsContent />
        </Modal>

        {activeMenu === 'streams' && (
          <PlayerMenuOverlay
            visible
            onClose={handleCloseMenus}
            title={t('streams')}
            icon="layers"
            autoFocus={false}>
            <StreamList
              type={mediaType}
              id={metaId}
              videoId={videoId}
              title={title}
              backgroundImage={backgroundImage}
              logoImage={logoImage}
              onSelectOverride={handleStreamSelect}
              selectedStreamId={streamId}
              selectedStreamUrl={currentStreamUrl}
              centered
              layout="vertical"
              autoFocus={false}
            />
          </PlayerMenuOverlay>
        )}

        {activeMenu === 'episodes' && (
          <PlayerMenuOverlay
            visible
            onClose={handleCloseMenus}
            title={t('episodes')}
            icon="albums"
            autoFocus={false}>
            <EpisodeList
              metaId={metaId}
              videos={videos ?? []}
              currentVideoId={videoId}
              onEpisodePress={handleEpisodeSelect}
              centered
              showTitle={false}
              layout="vertical"
            />
          </PlayerMenuOverlay>
        )}
      </>
    );
  }
);

PlayerControls.displayName = 'PlayerControls';
