import type { Theme } from '@/theme/theme';
import { ViewStyle } from 'react-native';

type ColorName = keyof Theme['colors'];

interface FocusableColorOptions {
    isActive?: boolean;
    isFocused?: boolean;
    defaultColor?: ColorName;
}

/**
 * Focus style variants for different component types.
 *
 * - 'background': Changes background color (buttons, list items, settings, switches)
 * - 'outline': Adds outline border (MediaCard, ContinueWatchingCard only)
 * - 'none': No visual focus indicator (useful for custom implementations)
 */
export type FocusVariant = 'background' | 'outline' | 'none';

/**
 * Returns the appropriate background color for a focusable element based on its active and focused state.
 *
 * - Active + Focused: focusBackgroundPrimary (highlighted active state)
 * - Active + Not Focused: primaryBackground (standard active state)
 * - Not Active + Focused: focusBackground (standard focus state)
 * - Not Active + Not Focused: defaultColor (idle state)
 */
export function getFocusableBackgroundColor({
    isActive = false,
    isFocused = false,
    defaultColor = 'cardBackground',
}: FocusableColorOptions): ColorName {
    if (isActive) {
        return isFocused ? 'focusBackgroundPrimary' : 'primaryBackground';
    }
    return isFocused ? 'focusBackground' : defaultColor;
}

/**
 * Returns the appropriate foreground/text color for a focusable element based on its active and focused state.
 *
 * - Active (focused or not): primaryForeground
 * - Not Active + Focused: focusForeground
 * - Not Active + Not Focused: defaultColor
 */
export function getFocusableForegroundColor({
    isActive = false,
    isFocused = false,
    defaultColor = 'textSecondary',
}: FocusableColorOptions): ColorName {
    if (isActive) {
        return 'primaryForeground';
    }
    return isFocused ? 'focusForeground' : defaultColor;
}

interface GetOutlineFocusStyleOptions {
    isFocused: boolean;
    theme: Theme;
    borderRadius?: keyof Theme['borderRadii'];
}

/**
 * Returns outline focus style for media cards (MediaCard, ContinueWatchingCard).
 * Only use this for card components that display images.
 *
 * Returns undefined when not focused to avoid unnecessary style objects.
 */
export function getOutlineFocusStyle({
    isFocused,
    theme,
    borderRadius = 'l',
}: GetOutlineFocusStyleOptions): ViewStyle | undefined {
    if (!isFocused) return undefined;

    return {
        outlineWidth: theme.focus.borderWidth,
        outlineColor: theme.colors.primaryBackground,
        borderRadius: theme.borderRadii[borderRadius],
    };
}
