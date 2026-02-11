import { Box, Text } from '@/theme/theme';
import { ReactNode } from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  children?: ReactNode;
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      gap="m"
      paddingHorizontal="s"
      width="100%"
      flexWrap="wrap">
      <Box flex={1} gap="xs">
        <Text variant="body">{label}</Text>
        {description && (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
}
