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
import { useAddonStore } from '@/store/addon.store';
import { syncFromStremio, StremioSyncResult } from '@/api/stremio/sync';
import { useDebugLogger } from '@/utils/debug';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';

/**
 * Sync settings content component
 * Provides UI for syncing addons from Stremio and a coming-soon sync server section
 */
export const SyncSettingsContent: FC = memo(() => {
  const theme = useTheme<Theme>();
  const debug = useDebugLogger('SyncSettingsContent');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<StremioSyncResult | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const addAddon = useAddonStore((state) => state.addAddon);
  const hasAddon = useAddonStore((state) => state.hasAddon);

  const handleSyncFromStremio = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      showToast({
        title: 'Missing credentials',
        message: 'Please enter your Stremio email and password',
        preset: 'error',
      });
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    setProgress(null);

    try {
      const result = await syncFromStremio(
        email.trim(),
        password.trim(),
        addAddon,
        hasAddon,
        (current, total) => setProgress({ current, total }),
      );

      setSyncResult(result);
      setPassword('');
      setProgress(null);

      if (result.installed > 0) {
        showToast({
          title: 'Sync complete',
          message: `Installed ${result.installed} addon${result.installed !== 1 ? 's' : ''}`,
          preset: 'success',
          duration: TOAST_DURATION_MEDIUM,
        });
      } else if (result.alreadyInstalled === result.total) {
        showToast({
          title: 'Already up to date',
          message: 'All addons are already installed',
          duration: TOAST_DURATION_MEDIUM,
        });
      } else {
        showToast({
          title: 'Sync complete',
          message: 'No new addons to install',
          duration: TOAST_DURATION_MEDIUM,
        });
      }

      debug('syncComplete', result);
    } catch (error) {
      setProgress(null);
      const message = error instanceof Error ? error.message : 'Sync failed';
      showToast({
        title: 'Sync failed',
        message,
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      debug('syncFailed', { error });
    } finally {
      setIsSyncing(false);
    }
  }, [email, password, addAddon, hasAddon, debug]);

  const buttonTitle = isSyncing
    ? progress
      ? `Syncing ${progress.current}/${progress.total}...`
      : 'Logging in...'
    : 'Sync from Stremio';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        {/* Stremio Sync */}
        <SettingsCard title="Sync from Stremio">
          <Text variant="caption" color="textSecondary">
            Log in with your Stremio account to import your installed addons. Only third-party
            addons will be synced official Stremio addons are skipped.
          </Text>

          <Box gap="s">
            <Text variant="body">Email</Text>
            <Input
              icon="mail-outline"
              placeholder="stremio@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isSyncing}
            />
          </Box>

          <Box gap="s">
            <Text variant="body">Password</Text>
            <Input
              icon="lock-closed-outline"
              placeholder="Your Stremio password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              editable={!isSyncing}
            />
          </Box>

          <Button
            variant="primary"
            title={buttonTitle}
            icon="sync-outline"
            onPress={() => void handleSyncFromStremio()}
            disabled={isSyncing}
          />

          <Text variant="caption" color="textSecondary">
            Your credentials are only used to authenticate with the Stremio API and are not stored.
          </Text>
        </SettingsCard>

        {/* Sync Result */}
        {syncResult && (
          <SettingsCard title="Last Sync Result">
            <SettingsRow label="Third-party addons found">
              <Text variant="body" color="textSecondary">
                {syncResult.total}
              </Text>
            </SettingsRow>

            <SettingsRow label="Newly installed">
              <Text variant="body" color="textSecondary">
                {syncResult.installed}
              </Text>
            </SettingsRow>

            <SettingsRow label="Already installed">
              <Text variant="body" color="textSecondary">
                {syncResult.alreadyInstalled}
              </Text>
            </SettingsRow>

            {syncResult.failed > 0 && (
              <SettingsRow label="Failed">
                <Text variant="body" color="danger">
                  {syncResult.failed}
                </Text>
              </SettingsRow>
            )}

            {syncResult.details.length > 0 && (
              <Box gap="xs" marginTop="s">
                <Text variant="body" color="textSecondary">
                  Details
                </Text>
                {syncResult.details.map((detail) => (
                  <Box
                    key={detail.transportUrl}
                    flexDirection="row"
                    alignItems="center"
                    gap="s"
                    paddingVertical="xs">
                    <Ionicons
                      name={
                        detail.status === 'installed'
                          ? 'checkmark-circle'
                          : detail.status === 'already_installed'
                            ? 'ellipse-outline'
                            : 'close-circle'
                      }
                      size={16}
                      color={
                        detail.status === 'installed'
                          ? theme.colors.primaryBackground
                          : detail.status === 'failed'
                            ? theme.colors.danger
                            : theme.colors.textSecondary
                      }
                    />
                    <Box flex={1}>
                      <Text variant="caption" color="textPrimary" numberOfLines={1}>
                        {detail.name}
                      </Text>
                      {detail.reason && (
                        <Text variant="caption" color="danger" numberOfLines={1}>
                          {detail.reason}
                        </Text>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </SettingsCard>
        )}

        {/* Sync Server — Coming Soon */}
        <SettingsCard title="Sync Server">
          <Box
            backgroundColor="inputBackground"
            borderRadius="m"
            padding="m"
            alignItems="center"
            gap="s">
            <Ionicons name="cloud-outline" size={32} color={theme.colors.textSecondary} />
            <Text variant="body" color="textSecondary">
              Coming Soon
            </Text>
            <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
              Connect to a syncing server to keep your data synchronized across devices. This
              feature is currently in development.
            </Text>
          </Box>
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

SyncSettingsContent.displayName = 'SyncSettingsContent';
