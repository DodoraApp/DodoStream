/* eslint-disable max-lines-per-function -- large TV-focused component; see AGENTS.md refactor note */
import { FC, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { stremioKeys } from '@/api/stremio';
import { Button } from '@/components/basic/Button';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import {
  clearMetaCache,
  clearMetaIds,
  countMetaCache,
  countMetaIds,
  countMyListForProfile,
  countWatchHistory,
} from '@/db';
import { useMyListActions } from '@/hooks/useMyListDb';
import { useWatchHistoryActions } from '@/hooks/useWatchHistoryDb';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { useToastStore } from '@/store/toast.store';
import { Box, Text } from '@/theme/theme';
import type { IntegrationProvider } from '@/types/integrations';

export interface DataSettingsContentProps {
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

export const DataSettingsContent: FC<DataSettingsContentProps> = memo(({ scrollable = true }) => {
  const { t } = useTranslation(['settings', 'common']);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const { clearHistory } = useWatchHistoryActions();
  const { clearList } = useMyListActions();
  const clearProviderIntegration = useIntegrationsStore((state) => state.clearProviderIntegration);
  const addToast = useToastStore((state) => state.addToast);
  const queryClient = useQueryClient();
  const historyCount = useQuery({
    queryKey: ['data-settings', 'history-count', activeProfileId],
    queryFn: () => (activeProfileId ? countWatchHistory(activeProfileId) : 0),
    enabled: !!activeProfileId,
  });
  const myListCount = useQuery({
    queryKey: ['data-settings', 'my-list-count', activeProfileId],
    queryFn: () => (activeProfileId ? countMyListForProfile(activeProfileId) : 0),
    enabled: !!activeProfileId,
  });
  const metaCacheCount = useQuery({
    queryKey: ['data-settings', 'meta-cache-count'],
    queryFn: countMetaCache,
  });
  const idCacheCount = useQuery({
    queryKey: ['data-settings', 'id-cache-count'],
    queryFn: countMetaIds,
  });

  const invalidateCounts = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['data-settings', 'history-count', activeProfileId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['data-settings', 'my-list-count', activeProfileId],
      }),
      queryClient.invalidateQueries({ queryKey: ['data-settings', 'meta-cache-count'] }),
      queryClient.invalidateQueries({ queryKey: ['data-settings', 'id-cache-count'] }),
    ]);
  }, [activeProfileId, queryClient]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(t('data.clear_history_confirm_title'), t('data.clear_history_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: () => {
          clearHistory();
          invalidateCounts();
          addToast({
            title: t('data.history_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [clearHistory, addToast, invalidateCounts, t]);

  const handleClearList = useCallback(() => {
    Alert.alert(t('data.clear_list_confirm_title'), t('data.clear_list_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: () => {
          clearList();
          invalidateCounts();
          addToast({
            title: t('data.list_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [clearList, addToast, invalidateCounts, t]);

  const handleClearPosterCache = useCallback(() => {
    Alert.alert(
      t('data.clear_poster_cache_confirm_title'),
      t('data.clear_poster_cache_confirm_msg'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('common:clear'),
          style: 'destructive',
          onPress: async () => {
            await Image.clearDiskCache();
            await Image.clearMemoryCache();
            invalidateCounts();
            addToast({
              title: t('data.poster_cache_cleared'),
              preset: 'success',
            });
          },
        },
      ]
    );
  }, [addToast, invalidateCounts, t]);

  const handleClearMetaCache = useCallback(() => {
    Alert.alert(t('data.clear_meta_cache_confirm_title'), t('data.clear_meta_cache_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: async () => {
          await clearMetaCache();
          queryClient.removeQueries({ queryKey: stremioKeys.metas() });
          invalidateCounts();
          void queryClient.invalidateQueries({ queryKey: ['my-list-db'] });
          addToast({
            title: t('data.meta_cache_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [addToast, invalidateCounts, queryClient, t]);

  const handleClearIdCache = useCallback(() => {
    Alert.alert(t('data.clear_id_cache_confirm_title'), t('data.clear_id_cache_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: async () => {
          await clearMetaIds();
          invalidateCounts();
          addToast({
            title: t('data.id_cache_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [addToast, invalidateCounts, t]);

  const handleResetProvider = useCallback(
    (provider: IntegrationProvider) => {
      Alert.alert(
        t(`data.reset_${provider}_confirm_title`),
        t(`data.reset_${provider}_confirm_msg`),
        [
          { text: t('common:cancel'), style: 'cancel' },
          {
            text: t('common:reset'),
            style: 'destructive',
            onPress: () => {
              if (activeProfileId) {
                clearProviderIntegration(activeProfileId, provider);
                addToast({
                  title: t(`data.${provider}_reset`),
                  preset: 'success',
                });
              }
            },
          },
        ]
      );
    },
    [activeProfileId, clearProviderIntegration, addToast, t]
  );

  const content = (
    <Box paddingVertical="m" paddingHorizontal="m" gap="l" paddingBottom="xl">
      <SettingsCard title={t('data.watch_history')}>
        <SettingsRow label={t('data.clear_history')} description={t('data.clear_history_desc')}>
          <Box alignItems="flex-end" gap="xs">
            <Text variant="caption" color="textSecondary">
              {t('data.entries', { count: historyCount.data ?? 0 })}
            </Text>
            <Button title={t('common:clear')} onPress={handleClearHistory} variant="secondary" />
          </Box>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title={t('data.my_list')}>
        <SettingsRow label={t('data.clear_list')} description={t('data.clear_list_desc')}>
          <Box alignItems="flex-end" gap="xs">
            <Text variant="caption" color="textSecondary">
              {t('data.entries', { count: myListCount.data ?? 0 })}
            </Text>
            <Button title={t('common:clear')} onPress={handleClearList} variant="secondary" />
          </Box>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title={t('data.cache')}>
        <SettingsRow
          label={t('data.clear_poster_cache')}
          description={t('data.clear_poster_cache_desc')}>
          <Button title={t('common:clear')} onPress={handleClearPosterCache} variant="secondary" />
        </SettingsRow>
        <SettingsRow
          label={t('data.clear_meta_cache')}
          description={t('data.clear_meta_cache_desc')}>
          <Box alignItems="flex-end" gap="xs">
            <Text variant="caption" color="textSecondary">
              {t('data.entries', {
                count:
                  (metaCacheCount.data?.metaEntries ?? 0) +
                  (metaCacheCount.data?.videoEntries ?? 0),
              })}
            </Text>
            <Button title={t('common:clear')} onPress={handleClearMetaCache} variant="secondary" />
          </Box>
        </SettingsRow>
        <SettingsRow label={t('data.clear_id_cache')} description={t('data.clear_id_cache_desc')}>
          <Box alignItems="flex-end" gap="xs">
            <Text variant="caption" color="textSecondary">
              {t('data.entries', { count: idCacheCount.data ?? 0 })}
            </Text>
            <Button title={t('common:clear')} onPress={handleClearIdCache} variant="secondary" />
          </Box>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title={t('data.integrations')}>
        <SettingsRow label={t('data.reset_simkl')} description={t('data.reset_simkl_desc')}>
          <Button
            title={t('common:reset')}
            onPress={() => handleResetProvider('simkl')}
            variant="secondary"
          />
        </SettingsRow>
        <SettingsRow label={t('data.reset_trakt')} description={t('data.reset_trakt_desc')}>
          <Button
            title={t('common:reset')}
            onPress={() => handleResetProvider('trakt')}
            variant="secondary"
          />
        </SettingsRow>
      </SettingsCard>

      <Box paddingHorizontal="m" marginTop="m">
        <Text variant="caption" color="textSecondary" textAlign="center">
          {t('data.profile_data_notice')}
        </Text>
      </Box>
    </Box>
  );

  if (!scrollable) {
    return content;
  }

  return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
});
