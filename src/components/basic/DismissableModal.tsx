import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';

import { Button } from '@/components/basic/Button';
import { MarkdownText } from '@/components/basic/MarkdownText';
import { Modal } from '@/components/basic/Modal';
import { Box, Text } from '@/theme/theme';

export interface DismissableModalProps {
  visible: boolean;
  heading: string;
  subheading?: string;
  body: string;
  primaryActionText: string;
  onPrimaryAction: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  tertiaryActionText?: string;
  onTertiaryAction?: () => void;
  preferredAction?: 'primary' | 'secondary' | 'tertiary';
  onDismiss: () => void;
}

export function DismissableModal({
  visible,
  heading,
  subheading,
  body,
  primaryActionText,
  onPrimaryAction,
  secondaryActionText,
  onSecondaryAction,
  tertiaryActionText,
  onTertiaryAction,
  preferredAction = 'primary',
  onDismiss,
}: DismissableModalProps) {
  const showSecondary = !!secondaryActionText && !!onSecondaryAction;
  const showTertiary = !!tertiaryActionText && !!onTertiaryAction;

  return (
    <Modal visible={visible} onClose={onDismiss} label={heading}>
      <Box flex={1} gap="s">
        <ScrollView style={{ flex: 1 }}>
          <Box gap="xs">
            {subheading ? (
              <Text variant="subheader" color="textSecondary">
                {subheading}
              </Text>
            ) : null}
          </Box>
          <MarkdownText content={body} />
        </ScrollView>

        <Box
          flexDirection="row"
          gap="s"
          justifyContent="flex-end"
          flexWrap="wrap"
          style={{ flexShrink: 0 }}>
          <Button
            variant="primary"
            title={primaryActionText}
            onPress={onPrimaryAction}
            hasTVPreferredFocus={preferredAction === 'primary'}
            width="100%"
            testID="modal-primary-action"
          />
          {showSecondary ? (
            <Button
              variant="secondary"
              title={secondaryActionText}
              onPress={onSecondaryAction!}
              hasTVPreferredFocus={preferredAction === 'secondary'}
              width="100%"
              testID="modal-secondary-action"
            />
          ) : null}

          {showTertiary ? (
            <Button
              variant="secondary"
              title={tertiaryActionText}
              onPress={onTertiaryAction!}
              hasTVPreferredFocus={preferredAction === 'tertiary'}
              width="100%"
              testID="modal-tertiary-action"
            />
          ) : null}
        </Box>
      </Box>
    </Modal>
  );
}
