import type { ReactNode } from 'react';
import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import { Box, Text } from '@/theme/theme';
import type { Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';

interface TagProps {
  label: string;
  selected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  focusable?: boolean;
  rightElement?: ReactNode;
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

const getColor = (selected: boolean, isFocused: boolean) => {
  if (selected) {
    return isFocused ? 'focusBackgroundPrimary' : 'primaryBackground';
  }
  return isFocused ? 'focusBackground' : 'cardBackground';
};

export const Tag = memo(
  ({
    label,
    selected = false,
    focusable = false,
    disabled = false,
    rightElement,
    onPress,
    onFocus,
    onBlur,
  }: TagProps) => {
    const theme = useTheme<Theme>();

    const renderContent = (isFocused: boolean) => (
      <Box
        backgroundColor={getColor(selected, isFocused)}
        paddingHorizontal="m"
        paddingVertical="xs"
        borderRadius="s"
        borderWidth={1}
        borderColor="cardBorder"
        opacity={disabled ? 0.5 : 1}
        justifyContent="center"
        alignItems="center"
        flexDirection="row"
        gap="s"
        focusable={focusable}>
        <Text
          variant="caption"
          color={selected ? 'primaryForeground' : isFocused ? 'focusForeground' : 'textSecondary'}
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
        style={{ borderRadius: theme.borderRadii.s }}>
        {({ isFocused }) => renderContent(isFocused)}
      </Focusable>
    );
  }
);

Tag.displayName = 'Tag';
