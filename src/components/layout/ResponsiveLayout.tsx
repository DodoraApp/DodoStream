import { FC, ReactNode, useEffect, useState } from 'react';
import { BackHandler, Platform, UIManager, useWindowDimensions, View } from 'react-native';

import { usePathname } from 'expo-router';

import { NAV_ITEMS } from '@/constants/navigation';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useSidebarFocusStore } from '@/store/sidebar-focus.store';
import { Box } from '@/theme/theme';

import { TVSidebar } from './TVSidebar';

interface ResponsiveLayoutProps {
  children: ReactNode;
  maxWidth?: number | string;
}

export const ResponsiveLayout: FC<ResponsiveLayoutProps> = ({ children, maxWidth }) => {
  const breakpoint = useBreakpoint();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isTabsRoute =
    pathname === '/' ||
    pathname === '/index' ||
    NAV_ITEMS.some(({ route }) => route !== '/' && pathname.startsWith(route));
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
  const activeSidebarNodeHandle = useSidebarFocusStore((state) => state.activeSidebarNodeHandle);

  // Show sidebar on tablet and TV
  const showSidebar = breakpoint === 'tablet' || breakpoint === 'tv';

  // Handle TV back button: focus sidebar if not already focused
  // This must be before any conditional returns to maintain hook order
  useEffect(() => {
    if (!Platform.isTV || !showSidebar || !isTabsRoute) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isSidebarFocused && activeSidebarNodeHandle) {
        // Focus the active sidebar item instead of closing the app
        UIManager.dispatchViewManagerCommand(activeSidebarNodeHandle, 'requestTVFocus' as any, []);
        return true; // Handled
      }
      return false; // Let default behavior occur (close app)
    });

    return () => backHandler.remove();
  }, [showSidebar, isSidebarFocused, activeSidebarNodeHandle, isTabsRoute]);

  // Calculate max width for content (50% on large screens)
  const contentMaxWidth: number | undefined =
    maxWidth !== undefined
      ? typeof maxWidth === 'number'
        ? maxWidth
        : undefined
      : breakpoint === 'tv'
        ? width * 0.5
        : undefined;

  if (!showSidebar) {
    // Mobile layout: just render children
    return (
      <Box flex={1} backgroundColor="mainBackground">
        {children}
      </Box>
    );
  }

  // Tablet/TV layout: sidebar + content
  // NOTE: Content area intentionally uses a plain View instead of TVFocusGuideView.
  // Using TVFocusGuideView with autoFocus here prevents LEFT navigation to the sidebar
  // because the guide redirects focus back into the content area.

  return (
    <Box flex={1} flexDirection="row" backgroundColor="mainBackground">
      <View onFocus={() => setIsSidebarFocused(true)} onBlur={() => setIsSidebarFocused(false)}>
        <TVSidebar />
      </View>
      <View style={{ flex: 1 }}>
        <Box flex={1} alignItems="center" backgroundColor="mainBackground">
          <Box
            flex={1}
            width="100%"
            style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}>
            {children}
          </Box>
        </Box>
      </View>
    </Box>
  );
};
