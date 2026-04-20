import { FC, ReactNode } from 'react';
import { Box } from '@/theme/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { TVSidebar } from './TVSidebar';
import { View, useWindowDimensions } from 'react-native';

interface ResponsiveLayoutProps {
  children: ReactNode;
  maxWidth?: number | string;
}

export const ResponsiveLayout: FC<ResponsiveLayoutProps> = ({ children, maxWidth }) => {
  const breakpoint = useBreakpoint();
  const { width } = useWindowDimensions();

  // Show sidebar on tablet and TV
  const showSidebar = breakpoint === 'tablet' || breakpoint === 'tv';

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
      <TVSidebar />
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
