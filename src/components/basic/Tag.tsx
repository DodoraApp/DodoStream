import type { ReactNode } from 'react';
import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import { Box, Text } from '@/theme/theme';
import type { Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

type TagVariant = 'default' | 'glass';

interface TagProps {
  label: string;
  /** Visual variant: 'default' has border, 'glass' is semi-transparent without border */
  variant?: TagVariant;
  selected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  focusable?: boolean;
  /** Whether this tag should receive focus by default on TV */
  hasTVPreferredFocus?: boolean;
  rightElement?: ReactNode;
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const Tag = memo(
  ({
    label,
    variant = 'default',
    selected = false,
    focusable = false,
    disabled = false,
    hasTVPreferredFocus = false,
    rightElement,
    onPress,
    onFocus,
    onBlur,
  }: TagProps) => {
    const theme = useTheme<Theme>();

    const isGlass = variant === 'glass';

    const renderContent = (isFocused: boolean) => (
      <Box
        backgroundColor={
          isGlass
            ? isFocused
              ? 'focusBackground'
              : 'semiTransparentBackground'
            : getFocusableBackgroundColor({ isActive: selected, isFocused })
        }
        paddingHorizontal={isGlass ? 's' : 'm'}
        paddingVertical="xs"
        borderRadius="s"
        borderWidth={isGlass ? 0 : 1}
        borderColor={isGlass ? 'transparent' : 'cardBorder'}
        opacity={disabled ? 0.5 : 1}
        justifyContent="center"
        alignItems="center"
        flexDirection="row"
        gap="s"
        focusable={focusable}>
        <Text
          variant="caption"
          color={
            isGlass ? 'textPrimary' : getFocusableForegroundColor({ isActive: selected, isFocused })
          }
          style={{ includeFontPadding: false }}>
          {label}
        </Text>
        {rightElement}
      </Box>
    );

    if (!focusable) {
      return renderContent(false);
    }

    return (
      <Focusable
        onPress={onPress}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={{ borderRadius: theme.borderRadii.s }}>
        {({ isFocused }) => renderContent(isFocused)}
      </Focusable>
    );
  }
);

Tag.displayName = 'Tag';
