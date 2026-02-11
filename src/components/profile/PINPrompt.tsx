import { FC } from 'react';
import { Box, Text } from '@/theme/theme';
import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';
import { Input } from '@/components/basic/Input';

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
  return (
    <Modal visible={visible} onClose={onCancel} label="Enter PIN" icon="lock-closed">
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
          placeholder="Enter PIN"
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
            <Button title="Cancel" variant="secondary" onPress={onCancel} />
          </Box>
          <Box flex={1}>
            <Button title="Submit" onPress={onSubmit} disabled={value.length === 0} />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
