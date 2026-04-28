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

export interface DataSettingsContentProps {
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

export const DataSettingsContent: FC<DataSettingsContentProps> = memo(({ scrollable = true }) => {
  const { t } = useTranslation(['settings', 'common']);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const { clearHistory } = useWatchHistoryActions();
  const { clearList } = useMyListActions();
  const clearProfileIntegrations = useIntegrationsStore((state) => state.clearProfileIntegrations);
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

  const handleResetSimkl = useCallback(() => {
    Alert.alert(t('data.reset_simkl_confirm_title'), t('data.reset_simkl_confirm_msg'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:reset'),
        style: 'destructive',
        onPress: () => {
          if (activeProfileId) {
            clearProfileIntegrations(activeProfileId);
            addToast({
              title: t('data.simkl_reset'),
              preset: 'success',
            });
          }
        },
      },
    ]);
  }, [activeProfileId, clearProfileIntegrations, addToast, t]);

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
          <Button title={t('common:reset')} onPress={handleResetSimkl} variant="secondary" />
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
