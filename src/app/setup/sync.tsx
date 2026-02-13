import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { WIZARD_CONTENT_FADE_MS, TOAST_DURATION_MEDIUM } from '@/constants/ui';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { Input } from '@/components/basic/Input';
import { Button } from '@/components/basic/Button';
import { showToast } from '@/store/toast.store';
import { useSyncStore } from '@/store/sync.store';
import { useProfileStore } from '@/store/profile.store';

/**
 * Sync server connection step during setup wizard.
 *
 * If the server already has profiles, they are synced down and the user
 * is taken straight to the completion screen. Otherwise, the user is
 * directed to create a profile first.
 */
export default function SyncStep() {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const setServerUrl = useSyncStore((s) => s.setServerUrl);
  const connectToServer = useSyncStore((s) => s.connect);
  const testConnection = useSyncStore((s) => s.testConnection);
  const isTesting = useSyncStore((s) => s.isTesting);
  const isPollingApproval = useSyncStore((s) => s.isPollingApproval);

  const [urlInput, setUrlInput] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    name?: string;
    version?: string;
    error?: string;
  } | null>(null);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTest = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) {
      showToast({ title: 'Missing URL', message: 'Enter a sync server URL', preset: 'error' });
      return;
    }
    setTestResult(null);
    const result = await testConnection(url);
    setTestResult(result);
  }, [urlInput, testConnection]);

  const handleConnect = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) {
      showToast({ title: 'Missing URL', message: 'Enter a sync server URL', preset: 'error' });
      return;
    }

    setIsConnecting(true);
    setServerUrl(url);

    await connectToServer(password || undefined);

    const { isEnabled, error, deviceStatus } = useSyncStore.getState();

    if (!isEnabled || error) {
      showToast({
        title: 'Connection failed',
        message: error ?? 'Could not connect to sync server',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
      setIsConnecting(false);
      return;
    }

    if (deviceStatus === 'pending') {
      showToast({
        title: 'Registered',
        message: 'Waiting for admin approval — check back later',
        preset: 'success',
        duration: TOAST_DURATION_MEDIUM,
      });
      setIsConnecting(false);
      return;
    }

    // Connected & approved — check if the server had profiles
    const hasProfiles = Object.keys(useProfileStore.getState().profiles).length > 0;

    showToast({
      title: 'Connected',
      message: hasProfiles ? 'Profiles synced from server' : 'No profiles on server yet',
      preset: 'success',
      duration: TOAST_DURATION_MEDIUM,
    });

    setIsConnecting(false);

    if (hasProfiles) {
      // Server had profiles — skip profile creation, go straight to addons
      const firstProfileId = Object.keys(useProfileStore.getState().profiles)[0];
      useProfileStore.getState().switchProfile(firstProfileId);
      router.push('/setup/addons');
    } else {
      // Server has no profiles — need to create one
      router.push('/setup/profile');
    }
  }, [urlInput, password, setServerUrl, connectToServer, router]);

  return (
    <WizardContainer>
      <Box flex={1} paddingHorizontal="l" paddingVertical="m" gap="m">
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS }}>
          <Box gap="s">
            <Text variant="header">Connect to Sync Server</Text>
            <Text variant="body" color="textSecondary">
              Enter the URL and optional password for your DodoStream sync server. Your profiles,
              addons, and watch history will be synced automatically.
            </Text>
          </Box>
        </MotiView>

        {/* Form */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 100 }}
            style={{ flex: 1 }}>
            <Box flex={1} gap="l" paddingVertical="m">
              {/* URL input */}
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

              {/* Password input */}
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

              {/* Pending approval notice */}
              {isPollingApproval && (
                <Box
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  padding="m"
                  backgroundColor="cardBackground"
                  borderRadius="m">
                  <Ionicons
                    name="hourglass-outline"
                    size={22}
                    color={'#fdcb6e'}
                  />
                  <Box flex={1}>
                    <Text variant="body">Waiting for Admin Approval</Text>
                    <Text variant="caption" color="textSecondary">
                      Your device is registered. Ask the server admin to approve it.
                    </Text>
                  </Box>
                </Box>
              )}
            </Box>
          </MotiView>
        </ScrollView>

        {/* Buttons */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 200 }}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" paddingVertical="m">
            <Button variant="tertiary" icon="arrow-back" title="Back" onPress={handleBack} />

            <Box flexDirection="row" gap="s">
              <Button
                variant="secondary"
                title={isTesting ? 'Testing…' : 'Test'}
                icon="pulse-outline"
                onPress={() => void handleTest()}
                disabled={isTesting || isConnecting}
              />
              <Button
                variant="primary"
                title={isConnecting ? 'Connecting…' : 'Connect'}
                icon="sync-outline"
                onPress={() => void handleConnect()}
                disabled={isConnecting}
                hasTVPreferredFocus
              />
            </Box>
          </Box>
        </MotiView>
      </Box>
    </WizardContainer>
  );
}
