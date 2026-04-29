import { FC, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { Button } from '@/components/basic/Button';
import { Focusable } from '@/components/basic/Focusable';
import { Box, Text, type Theme } from '@/theme/theme';
import type { SyncMode } from '@/types/integrations';

import { RadioButton } from './RadioButton';
import { SettingsSwitch } from './SettingsSwitch';

interface IntegrationFirstConnectModalProps {
  visible: boolean;
  /** i18n namespace ('trakt' | 'simkl') */
  i18nNs: string;
  /** Username to display in the connected prompt */
  username: string;
  /** Called when user confirms with their chosen sync mode and clearLocal flag */
  onConfirm: (syncMode: SyncMode, clearLocal: boolean) => Promise<void>;
  onDone: () => void;
}

interface SyncChoice {
  id: 'import' | 'export' | 'full' | 'skip';
  label: string;
  description: string;
  syncMode: SyncMode;
}

export const IntegrationFirstConnectModal: FC<IntegrationFirstConnectModalProps> = memo(
  ({ visible, i18nNs, username, onConfirm, onDone }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();

    const SYNC_CHOICES: SyncChoice[] = useMemo(
      () => [
        {
          id: 'import',
          label: t(`${i18nNs}.sync_from`),
          description: t(`${i18nNs}.sync_from_desc`),
          syncMode: 'pull',
        },
        {
          id: 'export',
          label: t(`${i18nNs}.sync_to`),
          description: t(`${i18nNs}.sync_to_desc`),
          syncMode: 'push',
        },
        {
          id: 'full',
          label: t(`${i18nNs}.sync_full`),
          description: t(`${i18nNs}.sync_full_desc`),
          syncMode: 'full',
        },
      ],
      [t, i18nNs]
    );

    const [selectedChoice, setSelectedChoice] = useState<SyncChoice['id']>('full');
    const [clearLocalFirst, setClearLocalFirst] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleConfirm = useCallback(async () => {
      const choice = SYNC_CHOICES.find((c) => c.id === selectedChoice)!;
      setIsSyncing(true);
      try {
        await onConfirm(choice.syncMode, clearLocalFirst);
      } finally {
        setIsSyncing(false);
        onDone();
      }
    }, [selectedChoice, clearLocalFirst, onDone, onConfirm, SYNC_CHOICES]);

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
                {t(`${i18nNs}.welcome`)}
              </Text>
              <Text variant="body" color="textSecondary" textAlign="center">
                {t(`${i18nNs}.connected_prompt`, { username })}
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
                label={t(`${i18nNs}.clear_local`)}
                description={t(`${i18nNs}.clear_local_desc`)}
              />
            )}

            <Button
              onPress={handleConfirm}
              variant="primary"
              title={isSyncing ? t(`${i18nNs}.syncing`) : t(`${i18nNs}.confirm`)}
              disabled={isSyncing}
            />
          </Box>
        </Box>
      </Modal>
    );
  }
);

IntegrationFirstConnectModal.displayName = 'IntegrationFirstConnectModal';
