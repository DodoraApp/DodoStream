import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native-gesture-handler';

import { PickerInput } from '@/components/basic/PickerInput';
import type { PickerItem } from '@/components/basic/PickerModal';
import { SliderInput } from '@/components/basic/SliderInput';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { AVAILABLE_LANGUAGES } from '@/i18n';
import { useUIStore } from '@/store/ui.store';
import { Box, Text } from '@/theme/theme';
import {
  SCALING_FACTOR_MAX,
  SCALING_FACTOR_MIN,
  SCALING_FACTOR_STEP,
  THEME_PRESETS,
} from '@/theme/theme-presets';
import { useAppTheme } from '@/theme/ThemeContext';
import { getLanguageDisplayName } from '@/utils/languages';

/**
 * UI settings content component for theme and scaling preferences.
 * Extracted for use in both standalone page and split layout.
 */
export const UISettingsContent: FC = memo(() => {
  const { t } = useTranslation('settings');
  const themePresetId = useUIStore((state) => state.themePresetId);
  const scalingFactor = useUIStore((state) => state.scalingFactor);
  const language = useUIStore((state) => state.language);
  const setThemePresetId = useUIStore((state) => state.setThemePresetId);
  const setScalingFactor = useUIStore((state) => state.setScalingFactor);
  const setLanguage = useUIStore((state) => state.setLanguage);

  const { preset } = useAppTheme();

  /** Picker items for theme selection */
  const themePickerItems: PickerItem<string>[] = useMemo(
    () =>
      THEME_PRESETS.map((preset) => ({
        label: preset.name,
        value: preset.id,
      })),
    []
  );

  /** Picker items for language selection */
  const languagePickerItems: PickerItem<string | undefined>[] = useMemo(
    () => [
      { label: t('ui.system_default'), value: undefined },
      ...AVAILABLE_LANGUAGES.map((lang) => ({
        label: getLanguageDisplayName(lang),
        value: lang,
      })),
    ],
    [t]
  );

  const currentLanguageLabel = useMemo(() => {
    if (!language) return t('ui.system_default');
    return getLanguageDisplayName(language);
  }, [language, t]);

  const handleThemeChange = useCallback(
    (value: string) => {
      setThemePresetId(value);
    },
    [setThemePresetId]
  );

  const handleScalingChange = useCallback(
    (value: number) => {
      setScalingFactor(value);
    },
    [setScalingFactor]
  );

  const handleLanguageChange = useCallback(
    (value: string | undefined) => {
      setLanguage(value);
    },
    [setLanguage]
  );

  const formatScalingValue = useCallback((value: number) => {
    return `${Math.round(value * 100)}%`;
  }, []);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <SettingsCard title={t('ui.appearance')}>
          <Text variant="caption" color="textSecondary">
            {t('ui.appearance_desc')}
          </Text>

          <SettingsRow label={t('ui.theme')}>
            <PickerInput
              label={t('ui.select_theme')}
              icon="color-palette"
              items={themePickerItems}
              selectedLabel={preset.name}
              selectedValue={themePresetId}
              onValueChange={handleThemeChange}
            />
          </SettingsRow>

          <SettingsRow label={t('ui.language')}>
            <PickerInput
              label={t('ui.select_language')}
              icon="language"
              items={languagePickerItems}
              selectedLabel={currentLanguageLabel}
              selectedValue={language}
              onValueChange={handleLanguageChange}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={t('ui.scaling')}>
          <Text variant="caption" color="textSecondary">
            {t('ui.scaling_desc')}
          </Text>

          <SliderInput
            label={t('ui.ui_scale')}
            value={scalingFactor}
            onValueChange={handleScalingChange}
            minimumValue={SCALING_FACTOR_MIN}
            maximumValue={SCALING_FACTOR_MAX}
            step={SCALING_FACTOR_STEP}
            formatValue={formatScalingValue}
          />
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

UISettingsContent.displayName = 'UISettingsContent';
