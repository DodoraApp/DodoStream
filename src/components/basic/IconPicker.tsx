import React, { FC, memo, useCallback, useState } from 'react';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { Modal } from '@/components/basic/Modal';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

interface IconPickerProps {
  /** Currently selected icon name */
  value: string;
  /** Callback when icon is selected */
  onValueChange: (icon: string) => void;
  /** Label for the picker */
  label?: string;
  /** Available icons to choose from */
  icons: string[];
  /** Whether the picker is disabled */
  disabled?: boolean;
}

interface IconSwatchProps {
  icon: string;
  isSelected: boolean;
  onPress: () => void;
}

const IconSwatch = memo<IconSwatchProps>(({ icon, isSelected, onPress }) => {
  const theme = useTheme<Theme>();

  return (
    <Focusable
      onPress={onPress}
      variant="outline"
      focusedStyle={{ borderRadius: theme.borderRadii.m }}>
      <Box
        width={theme.sizes.inputHeight}
        height={theme.sizes.inputHeight}
        borderRadius="m"
        justifyContent="center"
        alignItems="center"
        backgroundColor={isSelected ? 'primaryBackground' : 'inputBackground'}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={theme.sizes.iconLarge}
          color={theme.colors.mainForeground}
        />
      </Box>
    </Focusable>
  );
});

IconSwatch.displayName = 'IconSwatch';

/**
 * Icon picker component for selecting icons from a predefined list.
 * Designed for TV remote navigation with focus states.
 */
export const IconPicker: FC<IconPickerProps> = memo(
  ({ value, onValueChange, label, icons, disabled = false }) => {
    const theme = useTheme<Theme>();
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleOpen = useCallback(() => {
      if (!disabled) {
        setIsModalVisible(true);
      }
    }, [disabled]);

    const handleClose = useCallback(() => {
      setIsModalVisible(false);
    }, []);

    const handleSelectIcon = useCallback(
      (icon: string) => {
        onValueChange(icon);
        setIsModalVisible(false);
      },
      [onValueChange]
    );

    return (
      <>
        {/* Icon Preview Button */}
        <Focusable onPress={handleOpen} disabled={disabled} variant="outline">
          <Box
            flexDirection="row"
            alignItems="center"
            gap="s"
            borderRadius="m"
            paddingHorizontal="m"
            paddingVertical="s"
            opacity={disabled ? 0.5 : 1}>
            <Box
              width={theme.sizes.iconLarge}
              height={theme.sizes.iconLarge}
              borderRadius="s"
              justifyContent="center"
              alignItems="center"
              backgroundColor="inputBackground">
              <Ionicons
                name={value as keyof typeof Ionicons.glyphMap}
                size={theme.sizes.iconMedium}
                color={theme.colors.mainForeground}
              />
            </Box>
            {label && (
              <Text variant="body" color="textPrimary">
                {label}
              </Text>
            )}
          </Box>
        </Focusable>

        {/* Icon Picker Modal */}
        <Modal visible={isModalVisible} onClose={handleClose} label={label ?? 'Select Icon'}>
          <Box flexDirection="row" flexWrap="wrap" justifyContent="center" gap="s">
            {icons.map((icon) => (
              <IconSwatch
                key={icon}
                icon={icon}
                isSelected={value === icon}
                onPress={() => handleSelectIcon(icon)}
              />
            ))}
          </Box>
        </Modal>
      </>
    );
  }
);

IconPicker.displayName = 'IconPicker';
