import { FC, memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { PickerModal, PickerItem } from '@/components/basic/PickerModal';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_STYLE_PRESETS } from '@/constants/subtitles';
import type { SubtitleStylePreset } from '@/types/subtitles';
import {
  SubtitleStyleControls,
  SubtitleStylePreview,
} from '@/components/settings/SubtitleStyleSettings';

export const SubtitlesSettingsContent: FC = memo(() => {
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { subtitleStyle, setSubtitleStyleForProfile } = useProfileSettingsStore((state) => ({
    subtitleStyle:
      (activeProfileId ? state.byProfile[activeProfileId]?.subtitleStyle : undefined) ??
      DEFAULT_SUBTITLE_STYLE,
    setSubtitleStyleForProfile: state.setSubtitleStyleForProfile,
  }));

  const currentPreset = useMemo(
    () =>
      SUBTITLE_STYLE_PRESETS.find((p) => JSON.stringify(p.style) === JSON.stringify(subtitleStyle)),
    [subtitleStyle]
  );

  const currentPresetLabel = currentPreset?.label ?? 'Custom';
  const currentPresetValue: SubtitleStylePreset | 'custom' = currentPreset?.id ?? 'custom';

  const presetPickerItems: PickerItem<SubtitleStylePreset | 'custom'>[] = useMemo(
    () => [
      ...SUBTITLE_STYLE_PRESETS.map((p) => ({ label: p.label, value: p.id })),
      { label: 'Custom', value: 'custom' as const },
    ],
    []
  );

  const handlePresetChange = useCallback(
    (value: SubtitleStylePreset | 'custom') => {
      if (value === 'custom' || !activeProfileId) return;
      const preset = SUBTITLE_STYLE_PRESETS.find((p) => p.id === value);
      if (preset) {
        setSubtitleStyleForProfile(activeProfileId, preset.style);
      }
    },
    [activeProfileId, setSubtitleStyleForProfile]
  );

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentInsetAdjustmentBehavior="automatic">
        {/* Sticky Preview */}
        <Box backgroundColor="mainBackground" paddingHorizontal="m" paddingTop="m">
          <SubtitleStylePreview />
        </Box>

        {/* Settings */}
        <Box paddingVertical="m" paddingHorizontal="m" gap="l">
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

            <SubtitleStyleControls />
          </SettingsCard>
        </Box>
      </ScrollView>

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

SubtitlesSettingsContent.displayName = 'SubtitlesSettingsContent';
