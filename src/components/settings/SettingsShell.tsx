import React, { FC, ReactNode, memo, useEffect, useState } from 'react';
import { Box } from '@/theme/theme';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { findNodeHandle, TVFocusGuideView } from 'react-native';
import { useSidebarFocusStore } from '@/store/sidebar-focus.store';

interface SettingsShellProps {
  /** Left panel content (menu, headings, profile switcher, etc.) */
  menu: ReactNode;
  // Ref to the first menu item - should point to a native view
  firstMenuItemRef: React.RefObject<any>;
  /** Content to render in the right panel (or full screen on mobile) */
  children: ReactNode;
}

export const SettingsShell: FC<SettingsShellProps> = memo(
  ({ menu, firstMenuItemRef, children }) => {
    const { splitLayout } = useResponsiveLayout();

    // get native node handle for first menu item (used for TV focus navigation)
    const leftNodeHandle = useFirstMenuItemNodeHandle(firstMenuItemRef, splitLayout.enabled);

    // Get the selected settings menu item's node handle for focus navigation
    const selectedSettingsMenuNodeHandle = useSidebarFocusStore(
      (state) => state.selectedSettingsMenuNodeHandle
    );

    // Mobile: just render children, navigation is handled by Stack
    if (!splitLayout.enabled) {
      return <>{children}</>;
    }

    // Wide layout: split view with menu on left, content on right
    return (
      <Box flex={1} flexDirection="row">
        {/* Left panel - Menu */}
        <TVFocusGuideView trapFocusUp trapFocusDown>
          <Box
            width={splitLayout.menuWidth}
            backgroundColor="cardBackground"
            borderRightWidth={1}
            borderRightColor="cardBorder"
            padding="s"
            flex={1}>
            {menu}
          </Box>
        </TVFocusGuideView>

        {/* Right panel - Content */}
        <TVFocusGuideView
          trapFocusUp
          trapFocusDown
          style={{ flex: splitLayout.contentFlex }}
          nextFocusLeft={selectedSettingsMenuNodeHandle ?? leftNodeHandle}>
          <Box flex={1} backgroundColor="mainBackground">
            {children}
          </Box>
        </TVFocusGuideView>
      </Box>
    );
  }
);

// compute native node handle for focus navigation
function useFirstMenuItemNodeHandle(firstMenuItemRef: React.RefObject<any>, enabled: boolean) {
  const [node, setNode] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setNode(null);
      return;
    }

    // allow microtask to run so forwarded refs attach
    const id = setTimeout(() => {
      setNode(findNodeHandle(firstMenuItemRef?.current) as number | null);
    }, 0);

    return () => clearTimeout(id);
  }, [firstMenuItemRef, enabled]);

  return node;
}
