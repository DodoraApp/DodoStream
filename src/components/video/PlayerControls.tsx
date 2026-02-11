import React, { FC, useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { StyleSheet, Pressable, Platform, useTVEventHandler, HWEvent } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import Slider from '@react-native-community/slider';
import { useTheme } from '@shopify/restyle';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AudioTrack, TextTrack, VideoFitMode } from '@/types/player';
import { Modal } from '@/components/basic/Modal';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';
import { PickerModal } from '@/components/basic/PickerModal';
import { SubtitlePickerModal } from '@/components/video/SubtitlePickerModal';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { SKIP_BACKWARD_SECONDS, SKIP_FORWARD_SECONDS } from '@/constants/playback';
import { getPreferredLanguageCodes, getLanguageDisplayName } from '@/utils/languages';
import { formatPlaybackTime } from '@/utils/format';
import { sortAudioTracksByPreference, getTrackBadge } from '@/utils/tracks';
import { ControlButton } from '@/components/video/controls/ControlButton';
import { TVSeekBar } from '@/components/video/TVSeekBar';
import { SkipIntroButton } from '@/components/video/SkipIntroButton';
import { usePlayerSeek } from '@/hooks/usePlayerSeek';
import { useControlsVisibility } from '@/hooks/useControlsVisibility';
import type { IntroData } from '@/types/introdb';

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
}

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

const getFitModeLabel = (fitMode: VideoFitMode): string => {
  switch (fitMode) {
    case 'cover':
      return 'Cover';
    case 'stretch':
      return 'Stretch';
    default:
      return 'Contain';
  }
};

// ============================================================================
// Sub-Components (memoized for performance)
// ============================================================================

interface TopBarProps {
  title?: string;
  onBack: () => void;
  onOpenSettings: () => void;
}

const TopBar = memo<TopBarProps>(({ title, onBack, onOpenSettings }) => (
  <Box flexDirection="row" alignItems="center" paddingHorizontal="l" paddingVertical="m" gap="m">
    <ControlButton onPress={onBack} icon="arrow-back" iconComponent={Ionicons} />
    <Box flex={1}>
      <Text variant="cardTitle" color="mainForeground" numberOfLines={1}>
        {title || 'Play'}
      </Text>
    </Box>
    <ControlButton
      onPress={onOpenSettings}
      icon="settings"
      iconComponent={Ionicons}
      label="Settings"
      labelPosition="bottom"
    />
  </Box>
));
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
  showSkipEpisode: boolean;
  skipEpisodeLabel?: string;
  showLoadingIndicator: boolean;
  onSkipEpisode: () => void;
  fitMode: VideoFitMode;
  onToggleFitMode: () => void;
  onFocusChange: () => void;
}

const LeftControls = memo<LeftControlsProps>(
  ({
    showSkipEpisode,
    skipEpisodeLabel,
    showLoadingIndicator,
    onSkipEpisode,
    fitMode,
    onToggleFitMode,
    onFocusChange,
  }) => (
    <Box flexDirection="row" alignItems="center" gap="s">
      {showSkipEpisode && (
        <ControlButton
          onPress={onSkipEpisode}
          icon="skip-next"
          iconComponent={MaterialCommunityIcons}
          disabled={showLoadingIndicator}
          label="Skip"
          onFocusChange={onFocusChange}
          badge={skipEpisodeLabel}
          badgeVariant="tertiary"
        />
      )}
      <ControlButton
        onPress={onToggleFitMode}
        icon={getFitModeIcon(fitMode)}
        iconComponent={MaterialCommunityIcons}
        disabled={showLoadingIndicator}
        label={getFitModeLabel(fitMode)}
        onFocusChange={onFocusChange}
      />
    </Box>
  )
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
  }) => (
    <Box flexDirection="row" alignItems="center" gap="s">
      <ControlButton
        onPress={onSkipBackward}
        icon="rotate-left"
        iconComponent={MaterialCommunityIcons}
        disabled={showLoadingIndicator}
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
        label={paused ? 'Play' : 'Pause'}
      />
      <ControlButton
        onPress={onSkipForward}
        icon="rotate-right"
        iconComponent={MaterialCommunityIcons}
        disabled={showLoadingIndicator}
        label={`+${SKIP_FORWARD_SECONDS}s`}
        onFocusChange={onFocusChange}
      />
    </Box>
  )
);
PlaybackControls.displayName = 'PlaybackControls';

interface RightControlsProps {
  showLoadingIndicator: boolean;
  hasTextTracks: boolean;
  selectedAudioLanguage?: string;
  selectedTextLanguage?: string;
  onToggleAudioTracks: () => void;
  onToggleTextTracks: () => void;
  onFocusChange: () => void;
}

