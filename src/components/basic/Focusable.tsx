import { FC, ReactNode, useCallback, useState, useRef, RefObject, useMemo } from 'react';
import {
  Pressable,
  PressableProps,
  ViewStyle,
  View,
  Platform,
  StyleProp,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@shopify/restyle';
import { useRecyclingState } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { Theme } from '@/theme/theme';

export interface FocusableProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode | ((params: { isFocused: boolean }) => ReactNode);

  // === STYLE ===
  /** Static style for the pressable. Note: function-based styles are not supported - use focusedStyle instead */
  style?: StyleProp<ViewStyle>;

  // === FOCUS STYLING ===
  /** Focus style variant */
  variant?: 'background' | 'outline' | 'none';
  /** Custom focus style override - merged with variant styles when focused */
  focusedStyle?: ViewStyle;

  // === DIRECT NODE HANDLES (for performance in lists) ===
  nextFocusUpId?: number | null;
  nextFocusDownId?: number | null;
  nextFocusLeftId?: number | null;
  nextFocusRightId?: number | null;

  // === CALLBACKS ===
  /** Callback when focus changes */
  onFocusChange?: (isFocused: boolean) => void;
  onRef?: (ref: View | null) => void;

  // === FLASHLIST SUPPORT ===
  /**
   * When used inside a FlashList item, provide a stable key to avoid focus-state
   * leaking due to cell recycling.
   */
  recyclingKey?: string | number;

  // === REF FORWARDING ===
  /** Expose ref for parent coordination (e.g., focus navigation between components) */
  viewRef?: RefObject<View | null>;
}

/**
 * Compute TV-specific navigation props.
 * Extracted to keep the component body clean and enable future memoization.
 */
function buildTVProps(
  isTV: boolean,
  nextFocusUpId?: number | null,
  nextFocusDownId?: number | null,
  nextFocusLeftId?: number | null,
  nextFocusRightId?: number | null
): Record<string, unknown> {
  const tvProps: Record<string, unknown> = {};

  if (isTV) {
    if (nextFocusUpId) tvProps.nextFocusUp = nextFocusUpId;
    if (nextFocusDownId) tvProps.nextFocusDown = nextFocusDownId;
    if (nextFocusLeftId) tvProps.nextFocusLeft = nextFocusLeftId;
    if (nextFocusRightId) tvProps.nextFocusRight = nextFocusRightId;
  }

  return tvProps;
}

/**
 * Compute the focus style based on variant and focused state.
 * Returns the style to apply to the pressable when focused.
 */
function computeFocusStyle(
  isFocused: boolean,
  variant: 'background' | 'outline' | 'none',
  theme: Theme,
  focusedStyle?: ViewStyle
): ViewStyle | undefined {
  if (!isFocused) return undefined;

  let variantStyle: ViewStyle | undefined;

  if (variant === 'outline') {
    // NOTE: We intentionally use outline (not border) for focus.
    // Border changes the element's layout (content appears to shrink/shift),
    // while outline does not affect layout and avoids janky scaling/resizing.
    variantStyle = {
      outlineWidth: theme.focus.borderWidth,
      outlineColor: theme.colors.primaryBackground,
      borderRadius: theme.borderRadii.l,
    };
  } else if (variant === 'background') {
    variantStyle = {
      backgroundColor: theme.colors.focusBackground,
      borderRadius: theme.borderRadii.l,
    };
  }

  // Merge variant style with custom focusedStyle
  if (variantStyle && focusedStyle) {
    return { ...variantStyle, ...focusedStyle };
  }

  return variantStyle ?? focusedStyle;
}

