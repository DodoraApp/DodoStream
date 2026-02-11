import React, { memo, useCallback, useState } from 'react';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { Button, ButtonProps, IconComponentType } from '@/components/basic/Button';
import { Badge } from '@/components/basic/Badge';

export interface ControlButtonProps extends Pick<
  ButtonProps<IconComponentType>,
  'icon' | 'iconComponent' | 'variant'
> {
  onPress: () => void;
  label?: string;
  labelPosition?: 'top' | 'bottom';
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  onFocusChange?: (focused: boolean) => void;
  /** Badge text displayed at top right of button */
  badge?: string;
  /** Badge variant (default: primary) */
  badgeVariant?: 'primary' | 'secondary' | 'tertiary';
}

export const ControlButton = memo(
  ({
    onPress,
    label,
    hasTVPreferredFocus = false,
    disabled = false,
    onFocusChange,
    variant = 'secondary',
    badge,
    badgeVariant = 'primary',
    labelPosition = 'top',
    ...buttonProps
  }: ControlButtonProps) => {
    const theme = useTheme<Theme>();
    const [isFocused, setIsFocused] = useState(false);

    const handleFocused = useCallback(() => {
      setIsFocused(true);
      onFocusChange?.(true);
    }, [onFocusChange]);

    const handleBlurred = useCallback(() => {
      setIsFocused(false);
      onFocusChange?.(false);
    }, [onFocusChange]);

    return (
      <Box alignItems="center" justifyContent="center" position="relative">
        {!disabled && label && isFocused && (
          <Box
            position="absolute"
            top={labelPosition === 'top' ? -theme.spacing.l : undefined}
            bottom={labelPosition === 'bottom' ? -theme.spacing.l : undefined}
            left={-200}
            right={-200}
            alignItems="center"
            pointerEvents="none">
            <Text variant="caption" color="mainForeground">
              {label}
            </Text>
          </Box>
        )}
        <Button
          {...buttonProps}
          onPress={onPress}
          hasTVPreferredFocus={hasTVPreferredFocus}
          disabled={disabled}
          onFocus={handleFocused}
          onBlur={handleBlurred}
          variant={variant}
        />
        {badge && (
          <Box position="absolute" top={-theme.spacing.xs} right={-theme.spacing.xs}>
            <Badge label={badge} variant={badgeVariant} />
          </Box>
        )}
      </Box>
    );
  }
);
