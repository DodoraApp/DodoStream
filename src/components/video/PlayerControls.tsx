import React, { FC, useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import Slider from '@react-native-community/slider';
import { useTheme } from '@shopify/restyle';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AudioTrack, TextTrack } from '@/types/player';
import { PickerItem, PickerModal } from '@/components/basic/PickerModal';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { PLAYER_CONTROLS_AUTO_HIDE_MS } from '@/constants/playback';
import {
  getPreferredLanguageCodes,
  normalizeLanguageCode,
  getLanguageDisplayName,
} from '@/utils/languages';
import { useDebugLogger } from '@/utils/debug';
import { ControlButton } from '@/components/video/controls/ControlButton'; // import { getVideoSessionId } from '@/utils/stream';

interface PlayerControlsProps {
  // Playback state
  paused: boolean;
  currentTime: number;
  duration: number;
  showLoadingIndicator: boolean;

  // Title
  title?: string;

  // Tracks
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  selectedAudioTrack?: AudioTrack;
  selectedTextTrack?: TextTrack;

  // Callbacks
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
}

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
}) => {
  const theme = useTheme<Theme>();
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
  const [interactionId, setInteractionId] = useState(0);

  const registerInteraction = useCallback(() => {
    setInteractionId((prev) => prev + 1);
    setVisible(true);
  }, []);

  const buildOrderedTrackItems = useCallback(
    <T extends { index: number; title?: string; language?: string }>(
      tracks: T[],
      preferredLanguageCodes: string[]
    ): PickerItem[] => {
      const preferredIndexByLang = new Map<string, number>();
      preferredLanguageCodes.forEach((code, idx) => preferredIndexByLang.set(code, idx));

      return tracks
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
    },
    []
  );

  // Convert tracks to picker items, ordered by preferred languages first
  const audioTrackItems = useMemo<PickerItem[]>(() => {
    const preferred = getPreferredLanguageCodes(preferredAudioLanguages);
    return buildOrderedTrackItems(audioTracks, preferred);
  }, [audioTracks, buildOrderedTrackItems, preferredAudioLanguages]);

  const textTrackItems = useMemo<PickerItem[]>(() => {
    const preferred = getPreferredLanguageCodes(preferredSubtitleLanguages);
    return [{ label: 'None', value: -1 }, ...buildOrderedTrackItems(textTracks, preferred)];
  }, [buildOrderedTrackItems, preferredSubtitleLanguages, textTracks]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    if (visible && !paused && !isSeeking && !showAudioTracks && !showTextTracks) {
      const timeout = setTimeout(() => {
        setVisible(false);
      }, PLAYER_CONTROLS_AUTO_HIDE_MS);
      return () => clearTimeout(timeout);
    }
  }, [visible, paused, isSeeking, showAudioTracks, showTextTracks, interactionId]);

  const showControls = useCallback(() => {
    registerInteraction();
  }, [registerInteraction]);

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
    if (!showSkipEpisode || !onSkipEpisode) return;
    registerInteraction();
    onSkipEpisode();
  }, [onSkipEpisode, registerInteraction, showSkipEpisode]);

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

  const handleSeekStart = useCallback(() => {
    debug('seekStart');
    registerInteraction();
    setIsSeeking(true);
    if (!paused) {
      onPlayPause(); // Pause video while seeking
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
        onPlayPause(); // Resume video after seeking
      }
    },
    [debug, paused, onSeek, onPlayPause, registerInteraction]
  );

  const toggleControls = useCallback(() => {
    debug('toggleControls');
    registerInteraction();
    setVisible(!visible);
  }, [debug, registerInteraction, visible]);

  if (!visible) {
    // Invisible touchable area to show controls
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
        <Box
          flexDirection="row"
          alignItems="center"
          paddingHorizontal="l"
          paddingVertical="m"
          gap="m">
          <ControlButton onPress={handleBack} icon="arrow-back" iconComponent={Ionicons} />
          <Text
            variant="cardTitle"
            color="mainForeground"
            numberOfLines={1}
            style={{ flex: 1, fontFamily: 'Outfit_700Bold' }}>
            {title || 'Play'}
          </Text>
        </Box>
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
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
          }}>
          <Box>
            {/* Time Display */}
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal="s">
              <Text variant="body" color="mainForeground" fontSize={14}>
                {isSeeking ? formatTime(seekTime) : formatTime(currentTime)}
              </Text>
              <Text variant="body" color="mainForeground" fontSize={14}>
                {formatTime(duration)}
              </Text>
            </Box>

            {/* Seek Bar - Full Width */}
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={duration || 0}
              value={currentTime}
              onSlidingStart={handleSeekStart}
              onValueChange={handleSeekChange}
              onSlidingComplete={handleSeekEnd}
              minimumTrackTintColor={theme.colors.primaryBackground}
              maximumTrackTintColor={theme.colors.secondaryBackground}
              thumbTintColor={theme.colors.primaryBackground}
            />
          </Box>

          {/* Control Buttons */}
          <Box flexDirection="row" alignItems="center" justifyContent="space-between">
            {/* Left side: Skip Episode */}
            <Box>
              {showSkipEpisode && (
                <ControlButton
                  onPress={handleSkipEpisode}
                  icon="skip-next"
                  iconComponent={MaterialCommunityIcons}
                  disabled={showLoadingIndicator || !onSkipEpisode}
                  label={skipEpisodeLabel}
                  onFocusChange={handleButtonFocusChange}
                />
              )}
            </Box>
            {/* Center: Playback controls */}
            <Box flexDirection="row" alignItems="center" gap="s">
              <ControlButton
                onPress={handleSkipBackward}
                icon="rotate-left"
                iconComponent={MaterialCommunityIcons}
                disabled={showLoadingIndicator}
                label="-15s"
                onFocusChange={handleButtonFocusChange}
              />
              <ControlButton
                onPress={handlePlayPause}
                icon={paused ? 'play' : 'pause'}
                iconComponent={Ionicons}
                disabled={showLoadingIndicator}
                hasTVPreferredFocus
                onFocusChange={handleButtonFocusChange}
                variant="primary"
                label={paused ? 'Play' : 'Pause'}
              />
              <ControlButton
                onPress={handleSkipForward}
                icon="rotate-right"
                iconComponent={MaterialCommunityIcons}
                disabled={showLoadingIndicator}
                label="+15s"
                onFocusChange={handleButtonFocusChange}
              />
            </Box>

            {/* Right side: Audio and subtitle controls */}
            <Box flexDirection="row" alignItems="center" gap="s">
              <ControlButton
                onPress={() => {
                  registerInteraction();
                  setShowAudioTracks(!showAudioTracks);
                }}
                icon="globe"
                iconComponent={Ionicons}
                disabled={showLoadingIndicator}
                onFocusChange={handleButtonFocusChange}
                label="Audio"
              />
              {textTracks.length > 0 && (
                <ControlButton
                  onPress={() => {
                    registerInteraction();
                    setShowTextTracks(!showTextTracks);
                  }}
                  icon="subtitles"
                  iconComponent={MaterialCommunityIcons}
                  disabled={showLoadingIndicator}
                  onFocusChange={handleButtonFocusChange}
                  label="Subtitles"
                />
              )}
            </Box>
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
          onValueChange={(value) => {
            registerInteraction();
            onSelectAudioTrack(Number(value));
          }}
          getItemGroupId={(item) => item.groupId ?? null}
          getGroupLabel={(id) => getLanguageDisplayName(id)}
          preferredGroupIds={getPreferredLanguageCodes(preferredAudioLanguages)}
        />

        {/* Text Track Selector Modal */}
        <PickerModal
          visible={showTextTracks}
          onClose={() => setShowTextTracks(false)}
          label="Select Subtitles"
          icon="text"
          items={textTrackItems}
          selectedValue={selectedTextTrack?.index ?? -1}
          onValueChange={(value) => {
            registerInteraction();
            const numericValue = typeof value === 'number' ? value : Number(value);
            onSelectTextTrack(numericValue === -1 ? undefined : numericValue);
          }}
          getItemGroupId={(item) => item.groupId ?? null}
          getGroupLabel={(id) => (id === 'none' ? 'None' : getLanguageDisplayName(id))}
          preferredGroupIds={getPreferredLanguageCodes(preferredSubtitleLanguages)}
        />
      </Box>
    </Pressable>
  );
};
