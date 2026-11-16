import { FC, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';

import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';
import { Box, Text } from '@/theme/theme';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: IoniconsIconName;
  /** Label of the button that performs the action. */
  confirmLabel: string;
  /** Label of the button that dismisses the dialog. Defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  testID?: string;
}

/**
 * Confirmation dialog in the app's own modal style.
 * Use it instead of the system alert for questions that need a yes or no.
 */
export const ConfirmModal: FC<ConfirmModalProps> = memo(
  ({ visible, title, message, icon, confirmLabel, cancelLabel, onConfirm, onClose, testID }) => {
    const { t } = useTranslation('common');

    const handleConfirm = useCallback(() => {
      onConfirm();
      onClose();
    }, [onClose, onConfirm]);

    return (
      <Modal visible={visible} onClose={onClose} label={title} icon={icon}>
        <Box gap="l" paddingHorizontal="s" paddingBottom="s" testID={testID}>
          {message ? (
            <Text variant="body" color="textSecondary">
              {message}
            </Text>
          ) : null}
          <Box flexDirection="row" justifyContent="flex-end" gap="s" flexWrap="wrap">
            <Button
              title={cancelLabel ?? t('cancel')}
              variant="secondary"
              onPress={onClose}
              testID={testID ? `${testID}-cancel` : undefined}
            />
            <Button
              title={confirmLabel}
              variant="primary"
              onPress={handleConfirm}
              hasTVPreferredFocus
              testID={testID ? `${testID}-confirm` : undefined}
            />
          </Box>
        </Box>
      </Modal>
    );
  }
);

ConfirmModal.displayName = 'ConfirmModal';
