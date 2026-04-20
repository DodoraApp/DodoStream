import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import { Box, Text } from '@/theme/theme';
import type { Theme } from '@/theme/theme';

interface MediaSectionHeaderProps {
  title: string;
}

export const MediaSectionHeader = memo(({ title }: MediaSectionHeaderProps) => {
  const theme = useTheme<Theme>();

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      paddingLeft="m"
      style={{
        borderLeftWidth: theme.focus.borderWidthSmall,
        borderLeftColor: theme.colors.primaryBackground,
      }}>
      <Text variant="subheader">{title}</Text>
    </Box>
  );
});

MediaSectionHeader.displayName = 'MediaSectionHeader';
