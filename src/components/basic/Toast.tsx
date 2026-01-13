import { FC, memo, useCallback, useEffect } from 'react';
import { Pressable, Platform } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useTheme } from '@shopify/restyle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Box, Text, Theme } from '@/theme/theme';
import { useToastStore, Toast as ToastType, ToastPreset, ToastHaptic } from '@/store/toast.store';
import {
  TOAST_ENTER_DURATION_MS,
  TOAST_EXIT_DURATION_MS,
  TOAST_MAX_WIDTH,
  TOAST_STACK_GAP,
} from '@/constants/ui';

const triggerHaptic = (haptic: ToastHaptic) => {
  if (Platform.isTV || haptic === 'none') return;

  switch (haptic) {
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'error':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
};

interface ToastIconProps {
  preset: ToastPreset;
  color: string;
}

const ToastIcon: FC<ToastIconProps> = memo(({ preset, color }) => {
  const iconSize = 25;

  switch (preset) {
    case 'success':
      return <Ionicons name="checkmark-circle" size={iconSize} color={color} />;
    case 'error':
      return <Ionicons name="close-circle" size={iconSize} color={color} />;
    case 'warning':
      return <Ionicons name="warning" size={iconSize} color={color} />;
    default:
      return <Ionicons name="information-circle" size={iconSize} color={color} />;
  }
});

ToastIcon.displayName = 'ToastIcon';

interface ToastItemProps {
  toast: ToastType;
  index: number;
  onDismiss: (id: string) => void;
}

const ToastItem: FC<ToastItemProps> = memo(({ toast, index, onDismiss }) => {
  const theme = useTheme<Theme>();

  // Trigger haptic feedback when toast appears
  useEffect(() => {
    triggerHaptic(toast.haptic);
  }, [toast.haptic]);

  const getPresetColors = useCallback(
    (preset: ToastPreset) => {
      switch (preset) {
        case 'success':
          return {
            background: theme.colors.primaryBackground,
            icon: theme.colors.primaryForeground,
          };
        case 'error':
          return {
            background: theme.colors.danger,
            icon: theme.colors.primaryForeground,
          };
        case 'warning':
          return {
            background: '#F59E0B', // Amber/yellow for warning
            icon: theme.colors.mainBackground,
          };
        default:
          return {
            background: theme.colors.cardBackground,
            icon: theme.colors.textSecondary,
          };
      }
    },
    [theme]
  );

  const colors = getPresetColors(toast.preset);

  const handlePress = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  return (
    <MotiView
      from={{
        opacity: 0,
        translateY: -20,
        scale: 0.95,
      }}
      animate={{
        opacity: 1,
        translateY: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        translateY: -10,
        scale: 0.95,
      }}
      transition={{
        type: 'timing',
        duration: TOAST_ENTER_DURATION_MS,
      }}
      exitTransition={{
        type: 'timing',
        duration: TOAST_EXIT_DURATION_MS,
      }}
      style={{
        width: '100%',
        alignItems: 'center',
        marginBottom: TOAST_STACK_GAP,
        maxWidth: TOAST_MAX_WIDTH,
      }}>
      <Pressable onPress={handlePress} style={{ width: '100%', maxWidth: TOAST_MAX_WIDTH }}>
        <Box
          flexDirection="row"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="m"
          padding="m"
          gap="s"
          style={{
            shadowColor: theme.colors.mainBackground,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
          }}>
          <ToastIcon preset={toast.preset} color={colors.background} />
          <Box flex={1} gap="xs">
            <Text variant="button" color="textPrimary" numberOfLines={2}>
              {toast.title}
            </Text>
            {toast.message ? (
              <Text variant="caption" color="textSecondary" numberOfLines={3}>
                {toast.message}
              </Text>
            ) : null}
          </Box>
        </Box>
      </Pressable>
    </MotiView>
  );
});

ToastItem.displayName = 'ToastItem';

/**
 * Toast container component that renders all active toasts.
 * Should be placed at the root of the app (in _layout.tsx).
 *
 * Features:
 * - Stacking toasts with smooth animations
 * - Auto-dismiss with configurable duration
 * - Tap to dismiss
 * - Safe area aware positioning
 * - Themed styling with preset variants
 */
export const ToastContainer: FC = memo(() => {
  const theme = useTheme<Theme>();
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  const handleDismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  // Reverse toasts so newest appears at top
  const reversedToasts = [...toasts].reverse();

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      style={{
        paddingTop: insets.top + theme.spacing.m,
        paddingHorizontal: theme.spacing.m,
      }}
      pointerEvents="box-none"
      zIndex={9999}>
      <Box alignItems="center" pointerEvents="box-none">
        <AnimatePresence>
          {reversedToasts.map((toast, index) => (
            <ToastItem key={toast.id} toast={toast} index={index} onDismiss={handleDismiss} />
          ))}
        </AnimatePresence>
      </Box>
    </Box>
  );
});

ToastContainer.displayName = 'ToastContainer';

export default ToastContainer;
