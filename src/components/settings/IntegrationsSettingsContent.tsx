import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import * as Burnt from 'burnt';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { Button } from '@/components/basic/Button';
import { simklCreatePin, simklPollPin } from '@/api/simkl/auth';
import { SIMKL_PIN_POLL_TICK_MS } from '@/constants/tracking';
import { useSimklStore } from '@/store/simkl.store';
import { useTrackingStore } from '@/store/tracking.store';
import { createDebugLogger } from '@/utils/debug';
import { performTrackingSync } from '@/api/tracking/sync';
import { TOAST_DURATION_MEDIUM } from '@/constants/ui';

const debug = createDebugLogger('IntegrationsSettings');

export const IntegrationsSettingsContent: FC = memo(() => {
  const theme = useTheme<Theme>();
  const activeTracking = useTrackingStore((state) => state.getActiveTracking());
  const setEnabled = useTrackingStore((state) => state.setEnabled);
  const setAutoSyncEnabled = useTrackingStore((state) => state.setAutoSyncEnabled);
  const resetTracking = useTrackingStore((state) => state.reset);

  const simkl = useSimklStore((state) => state.getActiveSimkl());
  const getAccessToken = useSimklStore((state) => state.getAccessToken);
  const setAuthStatus = useSimklStore((state) => state.setAuthStatus);
  const setAccessToken = useSimklStore((state) => state.setAccessToken);
  const setPin = useSimklStore((state) => state.setPin);
  const clearAuth = useSimklStore((state) => state.clearAuth);
  const isScrobblingEnabled = useSimklStore((state) => state.isScrobblingEnabled);
  const setScrobblingEnabled = useSimklStore((state) => state.setScrobblingEnabled);

  const isConnected = useMemo(() => !!getAccessToken(), [getAccessToken]);
  const [isStartingPin, setIsStartingPin] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleOpenSimkl = useCallback(async () => {
    const url = simkl.pin?.verificationUrl ?? 'https://simkl.com/pin/';
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      debug('openBrowserFailed', { url, error });
      Burnt.toast({
        title: 'Failed to open browser',
        message: 'Please open Simkl in your browser and enter the code.',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
    }
  }, [simkl.pin?.verificationUrl]);

  const startPolling = useCallback(
    (userCode: string) => {
      debug('startPolling', { userCode });
      stopPolling();

      pollingRef.current = setInterval(async () => {
        try {
          const result = await simklPollPin(userCode);
          const token = result.access_token;
          if (!token) return;

          debug('pinConnected');
          stopPolling();
          setPin(undefined);
          setAccessToken(token);
          setAuthStatus('connected');
          Burnt.toast({
            title: 'Simkl connected',
            preset: 'done',
            duration: TOAST_DURATION_MEDIUM,
          });
        } catch (error) {
          debug('pollFailed', { error });
        }
      }, SIMKL_PIN_POLL_TICK_MS);
    },
    [setAccessToken, setAuthStatus, setPin, stopPolling]
  );

  const handleConnectSimkl = useCallback(async () => {
    if (isStartingPin) return;
    debug('handleConnectSimkl', { action: 'start' });
    setIsStartingPin(true);
    stopPolling();

    try {
      setAuthStatus('connecting');
      const pin = await simklCreatePin();
      const userCode = pin.user_code;
      debug('handleConnectSimkl', { action: 'pinReceived', userCode, expiresIn: pin.expires_in });
      if (!userCode) {
        setAuthStatus('error', pin.message ?? 'Failed to start PIN flow');
        return;
      }

      const createdAt = Date.now();
      const expiresAt = pin.expires_in ? createdAt + pin.expires_in * 1000 : undefined;

      setPin({
        userCode,
        verificationUrl: pin.verification_url ?? 'https://simkl.com/pin/',
        createdAt,
        expiresAt,
      });

      Burnt.toast({
        title: 'Enter code on Simkl',
        message: userCode,
        preset: 'none',
        duration: TOAST_DURATION_MEDIUM,
      });

      startPolling(userCode);
    } catch (error: any) {
      debug('connectFailed', { error });
      setAuthStatus('error', typeof error?.message === 'string' ? error.message : 'Connect failed');
      Burnt.toast({
        title: 'Simkl connect failed',
        message: typeof error?.message === 'string' ? error.message : 'Unknown error',
        preset: 'error',
        duration: TOAST_DURATION_MEDIUM,
      });
    } finally {
      setIsStartingPin(false);
    }
  }, [isStartingPin, setAuthStatus, setPin, startPolling, stopPolling]);

  const handleDisconnect = useCallback(() => {
    debug('handleDisconnect');
    stopPolling();
    clearAuth();
    resetTracking(); // Clear tracking data for fresh start on reconnect
    Burnt.toast({
      title: 'Simkl disconnected',
      preset: 'done',
      duration: TOAST_DURATION_MEDIUM,
    });
  }, [clearAuth, resetTracking, stopPolling]);

  const handleSyncNow = useCallback(async () => {
    debug('handleSyncNow');
    await performTrackingSync({ reason: 'manual', showToast: true });
  }, []);

  const syncStatusLabel = useMemo(() => {
    if (activeTracking.syncStatus === 'syncing') return 'Syncing…';
    if (activeTracking.syncStatus === 'error') return 'Error';
    return 'Idle';
  }, [activeTracking.syncStatus]);

  const statusDotSize = theme.spacing.s;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        <SettingsCard title="Tracking">
          <SettingsSwitch
            label="Enable tracking"
            description="Sync watch history across devices using Simkl"
            value={activeTracking.enabled}
            onValueChange={setEnabled}
          />

          <SettingsSwitch
            label="Auto sync"
            description="Sync in the background when the app becomes active"
            value={activeTracking.autoSyncEnabled}
            onValueChange={setAutoSyncEnabled}
          />

          <SettingsRow label="Status" description={activeTracking.syncError}>
            <Text
              variant="body"
              color={activeTracking.syncStatus === 'error' ? 'danger' : 'textSecondary'}>
              {syncStatusLabel}
            </Text>
          </SettingsRow>

          <Box flexDirection="row" gap="m" marginTop="s">
            <Box flex={1}>
              <Button
                title="Sync now"
                icon="sync"
                variant="secondary"
                onPress={handleSyncNow}
                disabled={!activeTracking.enabled || !isConnected}
              />
            </Box>
          </Box>
        </SettingsCard>

        <SettingsCard title="Simkl">
          {!isConnected ? (
            <>
              <Text variant="caption" color="textSecondary">
                Connect with a PIN code. No passwords are stored in DodoStream.
              </Text>

              {simkl.pin?.userCode ? (
                <Box gap="s" marginTop="s">
                  <Box
                    backgroundColor="inputBackground"
                    borderRadius="m"
                    padding="m"
                    alignItems="center">
                    <Text variant="subheader">{simkl.pin.userCode}</Text>
                    <Text variant="caption" color="textSecondary">
                      Enter this code on Simkl
                    </Text>
                  </Box>

                  <Box flexDirection="row" gap="m">
                    <Box flex={1}>
                      <Button
                        title="Open Simkl"
                        icon="open-outline"
                        variant="secondary"
                        onPress={handleOpenSimkl}
                      />
                    </Box>
                    <Box flex={1}>
                      <Button
                        title="Restart"
                        icon="refresh"
                        variant="tertiary"
                        onPress={handleConnectSimkl}
                        disabled={isStartingPin}
                      />
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box marginTop="s">
                  <Button
                    title="Connect Simkl"
                    icon="link"
                    variant="primary"
                    onPress={handleConnectSimkl}
                    disabled={isStartingPin}
                  />
                </Box>
              )}
            </>
          ) : (
            <>
              <Box flexDirection="row" alignItems="center" justifyContent="space-between">
                <Text variant="body">Connected</Text>
                <Box
                  width={statusDotSize}
                  height={statusDotSize}
                  borderRadius="full"
                  backgroundColor="primaryBackground"
                />
              </Box>

              <SettingsSwitch
                label="Scrobbling"
                description="Track 'Now Watching' status on Simkl"
                value={isScrobblingEnabled()}
                onValueChange={setScrobblingEnabled}
              />

              <Box marginTop="s">
                <Button
                  title="Disconnect"
                  icon="close"
                  variant="secondary"
                  onPress={handleDisconnect}
                />
              </Box>
            </>
          )}

          {simkl.authStatus === 'error' && simkl.authError ? (
            <Box marginTop="s" backgroundColor="cardBackground" padding="s" borderRadius="m">
              <Text variant="caption" color="danger">
                {simkl.authError}
              </Text>
            </Box>
          ) : null}
        </SettingsCard>
      </Box>
    </ScrollView>
  );
});

IntegrationsSettingsContent.displayName = 'IntegrationsSettingsContent';
