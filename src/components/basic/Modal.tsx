import React, { FC, ReactNode } from 'react';
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  TVFocusGuideView,
  type ModalProps as RNModalProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@shopify/restyle';
import { Box, Theme } from '@/theme/theme';

export interface ModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should be closed (back button, backdrop press) */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Animation type for the modal */
  animationType?: RNModalProps['animationType'];
  /** Presentation style (iOS) - use 'fullScreen' for full-screen modals */
  presentationStyle?: RNModalProps['presentationStyle'];
  /** Whether pressing the backdrop should close the modal (default: true) */
  closeOnBackdropPress?: boolean;
  /** Whether to trap focus within the modal (TV) - default: true */
  trapFocus?: boolean;
  /** Custom content style */
  contentStyle?: object;
}

/**
 * Reusable modal wrapper with consistent styling across the app.
 * Handles safe area insets, backdrop, TV focus management, and backdrop press dismissal.
 *
 * @example
 * ```tsx
 * <Modal visible={isOpen} onClose={() => setIsOpen(false)}>
 *   <Box backgroundColor="cardBackground" borderRadius="l" padding="l">
 *     <Text>Modal content</Text>
 *   </Box>
 * </Modal>
 * ```
 */
export const Modal: FC<ModalProps> = ({
  visible,
  onClose,
  children,
  animationType = 'fade',
  presentationStyle,
  closeOnBackdropPress = true,
  trapFocus = true,
  contentStyle,
}) => {
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      presentationStyle={presentationStyle}
      onRequestClose={onClose}>
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: theme.colors.overlayBackground,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
        onPress={closeOnBackdropPress ? onClose : undefined}
        focusable={false}>
        <Box
          flex={1}
          justifyContent="center"
          alignItems="center"
          pointerEvents="box-none"
          style={contentStyle}>
          {trapFocus ? (
            <TVFocusGuideView
              autoFocus
              trapFocusUp
              trapFocusDown
              trapFocusLeft
              trapFocusRight
              style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Pressable onPress={() => {}} focusable={false}>
                {children}
              </Pressable>
            </TVFocusGuideView>
          ) : (
            <Pressable onPress={() => {}} focusable={false}>
              {children}
            </Pressable>
          )}
        </Box>
      </Pressable>
    </RNModal>
  );
};

Modal.displayName = 'Modal';
