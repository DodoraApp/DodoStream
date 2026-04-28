import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/basic/Button';
import { Input } from '@/components/basic/Input';
import { Modal } from '@/components/basic/Modal';
import { Box, Text } from '@/theme/theme';

interface PINPromptProps {
  visible: boolean;
  title?: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const PINPrompt: FC<PINPromptProps> = ({
  visible,
  title,
  value,
  onChangeText,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} onClose={onCancel} label={t('profiles:enter_pin')} icon="lock-closed">
      <Box gap="l" paddingHorizontal="s">
        {/* Title */}
        {title ? (
          <Text variant="body" color="textSecondary" textAlign="center">
            {title}
          </Text>
        ) : null}

        {/* PIN Input */}
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={t('profiles:pin_placeholder')}
          secureTextEntry
          keyboardType="numeric"
          maxLength={8}
          autoFocus
          onSubmitEditing={onSubmit}
          icon="keypad"
        />

        {/* Buttons */}
        <Box flexDirection="row" gap="m">
          <Box flex={1}>
            <Button title={t('common:cancel')} variant="secondary" onPress={onCancel} />
          </Box>
          <Box flex={1}>
            <Button title={t('common:submit')} onPress={onSubmit} disabled={value.length === 0} />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
