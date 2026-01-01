import type { Theme } from '@/theme/theme';

type ColorName = keyof Theme['colors'];

interface FocusableColorOptions {
    isActive?: boolean;
    isFocused?: boolean;
    defaultColor?: ColorName;
}

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