/**
 * A wrapper component for TV focus handling with smooth Reanimated animations.
 * Provides consistent focus styling across the app using Pressable.
 *
 * PERFORMANCE OPTIMIZATION:
 * - When children is NOT a function: no re-renders on focus change (focus styling handled via animated styles)
 * - When children IS a function: re-renders only when isFocused changes
 *
 * FOCUS STYLING GUIDELINES:
 * - variant="outline": Adds outline border when focused (for MediaCard, ContinueWatchingCard)
 * - variant="background": Adds background color when focused (for buttons, tags, list items)
 * - variant="none": No automatic focus styling (use render function for custom handling)
 *
 * @example
 * // Simple usage - no re-renders, focus handled automatically
 * <Focusable variant="background" onPress={handlePress}>
 *   <Box padding="m">
 *     <Text>Card Content</Text>
 *   </Box>
 * </Focusable>
 *
 * @example
 * // Outline focus for MediaCard (no re-renders)
 * <Focusable variant="outline" withScale onPress={handlePress}>
 *   <Box borderRadius="l" overflow="hidden">
 *     <Image source={posterSource} />
 *   </Box>
 * </Focusable>
 *
 * @example
 * // Custom focus handling with render function (re-renders on focus change)
 * <Focusable variant="none" onPress={handlePress}>
 *   {({ isFocused }) => (
 *     <Box backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}>
 *       <Text color={isFocused ? 'focusForeground' : 'textPrimary'}>Content</Text>
 *     </Box>
 *   )}
 * </Focusable>
 */
export const Focusable: FC<FocusableProps> = ({
  children,
  variant = 'background',
  focusedStyle,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  nextFocusUpId,
  nextFocusDownId,
  nextFocusLeftId,
  nextFocusRightId,
  onFocusChange,
  recyclingKey,
  viewRef,
  onRef,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const theme = useTheme<Theme>();
  const isTV = Platform.isTV;
  // const debug = useDebugLogger('Focusable');

  // Internal ref for the pressable element
  const innerRef = useRef<View>(null);

  // Determine if we need to trigger re-renders on focus change
  // Only re-render if children is a function (needs isFocused for rendering)
  const isRenderFunction = typeof children === 'function';

  const [standardIsFocused, setStandardIsFocused] = useState(false);
  const [recyclingIsFocused, setRecyclingIsFocused] = useRecyclingState(false, [recyclingKey]);

  // Read the correct state based on recyclingKey
  const isFocused = recyclingKey !== undefined ? recyclingIsFocused : standardIsFocused;

  // Memoize TV props to avoid recalculation on every render
  const tvProps = useMemo(
    () => buildTVProps(isTV, nextFocusUpId, nextFocusDownId, nextFocusLeftId, nextFocusRightId),
    [isTV, nextFocusUpId, nextFocusDownId, nextFocusLeftId, nextFocusRightId]
  );

  // Memoize focus style calculation
  const currentFocusStyle = useMemo(
    () => computeFocusStyle(isFocused, variant, theme, focusedStyle),
    [isFocused, variant, theme, focusedStyle]
  );

  // Ref callback to capture node handle and forward ref
  const refCallback = useCallback(
    (node: View | null) => {
      onRef?.(node);
      innerRef.current = node;
      // FIXME not working
      // if (viewRef) {
        // viewRef.current = node;
      // }
    },
    [onRef]
  );

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<PressableProps['onFocus']>>[0]) => {
      // debug('onFocus', {
      //   recyclingKey,
      //   withScale,
      //   variant,
      //   isRenderFunction,
      // });

      // Only trigger state update if children is a render function OR we need focus styling
      // For non-function children with variant styling, we still need state to apply focus styles
      if (isRenderFunction || variant !== 'none') {
        setStandardIsFocused(true);
        setRecyclingIsFocused(true);
      }

      onFocusChange?.(true);
      onFocus?.(e);
    },
    [isRenderFunction, variant, setStandardIsFocused, setRecyclingIsFocused, onFocusChange, onFocus]
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<PressableProps['onBlur']>>[0]) => {
      // debug('onBlur', {
      //   recyclingKey,
      //   withScale,
      //   variant,
      //   isRenderFunction,
      // });

      // Only trigger state update if children is a render function OR we need focus styling
      if (isRenderFunction || variant !== 'none') {
        setStandardIsFocused(false);
        setRecyclingIsFocused(false);
      }

      onFocusChange?.(false);
      onBlur?.(e);
    },
    [isRenderFunction, variant, setStandardIsFocused, setRecyclingIsFocused, onFocusChange, onBlur]
  );

  // Flatten the style prop to a static ViewStyle (Pressable's style can be a function but we use focusedStyle for focus-based styling)
  const flatStyle = useMemo(() => {
    if (!style) return undefined;
    return StyleSheet.flatten(style as ViewStyle);
  }, [style]);

  return (
    <Pressable
      ref={refCallback}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[flatStyle, currentFocusStyle]}
      {...tvProps}
      {...props}>
      {isRenderFunction ? children({ isFocused }) : children}
    </Pressable>
  );
};
