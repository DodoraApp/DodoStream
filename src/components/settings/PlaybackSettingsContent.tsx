import { FC, memo, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { PickerModal, PickerItem } from '@/components/basic/PickerModal';
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
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_STYLE_PRESETS } from '@/constants/subtitles';
import type { SubtitleStylePreset } from '@/types/subtitles';
import { SubtitleStyleSettings } from '@/components/settings/SubtitleStyleSettings';

/**
 * Playback settings content component
 * Extracted for use in both standalone page and split layout
 */
export const PlaybackSettingsContent: FC = memo(() => {
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [showAudioLanguagePicker, setShowAudioLanguagePicker] = useState(false);
  const [showSubtitleLanguagePicker, setShowSubtitleLanguagePicker] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const {
    player,
    automaticFallback,
    autoPlayFirstStream,
    preferredAudioLanguages,
    preferredSubtitleLanguages,
    subtitleStyle,
    setPlayerForProfile,
    setAutomaticFallbackForProfile,
    setAutoPlayFirstStreamForProfile,
    setPreferredAudioLanguagesForProfile,
    setPreferredSubtitleLanguagesForProfile,
    setSubtitleStyleForProfile,
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
    preferredAudioLanguages: activeProfileId
      ? (state.byProfile[activeProfileId]?.preferredAudioLanguages ?? [])
      : [],
    preferredSubtitleLanguages: activeProfileId
      ? (state.byProfile[activeProfileId]?.preferredSubtitleLanguages ?? [])
      : [],
    subtitleStyle:
      (activeProfileId ? state.byProfile[activeProfileId]?.subtitleStyle : undefined) ??
      DEFAULT_SUBTITLE_STYLE,
    setPlayerForProfile: state.setPlayerForProfile,
    setAutomaticFallbackForProfile: state.setAutomaticFallbackForProfile,
    setAutoPlayFirstStreamForProfile: state.setAutoPlayFirstStreamForProfile,
    setPreferredAudioLanguagesForProfile: state.setPreferredAudioLanguagesForProfile,
    setPreferredSubtitleLanguagesForProfile: state.setPreferredSubtitleLanguagesForProfile,
    setSubtitleStyleForProfile: state.setSubtitleStyleForProfile,
  }));

  // Find current preset (if any matches)
  const currentPreset = useMemo(
    () =>
      SUBTITLE_STYLE_PRESETS.find((p) => JSON.stringify(p.style) === JSON.stringify(subtitleStyle)),
    [subtitleStyle]
  );
  const currentPresetLabel = currentPreset?.label ?? 'Custom';
  const currentPresetValue: SubtitleStylePreset | 'custom' = currentPreset?.id ?? 'custom';

  // Preset picker items including "Custom" option
  const presetPickerItems: PickerItem<SubtitleStylePreset | 'custom'>[] = useMemo(
    () => [
      ...SUBTITLE_STYLE_PRESETS.map((p) => ({ label: p.label, value: p.id })),
      { label: 'Custom', value: 'custom' as const },
    ],
    []
  );

  const handlePresetChange = (value: SubtitleStylePreset | 'custom') => {
    if (value === 'custom' || !activeProfileId) return;
    const preset = SUBTITLE_STYLE_PRESETS.find((p) => p.id === value);
    if (preset) {
      setSubtitleStyleForProfile(activeProfileId, preset.style);
    }
  };

  const deviceLanguageCodes = getDevicePreferredLanguageCodes();
  const availableLanguageCodes = Array.from(
    new Set([...deviceLanguageCodes, ...COMMON_LANGUAGE_CODES])
  );

  const renderLanguageSummary = (codes: string[]) => {
    if (!codes || codes.length === 0) return 'Device default';
    return codes.join(', ');
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Box paddingVertical="m" paddingHorizontal="m" gap="l">
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
                  <Text variant="body">{player === 'exoplayer' ? 'ExoPlayer' : 'VLC'}</Text>
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

          <SettingsCard title="Subtitles">
            <SettingsRow label="Preset" description="Apply a predefined subtitle style">
              <TouchableOpacity onPress={() => setShowPresetPicker(true)}>
                <Box
                  backgroundColor="inputBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  minWidth={140}>
                  <Ionicons name="color-palette" size={20} color={theme.colors.textSecondary} />
                  <Text variant="body">{currentPresetLabel}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </Box>
              </TouchableOpacity>
            </SettingsRow>

            {/* Subtitle Style Preview and Settings */}
            <SubtitleStyleSettings />
          </SettingsCard>
        </Box>
      </ScrollView>

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

      <PickerModal
        visible={showPresetPicker}
        onClose={() => setShowPresetPicker(false)}
        label="Select Preset"
        icon="color-palette"
        items={presetPickerItems}
        selectedValue={currentPresetValue}
        onValueChange={handlePresetChange}
      />
    </>
  );
});
