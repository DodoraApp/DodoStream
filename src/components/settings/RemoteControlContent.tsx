import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView } from 'react-native';

import * as Network from 'expo-network';

import { Button } from '@/components/basic/Button';
import { QrCode } from '@/components/basic/QrCode';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { useLocalServerStore } from '@/store/local-server.store';
import { showToast } from '@/store/toast.store';
import { Box, Text } from '@/theme/theme';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('RemoteControl');

export const RemoteControlContent: FC<{ onStop?: () => void }> = memo(({ onStop }) => {
  const isRunning = useLocalServerStore((state) => state.isRunning);
  const { t } = useTranslation('settings');
  const pin = useLocalServerStore((state) => state.pin);
  const port = useLocalServerStore((state) => state.port);
  const startServer = useLocalServerStore((state) => state.startServer);
  const stopServer = useLocalServerStore((state) => state.stopServer);
  const generatePin = useLocalServerStore((state) => state.generatePin);

  const [localIp, setLocalIp] = useState('');
  const [ipDetectionFailed, setIpDetectionFailed] = useState(false);

  const fetchLocalIp = useCallback(async () => {
    try {
      const ip = await Promise.race([
        Network.getIpAddressAsync(),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ]);
      if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1') {
        debug('fetchLocalIp: unusable IP', ip);
        setIpDetectionFailed(true);
        setLocalIp('');
        return;
      }
      setLocalIp(ip);
      setIpDetectionFailed(false);
    } catch (err) {
      debug('fetchLocalIp: error', err);
      setIpDetectionFailed(true);
      setLocalIp('');
    }
  }, []);

  const serverUrl = useMemo(() => {
    if (!localIp) return '';
    return `http://${localIp}:${port}`;
  }, [localIp, port]);

  const ipHint = useMemo(() => {
    if (Platform.OS === 'ios') return t('remoteControl.ip_hint_ios');
    return t('remoteControl.ip_hint_android');
  }, [t]);

  const qrUrl = useMemo(() => {
    if (!serverUrl) return '';
    return `${serverUrl}?pin=${pin}`;
  }, [serverUrl, pin]);

  const handleRegeneratePin = useCallback(() => {
    generatePin();
    showToast({
      title: t('remoteControl.toast.pin_updated_title'),
      message: t('remoteControl.toast.pin_updated_msg'),
    });
  }, [generatePin, t]);

  useEffect(() => {
    let cancelled = false;

    debug('mounting: starting server');
    void (async () => {
      try {
        await startServer();
        if (cancelled) {
          // Server started but component already unmounting — stop it.
          debug('startServer completed after unmount, stopping');
          void stopServer();
        }
      } catch (err) {
        if (!cancelled) {
          debug('startServer failed', err);
          showToast({
            title: t('remoteControl.toast.server_failed_title'),
            message: t('remoteControl.toast.server_failed_msg'),
            preset: 'error',
          });
        }
      }
    })();

    return () => {
      debug('unmounting: stopping server');
      cancelled = true;
      void stopServer();
    };
  }, [startServer, stopServer, t]);

  const handleStop = useCallback(() => {
    void stopServer();
    onStop?.();
  }, [stopServer, onStop]);

  useEffect(() => {
    if (!isRunning) return;
    void fetchLocalIp();
  }, [fetchLocalIp, isRunning]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      <Box padding="m" gap="l">
        <Text variant="body" color="textSecondary">
          {t('remoteControl.description')}
        </Text>

        {!isRunning && (
          <SettingsCard>
            <Box alignItems="center" gap="s" paddingVertical="m">
              <ActivityIndicator size="small" />
              <Text variant="body" color="textSecondary">
                {t('remoteControl.starting')}
              </Text>
            </Box>
          </SettingsCard>
        )}

        {isRunning && (
          <SettingsCard>
            <Box gap="xs">
              <Text variant="sectionLabel">{t('remoteControl.url')}</Text>
              <Text variant="body" color="textPrimary">
                {serverUrl ||
                  (ipDetectionFailed
                    ? t('remoteControl.address_unavailable')
                    : t('remoteControl.loading_address'))}
              </Text>
              {ipDetectionFailed && !serverUrl && (
                <Box marginTop="xs">
                  <Text variant="caption" color="textSecondary">
                    {t('remoteControl.ip_fallback', { port })}
                  </Text>
                  <Text variant="caption" color="textSecondary" marginTop="xs">
                    {ipHint}
                  </Text>
                </Box>
              )}
            </Box>

            <Box gap="xs" alignItems="center">
              <Text variant="sectionLabel">{t('remoteControl.pin')}</Text>
              <Text variant="pinCode" color="textPrimary">
                {pin}
              </Text>
            </Box>

            {!!qrUrl && (
              <Box alignItems="center" paddingVertical="s">
                <QrCode value={qrUrl} />
              </Box>
            )}

            <Box flexDirection="row" gap="s">
              <Box flex={1}>
                <Button
                  variant="secondary"
                  title={t('remoteControl.regenerate_pin')}
                  onPress={handleRegeneratePin}
                />
              </Box>

              <Box flex={1}>
                <Button variant="secondary" title={t('remoteControl.stop')} onPress={handleStop} />
              </Box>
            </Box>
          </SettingsCard>
        )}

        <Text variant="caption" color="textSecondary">
          {t('remoteControl.footer')}
        </Text>
      </Box>
    </ScrollView>
  );
});

RemoteControlContent.displayName = 'RemoteControlContent';
