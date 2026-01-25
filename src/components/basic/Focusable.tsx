import { FC, ReactNode, useCallback, useState, useRef } from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { useRecyclingState } from '@shopify/flash-list';
import { Theme } from '@/theme/theme';

interface FocusableProps extends Omit<PressableProps, 'children' | 'style'> {
  children:
    | ReactNode
    | ((params: { isFocused: boolean; focusStyle: ViewStyle | undefined }) => ReactNode);
  /** Apply scale transform when focused */
  withScale?: boolean;
  /** Scale amount (default: theme.focus.scaleMedium) */
  scale?: number;
  /** Custom focus style override */
  focusStyle?: ViewStyle;
  /**
   * Enable outline focus styling (default: false).
   * Only MediaCard and ContinueWatchingCard should use outline focus.
   * All other components should use background/text color changes.
   */
  withOutline?: boolean;
  /** Callback when focus changes */
  onFocusChange?: (isFocused: boolean) => void;
  /**
   * When used inside a FlashList item, provide a stable key to avoid focus-state
   * leaking due to cell recycling.
   */
  recyclingKey?: string | number;
  /** Base style to apply */
  style?: ViewStyle;
}

/**
 * A wrapper component for TV focus handling.
 * Provides consistent focus styling across the app using Pressable.
 *
 * FOCUS STYLING GUIDELINES:
 * - Only MediaCard and ContinueWatchingCard should use outline focus (via withOutline + render prop)
 * - All other components (buttons, tags, list items, settings) should use background/text color changes
 * - Access isFocused via render prop to conditionally apply focus background/text colors
 *
 * @example
 * // Color-based focus (default for most components)
 * <Focusable onPress={handlePress}>
 *   {({ isFocused }) => (
 *     <Box backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'} padding="m">
 *       <Text color={isFocused ? 'focusForeground' : 'textPrimary'}>Card Content</Text>
 *     </Box>
 *   )}
 * </Focusable>
 *
 * @example
 * // Outline focus for MediaCard/ContinueWatchingCard only
 * <Focusable onPress={handlePress} withOutline>
 *   {({ focusStyle }) => (
 *     <Box gap="s">
 *       <Box borderRadius="l" overflow="hidden" style={focusStyle}>
 *         <Image source={posterSource} />
 *       </Box>
 *       <Text>{title}</Text>
 *     </Box>
 *   )}
 * </Focusable>
 */
export const Focusable: FC<FocusableProps> = ({
  children,
  withScale = false,
  scale,
  focusStyle,
  withOutline = false,
  onFocusChange,
  recyclingKey,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const theme = useTheme<Theme>();

  // Optimization: Use ref for focus state when children is not a render function
  // This avoids re-renders when focus changes but children don't need the focus state
  const isFocusedRef = useRef(false);
  const needsRenderOnFocusChange = typeof children === 'function';

  const [standardIsFocused, setStandardIsFocused] = useState(false);
  const [recyclingIsFocused, setRecyclingIsFocused] = useRecyclingState(false, [recyclingKey]);

  const isFocused = recyclingKey !== undefined ? recyclingIsFocused : standardIsFocused;
  const setIsFocused = recyclingKey !== undefined ? setRecyclingIsFocused : setStandardIsFocused;

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<PressableProps['onFocus']>>[0]) => {
      isFocusedRef.current = true;
      // Only trigger state update if children needs it for rendering
      if (needsRenderOnFocusChange || withScale || withOutline || focusStyle) {
        setIsFocused(true);
      }
      onFocusChange?.(true);
      onFocus?.(e);
    },
    [
      onFocusChange,
      onFocus,
      setIsFocused,
      needsRenderOnFocusChange,
      withScale,
      withOutline,
      focusStyle,
    ]
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<PressableProps['onBlur']>>[0]) => {
      isFocusedRef.current = false;
      // Only trigger state update if children needs it for rendering
      if (needsRenderOnFocusChange || withScale || withOutline || focusStyle) {
        setIsFocused(false);
      }
      onFocusChange?.(false);
      onBlur?.(e);
    },
    [
      onFocusChange,
      onBlur,
      setIsFocused,
      needsRenderOnFocusChange,
      withScale,
      withOutline,
      focusStyle,
    ]
  );

  // Wrapper focus style (scale only, no outline by default)
  const focusedStyle: ViewStyle | undefined = isFocused
    ? {
        ...(withScale && {
          transform: [{ scale: scale ?? theme.focus.scaleMedium }],
        }),
        ...focusStyle,
      }
    : undefined;

  // Focus style for inner elements (outline focus for MediaCard/ContinueWatchingCard only)
  const cardFocusStyle: ViewStyle | undefined =
    withOutline && isFocused
      ? {
          // NOTE: We intentionally use outline (not border) for focus.
          // Border changes the element's layout (content appears to shrink/shift),
          // while outline does not affect layout and avoids janky scaling/resizing.
          outlineWidth: theme.focus.borderWidth,
          outlineColor: theme.colors.primaryBackground,
          borderRadius: theme.borderRadii.l,
        }
      : undefined;

  return (
    <Pressable onFocus={handleFocus} onBlur={handleBlur} style={[style, focusedStyle]} {...props}>
      {typeof children === 'function'
        ? children({ isFocused, focusStyle: cardFocusStyle })
        : children}
    </Pressable>
  );
};
