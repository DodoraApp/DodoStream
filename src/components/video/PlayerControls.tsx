import React, { FC, useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import Slider from '@react-native-community/slider';
import { useTheme } from '@shopify/restyle';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AudioTrack, TextTrack, VideoFitMode } from '@/types/player';
import { PickerItem, PickerModal } from '@/components/basic/PickerModal';
import { SubtitlePickerModal } from '@/components/video/SubtitlePickerModal';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import {
  PLAYER_CONTROLS_AUTO_HIDE_MS,
  SKIP_BACKWARD_SECONDS,
  SKIP_FORWARD_SECONDS,
} from '@/constants/playback';
import {
  getPreferredLanguageCodes,
  normalizeLanguageCode,
  getLanguageDisplayName,
} from '@/utils/languages';
import { useDebugLogger } from '@/utils/debug';
import { ControlButton } from '@/components/video/controls/ControlButton';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { Modal } from '@/components/basic/Modal';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';

// ============================================================================
// Types
// ============================================================================

interface PlayerControlsProps {
  paused: boolean;
  currentTime: number;
  duration: number;
  showLoadingIndicator: boolean;
  title?: string;
  statistics?: Record<string, string>;
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
}

interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  isSeeking: boolean;
  seekTime: number;
}

interface SeekBarProps {
  currentTime: number;
  duration: number;
  onSeekStart: () => void;
  onSeekChange: (value: number) => void;
  onSeekEnd: (value: number) => void;
}

interface PlaybackControlsProps {
  paused: boolean;
  showLoadingIndicator: boolean;
  onPlayPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onFocusChange: () => void;
}

interface SkipEpisodeControlProps {
  showSkipEpisode: boolean;
  skipEpisodeLabel?: string;
  showLoadingIndicator: boolean;
  onSkipEpisode?: () => void;
  onFocusChange: () => void;
}

interface TrackControlsProps {
  showLoadingIndicator: boolean;
  selectedAudioTrack?: AudioTrack;
  selectedTextTrack?: TextTrack;
  hasTextTracks: boolean;
  onToggleAudioTracks: () => void;
  onToggleTextTracks: () => void;
  onFocusChange: () => void;
}

interface FitModeControlProps {
  fitMode: VideoFitMode;
  showLoadingIndicator: boolean;
  onToggleFitMode: () => void;
  onFocusChange: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// Sub-Components (Memoized for performance)
// ============================================================================

/**
 * Displays current time / duration. Only re-renders when time values change.
 */
const TimeDisplay = memo<TimeDisplayProps>(({ currentTime, duration, isSeeking, seekTime }) => {
  const displayTime = isSeeking ? seekTime : currentTime;

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="s">
      <Text variant="body" color="mainForeground" fontSize={14}>
        {formatTime(displayTime)}
      </Text>
      <Text variant="body" color="mainForeground" fontSize={14}>
        {formatTime(duration)}
      </Text>
    </Box>
  );
});

TimeDisplay.displayName = 'TimeDisplay';

/**
 * Seek bar slider. Uses internal state to prevent parent re-renders during drag.
 * Only syncs with external currentTime when not actively seeking.
 */
const SeekBar = memo<SeekBarProps>(
  ({ currentTime, duration, onSeekStart, onSeekChange, onSeekEnd }) => {
    const theme = useTheme<Theme>();
    const [internalValue, setInternalValue] = useState(currentTime);
    const isSeekingRef = useRef(false);

    // Sync internal value with external currentTime only when not seeking
    useEffect(() => {
      if (!isSeekingRef.current) {
        setInternalValue(currentTime);
      }
    }, [currentTime]);

    const handleSlidingStart = useCallback(() => {
      isSeekingRef.current = true;
      onSeekStart();
    }, [onSeekStart]);

    const handleValueChange = useCallback(
      (value: number) => {
        setInternalValue(value);
        onSeekChange(value);
      },
      [onSeekChange]
    );

    const handleSlidingComplete = useCallback(
      (value: number) => {
        isSeekingRef.current = false;
        setInternalValue(value);
        onSeekEnd(value);
      },
      [onSeekEnd]
    );

    return (
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={0}
        maximumValue={duration || 1}
        value={internalValue}
        onSlidingStart={handleSlidingStart}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={theme.colors.primaryBackground}
        maximumTrackTintColor={theme.colors.secondaryBackground}
        thumbTintColor={theme.colors.primaryBackground}
      />
    );
  }
);

SeekBar.displayName = 'SeekBar';

/**
 * Center playback controls (skip back, play/pause, skip forward).
 */
