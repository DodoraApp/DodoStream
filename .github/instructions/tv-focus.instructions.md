---
applyTo: '**/*.tsx'
---

## TV Platform & Focus Management

### Use `<Focusable>` Wrapper

For TV focus handling, use the `<Focusable>` component from `src/components/basic/Focusable.tsx`.

### Performance Optimization

The `Focusable` component is optimized for performance:

- **When children is NOT a function**: No re-renders on focus change. Focus styling (outline, background) is applied directly to the pressable.
- **When children IS a function**: Re-renders only when `isFocused` changes, providing the focus state for custom styling.

### Focus Styling Rules

**CRITICAL**: Only MediaCard and ContinueWatchingCard should have outline focus. All other components (buttons, tags, list items, settings, etc.) should use **background and/or text color changes** for focus indication.

**Pattern 1: Simple focus (NO re-renders - best performance)**

Use `variant` prop for automatic focus styling. Children don't need to know about focus state.

```tsx
// BEST - No re-renders, focus handled automatically via variant
<Focusable variant="background" onPress={handlePress}>
  <Box padding="m" borderRadius="l">
    <Text>Card Content</Text>
  </Box>
</Focusable>

// Outline focus for media cards (no re-renders)
<Focusable variant="outline" focusedStyle={{ borderRadius: theme.borderRadii.l }} onPress={handlePress}>
  <Box borderRadius="l" overflow="hidden">
    <Image source={posterSource} />
  </Box>
</Focusable>
```

**Pattern 2: Custom focus handling (with render function)**

Use render function only when you need custom focus behavior (e.g., changing text color, icons).

```tsx
// Only use when children need to react to focus state
<Focusable variant="none" onPress={handlePress}>
  {({ isFocused }) => (
    <Box
      backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}
      borderRadius="l"
      padding="m">
      <Text color={isFocused ? 'focusForeground' : 'textPrimary'}>Card Content</Text>
    </Box>
  )}
</Focusable>
```

**WRONG - Using render function when not needed:**

```tsx
// WRONG - Unnecessary re-renders, use variant="background" instead
<Focusable onPress={handlePress}>
  {({ isFocused }) => (
    <Box backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}>
      <Text>Static content</Text>
    </Box>
  )}
</Focusable>
```

### Focus State Naming

Always use `isFocused` (not `focused`) for consistency across the codebase.

### Focus vs Active State

Focus and active states must be visually distinct:

- **Focus**: Use `focusBackground` / `focusForeground` colors
- **Active/Selected**: Use `primaryBackground` / `primaryForeground` colors

### Focus Visual Feedback

- Only MediaCard/ContinueWatchingCard use outline focus (`variant="outline"` prop)
- All other components use `focusBackground` and `focusForeground` theme colors
- Use `theme.focus.scaleMedium` (1.05) for scale transform on TV when needed
- Always test with D-pad/remote controls

---

## Advanced Focus Management

When standard focus behavior is insufficient, use `react-native-tvos` specific features.

### 1. TVFocusGuideView

Use `TVFocusGuideView` to manage focus groups, redirect focus, or trap focus.

```tsx
import { TVFocusGuideView } from 'react-native';

// Redirect focus to specific destinations
<TVFocusGuideView destinations={[viewRef.current]}>
  {/* content */}
</TVFocusGuideView>

// Trap focus within a container (e.g., for modals or sidebars)
<TVFocusGuideView trapFocusLeft trapFocusRight>
  {/* content */}
</TVFocusGuideView>

// Auto-focus the first focusable child or remember last focused child
<TVFocusGuideView autoFocus>
  {/* content */}
</TVFocusGuideView>
```

### 2. Preferred Focus

Use `hasTVPreferredFocus` to force focus to a specific element when the screen mounts or updates.

```tsx
// Force focus to this element
<Focusable hasTVPreferredFocus>{/* content */}</Focusable>
```

### 3. Explicit Focus Navigation

Use `nextFocus*` props to override default directional navigation.

```tsx
<Focusable nextFocusDown={nextItemRef.current} nextFocusRight={sideItemRef.current}>
  {/* content */}
</Focusable>
```
