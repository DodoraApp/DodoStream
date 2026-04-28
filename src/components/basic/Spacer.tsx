import { memo } from 'react';

import { useTheme } from '@shopify/restyle';

import type { Theme } from '@/theme/theme';
import { Box } from '@/theme/theme';

interface SpacerProps {
  /** Uses theme spacing tokens (default: s + xs). */
  size?: keyof Theme['spacing'];
}

export const HorizontalSpacer = memo(({ size, ..._ }: SpacerProps & Record<string, unknown>) => {
  const theme = useTheme<Theme>();
  const width = size ? theme.spacing[size] : theme.spacing.s + theme.spacing.xs;
  return <Box width={width} />;
});

export const VerticalSpacer = memo(({ size, ..._ }: SpacerProps & Record<string, unknown>) => {
  const theme = useTheme<Theme>();
  const height = size ? theme.spacing[size] : theme.spacing.s + theme.spacing.xs;
  return <Box height={height} />;
});

HorizontalSpacer.displayName = 'HorizontalSpacer';
VerticalSpacer.displayName = 'VerticalSpacer';
