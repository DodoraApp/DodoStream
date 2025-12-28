import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { Button } from '@/components/basic/Button';

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
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();

  const showSecondary = !!secondaryActionText && !!onSecondaryAction;
  const showTertiary = !!tertiaryActionText && !!onTertiaryAction;

  return (
    <Modal
      visible={visible}
      backdropColor={theme.colors.overlayBackground}
      animationType="fade"
      onRequestClose={onDismiss}>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}>
        <Box flex={1} justifyContent="center" alignItems="center" pointerEvents="box-none">
          <Box
            backgroundColor="cardBackground"
            borderRadius="l"
            padding="l"
            style={{
              minWidth: theme.sizes.modalMinWidth,
              maxWidth: theme.sizes.modalMaxWidth,
            }}>
            <Box gap="s">
              <Box gap="xs">
                <Text variant="header">{heading}</Text>
                {subheading ? (
                  <Text variant="subheader" color="textSecondary">
                    {subheading}
                  </Text>
                ) : null}
              </Box>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text variant="body" color="mainForeground">
                  {body}
                </Text>
              </ScrollView>

              <Box flexDirection="row" gap="s" justifyContent="flex-end" flexWrap="wrap">
                <Button
                  variant="primary"
                  title={primaryActionText}
                  onPress={onPrimaryAction}
                  hasTVPreferredFocus={preferredAction === 'primary'}
                  width="100%"
                />
                {showSecondary ? (
                  <Button
                    variant="secondary"
                    title={secondaryActionText}
                    onPress={onSecondaryAction!}
                    hasTVPreferredFocus={preferredAction === 'secondary'}
                    width="100%"
                  />
                ) : null}

                {showTertiary ? (
                  <Button
                    variant="secondary"
                    title={tertiaryActionText}
                    onPress={onTertiaryAction!}
                    hasTVPreferredFocus={preferredAction === 'tertiary'}
                    width="100%"
                  />
                ) : null}
              </Box>
            </Box>
          </Box>
        </Box>
      </View>
    </Modal>
  );
}
