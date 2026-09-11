import React, { FC, memo, ReactNode } from 'react';

import type { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';

import { Modal } from '@/components/basic/Modal';
import { ANIMATION_FADE_IN_MS } from '@/constants/ui';
import { Box, Theme } from '@/theme/theme';

export interface PlayerMenuOverlayProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: IoniconsIconName;
  /** When false, the TV focus guide does not auto-focus (a list item claims preferred focus instead). Default true. */
  autoFocus?: boolean;
  children: ReactNode;
}

/**
 * Shared full-screen overlay for the player's selection menus (Streams, Episodes).
 * Same chrome for both: backdrop, header with icon/title/close, and a content
 * region that centers its list vertically.
 */
export const PlayerMenuOverlay: FC<PlayerMenuOverlayProps> = memo(
  ({ visible, onClose, title, icon, autoFocus = true, children }) => {
    const theme = useTheme<Theme>();

    return (
      <Modal
        visible={visible}
        onClose={onClose}
        icon={icon}
        label={title}
        autoFocus={autoFocus}
        contentAlignment="right">
        <MotiView
          from={{ opacity: 0, translateX: theme.spacing.xxl }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: ANIMATION_FADE_IN_MS }}
          style={{ flex: 1 }}>
          <Box flex={1} justifyContent="center" paddingBottom="m">
            {children}
          </Box>
        </MotiView>
      </Modal>
    );
  }
);

PlayerMenuOverlay.displayName = 'PlayerMenuOverlay';
