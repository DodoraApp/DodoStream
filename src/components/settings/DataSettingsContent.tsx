import { FC, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { Button } from '@/components/basic/Button';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
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

  const handleClearHistory = useCallback(() => {
    Alert.alert(t('data.clear_history_confirm_title'), t('data.clear_history_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: () => {
          clearHistory();
          addToast({
            title: t('data.history_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [clearHistory, addToast, t]);

  const handleClearList = useCallback(() => {
    Alert.alert(t('data.clear_list_confirm_title'), t('data.clear_list_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:clear'),
        style: 'destructive',
        onPress: () => {
          clearList();
          addToast({
            title: t('data.list_cleared'),
            preset: 'success',
          });
        },
      },
    ]);
  }, [clearList, addToast, t]);

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
          <Button title={t('common:clear')} onPress={handleClearHistory} variant="secondary" />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title={t('data.my_list')}>
        <SettingsRow label={t('data.clear_list')} description={t('data.clear_list_desc')}>
          <Button title={t('common:clear')} onPress={handleClearList} variant="secondary" />
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
