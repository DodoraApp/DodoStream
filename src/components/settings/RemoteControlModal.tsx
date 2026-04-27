import { FC, memo } from 'react';
import { Modal } from '@/components/basic/Modal';
import { RemoteControlContent } from '@/components/settings/RemoteControlContent';
import { useTranslation } from 'react-i18next';

interface RemoteControlModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RemoteControlModal: FC<RemoteControlModalProps> = memo(
  ({ visible, onClose }) => {
    const { t } = useTranslation('settings');
    return (
      <Modal visible={visible} onClose={onClose} label={t('remoteControl.title')} animationType="slide">
        {visible && <RemoteControlContent onStop={onClose} />}
      </Modal>
    );
  }
);

RemoteControlModal.displayName = 'RemoteControlModal';