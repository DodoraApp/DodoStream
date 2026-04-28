import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

import { SimklLogo } from '@/components/basic/SimklLogo';
import type { WatchHistorySource } from '@/db/schema';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';

interface CompletedBadgeProps {
  mode?: 'inline' | 'overlay';
  variant?: 'completed' | 'watching';
  source?: WatchHistorySource;
  showSimklLogo?: boolean;
}

export const CompletedBadge = ({
  mode = 'inline',
  variant = 'completed',
  source,
  showSimklLogo = false,
}: CompletedBadgeProps) => {
  const theme = useTheme<Theme>();
  const { t } = useTranslation('media');
  const isOverlay = mode === 'overlay';
  const isCompleted = variant === 'completed';
  const showProviderIcon = showSimklLogo || source === 'simkl';

  return (
    <Box
      position={isOverlay ? 'absolute' : 'relative'}
      top={isOverlay ? 0 : undefined}
      right={isOverlay ? 0 : undefined}
      borderBottomLeftRadius={isOverlay ? 'm' : undefined}
      borderRadius={isOverlay ? undefined : 's'}
      backgroundColor={isCompleted ? 'primaryBackground' : 'tertiaryBackground'}
      paddingHorizontal="s"
      paddingVertical="xs"
      flexDirection="row"
      alignItems="center"
      gap="xs">
      <Ionicons
        name={isCompleted ? 'checkmark-circle' : 'play-circle'}
        size={theme.sizes.iconSmall}
        color={isCompleted ? theme.colors.primaryForeground : theme.colors.tertiaryForeground}
      />
      <Text
        variant="bodySmall"
        fontWeight="700"
        color={isCompleted ? 'primaryForeground' : 'tertiaryForeground'}>
        {isCompleted ? t('completed') : t('watching')}
      </Text>
      {showProviderIcon && (
        <Box testID="status-provider-simkl">
          <SimklLogo size="iconSmall" />
        </Box>
      )}
    </Box>
  );
};