const PlaybackControls = memo<PlaybackControlsProps>(
  ({ paused, showLoadingIndicator, onPlayPause, onSkipBackward, onSkipForward, onFocusChange }) => (
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
        hasTVPreferredFocus
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

/**
 * Skip episode button (left side control).
 */
const SkipEpisodeControl = memo<SkipEpisodeControlProps>(
  ({ showSkipEpisode, skipEpisodeLabel, showLoadingIndicator, onSkipEpisode, onFocusChange }) => {
    if (!showSkipEpisode) return <Box />;

    return (
      <ControlButton
        onPress={onSkipEpisode ?? (() => {})}
        icon="skip-next"
        iconComponent={MaterialCommunityIcons}
        disabled={showLoadingIndicator || !onSkipEpisode}
        label="Skip"
        onFocusChange={onFocusChange}
        badge={skipEpisodeLabel}
        badgeVariant="tertiary"
      />
    );
  }
);

SkipEpisodeControl.displayName = 'SkipEpisodeControl';

/**
 * Audio and subtitle track controls (right side).
 */
const TrackControls = memo<TrackControlsProps>(
  ({
    showLoadingIndicator,
    selectedAudioTrack,
    selectedTextTrack,
    hasTextTracks,
    onToggleAudioTracks,
    onToggleTextTracks,
    onFocusChange,
  }) => {
    const audioBadge = selectedAudioTrack?.language
      ? (normalizeLanguageCode(selectedAudioTrack.language)?.toUpperCase() ??
        selectedAudioTrack.language.substring(0, 2).toUpperCase())
      : undefined;

    const subtitleBadge = selectedTextTrack?.language
      ? (normalizeLanguageCode(selectedTextTrack.language)?.toUpperCase() ??
        selectedTextTrack.language.substring(0, 2).toUpperCase())
      : undefined;

    return (
      <Box flexDirection="row" alignItems="center" gap="s">
        <ControlButton
          onPress={onToggleAudioTracks}
          icon="globe"
          iconComponent={Ionicons}
          disabled={showLoadingIndicator}
          onFocusChange={onFocusChange}
          label="Audio"
          badge={audioBadge}
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
            badge={subtitleBadge}
            badgeVariant="tertiary"
          />
        )}
      </Box>
    );
  }
);

TrackControls.displayName = 'TrackControls';

/**
 * Video fit mode control (contain, cover, stretch).
 */
const FitModeControl = memo<FitModeControlProps>(
  ({ fitMode, showLoadingIndicator, onToggleFitMode, onFocusChange }) => {
    const icon = (() => {
      switch (fitMode) {
        case 'cover':
          return 'fullscreen';
        case 'stretch':
          return 'arrow-expand-all';
        default:
          return 'aspect-ratio';
      }
    })();

    const label = (() => {
      switch (fitMode) {
        case 'cover':
          return 'Cover';
        case 'stretch':
          return 'Stretch';
        default:
          return 'Contain';
      }
    })();

    return (
      <ControlButton
        onPress={onToggleFitMode}
        icon={icon}
        iconComponent={MaterialCommunityIcons}
        disabled={showLoadingIndicator}
        label={label}
        onFocusChange={onFocusChange}
      />
    );
  }
);

FitModeControl.displayName = 'FitModeControl';

/**
 * Top bar with back button and title.
 */
const TopBar = memo<{
  title?: string;
  onBack: () => void;
  onOpenSettings: () => void;
}>(({ title, onBack, onOpenSettings }) => (
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
    />
  </Box>
));

