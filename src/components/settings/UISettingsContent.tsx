import { FC, memo, useCallback } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Box, Text } from '@/theme/theme';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { PickerInput } from '@/components/basic/PickerInput';
import { SliderInput } from '@/components/basic/SliderInput';
import { useUIStore } from '@/store/ui.store';
import {
  THEME_PRESETS,
  SCALING_FACTOR_MIN,
  SCALING_FACTOR_MAX,
  SCALING_FACTOR_STEP,
} from '@/theme/theme-presets';
import { useAppTheme } from '@/theme/ThemeContext';
import type { PickerItem } from '@/components/basic/PickerModal';

/** Picker items for theme selection */
const THEME_PICKER_ITEMS: PickerItem<string>[] = THEME_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.id,
}));

/**
 * UI settings content component for theme and scaling preferences.
 * Extracted for use in both standalone page and split layout.
 */
export const UISettingsContent: FC = memo(() => {
  const themePresetId = useUIStore((state) => state.themePresetId);
  const scalingFactor = useUIStore((state) => state.scalingFactor);
  const setThemePresetId = useUIStore((state) => state.setThemePresetId);
  const setScalingFactor = useUIStore((state) => state.setScalingFactor);

  const { preset } = useAppTheme();

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

  const formatScalingValue = useCallback((value: number) => {
    return `${Math.round(value * 100)}%`;
  }, []);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <SettingsCard title="Appearance">
          <Text variant="caption" color="textSecondary">
            Customize the app's look and feel.
          </Text>

          <SettingsRow label="Theme">
            <PickerInput
              label="Select Theme"
              icon="color-palette"
              items={THEME_PICKER_ITEMS}
              selectedLabel={preset.name}
              selectedValue={themePresetId}
              onValueChange={handleThemeChange}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title="Scaling">
          <Text variant="caption" color="textSecondary">
            Adjust the overall size of UI elements. Smaller values fit more content on screen.
          </Text>

          <SliderInput
            label="UI Scale"
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
