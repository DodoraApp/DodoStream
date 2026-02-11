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
import { Box, Text, Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/basic/Button';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

export interface ModalProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
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
  disablePadding?: boolean;
  /** Use wider modal size for two-panel layouts (default: false) */
  wide?: boolean;
}

/**
 * Reusable modal wrapper with consistent styling across the app.
 * Handles safe area insets, backdrop, TV focus management, and backdrop press dismissal.
 */
export const Modal: FC<ModalProps> = ({
  label,
  icon,
  visible,
  onClose,
  children,
  animationType = 'fade',
  presentationStyle,
  closeOnBackdropPress = true,
  disablePadding = false,
  wide = false,
}) => {
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();
  const { breakpoint } = useResponsiveLayout();

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
        <Box flex={1} justifyContent="center" alignItems="center" pointerEvents="box-none">
          <TVFocusGuideView
            autoFocus
            trapFocusUp
            trapFocusDown
            trapFocusLeft
            trapFocusRight
            style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Pressable onPress={() => {}} focusable={false}>
              <Box
                backgroundColor="cardBackground"
                borderRadius="l"
                paddingVertical={disablePadding ? undefined : 'm'}
                paddingHorizontal={disablePadding ? undefined : 'm'}
                gap="m"
                style={{
                  minWidth: wide
                    ? theme.sizes.modalMinWidthWide[breakpoint]
                    : theme.sizes.modalMinWidth[breakpoint],
                  maxWidth: theme.sizes.modalMaxWidth[breakpoint],
                }}>
                <Box
                  flexDirection="row"
                  alignItems="center"
                  gap="s"
                  justifyContent="space-between"
                  padding="s">
                  <Box flexDirection="row" alignItems="center" gap="s">
                    {icon && (
                      <Ionicons
                        name={icon}
                        size={theme.sizes.iconMedium}
                        color={theme.colors.mainForeground}
                      />
                    )}
                    {label && <Text variant="subheader">{label}</Text>}
                  </Box>
                  <Button icon="close" variant="tertiary" onPress={onClose} />
                </Box>
                {children}
              </Box>
            </Pressable>
          </TVFocusGuideView>
        </Box>
      </Pressable>
    </RNModal>
  );
};

Modal.displayName = 'Modal';
