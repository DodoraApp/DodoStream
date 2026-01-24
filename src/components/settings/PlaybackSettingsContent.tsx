import { FC, memo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { PickerModal } from '@/components/basic/PickerModal';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { LanguagePreferenceModal } from '@/components/settings/LanguagePreferenceModal';
import {
  DEFAULT_PROFILE_PLAYBACK_SETTINGS,
  useProfileSettingsStore,
} from '@/store/profile-settings.store';
import type { PlayerType } from '@/types/player';
import { useProfileStore } from '@/store/profile.store';
import { PLAYER_PICKER_ITEMS } from '@/constants/playback';
import { COMMON_LANGUAGE_CODES } from '@/constants/languages';
import { getDevicePreferredLanguageCodes } from '@/utils/languages';

export interface PlaybackSettingsContentProps {
  /** Whether to show the player selection section (default: true) */
  showPlayerSelection?: boolean;
  /** Whether to show the language preferences section (default: true) */
  showLanguages?: boolean;
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

/**
 * Playback settings content component
 * Extracted for use in both standalone page and split layout
 */
export const PlaybackSettingsContent: FC<PlaybackSettingsContentProps> = memo(
  ({ showPlayerSelection = true, showLanguages = true, scrollable = true }) => {
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const [showAudioLanguagePicker, setShowAudioLanguagePicker] = useState(false);
    const [showSubtitleLanguagePicker, setShowSubtitleLanguagePicker] = useState(false);
    const activeProfileId = useProfileStore((state) => state.activeProfileId);

    const {
      player,
      automaticFallback,
      autoPlayFirstStream,
      showVideoStatistics,
      preferredAudioLanguages,
      preferredSubtitleLanguages,
      tunneled,
      audioPassthrough,
      enableWorkarounds,
      matchFrameRate,
      enableVideoSoftwareDecoding,
      setPlayerForProfile,
      setAutomaticFallbackForProfile,
      setAutoPlayFirstStreamForProfile,
      setShowVideoStatisticsForProfile,
      setPreferredAudioLanguagesForProfile,
      setPreferredSubtitleLanguagesForProfile,
      setTunneledForProfile,
      setAudioPassthroughForProfile,
      setEnableWorkaroundsForProfile,
      setMatchFrameRateForProfile,
      setEnableVideoSoftwareDecodingForProfile,
    } = useProfileSettingsStore((state) => ({
      player:
        (activeProfileId ? state.byProfile[activeProfileId]?.player : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.player,
      automaticFallback:
        (activeProfileId ? state.byProfile[activeProfileId]?.automaticFallback : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.automaticFallback,
      autoPlayFirstStream:
        (activeProfileId ? state.byProfile[activeProfileId]?.autoPlayFirstStream : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.autoPlayFirstStream,
      showVideoStatistics:
        (activeProfileId ? state.byProfile[activeProfileId]?.showVideoStatistics : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.showVideoStatistics,
      preferredAudioLanguages: activeProfileId
        ? (state.byProfile[activeProfileId]?.preferredAudioLanguages ?? [])
        : [],
      preferredSubtitleLanguages: activeProfileId
        ? (state.byProfile[activeProfileId]?.preferredSubtitleLanguages ?? [])
        : [],
      tunneled:
        (activeProfileId ? state.byProfile[activeProfileId]?.tunneled : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.tunneled,
      audioPassthrough:
        (activeProfileId ? state.byProfile[activeProfileId]?.audioPassthrough : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.audioPassthrough,
      enableWorkarounds:
        (activeProfileId ? state.byProfile[activeProfileId]?.enableWorkarounds : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableWorkarounds,
      matchFrameRate:
        (activeProfileId ? state.byProfile[activeProfileId]?.matchFrameRate : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.matchFrameRate,
      enableVideoSoftwareDecoding:
        (activeProfileId
          ? state.byProfile[activeProfileId]?.enableVideoSoftwareDecoding
          : undefined) ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableVideoSoftwareDecoding,
      setPlayerForProfile: state.setPlayerForProfile,
      setAutomaticFallbackForProfile: state.setAutomaticFallbackForProfile,
      setAutoPlayFirstStreamForProfile: state.setAutoPlayFirstStreamForProfile,
      setShowVideoStatisticsForProfile: state.setShowVideoStatisticsForProfile,
      setPreferredAudioLanguagesForProfile: state.setPreferredAudioLanguagesForProfile,
      setPreferredSubtitleLanguagesForProfile: state.setPreferredSubtitleLanguagesForProfile,
      setTunneledForProfile: state.setTunneledForProfile,
      setAudioPassthroughForProfile: state.setAudioPassthroughForProfile,
      setEnableWorkaroundsForProfile: state.setEnableWorkaroundsForProfile,
      setMatchFrameRateForProfile: state.setMatchFrameRateForProfile,
      setEnableVideoSoftwareDecodingForProfile: state.setEnableVideoSoftwareDecodingForProfile,
    }));

    const deviceLanguageCodes = getDevicePreferredLanguageCodes();
    const availableLanguageCodes = Array.from(
      new Set([...deviceLanguageCodes, ...COMMON_LANGUAGE_CODES])
    );

    const renderLanguageSummary = (codes: string[]) => {
      if (!codes || codes.length === 0) return 'Device default';
      return codes.join(', ');
    };

    const content = (
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        {showPlayerSelection && (
          <SettingsCard title="Playback">
            <SettingsRow label="Player">
              <TouchableOpacity onPress={() => setShowPlayerPicker(true)}>
                <Box
                  backgroundColor="inputBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  minWidth={140}>
                  <Ionicons name="play" size={20} color={theme.colors.textSecondary} />
                  <Text variant="body">
                    {PLAYER_PICKER_ITEMS.find((item) => item.value === player)?.label || 'Unknown'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </Box>
              </TouchableOpacity>
            </SettingsRow>

            <SettingsSwitch
              label="Automatic Fallback"
              description="Automatically switch to another player if playback fails"
              value={automaticFallback}
              onValueChange={(value) =>
                activeProfileId && setAutomaticFallbackForProfile(activeProfileId, value)
              }
            />
            <SettingsSwitch
              label="Auto Play First Stream"
              description="Automatically play the first stream returned"
              value={autoPlayFirstStream}
              onValueChange={(value) =>
                activeProfileId && setAutoPlayFirstStreamForProfile(activeProfileId, value)
              }
            />
          </SettingsCard>
        )}

        <SettingsCard title="Android & ExoPlayer">
          <Text variant="caption" color="textSecondary">
            Advanced settings for Android ExoPlayer
          </Text>
          <SettingsSwitch
            label="Tunneled Playback"
            description="Use tunneled video playback mode for better performance on some devices"
            value={tunneled}
            onValueChange={(value) =>
              activeProfileId && setTunneledForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label="Audio Passthrough"
            description="Enable audio passthrough for surround sound (recommended for TV)"
            value={audioPassthrough}
            onValueChange={(value) =>
              activeProfileId && setAudioPassthroughForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label="Enable Workarounds"
            description="Apply compatibility workarounds for certain video formats"
            value={enableWorkarounds}
            onValueChange={(value) =>
              activeProfileId && setEnableWorkaroundsForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label="Match Frame Rate"
            description="Automatically match screen refresh rate and resolution to video (supported TV devices only)"
            value={matchFrameRate}
            onValueChange={(value) =>
              activeProfileId && setMatchFrameRateForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label="Software Video Decoding"
            description="Use software decoder instead of hardware (may help with compatibility issues but uses more CPU, not recommended on low-end devices such as streaming sticks, set-top boxes and older phones). Disable this if you experience playback stuttering."
            value={enableVideoSoftwareDecoding}
            onValueChange={(value) =>
              activeProfileId && setEnableVideoSoftwareDecodingForProfile(activeProfileId, value)
            }
          />
        </SettingsCard>

        <SettingsCard title="Diagnostics">
          <SettingsSwitch
            label="Show video statistics"
            description="Display a live stats overlay during playback"
            value={showVideoStatistics}
            onValueChange={(value) =>
              activeProfileId && setShowVideoStatisticsForProfile(activeProfileId, value)
            }
          />
        </SettingsCard>

        {showLanguages && (
          <SettingsCard title="Languages">
            <SettingsRow
              label="Preferred audio languages"
              description="The first available one is used">
              <TouchableOpacity onPress={() => setShowAudioLanguagePicker(true)}>
                <Box
                  backgroundColor="inputBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  minWidth={180}>
                  <Ionicons name="volume-high" size={20} color={theme.colors.textSecondary} />
                  <Text variant="body" numberOfLines={1} style={{ maxWidth: 260 }}>
                    {renderLanguageSummary(preferredAudioLanguages)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </Box>
              </TouchableOpacity>
            </SettingsRow>

            <SettingsRow
              label="Preferred subtitle languages"
              description="Shown first in the subtitle selector">
              <TouchableOpacity onPress={() => setShowSubtitleLanguagePicker(true)}>
                <Box
                  backgroundColor="inputBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  minWidth={180}>
                  <Ionicons name="text" size={20} color={theme.colors.textSecondary} />
                  <Text variant="body" numberOfLines={1} style={{ maxWidth: 260 }}>
                    {renderLanguageSummary(preferredSubtitleLanguages)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </Box>
              </TouchableOpacity>
            </SettingsRow>
          </SettingsCard>
        )}
      </Box>
    );

    const scrollableContent = scrollable ? (
      <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
    ) : (
      content
    );

    return (
      <>
        {scrollableContent}

        {showPlayerSelection && (
          <PickerModal
            visible={showPlayerPicker}
            onClose={() => setShowPlayerPicker(false)}
            label="Select Player"
            icon="play"
            items={PLAYER_PICKER_ITEMS}
            selectedValue={player}
            onValueChange={(value: PlayerType) =>
              activeProfileId && setPlayerForProfile(activeProfileId, value)
            }
          />
        )}

        {showLanguages && (
          <>
            <LanguagePreferenceModal
              visible={showAudioLanguagePicker}
              onClose={() => setShowAudioLanguagePicker(false)}
              title="Preferred audio languages"
              selectedLanguageCodes={preferredAudioLanguages}
              availableLanguageCodes={availableLanguageCodes}
              onChange={(next) =>
                activeProfileId && setPreferredAudioLanguagesForProfile(activeProfileId, next)
              }
            />

            <LanguagePreferenceModal
              visible={showSubtitleLanguagePicker}
              onClose={() => setShowSubtitleLanguagePicker(false)}
              title="Preferred subtitle languages"
              selectedLanguageCodes={preferredSubtitleLanguages}
              availableLanguageCodes={availableLanguageCodes}
              onChange={(next) =>
                activeProfileId && setPreferredSubtitleLanguagesForProfile(activeProfileId, next)
              }
            />
          </>
        )}
      </>
    );
  }
);
