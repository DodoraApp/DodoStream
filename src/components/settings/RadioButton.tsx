import { memo } from 'react';
import { Box, type Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';

interface RadioButtonProps {
  selected: boolean;
}

export const RadioButton = memo(({ selected }: RadioButtonProps) => {
  const theme = useTheme<Theme>();

  return (
    <Box
      width={theme.sizes.iconMedium}
      height={theme.sizes.iconMedium}
      borderRadius="full"
      borderWidth={theme.focus.borderWidthSmall}
      borderColor={selected ? 'primaryBackground' : 'textSecondary'}
      backgroundColor={selected ? 'primaryBackground' : 'cardBackground'}
    />
  );
});

RadioButton.displayName = 'RadioButton';
