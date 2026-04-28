import { FC, memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { useSimklPinAuth } from '@/api/simkl/hooks';
import { Button } from '@/components/basic/Button';
import { SIMKL_PIN_TIMEOUT_S } from '@/constants/ui';
import { Box, Text, Theme } from '@/theme/theme';

interface SimklPinAuthModalProps {
  visible: boolean;
  onSuccess: (accessToken: string) => void;
  onCancel: () => void;
}

export const SimklPinAuthModal: FC<SimklPinAuthModalProps> = memo(
  ({ visible, onSuccess, onCancel }) => {
    const { t } = useTranslation(['settings', 'common']);
    const theme = useTheme<Theme>();
    const [countdown, setCountdown] = useState(SIMKL_PIN_TIMEOUT_S);

    const handleSuccess = useCallback(
      (token: string) => {
        onSuccess(token);
      },
      [onSuccess]
    );

    const { userCode, verificationUrl, status, start, cancel } = useSimklPinAuth(handleSuccess);

    useEffect(() => {
      if (visible) {
        start();
        setCountdown(SIMKL_PIN_TIMEOUT_S);
      }
    }, [visible, start]);

    useEffect(() => {
      if (status !== 'pending') return;
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
    }, [status]);

    const handleCancel = useCallback(() => {
      cancel();
      onCancel();
    }, [cancel, onCancel]);

    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const countdownLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
        <Box flex={1} backgroundColor="mainBackground" justifyContent="center" alignItems="center">
          <Box
            backgroundColor="cardBackground"
            borderRadius="l"
            padding="xl"
            gap="l"
            style={{
              maxWidth: theme.sizes.modalMinWidth.tv,
              width: '90%',
            }}>
            <Text variant="header" textAlign="center">
              {t('simkl.connect_title')}
            </Text>

            {status === 'pending' && (
              <>
                <Text variant="body" color="textSecondary" textAlign="center">
                  {t('simkl.instructions')}
                </Text>

                <Box
                  backgroundColor="mainBackground"
                  borderRadius="m"
                  padding="l"
                  alignItems="center"
                  gap="s">
                  <Text variant="caption" color="textSecondary">
                    {t('simkl.go_to')}
                  </Text>
                  <Text variant="subheader" color="primaryBackground">
                    {verificationUrl ?? 'simkl.com/pin'}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {t('simkl.enter_code')}
                  </Text>
                  <Text variant="pinCode">{userCode ?? '—'}</Text>
                </Box>

                <Text variant="caption" color="textSecondary" textAlign="center">
                  {t('simkl.expires_in', { time: countdownLabel })}
                </Text>
              </>
            )}

            {status === 'expired' && (
              <Text variant="body" color="textSecondary" textAlign="center">
                {t('simkl.code_expired')}
              </Text>
            )}

            {status === 'success' && (
              <Text variant="body" color="textSecondary" textAlign="center">
                {t('simkl.connected_success')}
              </Text>
            )}

            <Button onPress={handleCancel} variant="primary" title={t('common:cancel')} />
          </Box>
        </Box>
      </Modal>
    );
  }
);

SimklPinAuthModal.displayName = 'SimklPinAuthModal';
