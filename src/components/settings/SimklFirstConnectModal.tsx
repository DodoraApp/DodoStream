import { FC, memo, useCallback, useState } from 'react';
import { Modal } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@shopify/restyle';
import { SIMKL_CLIENT_ID } from '@/api/simkl/config';
import { runImport, runExport } from '@/api/simkl/sync-service';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';
import { useIntegrationsStore } from '@/store/integrations.store';
import { Box, Text, Theme } from '@/theme/theme';
import type { SimklConnection, SyncMode } from '@/types/integrations';
import { Focusable } from '@/components/basic/Focusable';
import { SettingsSwitch } from './SettingsSwitch';
import { RadioButton } from './RadioButton';
import { Button } from '@/components/basic/Button';

interface SimklFirstConnectModalProps {
  visible: boolean;
  profileId: string;
  connection: SimklConnection;
  onDone: () => void;
}

interface SyncChoice {
  id: 'import' | 'export' | 'full' | 'skip';
  label: string;
  description: string;
  syncMode: SyncMode;
}

const SYNC_CHOICES: SyncChoice[] = [
  {
    id: 'import',
    label: 'Sync from Simkl',
    description: 'Pull your Simkl watch history and watchlist into DodoStream',
    syncMode: 'pull',
  },
  {
    id: 'export',
    label: 'Sync to Simkl',
    description: 'Export your DodoStream history and watchlist to Simkl',
    syncMode: 'push',
  },
  {
    id: 'full',
    label: 'Full sync (both)',
    description: 'Full synchronization of history and watchlist in both directions',
    syncMode: 'full',
  },
];

export const SimklFirstConnectModal: FC<SimklFirstConnectModalProps> = memo(
  ({ visible, profileId, connection, onDone }) => {
    const theme = useTheme<Theme>();
    const queryClient = useQueryClient();
    const [selectedChoice, setSelectedChoice] = useState<SyncChoice['id']>('full');
    const [clearLocalFirst, setClearLocalFirst] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleConfirm = useCallback(async () => {
      const choice = SYNC_CHOICES.find((c) => c.id === selectedChoice)!;
      setIsSyncing(true);

      try {
        // Save connection with chosen sync mode
        useIntegrationsStore.getState().connectSimkl(profileId, connection, choice.syncMode);

        if (choice.id === 'import' || choice.id === 'full') {
          await runImport(profileId, connection.accessToken, undefined, {
            clearLocalFirst,
          });
        }
        if (choice.id === 'export' || choice.id === 'full') {
          await runExport(profileId, connection.accessToken);
        }

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: watchHistoryKeys.continueWatching(profileId),
          }),
          queryClient.invalidateQueries({
            queryKey: watchHistoryKeys.metaSummaries(profileId),
          }),
        ]);
      } finally {
        setIsSyncing(false);
        onDone();
      }
    }, [selectedChoice, profileId, connection, clearLocalFirst, onDone, queryClient]);

    const showClearOption = selectedChoice === 'import' || selectedChoice === 'full';

    return (
      <Modal visible={visible} transparent animationType="fade">
        <Box flex={1} backgroundColor="mainBackground" justifyContent="center" alignItems="center">
          <Box
            backgroundColor="cardBackground"
            borderRadius="l"
            padding="xl"
            gap="l"
            style={{
              maxWidth: theme.sizes.modalMinWidthWide.tv,
              width: '90%',
            }}>
            <Box gap="xs">
              <Text variant="header" textAlign="center">
                Welcome to Simkl Sync
              </Text>
              <Text variant="body" color="textSecondary" textAlign="center">
                Connected as {connection.username}. How would you like to start?
              </Text>
            </Box>

            <Box gap="s">
              {SYNC_CHOICES.map((choice) => (
                <Focusable
                  key={choice.id}
                  onPress={() => setSelectedChoice(choice.id)}
                  variant="background">
                  <Box
                    borderRadius="m"
                    padding="m"
                    flexDirection="row"
                    alignItems="center"
                    gap="m"
                    borderWidth={selectedChoice === choice.id ? theme.focus.borderWidthSmall : 0}
                    borderColor={
                      selectedChoice === choice.id ? 'primaryBackground' : 'cardBackground'
                    }>
                    <RadioButton selected={selectedChoice === choice.id} />
                    <Box flex={1} gap="xs">
                      <Text variant="body">{choice.label}</Text>
                      <Text variant="caption" color="textSecondary">
                        {choice.description}
                      </Text>
                    </Box>
                  </Box>
                </Focusable>
              ))}
            </Box>

            {showClearOption && (
              <SettingsSwitch
                value={clearLocalFirst}
                onValueChange={() => setClearLocalFirst((v) => !v)}
                label="Clear DodoStream history before importing"
                description="Removes all local watch history before pulling from Simkl"
              />
            )}

            <Button
              onPress={handleConfirm}
              variant="primary"
              title={isSyncing ? 'Syncing…' : 'Confirm'}
              disabled={isSyncing}
            />
          </Box>
        </Box>
      </Modal>
    );
  }
);

SimklFirstConnectModal.displayName = 'SimklFirstConnectModal';
