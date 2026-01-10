import React, { FC, memo, useCallback, useState } from 'react';
import { Box, Text } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { Modal } from '@/components/basic/Modal';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

/** Default color palette for general use */
const DEFAULT_COLORS = [
  '#FFFFFF', // White
  '#FFFF00', // Yellow
  '#00FFFF', // Cyan
  '#00FF00', // Green
  '#FF00FF', // Magenta
  '#FF0000', // Red
  '#FFA500', // Orange
  '#FFD700', // Gold
  '#FFFACD', // Lemon chiffon
  '#000000', // Black
  '#333333', // Dark gray
  '#666666', // Gray
];

interface ColorPickerProps {
  /** Currently selected color in hex format */
  value: string;
  /** Callback when color is selected */
  onValueChange: (color: string) => void;
  /** Label for the picker */
  label?: string;
  /** Available colors to choose from */
  colors?: string[];
  /** Whether the picker is disabled */
  disabled?: boolean;
}

interface ColorSwatchProps {
  color: string;
  isSelected: boolean;
  onPress: () => void;
}

const ColorSwatch = memo<ColorSwatchProps>(({ color, isSelected, onPress }) => {
  return (
    <Focusable onPress={onPress}>
      {({ isFocused }) => (
        <Box
          width={48}
          height={48}
          borderRadius="m"
          borderWidth={isSelected ? 3 : isFocused ? 2 : 1}
          borderColor={
            isSelected ? 'primaryBackground' : isFocused ? 'focusForeground' : 'cardBorder'
          }
          style={{ backgroundColor: color }}
        />
      )}
    </Focusable>
  );
});

ColorSwatch.displayName = 'ColorSwatch';

/**
 * Color picker component for selecting colors from a predefined palette.
 * Designed for TV remote navigation with focus states.
 */
export const ColorPicker: FC<ColorPickerProps> = memo(
  ({ value, onValueChange, label, colors = DEFAULT_COLORS, disabled = false }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleOpen = useCallback(() => {
      if (!disabled) {
        setIsModalVisible(true);
      }
    }, [disabled]);

    const handleClose = useCallback(() => {
      setIsModalVisible(false);
    }, []);

    const handleSelectColor = useCallback(
      (color: string) => {
        onValueChange(color);
        setIsModalVisible(false);
      },
      [onValueChange]
    );

    return (
      <>
        {/* Color Preview Button */}
        <Focusable onPress={handleOpen} disabled={disabled}>
          {({ isFocused }) => (
            <Box
              flexDirection="row"
              alignItems="center"
              gap="s"
              backgroundColor={getFocusableBackgroundColor({
                isActive: false,
                isFocused,
                defaultColor: 'inputBackground',
              })}
              borderRadius="m"
              paddingHorizontal="m"
              paddingVertical="s"
              opacity={disabled ? 0.5 : 1}>
              <Box
                width={28}
                height={28}
                borderRadius="s"
                borderWidth={1}
                borderColor="cardBorder"
                style={{ backgroundColor: value }}
              />
              {label && (
                <Text variant="body" color="textPrimary">
                  {label}
                </Text>
              )}
            </Box>
          )}
        </Focusable>

        {/* Color Picker Modal */}
        <Modal visible={isModalVisible} onClose={handleClose}>
          <Box
            backgroundColor="cardBackground"
            borderRadius="l"
            padding="l"
            margin="l"
            maxWidth={400}>
            <Box gap="m">
              <Text variant="subheader" textAlign="center">
                {label ?? 'Select Color'}
              </Text>

              <Box flexDirection="row" flexWrap="wrap" justifyContent="center" gap="s">
                {colors.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={color}
                    isSelected={value === color}
                    onPress={() => handleSelectColor(color)}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Modal>
      </>
    );
  }
);

ColorPicker.displayName = 'ColorPicker';
