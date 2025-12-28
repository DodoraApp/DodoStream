import { memo } from 'react';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box } from '@/theme/theme';
import { useTrackingStore } from '@/store/tracking.store';

export const TrackingSyncIndicator = memo(() => {
  const theme = useTheme<Theme>();
  const { enabled, syncStatus } = useTrackingStore((state) => state.getActiveTracking());

  const iconSize = theme.spacing.m + theme.spacing.xs;

  if (!enabled) return null;

  if (syncStatus === 'syncing') {
    return <ActivityIndicator size="small" color={theme.colors.textSecondary} />;
  }

  if (syncStatus === 'error') {
    return <Ionicons name="alert-circle" size={iconSize} color={theme.colors.danger} />;
  }

  return (
    <Box flexDirection="row" alignItems="center">
      <Ionicons name="sync" size={iconSize} color={theme.colors.textSecondary} />
    </Box>
  );
});

TrackingSyncIndicator.displayName = 'TrackingSyncIndicator';
