import { FC, ReactNode, useCallback } from 'react';
import { Box } from '@/theme/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { TVSidebar } from './TVSidebar';
import { useTVBackButton } from '@/hooks/useTVBackButton';
import { Platform, TVFocusGuideView, useWindowDimensions } from 'react-native';

interface ResponsiveLayoutProps {
  children: ReactNode;
  maxWidth?: number | string;
}

export const ResponsiveLayout: FC<ResponsiveLayoutProps> = ({ children, maxWidth }) => {
  const breakpoint = useBreakpoint();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Show sidebar on tablet and TV
  const showSidebar = breakpoint === 'tablet' || breakpoint === 'tv';

  // Calculate max width for content
  const contentMaxWidth: number | undefined =
    maxWidth !== undefined
      ? typeof maxWidth === 'number'
        ? maxWidth
        : undefined
      : breakpoint === 'tv'
        ? width * 0.5
        : breakpoint === 'tablet' && isLandscape
          ? Math.min(width * 0.75, 1000)
          : undefined;

  // Handle TV back button to focus sidebar
  const handleBackPress = useCallback(() => {
    if (showSidebar && Platform.isTV) {
      // TODO: Focus first item in sidebar
      // This would require imperatively focusing the sidebar
      // For now, return false to allow default back behavior
      return false;
    }
    return false;
  }, [showSidebar]);

  useTVBackButton(handleBackPress);

  if (!showSidebar) {
    // Mobile layout: just render children
    return (
      <Box flex={1} backgroundColor="mainBackground">
        {children}
      </Box>
    );
  }

  // Tablet/TV layout: sidebar + content
  return (
    <Box flex={1} flexDirection="row" backgroundColor="mainBackground">
      <TVSidebar />
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <Box flex={1} alignItems="center" backgroundColor="mainBackground">
          <Box
            flex={1}
            width="100%"
            style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}>
            {children}
          </Box>
        </Box>
      </TVFocusGuideView>
    </Box>
  );
};
