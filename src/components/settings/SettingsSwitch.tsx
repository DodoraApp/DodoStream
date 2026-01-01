import { Box, Text, Theme } from '@/theme/theme';
import { Switch } from 'react-native';
import { Focusable } from '@/components/basic/Focusable';
import { useTheme } from '@shopify/restyle';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface SettingsSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SettingsSwitch({ label, description, value, onValueChange }: SettingsSwitchProps) {
  const theme = useTheme<Theme>();

  return (
    <Focusable onPress={() => onValueChange(!value)}>
      {({ isFocused }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          gap="m"
          backgroundColor={getFocusableBackgroundColor({ isFocused, defaultColor: 'transparent' })}
          borderRadius="m"
          padding="s"
          style={{ marginHorizontal: -theme.spacing.s }}>
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
            trackColor={{
              false: theme.colors.mainBackground,
              true: theme.colors.primaryBackground,
            }}
            thumbColor={theme.colors.mainForeground}
            focusable={false}
          />
        </Box>
      )}
    </Focusable>
  );
}