const RightControls = memo<RightControlsProps>(
  ({
    showLoadingIndicator,
    hasTextTracks,
    selectedAudioLanguage,
    selectedTextLanguage,
    onToggleAudioTracks,
    onToggleTextTracks,
    onFocusChange,
  }) => (
    <Box flexDirection="row" alignItems="center" gap="s">
      <ControlButton
        onPress={onToggleAudioTracks}
        icon="globe"
        iconComponent={Ionicons}
        disabled={showLoadingIndicator}
        onFocusChange={onFocusChange}
        label="Audio"
        badge={getTrackBadge(selectedAudioLanguage)}
        badgeVariant="tertiary"
      />
      {hasTextTracks && (
        <ControlButton
          onPress={onToggleTextTracks}
          icon="subtitles"
          iconComponent={MaterialCommunityIcons}
          disabled={showLoadingIndicator}
          onFocusChange={onFocusChange}
          label="Subtitles"
          badge={getTrackBadge(selectedTextLanguage)}
          badgeVariant="tertiary"
        />
      )}
    </Box>
  )
);
RightControls.displayName = 'RightControls';

// ============================================================================
// Main Component
// ============================================================================

export const PlayerControls: FC<PlayerControlsProps> = ({
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
}) => {
  const theme = useTheme<Theme>();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { preferredAudioLanguages, preferredSubtitleLanguages } = useProfileSettingsStore(
    (state) => ({
      preferredAudioLanguages: activeProfileId
        ? state.byProfile[activeProfileId]?.preferredAudioLanguages
        : undefined,
      preferredSubtitleLanguages: activeProfileId
        ? state.byProfile[activeProfileId]?.preferredSubtitleLanguages
        : undefined,
    })
  );

  // Modal state
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const [showTextTracks, setShowTextTracks] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const isModalOpen = showAudioTracks || showTextTracks || showSettingsModal;

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

  const { visible, registerInteraction, showControls, toggleControls } = useControlsVisibility({
    paused,
    isSeeking,
    isModalOpen,
    onVisibilityChange,
  });

  const showSkipIntroButton = introData && !introSkipped;

  // Listen for TV D-pad events when controls are hidden to determine focus target
  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      if (!visible) {
        if (event.eventType === 'up' || event.eventType === 'down') {
          setFocusTarget('play-pause');
          showControls();
        } else if (event.eventType === 'left' || event.eventType === 'right') {
          setFocusTarget('seek');
          showControls();
        } else if (event.eventType === 'select') {
          // Don't intercept select if Skip Intro button is showing - let it handle the press
          if (!showSkipIntroButton) {
            setFocusTarget('play-pause');
            showControls();
          }
        }
      }
    },
    [visible, showControls, showSkipIntroButton]
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
  }, [registerInteraction]);

  const handleToggleTextTracks = useCallback(() => {
    registerInteraction();
    setShowTextTracks((prev) => !prev);
  }, [registerInteraction]);

  const handleToggleFitMode = useCallback(() => {
    registerInteraction();
    onToggleFitMode();
  }, [onToggleFitMode, registerInteraction]);

  const handleOpenSettings = useCallback(() => {
    registerInteraction();
    setShowSettingsModal(true);
  }, [registerInteraction]);

  const handleCloseSettings = useCallback(() => {
    registerInteraction();
    setShowSettingsModal(false);
  }, [registerInteraction]);

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

  // When hidden, render minimal touchable area + skip intro button
  if (!visible) {
    return (
      <>
        <Pressable
          testID="player-controls-invisible-area"
          style={StyleSheet.absoluteFill}
          onPress={showControls}
          hasTVPreferredFocus={!showSkipIntroButton}
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
    <Pressable
      testID="player-controls-overlay"
      style={StyleSheet.absoluteFill}
      onPress={toggleControls}>
      <Box flex={1} justifyContent="space-between">
        <TopBar title={title} onBack={handleBack} onOpenSettings={handleOpenSettings} />

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

        {/* Bottom Controls */}
        <Box
          paddingHorizontal="m"
          paddingVertical="m"
          gap="s"
          style={{ backgroundColor: theme.colors.semiTransparentBackground }}>
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
            <LeftControls
              showSkipEpisode={showSkipEpisode}
              skipEpisodeLabel={skipEpisodeLabel}
              showLoadingIndicator={showLoadingIndicator}
              onSkipEpisode={handleSkipEpisode}
              fitMode={fitMode}
              onToggleFitMode={handleToggleFitMode}
              onFocusChange={handleButtonFocusChange}
            />

            <PlaybackControls
              paused={paused}
              showLoadingIndicator={showLoadingIndicator}
              onPlayPause={handlePlayPause}
              onSkipBackward={handleSkipBackward}
              onSkipForward={handleSkipForward}
              onFocusChange={handleButtonFocusChange}
              hasTVPreferredFocus={focusTarget === 'play-pause'}
            />

            <RightControls
              showLoadingIndicator={showLoadingIndicator}
              hasTextTracks={textTracks.length > 0}
              selectedAudioLanguage={selectedAudioTrack?.language}
              selectedTextLanguage={selectedTextTrack?.language}
              onToggleAudioTracks={handleToggleAudioTracks}
              onToggleTextTracks={handleToggleTextTracks}
              onFocusChange={handleButtonFocusChange}
            />
          </Box>
        </Box>

        {/* Modals */}
        <PickerModal
          visible={showAudioTracks}
          onClose={() => setShowAudioTracks(false)}
          label="Select Audio Track"
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
      </Box>
    </Pressable>
  );
};
