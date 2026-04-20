import { FC, ReactNode, useCallback, useState, useRef, RefObject, useMemo, useEffect } from 'react';
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
import { Theme } from '@/theme/theme';

/**
 * react-native-tvos extends PressableStateCallbackType with `focused`,
 * but the upstream @types/react-native doesn't include it.
 */
interface TVPressableState {
  pressed: boolean;
  focused: boolean;
}

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

  // === LIST RECYCLING SUPPORT ===
  /**
   * When used inside a recycled list item, provide a stable key to avoid focus-state
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
 * A wrapper component for TV focus handling.
 * Provides consistent focus styling across the app using Pressable.
 *
 * PERFORMANCE OPTIMIZATION:
 * - When children is NOT a function: zero re-renders on focus change.
 *   Focus styling is handled via Pressable's native style function ({focused}) => style.
 * - When children IS a function: re-renders only when isFocused changes
 *   (uses useState to provide isFocused to the render function).
 *
 * FOCUS STYLING GUIDELINES:
 * - variant="outline": Adds outline border when focused (for MediaCard, ContinueWatchingCard)
 * - variant="background": Adds background color when focused (for buttons, tags, list items)
 * - variant="none": No automatic focus styling (use render function for custom handling)
 *
 * @example
 * // Simple usage - no re-renders, focus handled natively by Pressable
 * <Focusable variant="background" onPress={handlePress}>
 *   <Box padding="m">
 *     <Text>Card Content</Text>
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

  // Internal ref for the pressable element
  const innerRef = useRef<View>(null);

  // Only use React state when children is a render function that needs isFocused
  const isRenderFunction = typeof children === 'function';

  // State is only used for render-function children path
  const [standardIsFocused, setStandardIsFocused] = useState(false);
  const [recyclingIsFocused, setRecyclingIsFocused] = useState(false);

  // Reset focus state when recyclingKey changes (item recycled in list)
  useEffect(() => {
    setRecyclingIsFocused(false);
  }, [recyclingKey]);

  const isFocused = recyclingKey !== undefined ? recyclingIsFocused : standardIsFocused;

  // Memoize TV props to avoid recalculation on every render
  const tvProps = useMemo(
    () => buildTVProps(isTV, nextFocusUpId, nextFocusDownId, nextFocusLeftId, nextFocusRightId),
    [isTV, nextFocusUpId, nextFocusDownId, nextFocusLeftId, nextFocusRightId]
  );

  // Ref callback to capture node handle and forward ref
  const refCallback = useCallback(
    (node: View | null) => {
      onRef?.(node);
      innerRef.current = node;
    },
    [onRef]
  );

  // Pre-compute the focus style for the variant (stable between renders)
  const focusStyle = useMemo(
    () => computeFocusStyle(true, variant, theme, focusedStyle),
    [variant, theme, focusedStyle]
  );

  // Flatten the style prop to a static ViewStyle
  const flatStyle = useMemo(() => {
    if (!style) return undefined;
    return StyleSheet.flatten(style as ViewStyle);
  }, [style]);

  // For non-render-function children: use Pressable's native style function.
  // This avoids React state updates and re-renders on focus/blur entirely.
  const nativeStyleFn = useMemo(() => {
    if (isRenderFunction) return undefined;
    return (state: TVPressableState) => {
      const styles: ViewStyle[] = [];
      if (flatStyle) styles.push(flatStyle);
      if (state.focused && focusStyle) styles.push(focusStyle);
      return styles;
    };
  }, [isRenderFunction, flatStyle, focusStyle]);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<PressableProps['onFocus']>>[0]) => {
      // Only trigger React state update for render-function children
      if (isRenderFunction) {
        setStandardIsFocused(true);
        setRecyclingIsFocused(true);
      }

      onFocusChange?.(true);
      onFocus?.(e);
    },
    [isRenderFunction, onFocusChange, onFocus]
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<PressableProps['onBlur']>>[0]) => {
      // Only trigger React state update for render-function children
      if (isRenderFunction) {
        setStandardIsFocused(false);
        setRecyclingIsFocused(false);
      }

      onFocusChange?.(false);
      onBlur?.(e);
    },
    [isRenderFunction, onFocusChange, onBlur]
  );

  // For render-function children: compute style with current isFocused state
  const renderFnStyle = isRenderFunction
    ? [flatStyle, isFocused ? focusStyle : undefined]
    : undefined;

  return (
    <Pressable
      ref={refCallback}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={(nativeStyleFn ?? renderFnStyle) as PressableProps['style']}
      {...tvProps}
      {...props}>
      {isRenderFunction ? children({ isFocused }) : children}
    </Pressable>
  );
};
