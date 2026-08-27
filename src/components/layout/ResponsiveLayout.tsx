import { FC, ReactNode, useEffect, useState } from 'react';
import { BackHandler, Platform, UIManager, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isTabsRoute =
    pathname === '/' ||
    pathname === '/index' ||
    NAV_ITEMS.some(({ route }) => route !== '/' && pathname.startsWith(route));
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
  const activeSidebarNodeHandle = useSidebarFocusStore((state) => state.activeSidebarNodeHandle);

  // Landscape mobile and tablet screens use the same sidebar navigation as TV.
  const showSidebar = isLandscape || breakpoint === 'tablet' || breakpoint === 'tv';

  // Handle TV back button: focus sidebar if not already focused
  // This must be before any conditional returns to maintain hook order
  useEffect(() => {
    if (!Platform.isTV || !showSidebar || !isTabsRoute) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isSidebarFocused && activeSidebarNodeHandle) {
        UIManager.dispatchViewManagerCommand(activeSidebarNodeHandle, 'requestTVFocus', []);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showSidebar, isSidebarFocused, activeSidebarNodeHandle, isTabsRoute]);

  // The content area must fill the viewport beside the sidebar on both
  // tablets and TVs. Callers can still opt into a narrower content width.
  const contentMaxWidth: number | undefined = typeof maxWidth === 'number' ? maxWidth : undefined;

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
      <View
        style={
          isLandscape
            ? {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
              }
            : undefined
        }
        onFocus={() => setIsSidebarFocused(true)}
        onBlur={() => setIsSidebarFocused(false)}>
        <TVSidebar />
      </View>
      <View style={{ flex: 1 }}>
        <Box flex={1} alignItems="stretch" backgroundColor="mainBackground">
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
