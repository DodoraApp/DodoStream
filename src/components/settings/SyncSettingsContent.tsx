import { FC, memo, useCallback, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { Input } from '@/components/basic/Input';
import { Button } from '@/components/basic/Button';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { showToast } from '@/store/toast.store';
import { useSyncStore } from '@/store/sync.store';
import { useDebugLogger } from '@/utils/debug';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';
import type { SyncConnectionState } from '@/api/sync/websocket';

/** Maps connection state to a human-readable label */
const CONNECTION_STATE_LABELS: Record<SyncConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  authenticated: 'Syncing',
  error: 'Error',
};

/** Maps connection state to an Ionicon name */
const CONNECTION_STATE_ICONS: Record<SyncConnectionState, keyof typeof Ionicons.glyphMap> = {
  disconnected: 'cloud-offline-outline',
  connecting: 'cloud-outline',
  connected: 'cloud-outline',
  authenticated: 'cloud-done-outline',
  error: 'alert-circle-outline',
};

/**
 * Sync settings content component.
 * Provides UI for connecting to a self-hosted sync server that keeps
 * addons, watch history, my list, and continue watching in sync across devices.
 */
export const SyncSettingsContent: FC = memo(() => {
  const theme = useTheme<Theme>();
  const debug = useDebugLogger('SyncSettingsContent');

  // Sync store state
  const serverUrl = useSyncStore((s) => s.serverUrl);
  const connectionState = useSyncStore((s) => s.connectionState);
  const isEnabled = useSyncStore((s) => s.isEnabled);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const storeError = useSyncStore((s) => s.error);
  const isTesting = useSyncStore((s) => s.isTesting);
  const deviceStatus = useSyncStore((s) => s.deviceStatus);
  const isPollingApproval = useSyncStore((s) => s.isPollingApproval);

  // Actions
  const setServerUrl = useSyncStore((s) => s.setServerUrl);
  const connectToServer = useSyncStore((s) => s.connect);
  const disconnectFromServer = useSyncStore((s) => s.disconnect);
  const testConnection = useSyncStore((s) => s.testConnection);

  // Local UI state
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; version?: string; error?: string } | null>(null);

  const isConnected = connectionState === 'authenticated' || connectionState === 'connected';
  const isPendingApproval = deviceStatus === 'pending' && isEnabled;

  const handleTestConnection = useCallback(async () => {
    if (!urlInput.trim()) {
      showToast({ title: 'Missing URL', message: 'Enter a sync server URL', preset: 'error' });
      return;
    }

    setTestResult(null);
    const result = await testConnection(urlInput.trim());
    setTestResult(result);

    if (result.ok) {
      showToast({
        title: 'Connection successful',
        message: `${result.name ?? 'Sync Server'} v${result.version ?? '?'}`,
        preset: 'success',
        duration: TOAST_DURATION_MEDIUM,
      });
    } else {
      showToast({
        title: 'Connection failed',
        message: result.error ?? 'Could not reach server',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
    }

    debug('testConnection', result);
  }, [urlInput, testConnection, debug]);

  const handleConnect = useCallback(async () => {
    if (!urlInput.trim()) {
      showToast({ title: 'Missing URL', message: 'Enter a sync server URL', preset: 'error' });
      return;
    }

    setIsConnecting(true);
    setServerUrl(urlInput.trim());

    await connectToServer(password || undefined);

    // Read the latest store state *after* connect finishes to check the result.
    const { isEnabled, error, deviceStatus } = useSyncStore.getState();

    if (isEnabled && !error) {
      const message = deviceStatus === 'pending'
        ? 'Device registered — waiting for admin approval'
        : 'Sync is now active across your devices';
      showToast({
        title: deviceStatus === 'pending' ? 'Registered' : 'Connected',
        message,
        preset: 'success',
        duration: TOAST_DURATION_MEDIUM,
      });
    } else {
      showToast({
        title: 'Connection failed',
        message: error ?? 'Could not connect to sync server',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
    }

    setIsConnecting(false);
    setPassword('');
  }, [urlInput, password, setServerUrl, connectToServer]);

  const handleDisconnect = useCallback(() => {
    disconnectFromServer();
    showToast({ title: 'Disconnected', message: 'Sync has been turned off', duration: TOAST_DURATION_MEDIUM });
  }, [disconnectFromServer]);

  const stateColor = connectionState === 'authenticated'
    ? theme.colors.primaryBackground
    : connectionState === 'error'
      ? theme.colors.danger
      : theme.colors.textSecondary;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">

        {/* Pending Approval */}
        {isPendingApproval && (
          <SettingsCard title="Waiting for Approval">
            <Box flexDirection="row" alignItems="center" gap="m">
              <Ionicons
                name="hourglass-outline"
                size={28}
                color={theme.colors.warning ?? '#fdcb6e'}
              />
              <Box flex={1} gap="xs">
                <Text variant="body" color="textPrimary">
                  Pending Admin Approval
                </Text>
                <Text variant="caption" color="textSecondary">
                  Your device has been registered with the sync server.
                  Ask the server admin to approve it from the dashboard.
                </Text>
                {isPollingApproval && (
                  <Text variant="caption" color="textSecondary">
                    Checking for approval…
                  </Text>
                )}
              </Box>
            </Box>

            <Button
              variant="tertiary"
              title="Cancel"
              icon="close-outline"
              onPress={handleDisconnect}
            />
          </SettingsCard>
        )}

        {/* Connection Status */}
        {isEnabled && !isPendingApproval && (
          <SettingsCard title="Status">
            <Box flexDirection="row" alignItems="center" gap="m">
              <Ionicons
                name={CONNECTION_STATE_ICONS[connectionState]}
                size={28}
                color={stateColor}
              />
              <Box flex={1} gap="xs">
                <Text variant="body" color="textPrimary">
                  {CONNECTION_STATE_LABELS[connectionState]}
                </Text>
                {lastSyncAt && (
                  <Text variant="caption" color="textSecondary">
                    Last synced: {new Date(lastSyncAt).toLocaleString()}
                  </Text>
                )}
                {storeError && (
                  <Text variant="caption" color="danger">
                    {storeError}
                  </Text>
                )}
              </Box>
            </Box>

            <Button
              variant="tertiary"
              title="Disconnect"
              icon="log-out-outline"
              onPress={handleDisconnect}
            />
          </SettingsCard>
        )}

        {/* Server Configuration — hidden once connected */}
        {(!isEnabled || isPendingApproval) && (
        <SettingsCard title="Sync Server">
          <Text variant="caption" color="textSecondary">
            Connect to a self-hosted DodoStream sync server to keep your addons, watch history,
            my list, and continue watching data synchronized across all your devices.
          </Text>

          <Box gap="s">
            <Text variant="body">Server URL</Text>
            <Input
              icon="globe-outline"
              placeholder="http://192.168.1.100:8080"
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isConnecting}
            />
          </Box>

          <Box gap="s">
            <Text variant="body">Server Password (optional)</Text>
            <Input
              icon="lock-closed-outline"
              placeholder="Leave empty if none"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              editable={!isConnecting}
            />
          </Box>

          <Box flexDirection="row" gap="s">
            <Box flex={1}>
              <Button
                variant="secondary"
                title={isTesting ? 'Testing…' : 'Test'}
                icon="pulse-outline"
                onPress={() => void handleTestConnection()}
                disabled={isTesting || isConnecting}
              />
            </Box>
            <Box flex={1}>
              <Button
                variant="primary"
                title={isConnecting ? 'Connecting…' : isConnected ? 'Reconnect' : 'Connect'}
                icon="sync-outline"
                onPress={() => void handleConnect()}
                disabled={isConnecting}
              />
            </Box>
          </Box>

          {/* Test result */}
          {testResult && (
            <Box
              flexDirection="row"
              alignItems="center"
              gap="s"
              padding="s"
              backgroundColor="inputBackground"
              borderRadius="m">
              <Ionicons
                name={testResult.ok ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={testResult.ok ? theme.colors.primaryBackground : theme.colors.danger}
              />
              <Text variant="caption" color={testResult.ok ? 'textPrimary' : 'danger'}>
                {testResult.ok
                  ? `${testResult.name ?? 'Server'} v${testResult.version ?? '?'} — reachable`
                  : testResult.error ?? 'Unreachable'}
              </Text>
            </Box>
          )}
        </SettingsCard>
        )}

        {/* What Syncs */}
        <SettingsCard title="What Gets Synced">
          <SyncFeatureRow
            icon="extension-puzzle-outline"
            label="Addons"
            description="Install or remove an addon on one device and it appears on all others"
          />
          <SyncFeatureRow
            icon="time-outline"
            label="Watch History"
            description="Resume playback on any device from where you left off"
          />
          <SyncFeatureRow
            icon="bookmark-outline"
            label="My List"
            description="Saved items stay in sync everywhere"
          />
          <SyncFeatureRow
            icon="eye-off-outline"
            label="Continue Watching"
            description="Hidden items and progress are shared across devices"
          />
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

SyncSettingsContent.displayName = 'SyncSettingsContent';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface SyncFeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}

const SyncFeatureRow: FC<SyncFeatureRowProps> = memo(({ icon, label, description }) => {
  const theme = useTheme<Theme>();
  return (
    <Box flexDirection="row" alignItems="center" gap="m" paddingVertical="xs">
      <Ionicons name={icon} size={20} color={theme.colors.primaryBackground} />
      <Box flex={1} gap="xs">
        <Text variant="body" color="textPrimary">
          {label}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={2}>
          {description}
        </Text>
      </Box>
    </Box>
  );
});

SyncFeatureRow.displayName = 'SyncFeatureRow';
