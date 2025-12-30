import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Theme, Text, Box } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';

export interface ProgressButtonProps extends Omit<
  React.ComponentProps<typeof Focusable>,
  'children'
> {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  progress: number; // 0 to 1
  disabled?: boolean;
  flex?: number;
  minWidth?: number;
}

export const ProgressButton = ({
  title,
  icon,
  progress,
  disabled = false,
  flex,
  minWidth,
  ...rest
}: ProgressButtonProps) => {
  const theme = useTheme<Theme>();
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <Focusable disabled={disabled} hasTVPreferredFocus={false} style={{ flex, minWidth }} {...rest}>
      {({ isFocused }) => (
        <Box
          opacity={disabled ? 0.5 : 1}
          flexDirection="row"
          gap="s"
          borderRadius="full"
          overflow="hidden"
          height={50}
          justifyContent="center"
          alignItems="center"
          paddingHorizontal="l">
          {/* Progress fill layer */}
          <View style={StyleSheet.absoluteFill}>
            {/* Filled portion (primary color or focus color) */}
            <View
              style={[
                styles.progressFill,
                {
                  width: `${clampedProgress * 100}%`,
                  backgroundColor: isFocused
                    ? theme.colors.focusBackgroundPrimary
                    : theme.colors.primaryBackground,
                },
              ]}
            />
            {/* Unfilled portion (secondary or focus background) */}
            <View
              style={[
                styles.progressUnfilled,
                {
                  width: `${(1 - clampedProgress) * 100}%`,
                  backgroundColor: isFocused
                    ? theme.colors.focusBackground
                    : theme.colors.secondaryBackground,
                },
              ]}
            />
          </View>

          {/* Content layer */}
          {icon && <Ionicons name={icon} size={20} color={theme.colors.primaryForeground} />}
          <Text variant="button" color="primaryForeground">
            {title}
          </Text>
        </Box>
      )}
    </Focusable>
  );
};

const styles = StyleSheet.create({
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressUnfilled: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
});
