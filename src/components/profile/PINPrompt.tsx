import { FC } from 'react';
import { TouchableOpacity, TextInput } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

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
  const theme = useTheme<Theme>();

  return (
    <Modal visible={visible} onClose={onCancel}>
      <Box
        width={400}
        maxWidth="90%"
        backgroundColor="cardBackground"
        borderRadius="l"
        padding="l"
        gap="l">
        {/* Header */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text variant="subheader" color="mainForeground">
            Enter PIN
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Box>

        {/* Title */}
        {title ? (
          <Text variant="body" color="textSecondary" textAlign="center">
            {title}
          </Text>
        ) : null}

        {/* PIN Input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Enter PIN"
          placeholderTextColor={theme.colors.textPlaceholder}
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          autoFocus
          onSubmitEditing={onSubmit}
          style={{
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary,
            padding: 16,
            borderRadius: 12,
            fontSize: 18,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            textAlign: 'center',
            letterSpacing: 8,
          }}
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
