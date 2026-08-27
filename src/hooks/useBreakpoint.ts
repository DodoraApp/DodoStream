import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { useTheme } from '@shopify/restyle';

import { Theme } from '@/theme/theme';

export type Breakpoint = 'mobile' | 'tablet' | 'tv';

/**
 * Detect the layout tier from the shortest viewport side.
 *
 * Using the shortest side keeps a phone or tablet in the same tier after
 * rotation. TVs are identified by platform so 720p TV screens still receive
 * the TV navigation layout.
 */
export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  const theme = useTheme<Theme>();

  if (Platform.isTV) return 'tv';

  const shortSide = Math.min(width, height);
  if (shortSide >= theme.breakpoints.tv) return 'tv';
  if (shortSide >= theme.breakpoints.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Hook to check if current breakpoint is at least the specified size
 */
export function useBreakpointValue<T>(values: { mobile: T; tablet?: T; tv?: T }): T {
  const breakpoint = useBreakpoint();

  if (breakpoint === 'tv' && values.tv !== undefined) {
    return values.tv;
  }
  if (breakpoint === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
}

/** Split layout configuration for settings-style pages */
export interface SplitLayoutConfig {
  /** Whether split layout is enabled (true on tablet/TV) */
  enabled: boolean;
  /** Width of the left menu panel */
  menuWidth: number;
  /** Flex value for content area */
  contentFlex: number;
}

/** Responsive layout return type */
export interface ResponsiveLayoutResult {
  /** Current breakpoint */
  breakpoint: Breakpoint;

  /** True for TV breakpoint */
  isTV: boolean;

  /** True for tablet or TV (wide layouts that can show split views) */
  isWide: boolean;

  /** Current window dimensions */
  width: number;
  height: number;

  /** Whether viewport is landscape-oriented */
  isLandscape: boolean;
  /** Whether the TV-oriented composition should be used */
  isTVLayout: boolean;

  isPlatformTV: boolean;

  /** Split layout configuration for settings-style pages */
  splitLayout: SplitLayoutConfig;
}

/**
 * Comprehensive responsive layout hook
 *
 * Provides breakpoint detection, dimension info, and helper methods
 * for building responsive UIs across mobile, tablet, and TV.
 *
 * @example
 * const { isWide, splitLayout } = useResponsiveLayout();
 *
 * // Split layout for settings
 * if (splitLayout.enabled) {
 *   return (
 *     <Box flexDirection="row">
 *       <Box width={splitLayout.menuWidth}><Menu /></Box>
 *       <Box flex={splitLayout.contentFlex}><Content /></Box>
 *     </Box>
 *   );
 * }
 */
export function useResponsiveLayout(): ResponsiveLayoutResult {
  const { width, height } = useWindowDimensions();
  const breakpoint = useBreakpoint();

  const isTV = breakpoint === 'tv';
  const isWide = breakpoint === 'tablet' || isTV;
  const isLandscape = width > height;
  const isPlatformTV = Platform.isTV;
  const isTVLayout = isPlatformTV || isLandscape;

  // Split layout config
  const splitLayout = useMemo<SplitLayoutConfig>(
    () => ({
      enabled: isWide,
      menuWidth: isTV ? 320 : 280,
      contentFlex: 1,
    }),
    [isWide, isTV]
  );

  return {
    breakpoint,
    isTV,
    isWide,
    width,
    height,
    isLandscape,
    isTVLayout,
    isPlatformTV,
    splitLayout,
  };
}
