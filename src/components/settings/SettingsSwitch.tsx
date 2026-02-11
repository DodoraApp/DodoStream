import { memo, RefObject } from 'react';
import { Platform, Switch, View } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

interface SettingsSwitchProps {
  /** Label text for the switch */
  label: string;
  /** Optional description below the label */
  description?: string;
  /** Current switch value */
  value: boolean;
  /** Callback when value changes */
  onValueChange: (value: boolean) => void;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Ref for focus navigation - allows parent to control focus */
  viewRef?: RefObject<View>;
  /** Block focus from going up */
  blockUp?: boolean;
  /** Block focus from going down */
  blockDown?: boolean;
}

/**
 * A switch component for settings screens with proper TV focus support.
 * Uses background color change for focus indication (not outline).
 */
export const SettingsSwitch = memo(function SettingsSwitch({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  viewRef,
}: SettingsSwitchProps) {
  const theme = useTheme<Theme>();
  return (
    <Focusable
      onPress={() => !disabled && onValueChange(!value)}
      variant="background"
      disabled={disabled}
      viewRef={viewRef}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        gap="m"
        borderRadius="m"
        padding="s">
        <Box flex={1} gap="xs">
          <Text variant="body">{label}</Text>
          {description && (
            <Text variant="caption" color="textSecondary">
              {description}
            </Text>
          )}
        </Box>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || Platform.isTV}
          trackColor={{
            false: theme.colors.mainBackground,
            true: theme.colors.primaryBackground,
          }}
          thumbColor={theme.colors.mainForeground}
          focusable={false}
          accessible={false}
          importantForAccessibility="no"
          style={{ transform: [{ scaleX: theme.scalingFactor }, { scaleY: theme.scalingFactor }] }}
        />
      </Box>
    </Focusable>
  );
});
