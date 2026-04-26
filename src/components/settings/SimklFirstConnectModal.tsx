import { FC, memo, useCallback, useState, useMemo } from 'react';
import { Modal } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@shopify/restyle';
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

export const SimklFirstConnectModal: FC<SimklFirstConnectModalProps> = memo(
  ({ visible, profileId, connection, onDone }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const queryClient = useQueryClient();

    const SYNC_CHOICES: SyncChoice[] = useMemo(
      () => [
        {
          id: 'import',
          label: t('simkl.sync_from'),
          description: t('simkl.sync_from_desc'),
          syncMode: 'pull',
        },
        {
          id: 'export',
          label: t('simkl.sync_to'),
          description: t('simkl.sync_to_desc'),
          syncMode: 'push',
        },
        {
          id: 'full',
          label: t('simkl.sync_full'),
          description: t('simkl.sync_full_desc'),
          syncMode: 'full',
        },
      ],
      [t]
    );

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
    }, [selectedChoice, profileId, connection, clearLocalFirst, onDone, queryClient, SYNC_CHOICES]);

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
                {t('simkl.welcome')}
              </Text>
              <Text variant="body" color="textSecondary" textAlign="center">
                {t('simkl.connected_prompt', { username: connection.username })}
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
                label={t('simkl.clear_local')}
                description={t('simkl.clear_local_desc')}
              />
            )}

            <Button
              onPress={handleConfirm}
              variant="primary"
              title={isSyncing ? t('simkl.syncing') : t('simkl.confirm')}
              disabled={isSyncing}
            />
          </Box>
        </Box>
      </Modal>
    );
  }
);

SimklFirstConnectModal.displayName = 'SimklFirstConnectModal';