TopBar.displayName = 'TopBar';

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
}) => {
  const { isPlatformTV } = useResponsiveLayout();
  const debug = useDebugLogger('PlayerControls');
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

  const [visible, setVisible] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const [showTextTracks, setShowTextTracks] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Use ref to track interaction for auto-hide without causing re-renders
  const lastInteractionRef = useRef(Date.now());

  // Notify parent when visibility changes
  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  const registerInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setVisible(true);
  }, []);

  // Build ordered audio track items (audio tracks need sorting by preference)
  const audioTrackItems = useMemo<PickerItem[]>(() => {
    const preferredCodes = getPreferredLanguageCodes(preferredAudioLanguages);
    const preferredIndexByLang = new Map<string, number>();
    preferredCodes.forEach((code, idx) => preferredIndexByLang.set(code, idx));

    return audioTracks
      .map((track, originalIndex) => {
        const languageCode = normalizeLanguageCode(track.language);
        const preferredIndex =
          languageCode && preferredIndexByLang.has(languageCode)
            ? (preferredIndexByLang.get(languageCode) as number)
            : Number.POSITIVE_INFINITY;
        return {
          preferredIndex,
          originalIndex,
          item: {
            label: track.title || track.language || `Track ${track.index + 1}`,
            value: track.index,
            groupId: languageCode ?? null,
          } satisfies PickerItem,
        };
      })
      .sort((a, b) => {
        if (a.preferredIndex !== b.preferredIndex) return a.preferredIndex - b.preferredIndex;
        return a.originalIndex - b.originalIndex;
      })
      .map((x) => x.item);
  }, [audioTracks, preferredAudioLanguages]);

  // Stable callbacks that register interaction
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
    if (!showSkipEpisode || !onSkipEpisode) return;
    registerInteraction();
    onSkipEpisode();
  }, [onSkipEpisode, registerInteraction, showSkipEpisode]);

  const handleSeekStart = useCallback(() => {
    debug('seekStart');
    registerInteraction();
    setIsSeeking(true);
    if (!paused) {
      onPlayPause();
    }
  }, [debug, paused, onPlayPause, registerInteraction]);

  const handleSeekChange = useCallback(
    (value: number) => {
      registerInteraction();
      setSeekTime(value);
    },
    [registerInteraction]
  );

  const handleSeekEnd = useCallback(
    (value: number) => {
      debug('seekEnd', { value });
      registerInteraction();
      setIsSeeking(false);
      onSeek(value);
      if (paused) {
        onPlayPause();
      }
    },
    [debug, paused, onSeek, onPlayPause, registerInteraction]
  );

  const toggleControls = useCallback(() => {
    debug('toggleControls');
    registerInteraction();
    setVisible((prev) => !prev);
  }, [debug, registerInteraction]);

  const handleToggleAudioTracks = useCallback(() => {
    registerInteraction();
    setShowAudioTracks((prev) => !prev);
  }, [registerInteraction]);

  const handleToggleTextTracks = useCallback(() => {
    registerInteraction();
    setShowTextTracks((prev) => !prev);
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

  const handleButtonFocusChange = useCallback(() => {
    registerInteraction();
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

  // Auto-hide controls after inactivity
  useEffect(() => {
    if (!visible || paused || isSeeking || showAudioTracks || showTextTracks) {
      return;
    }

    const checkInactivity = () => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= PLAYER_CONTROLS_AUTO_HIDE_MS) {
        setVisible(false);
      }
    };

    const interval = setInterval(checkInactivity, 1000);
    return () => clearInterval(interval);
  }, [visible, paused, isSeeking, showAudioTracks, showTextTracks]);

  const showControls = useCallback(() => {
    registerInteraction();
    if (isPlatformTV && !paused) {
      handlePlayPause();
    }
  }, [handlePlayPause, isPlatformTV, paused, registerInteraction]);

  // Hidden state - just show invisible pressable
  if (!visible) {
    return (
      <Pressable
        testID="player-controls-invisible-area"
        style={StyleSheet.absoluteFill}
        onPress={showControls}
        hasTVPreferredFocus>
        <Box flex={1} />
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="player-controls-overlay"
      style={StyleSheet.absoluteFill}
      onPress={toggleControls}>
      <Box flex={1} justifyContent="space-between">
        {/* Top Bar */}
        <TopBar title={title} onBack={handleBack} onOpenSettings={handleOpenSettings} />

        {/* Loading Indicator */}
        {showLoadingIndicator && (
          <Box width="100%" alignItems="center" justifyContent="center">
            <LoadingIndicator />
          </Box>
        )}

        {/* Bottom Controls */}
        <Box
          paddingHorizontal="m"
          paddingVertical="m"
          gap="s"
          backgroundColor="semiTransparentBackground">
          {/* Time Display and Seek Bar */}
          <Box>
            <TimeDisplay
              currentTime={currentTime}
              duration={duration}
              isSeeking={isSeeking}
              seekTime={seekTime}
            />
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeekStart={handleSeekStart}
              onSeekChange={handleSeekChange}
              onSeekEnd={handleSeekEnd}
            />
          </Box>

          {/* Control Buttons Row */}
          <Box flexDirection="row" alignItems="center" justifyContent="space-between">
            {/* Left: Skip Episode */}
            <Box flexDirection="row" alignItems="center" gap="s">
              <SkipEpisodeControl
                showSkipEpisode={showSkipEpisode}
                skipEpisodeLabel={skipEpisodeLabel}
                showLoadingIndicator={showLoadingIndicator}
                onSkipEpisode={handleSkipEpisode}
                onFocusChange={handleButtonFocusChange}
              />
              <FitModeControl
                fitMode={fitMode}
                showLoadingIndicator={showLoadingIndicator}
                onToggleFitMode={handleToggleFitMode}
                onFocusChange={handleButtonFocusChange}
              />
            </Box>

            {/* Center: Playback Controls */}
            <PlaybackControls
              paused={paused}
              showLoadingIndicator={showLoadingIndicator}
              onPlayPause={handlePlayPause}
              onSkipBackward={handleSkipBackward}
              onSkipForward={handleSkipForward}
              onFocusChange={handleButtonFocusChange}
            />

            {/* Right: Track Controls */}
            <TrackControls
              showLoadingIndicator={showLoadingIndicator}
              selectedAudioTrack={selectedAudioTrack}
              selectedTextTrack={selectedTextTrack}
              hasTextTracks={textTracks.length > 0}
              onToggleAudioTracks={handleToggleAudioTracks}
              onToggleTextTracks={handleToggleTextTracks}
              onFocusChange={handleButtonFocusChange}
            />
          </Box>
        </Box>

        {/* Audio Track Selector Modal */}
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

        {/* Subtitle Picker Modal with Sync Controls */}
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

        <Modal visible={showSettingsModal} onClose={handleCloseSettings}>
          <Box backgroundColor="cardBackground" borderRadius="l">
            <PlaybackSettingsContent />
          </Box>
        </Modal>
      </Box>
    </Pressable>
  );
};
