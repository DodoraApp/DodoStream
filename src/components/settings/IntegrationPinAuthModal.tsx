import { FC, memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { Button } from '@/components/basic/Button';
import { QrCode } from '@/components/basic/QrCode';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Box, Text, type Theme } from '@/theme/theme';
import type { PinAuthState } from '@/types/integrations';

interface IntegrationPinAuthModalProps {
  visible: boolean;
  /** i18n namespace ('trakt' | 'simkl') */
  i18nNs: string;
  /** Full URL template for the activation link (e.g. 'https://trakt.tv/activate') */
  activateUrl: string;
  /** Display domain (e.g. 'trakt.tv/activate') */
  activateDomain: string;
  /** Pin auth state from useTraktPinAuth / useSimklPinAuth */
  pinAuth: PinAuthState;
  /** Whether to show a countdown timer (Simkl: true, Trakt: false) */
  showCountdown?: boolean;
  /** Countdown timeout in seconds (only when showCountdown=true) */
  countdownSeconds?: number;
  /** Called when the cancel button is pressed */
  onCancel: () => void;
}

export const IntegrationPinAuthModal: FC<IntegrationPinAuthModalProps> = memo(
  ({
    visible,
    i18nNs,
    activateUrl,
    activateDomain,
    pinAuth,
    showCountdown = false,
    countdownSeconds,
    onCancel,
  }) => {
    const { t } = useTranslation(['settings', 'common']);
    const theme = useTheme<Theme>();
    const breakpoint = useBreakpoint();

    const {
      start: pinStart,
      cancel: pinCancel,
      status: pinStatus,
      userCode,
      verificationUrl,
    } = pinAuth;
    const [countdown, setCountdown] = useState(countdownSeconds ?? 0);

    // Start auth flow when modal becomes visible
    useEffect(() => {
      if (visible) {
        pinStart();
        if (showCountdown && countdownSeconds) {
          setCountdown(countdownSeconds);
        }
      }
    }, [visible, pinStart, showCountdown, countdownSeconds]);

    // Countdown timer (Simkl-specific)
    useEffect(() => {
      if (!showCountdown || pinStatus !== 'pending') return;
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [showCountdown, pinStatus]);

    const handleCancel = useCallback(() => {
      pinCancel();
      onCancel();
    }, [pinCancel, onCancel]);

    const getActivationUrl = useCallback(() => {
      if (userCode) {
        return `${activateUrl}/${userCode}`;
      }
      return verificationUrl ?? activateUrl;
    }, [userCode, verificationUrl, activateUrl]);

    const countdownLabel = showCountdown
      ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`
      : undefined;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
        <Box flex={1} backgroundColor="mainBackground" justifyContent="center">
          <Box backgroundColor="cardBackground" borderRadius="l" padding="xl" gap="l">
            <Text variant="header" textAlign="center">
              {t(`${i18nNs}.connect_title`)}
            </Text>

            {pinStatus === 'pending' && (
              <>
                <Text variant="body" color="textSecondary" textAlign="center">
                  {t(`${i18nNs}.instructions`)}
                </Text>

                <Box backgroundColor="mainBackground" borderRadius="m" padding="l" gap="s">
                  <Box flexDirection="row" gap="l" alignItems="center" justifyContent="center">
                    <Box alignItems="center" gap="s" flex={1}>
                      <Text variant="caption" color="textSecondary">
                        {t(`${i18nNs}.go_to`)}
                      </Text>
                      <Pressable onPress={() => Linking.openURL(getActivationUrl())}>
                        <Text variant="subheader" color="primaryBackground">
                          {verificationUrl ?? activateDomain}
                        </Text>
                      </Pressable>
                      <Text variant="caption" color="textSecondary">
                        {t(`${i18nNs}.enter_code`)}
                      </Text>
                      <Text variant="pinCode">{userCode ?? '\u2014'}</Text>
                    </Box>

                    {breakpoint !== 'mobile' && (verificationUrl || userCode) && (
                      <QrCode
                        value={getActivationUrl()}
                        size={
                          typeof theme.sizes.modalMinWidth.tv === 'number'
                            ? theme.sizes.modalMinWidth.tv * 0.4
                            : undefined
                        }
                      />
                    )}
                  </Box>
                </Box>

                {showCountdown && countdownLabel && (
                  <Text variant="caption" color="textSecondary" textAlign="center">
                    {t(`${i18nNs}.expires_in`, { time: countdownLabel })}
                  </Text>
                )}
              </>
            )}

            {pinStatus === 'expired' && (
              <Text variant="body" color="textSecondary" textAlign="center">
                {t(`${i18nNs}.code_expired`)}
              </Text>
            )}

            {pinStatus === 'success' && (
              <Text variant="body" color="textSecondary" textAlign="center">
                {t(`${i18nNs}.connected_success`)}
              </Text>
            )}

            <Button onPress={handleCancel} variant="primary" title={t('common:cancel')} />
          </Box>
        </Box>
      </Modal>
    );
  }
);

IntegrationPinAuthModal.displayName = 'IntegrationPinAuthModal';
