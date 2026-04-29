import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

import { Focusable } from '@/components/basic/Focusable';
import { RadioButton } from '@/components/settings/RadioButton';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { Box, Text, type Theme } from '@/theme/theme';
import type { SyncMode } from '@/types/integrations';

interface IntegrationSettingsCardProps {
  /** Card title (e.g. 'Trakt.tv', 'Simkl') */
  title: string;
  /** Provider logo element */
  logo: React.ReactNode;
  /** URL to open when logo is pressed */
  websiteUrl: string;
  /** i18n namespace ('trakt' | 'simkl') */
  i18nNs: string;
  /** Current settings from store */
  settings?: { connection?: { username: string }; syncMode: SyncMode };
  isSyncing: boolean;
  lastSyncAt?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncModeChange: (mode: SyncMode) => void;
  onSyncNow: () => void;
  /** When true, the connect button is disabled (e.g. because the other service is connected) */
  disabled?: boolean;
  /** Reason shown when the connect button is disabled */
  disabledReason?: string;
}

export const IntegrationSettingsCard: FC<IntegrationSettingsCardProps> = memo(
  ({
    title,
    logo,
    websiteUrl,
    i18nNs,
    settings,
    isSyncing,
    lastSyncAt,
    onConnect,
    onDisconnect,
    onSyncModeChange,
    onSyncNow,
    disabled,
    disabledReason,
  }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const isConnected = !!settings?.connection;

    const lastSyncLabel = lastSyncAt
      ? new Date(lastSyncAt).toLocaleTimeString()
      : t(`${i18nNs}.never`);

    const SYNC_MODE_OPTIONS: { value: SyncMode; label: string; description: string }[] = useMemo(
      () => [
        {
          value: 'pull',
          label: t(`${i18nNs}.sync_mode_import`),
          description: t(`${i18nNs}.sync_mode_import_desc`),
        },
        {
          value: 'push',
          label: t(`${i18nNs}.sync_mode_export`),
          description: t(`${i18nNs}.sync_mode_export_desc`),
        },
        {
          value: 'full',
          label: t(`${i18nNs}.sync_mode_full`),
          description: t(`${i18nNs}.sync_mode_full_desc`),
        },
      ],
      [t, i18nNs]
    );

    const handleWebsiteLink = useCallback(() => {
      Linking.openURL(websiteUrl);
    }, [websiteUrl]);

    return (
      <SettingsCard title={title}>
        <Focusable onPress={handleWebsiteLink} variant="background">
          <Box
            borderRadius="m"
            paddingHorizontal="m"
            paddingVertical="s"
            flexDirection="row"
            alignItems="center"
            gap="s">
            {logo}
            <Text variant="caption" color="textSecondary" flex={1}>
              {t(`${i18nNs}.desc`)}
            </Text>
          </Box>
        </Focusable>

        {isConnected ? (
          <>
            <SettingsRow label={t(`${i18nNs}.connected_as`)}>
              <Text variant="body" color="textSecondary">
                {settings!.connection!.username}
              </Text>
            </SettingsRow>

            <Box gap="s" marginTop="s">
              <Text variant="subheader" color="textSecondary" paddingHorizontal="m">
                {t(`${i18nNs}.sync_mode`)}
              </Text>
              {SYNC_MODE_OPTIONS.map((option) => (
                <Focusable
                  key={option.value}
                  onPress={() => onSyncModeChange(option.value)}
                  variant="background">
                  <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
                    <RadioButton selected={settings.syncMode === option.value} />
                    <Box flex={1} gap="xs">
                      <Text variant="body">{option.label}</Text>
                      <Text variant="caption" color="textSecondary">
                        {option.description}
                      </Text>
                    </Box>
                  </Box>
                </Focusable>
              ))}
            </Box>

            <Box marginTop="s" />
            <SettingsRow label={t(`${i18nNs}.last_synced`)}>
              <Text variant="body" color="textSecondary">
                {lastSyncLabel}
              </Text>
            </SettingsRow>

            <Focusable onPress={onSyncNow} variant="background" disabled={isSyncing}>
              <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
                <Ionicons
                  name={isSyncing ? 'hourglass-outline' : 'sync-outline'}
                  size={theme.sizes.iconMedium}
                  color={theme.colors.textSecondary}
                />
                <Text variant="body">
                  {isSyncing ? t(`${i18nNs}.syncing`) : t(`${i18nNs}.sync_now`)}
                </Text>
              </Box>
            </Focusable>

            <Focusable onPress={onDisconnect} variant="background">
              <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
                <Ionicons
                  name="log-out-outline"
                  size={theme.sizes.iconMedium}
                  color={theme.colors.textSecondary}
                />
                <Text variant="body" color="textSecondary">
                  {t(`${i18nNs}.disconnect`)}
                </Text>
              </Box>
            </Focusable>
          </>
        ) : (
          <>
            <Focusable onPress={onConnect} variant="background" disabled={disabled}>
              <Box
                borderRadius="m"
                padding="m"
                flexDirection="row"
                alignItems="center"
                gap="m"
                opacity={disabled ? 0.5 : 1}>
                <Ionicons
                  name="link-outline"
                  size={theme.sizes.iconMedium}
                  color={theme.colors.textSecondary}
                />
                <Text variant="body">{t(`${i18nNs}.connect`)}</Text>
              </Box>
            </Focusable>
            {!!disabledReason && (
              <Text variant="caption" color="textSecondary" paddingHorizontal="m">
                {disabledReason}
              </Text>
            )}
          </>
        )}
      </SettingsCard>
    );
  }
);

IntegrationSettingsCard.displayName = 'IntegrationSettingsCard';
