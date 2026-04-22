import { FC, memo, useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
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

const SYNC_MODE_OPTIONS: { value: SyncMode; label: string; description: string }[] = [
  {
    value: 'pull',
    label: 'Import only',
    description: 'Pull watch history and watchlist from Simkl into DodoStream',
  },
  {
    value: 'push',
    label: 'Export only',
    description: 'Export DodoStream history and watchlist to Simkl',
  },
  {
    value: 'full',
    label: 'Full sync',
    description: 'Sync history and watchlist in both directions',
  },
];

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
    const theme = useTheme<Theme>();
    const lastSyncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Never';

    if (!isConnected || !settings) {
      return null;
    }

    return (
      <>
        <SettingsCard title="Sync Mode">
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

        <SettingsCard title="Sync">
          <SettingsRow label="Last synced">
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
              <Text variant="body">{isSyncing ? 'Syncing…' : 'Sync Now'}</Text>
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
            title: 'Connection failed',
            message: 'Could not fetch Simkl user info. Please try again.',
            preset: 'error',
            duration: TOAST_DURATION_SHORT,
          });
        }
      },
      [activeProfileId, debug]
    );

    const handleFirstConnectDone = useCallback(() => {
      setShowFirstConnectModal(false);
      setPendingConnection(null);
      showToast({
        title: 'Simkl connected',
        duration: TOAST_DURATION_SHORT,
      });
    }, []);

    const handleDisconnect = useCallback(() => {
      if (!activeProfileId) return;
      disconnectSimkl(activeProfileId);
      showToast({ title: 'Simkl disconnected', duration: TOAST_DURATION_SHORT });
    }, [activeProfileId, disconnectSimkl]);

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
