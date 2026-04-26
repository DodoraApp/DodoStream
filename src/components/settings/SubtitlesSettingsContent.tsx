import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { PickerItem } from '@/components/basic/PickerModal';
import { useProfileStore } from '@/store/profile.store';
import { usePlaybackStore } from '@/store/playback.store';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_STYLE_PRESETS } from '@/constants/subtitles';
import type { SubtitleStylePreset } from '@/types/subtitles';
import {
  SubtitleStyleControls,
  SubtitleStylePreview,
} from '@/components/settings/SubtitleStyleSettings';
import { PickerInput } from '@/components/basic/PickerInput';

export const SubtitlesSettingsContent: FC = memo(() => {
  const { t } = useTranslation('settings');
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { subtitleStyle, setSubtitleStyleForProfile } = usePlaybackStore((state) => ({
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

  const currentPresetLabel = currentPreset?.label ?? t('subtitles.custom');
  const currentPresetValue: SubtitleStylePreset | 'custom' = currentPreset?.id ?? 'custom';

  const presetPickerItems: PickerItem<SubtitleStylePreset | 'custom'>[] = useMemo(
    () => [
      ...SUBTITLE_STYLE_PRESETS.map((p) => ({ label: p.label, value: p.id })),
      { label: t('subtitles.custom'), value: 'custom' as const },
    ],
    [t]
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
          <SettingsCard title={t('subtitles.title')}>
            <SettingsRow label={t('subtitles.preset')} description={t('subtitles.preset_desc')}>
              <PickerInput
                label={t('subtitles.select_preset')}
                selectedLabel={currentPresetLabel}
                icon="color-palette"
                items={presetPickerItems}
                selectedValue={currentPresetValue}
                onValueChange={handlePresetChange}
              />
            </SettingsRow>

            <SubtitleStyleControls />
          </SettingsCard>
        </Box>
      </ScrollView>
    </>
  );
});

SubtitlesSettingsContent.displayName = 'SubtitlesSettingsContent';
