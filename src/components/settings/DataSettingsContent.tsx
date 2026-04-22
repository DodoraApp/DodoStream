import { FC, memo, useCallback } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { useWatchHistoryActions } from '@/hooks/useWatchHistoryDb';
import { useMyListActions } from '@/hooks/useMyListDb';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { useToastStore } from '@/store/toast.store';
import { Button } from '@/components/basic/Button';

export interface DataSettingsContentProps {
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

export const DataSettingsContent: FC<DataSettingsContentProps> = memo(({ scrollable = true }) => {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const { clearHistory } = useWatchHistoryActions();
  const { clearList } = useMyListActions();
  const clearProfileIntegrations = useIntegrationsStore((state) => state.clearProfileIntegrations);
  const addToast = useToastStore((state) => state.addToast);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear Watch History',
      'Are you sure you want to clear your entire watch history and "Continue Watching" items for this profile? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearHistory();
            addToast({
              title: 'Watch History Cleared',
              preset: 'success',
            });
          },
        },
      ]
    );
  }, [clearHistory, addToast]);

  const handleClearList = useCallback(() => {
    Alert.alert(
      'Clear My List',
      'Are you sure you want to remove all items from "My List" for this profile? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearList();
            addToast({
              title: 'My List Cleared',
              preset: 'success',
            });
          },
        },
      ]
    );
  }, [clearList, addToast]);

  const handleResetSimkl = useCallback(() => {
    Alert.alert(
      'Reset Simkl Sync',
      'Are you sure you want to reset your Simkl connection and sync cursors for this profile? You will need to reconnect your Simkl account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (activeProfileId) {
              clearProfileIntegrations(activeProfileId);
              addToast({
                title: 'Simkl Sync Reset',
                preset: 'success',
              });
            }
          },
        },
      ]
    );
  }, [activeProfileId, clearProfileIntegrations, addToast]);

  const content = (
    <Box paddingVertical="m" paddingHorizontal="m" gap="l" paddingBottom="xl">
      <SettingsCard title="Watch History">
        <SettingsRow
          label="Clear Watch History"
          description="Remove all watch progress and history items for this profile">
          <Button title="Clear" onPress={handleClearHistory} variant="secondary" />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="My List">
        <SettingsRow
          label="Clear My List"
          description="Remove all movies and shows saved to your list for this profile">
          <Button title="Clear" onPress={handleClearList} variant="secondary" />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Integrations">
        <SettingsRow
          label="Reset Simkl Sync"
          description="Clear Simkl connection and synchronization state for this profile">
          <Button title="Reset" onPress={handleResetSimkl} variant="secondary" />
        </SettingsRow>
      </SettingsCard>

      <Box paddingHorizontal="m" marginTop="m">
        <Text variant="caption" color="textSecondary" textAlign="center">
          These actions only affect the currently active profile. Local settings and other profiles
          will remain unchanged.
        </Text>
      </Box>
    </Box>
  );

  if (!scrollable) {
    return content;
  }

  return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
});
