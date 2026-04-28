import { ReactNode } from 'react';

import { Box, Text } from '@/theme/theme';

interface PageHeaderProps {
  title: string;
  rightElement?: ReactNode;
}

export const PageHeader = ({ title, rightElement }: PageHeaderProps) => {
  return (
    <Box flexDirection="row" alignItems="center" gap="m" marginTop="s">
      <Text variant="header">{title}</Text>
      {!!rightElement && <Box flex={1}>{rightElement}</Box>}
    </Box>
  );
};
