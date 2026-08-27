import { FC, memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { useQueryClient } from '@tanstack/react-query';

import { Focusable } from '@/components/basic/Focusable';
import { SimklLogo } from '@/components/basic/SimklLogo';
import { TraktLogo } from '@/components/basic/TraktLogo';
import { SettingsCard } from '@/components/settings/SettingsCard';
import type { DbSyncLogItem } from '@/db';
import { syncLogKeys, useSyncLog } from '@/hooks/useSyncLog';
import { Box, Text, type Theme } from '@/theme/theme';

interface SyncLogCardProps {
  profileId?: string;
}

const formatLogTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const ProviderLogo = memo(({ provider }: { provider: DbSyncLogItem['provider'] }) =>
  provider === 'simkl' ? <SimklLogo size="iconSmall" /> : <TraktLogo size="iconSmall" />
);
ProviderLogo.displayName = 'ProviderLogo';

/**
 * Accordion (collapsed by default) showing the most recent integration sync
 * activity, newest first. Each row is color-coded by provider via its logo.
 */
export const SyncLogCard: FC<SyncLogCardProps> = memo(({ profileId }) => {
  const { t } = useTranslation('settings');
  const theme = useTheme<Theme>();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: entries = [] } = useSyncLog(profileId);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (next && profileId) {
        queryClient.invalidateQueries({ queryKey: syncLogKeys.forProfile(profileId) });
      }
      return next;
    });
  }, [profileId, queryClient]);

  return (
    <SettingsCard title={t('sync_log.title')}>
      <Focusable onPress={handleToggle} variant="background">
        <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={theme.sizes.iconMedium}
            color={theme.colors.textSecondary}
          />
          <Text variant="body" flex={1}>
            {expanded ? t('sync_log.hide') : t('sync_log.show')}
          </Text>
          <Text variant="caption" color="textSecondary">
            {entries.length}
          </Text>
        </Box>
      </Focusable>

      {expanded &&
        (entries.length === 0 ? (
          <Text variant="caption" color="textSecondary" paddingHorizontal="m">
            {t('sync_log.empty')}
          </Text>
        ) : (
          <Box gap="xs" paddingHorizontal="s">
            {entries.map((entry) => (
              <Box
                key={entry.id}
                flexDirection="row"
                alignItems="center"
                gap="m"
                paddingVertical="xs">
                <ProviderLogo provider={entry.provider} />
                <Text variant="body" numberOfLines={1} flex={1}>
                  {entry.title}
                </Text>
                <Text
                  variant="caption"
                  color={entry.direction === 'import' ? 'textLink' : 'tertiaryBackground'}>
                  {entry.direction === 'import' ? t('sync_log.imported') : t('sync_log.exported')}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {formatLogTime(entry.createdAt)}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
    </SettingsCard>
  );
});

SyncLogCard.displayName = 'SyncLogCard';
