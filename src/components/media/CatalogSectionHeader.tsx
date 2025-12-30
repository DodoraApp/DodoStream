import { memo } from 'react';
import { Box, Text } from '@/theme/theme';

export interface CatalogSectionHeaderProps {
  title: string;
  type?: string;
}

export const CatalogSectionHeader = memo(({ title, type }: CatalogSectionHeaderProps) => (
  <Box
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    marginTop="m"
    marginBottom="s"
    marginHorizontal="m">
    <Box>
      <Text variant="subheader">{title}</Text>
      {type && (
        <Text variant="caption" color="textSecondary" textTransform="capitalize">
          {type}
        </Text>
      )}
    </Box>
  </Box>
));

CatalogSectionHeader.displayName = 'CatalogSectionHeader';
