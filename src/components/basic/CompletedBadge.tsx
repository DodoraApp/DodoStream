import { useTranslation } from 'react-i18next';

import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

import { SimklLogo } from '@/components/basic/SimklLogo';
import { TraktLogo } from '@/components/basic/TraktLogo';
import type { WatchHistorySource } from '@/db/schema';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';

interface CompletedBadgeProps {
  mode?: 'inline' | 'overlay';
  variant?: 'completed' | 'watching' | 'unreleased';
  /** Origin of the watch state (local playback, Simkl import, Trakt import). */
  source?: WatchHistorySource;
}

export const CompletedBadge = ({
  mode = 'inline',
  variant = 'completed',
  source,
}: CompletedBadgeProps) => {
  const theme = useTheme<Theme>();
  const { t } = useTranslation('media');
  const isOverlay = mode === 'overlay';
  const isCompleted = variant === 'completed';
  const isUnreleased = variant === 'unreleased';
  const isPrimary = isCompleted;

  // Provenance icon: mirrors the provider the watch state was imported from.
  // Locally-watched entries (source 'internal') show no icon.
  const showProviderIcon = source === 'simkl' || source === 'trakt';

  return (
    <Box
      position={isOverlay ? 'absolute' : 'relative'}
      top={isOverlay ? 0 : undefined}
      right={isOverlay ? 0 : undefined}
      borderBottomLeftRadius={isOverlay ? 'm' : undefined}
      borderRadius={isOverlay ? undefined : 's'}
      backgroundColor={isPrimary ? 'primaryBackground' : 'tertiaryBackground'}
      paddingHorizontal="s"
      paddingVertical="xs"
      flexDirection="row"
      alignItems="center"
      gap="xs">
      <Ionicons
        name={isUnreleased ? 'calendar-outline' : isCompleted ? 'checkmark-circle' : 'play-circle'}
        size={theme.sizes.iconSmall}
        color={isPrimary ? theme.colors.primaryForeground : theme.colors.tertiaryForeground}
      />
      {!isUnreleased && (
        <Text
          variant="bodySmall"
          fontWeight="700"
          color={isPrimary ? 'primaryForeground' : 'tertiaryForeground'}>
          {isCompleted ? t('completed') : t('watching')}
        </Text>
      )}
      {!isUnreleased && showProviderIcon && (
        <Box testID={`status-provider-${source}`}>
          {source === 'simkl' ? <SimklLogo size="iconSmall" /> : <TraktLogo size="iconSmall" />}
        </Box>
      )}
    </Box>
  );
};
