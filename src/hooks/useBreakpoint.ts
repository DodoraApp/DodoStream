import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';

export type Breakpoint = 'mobile' | 'tablet' | 'tv';

/**
 * Hook to detect current breakpoint based on window width
 * @returns Current breakpoint: 'mobile' | 'tablet' | 'tv'
 */
export function useBreakpoint(): Breakpoint {
    const { width } = useWindowDimensions();
    const theme = useTheme<Theme>()

    if (width >= theme.breakpoints.tv) {
        return 'tv';
    }
    if (width >= theme.breakpoints.tablet) {
        return 'tablet';
    }
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

    /** Current window width */
    width: number;

    /** Whether device is a TV platform */
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
    const { width } = useWindowDimensions();
    const breakpoint = useBreakpoint();

    const isTablet = breakpoint === 'tablet';
    const isTV = breakpoint === 'tv';
    const isWide = isTablet || isTV;
    const isPlatformTV = Platform.isTV;

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
        isPlatformTV,
        splitLayout,
    };
}
