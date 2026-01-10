import React, { FC, memo, useCallback, useMemo } from 'react';
import Slider from '@react-native-community/slider';
import { useTheme } from '@shopify/restyle';
import { Theme, Box, Text } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { Ionicons } from '@expo/vector-icons';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

interface SliderInputProps {
  /** Current value */
  value: number;
  /** Callback when value changes */
  onValueChange: (value: number) => void;
  /** Minimum value */
  minimumValue: number;
  /** Maximum value */
  maximumValue: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Label to display */
  label?: string;
  /** Unit suffix (e.g., 'px', '%') */
  unit?: string;
  /** Format the display value (default: value.toString()) */
  formatValue?: (value: number) => string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Show increment/decrement buttons (default: true) */
  showButtons?: boolean;
}

/**
 * Slider input component with optional increment/decrement buttons.
 * Designed for TV remote navigation with focus states.
 */
export const SliderInput: FC<SliderInputProps> = memo(
  ({
    value,
    onValueChange,
    minimumValue,
    maximumValue,
    step = 1,
    label,
    unit = '',
    formatValue,
    disabled = false,
    showButtons = true,
  }) => {
    const theme = useTheme<Theme>();

    const displayValue = useMemo(() => {
      const formatted = formatValue ? formatValue(value) : value.toString();
      return `${formatted}${unit}`;
    }, [value, formatValue, unit]);

    const handleDecrement = useCallback(() => {
      const newValue = Math.max(minimumValue, value - step);
      onValueChange(newValue);
    }, [minimumValue, value, step, onValueChange]);

    const handleIncrement = useCallback(() => {
      const newValue = Math.min(maximumValue, value + step);
      onValueChange(newValue);
    }, [maximumValue, value, step, onValueChange]);

    const handleSliderChange = useCallback(
      (newValue: number) => {
        // Round to step
        const rounded = Math.round(newValue / step) * step;
        onValueChange(rounded);
      },
      [step, onValueChange]
    );

    const canDecrement = value > minimumValue;
    const canIncrement = value < maximumValue;

    return (
      <Box
        gap="s"
        opacity={disabled ? 0.5 : 1}
        height={theme.sizes.inputHeight}
        justifyContent="space-between">
        {label && (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text variant="body" color="textPrimary">
              {label}
            </Text>
            <Text variant="body" color="textSecondary">
              {displayValue}
            </Text>
          </Box>
        )}

        <Box flexDirection="row" alignItems="center" gap="xs">
          {showButtons && (
            <Focusable onPress={handleDecrement} disabled={disabled || !canDecrement}>
              {({ isFocused }) => (
                <Box
                  width={theme.sizes.inputHeight}
                  height={theme.sizes.inputHeight}
                  borderRadius="m"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={getFocusableBackgroundColor({
                    isFocused,
                    defaultColor: 'inputBackground',
                  })}
                  opacity={canDecrement ? 1 : 0.4}>
                  <Ionicons
                    name="remove"
                    size={20}
                    color={
                      theme.colors[
                        getFocusableForegroundColor({
                          isFocused,
                          defaultColor: 'textPrimary',
                        })
                      ]
                    }
                  />
                </Box>
              )}
            </Focusable>
          )}

          <Box flex={1}>
            <Slider
              style={{ flex: 1, height: theme.sizes.inputHeight }}
              minimumValue={minimumValue}
              maximumValue={maximumValue}
              step={step}
              value={value}
              onValueChange={handleSliderChange}
              minimumTrackTintColor={theme.colors.primaryBackground}
              maximumTrackTintColor={theme.colors.secondaryBackground}
              thumbTintColor={theme.colors.primaryBackground}
              disabled={disabled}
              focusable={false}
            />
          </Box>

          {showButtons && (
            <Focusable onPress={handleIncrement} disabled={disabled || !canIncrement}>
              {({ isFocused }) => (
                <Box
                  width={theme.sizes.inputHeight}
                  height={theme.sizes.inputHeight}
                  borderRadius="m"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={getFocusableBackgroundColor({
                    isFocused,
                    defaultColor: 'inputBackground',
                  })}
                  opacity={canIncrement ? 1 : 0.4}>
                  <Ionicons
                    name="add"
                    size={20}
                    color={
                      theme.colors[
                        getFocusableForegroundColor({
                          isFocused,
                          defaultColor: 'textPrimary',
                        })
                      ]
                    }
                  />
                </Box>
              )}
            </Focusable>
          )}
        </Box>
      </Box>
    );
  }
);

SliderInput.displayName = 'SliderInput';
