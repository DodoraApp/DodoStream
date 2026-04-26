import { FC, memo, useCallback, useState, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDebugLogger } from '@/utils/debug';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SimklPinAuthModal } from '@/components/settings/SimklPinAuthModal';
import { SimklFirstConnectModal } from '@/components/settings/SimklFirstConnectModal';
import { SimklConnectionCard } from '@/components/settings/SimklConnectionCard';
import { RadioButton } from '@/components/settings/RadioButton';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { useSimklSync, completeSimklConnection } from '@/api/simkl/hooks';
import type { ProfileIntegrationSettings, SyncMode, SimklConnection } from '@/types/integrations';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_SHORT } from '@/constants/ui';

interface SimklSyncSettingsProps {
  isConnected: boolean;
  settings?: ProfileIntegrationSettings['simkl'];
  isSyncing: boolean;
  lastSyncAt?: number;
  onSyncModeChange: (mode: SyncMode) => void;
  onSyncNow: () => void;
}

const SimklSyncSettings = memo(
  ({
    isConnected,
    settings,
    isSyncing,
    lastSyncAt,
    onSyncModeChange,
    onSyncNow,
  }: SimklSyncSettingsProps) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const lastSyncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : t('simkl.never');

    const SYNC_MODE_OPTIONS: { value: SyncMode; label: string; description: string }[] = useMemo(
      () => [
        {
          value: 'pull',
          label: t('simkl.sync_mode_import'),
          description: t('simkl.sync_mode_import_desc'),
        },
        {
          value: 'push',
          label: t('simkl.sync_mode_export'),
          description: t('simkl.sync_mode_export_desc'),
        },
        {
          value: 'full',
          label: t('simkl.sync_mode_full'),
          description: t('simkl.sync_mode_full_desc'),
        },
      ],
      [t]
    );

    if (!isConnected || !settings) {
      return null;
    }

    return (
      <>
        <SettingsCard title={t('simkl.sync_mode')}>
          <Box gap="s">
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
        </SettingsCard>

        <SettingsCard title={t('simkl.sync')}>
          <SettingsRow label={t('simkl.last_synced')}>
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
              <Text variant="body">{isSyncing ? t('simkl.syncing') : t('simkl.sync_now')}</Text>
            </Box>
          </Focusable>
        </SettingsCard>
      </>
    );
  }
);

SimklSyncSettings.displayName = 'SimklSyncSettings';

interface IntegrationsSettingsContentProps {
  scrollable?: boolean;
}

// This component orchestrates provider cards/settings at a higher level.
export const IntegrationsSettingsContent: FC<IntegrationsSettingsContentProps> = memo(
  ({ scrollable = true }) => {
    const { t } = useTranslation('settings');
    const debug = useDebugLogger('IntegrationsSettingsContent');
    const activeProfileId = useProfileStore((s) => s.activeProfileId);
    const simklSettings = useIntegrationsStore((s) =>
      activeProfileId ? s.settings[activeProfileId]?.simkl : undefined
    );
    const { disconnectSimkl, setSyncMode } = useIntegrationsStore();

    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<SimklConnection | null>(null);
    const [showFirstConnectModal, setShowFirstConnectModal] = useState(false);

    const { sync, isSyncing, lastSyncAt } = useSimklSync(activeProfileId);

    const handleConnectPress = useCallback(() => {
      setShowPinModal(true);
    }, []);

    const handlePinSuccess = useCallback(
      async (accessToken: string) => {
        setShowPinModal(false);
        if (!activeProfileId) return;
        try {
          const connection = await completeSimklConnection(activeProfileId, accessToken);
          // Temporarily store connection for first-connect modal
          // (connectSimkl will be called again inside the modal with the chosen syncMode)
          setPendingConnection(connection);
          setShowFirstConnectModal(true);
        } catch (error) {
          debug('completeSimklConnectionError', { error });
          showToast({
            title: t('simkl.connection_failed'),
            message: t('simkl.connection_failed_desc'),
            preset: 'error',
            duration: TOAST_DURATION_SHORT,
          });
        }
      },
      [activeProfileId, debug, t]
    );

    const handleFirstConnectDone = useCallback(() => {
      setShowFirstConnectModal(false);
      setPendingConnection(null);
      showToast({
        title: t('simkl.connected'),
        duration: TOAST_DURATION_SHORT,
      });
    }, [t]);

    const handleDisconnect = useCallback(() => {
      if (!activeProfileId) return;
      disconnectSimkl(activeProfileId);
      showToast({ title: t('simkl.disconnected'), duration: TOAST_DURATION_SHORT });
    }, [activeProfileId, disconnectSimkl, t]);

    const handleSyncModeChange = useCallback(
      (mode: SyncMode) => {
        if (!activeProfileId) return;
        setSyncMode(activeProfileId, mode);
      },
      [activeProfileId, setSyncMode]
    );

    const isConnected = !!simklSettings?.connection;

    const content = (
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        {/* Simkl connection card */}
        <SimklConnectionCard
          settings={simklSettings}
          onConnect={handleConnectPress}
          onDisconnect={handleDisconnect}
        />

        <SimklSyncSettings
          isConnected={isConnected}
          settings={simklSettings}
          isSyncing={isSyncing}
          lastSyncAt={lastSyncAt}
          onSyncModeChange={handleSyncModeChange}
          onSyncNow={sync}
        />
      </Box>
    );

    return (
      <>
        {scrollable ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}

        <SimklPinAuthModal
          visible={showPinModal}
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinModal(false)}
        />

        {pendingConnection && activeProfileId && (
          <SimklFirstConnectModal
            visible={showFirstConnectModal}
            profileId={activeProfileId}
            connection={pendingConnection}
            onDone={handleFirstConnectDone}
          />
        )}
      </>
    );
  }
);

IntegrationsSettingsContent.displayName = 'IntegrationsSettingsContent';
