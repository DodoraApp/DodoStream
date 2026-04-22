import { Box, type Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { SimklLogo } from './SimklLogo';
import type { IntegrationProvider } from '@/types/integrations';

import type { SyncStatus } from '@/hooks/useSyncProviderBadges';

interface SyncBadgeProps {
  status: SyncStatus;
  provider: IntegrationProvider;
}

export const SyncBadge = ({ status, provider }: SyncBadgeProps) => {
  const theme = useTheme<Theme>();

  let iconName: keyof typeof Ionicons.glyphMap;

  switch (status) {
    case 'synced':
      iconName = 'checkmark';
      break;
    case 'error':
      iconName = 'close';
      break;
    case 'waiting':
    default:
      iconName = 'hourglass-outline';
      break;
  }

  const badgeSize = theme.sizes.iconLarge;
  const statusSize = theme.sizes.iconSmall;
  const statusOffset = theme.spacing.xs;

  return (
    <Box
      width={badgeSize}
      height={badgeSize}
      borderRadius="s"
      padding="xs"
      justifyContent="center"
      alignItems="center"
      position="relative">
      {provider === 'simkl' && <SimklLogo size="iconLarge" />}
      <Box
        position="absolute"
        justifyContent="center"
        alignItems="center"
        backgroundColor={
          status === 'synced'
            ? 'primaryBackground'
            : status === 'error'
              ? 'danger'
              : 'textSecondary'
        }
        width={statusSize}
        height={statusSize}
        borderRadius="full"
        right={-statusOffset}
        top={-statusOffset}>
        <Ionicons
          name={iconName}
          size={theme.spacing.s}
          color={theme.colors.mainForeground}
          style={{ fontWeight: 'bold' }}
        />
      </Box>
    </Box>
  );
};
