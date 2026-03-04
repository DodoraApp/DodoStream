# DodoStream Agent Guidelines

Essential context and rules for AI agents working on DodoStream.

## 1. Project Overview

- **Type:** Expo React Native app for TV (Apple TV, Android TV) and Mobile.
- **Stack:** Expo SDK 54, React Native TVOS, TypeScript (strict), Zustand, React Query, Shopify Restyle, Moti, FlashList.
- **Routing:** File-based via `expo-router` in `src/app/`.
- **Package Manager:** pnpm (v10). Use `pnpx expo install <package>` for adding deps, NOT `pnpm add`.

## 2. Build & Test Commands

```bash
pnpm install                        # Install dependencies
pnpm start                          # Start Expo dev client
pnpm android                        # Run on Android
pnpm ios                            # Run on iOS
pnpm lint                           # ESLint (flat config, expo + react-compiler)
pnpm format                         # ESLint --fix + Prettier --write
pnpm test                           # Run all Jest tests
pnpm test -- path/to/file.test.ts   # Run a single test file
pnpm test -- -t "test name"         # Run tests matching a name pattern
```

## 3. Directory Structure

```
src/
  app/          # File-system routes (expo-router). Each file = route.
  components/   # UI components by domain: basic/, media/, video/, profile/
  api/          # API client and React Query hooks
  store/        # Zustand stores (profile, settings, watch-history, my-list, addon)
  theme/        # Shopify Restyle theme (theme.ts is the single source of truth)
  constants/    # Centralized constants: playback.ts, ui.ts, media.ts (NO magic numbers)
  hooks/        # Custom React hooks
  utils/        # Utilities and helpers
  types/        # Shared TypeScript types
```

## 4. Code Style & Formatting

### Prettier

- `printWidth: 100`, `tabWidth: 2`, `singleQuote: true`, `bracketSameLine: true`, `trailingComma: 'es5'`.

### ESLint

- Flat config (`eslint.config.js`): expo base + `eslint-plugin-react-compiler` (recommended).
- `react/display-name` is disabled.

### Import Order

1. React / React Native
2. External libraries
3. Internal aliases (`@/components/...`, `@/store/...`)
4. Relative imports

Path alias: `@/*` maps to `src/*` (configured in `tsconfig.json`).

### Naming Conventions

- **Components/Files:** PascalCase (`MediaCard.tsx`).
- **Hooks:** camelCase with `use` prefix (`useMediaDetails.ts`).
- **Variables/Functions:** camelCase.
- **Booleans:** Prefix with `is`, `has`, `should`.
- **Handlers:** `handle*` for internal handlers, `on*` for callback props.
- **Domain:** Use `Media` (not `Movie`). Use `isFocused` (not `focused`) for focus state.

### TypeScript

- Strict mode enabled. No `any`.
- Define `interface ComponentProps` for all component props.
- Rely on type inference for return types unless ambiguous.
- Prefer optional chaining over `typeof fn === 'function'` checks.

## 5. Styling (Shopify Restyle)

- **Source of truth:** `src/theme/theme.ts`.
- Use `Box`, `Text` from Restyle for all layout and text.
- Use semantic color names (`mainBackground`, `cardBackground`, `textPrimary`, `focusBackground`).
- Use theme spacing (`xs`, `s`, `m`, `l`, `xl`, `xxl`), border radii, card sizes, and focus values.
- **Never** hardcode hex colors, pixel values, or magic numbers. Use theme tokens or constants.

## 6. Error Handling & Logging

- Handle API errors in React Query `onError` or try/catch in services.
- Show Toasts for user-facing failures.
- Use debug helpers for important decision points:
  ```ts
  const debug = useDebugLogger('ComponentName'); // In components
  const debug = createDebugLogger('ModuleName'); // In non-React modules
  debug('eventName', { key: value });
  ```

## 7. Component Design

- Keep components under ~200 lines. Extract sub-components.
- Use `memo()` for list items and frequently re-rendered components.
- Use `useCallback` for event handlers passed to children.
- Use `useMemo` only for genuinely expensive computations (never for components).
- Define TypeScript interfaces for all component props.
- Check `src/components/basic/` and `src/components/media/` before creating new components.

## 8. TV Focus & Navigation

- **Always** use `<Focusable>` from `src/components/basic/Focusable.tsx` for interactive elements.
- Prefer `variant="background"` or `variant="outline"` (no re-renders).
- Only use render function `({ isFocused }) => ...` when children must react to focus state.
- **Outline focus** (`variant="outline"`): Only for MediaCard and ContinueWatchingCard.
- **Background focus** (`variant="background"`): All other components (buttons, tags, list items).
- Focus vs Active: `focusBackground`/`focusForeground` for focus; `primaryBackground`/`primaryForeground` for selected.
- Use `TVFocusGuideView` for focus groups/traps and `hasTVPreferredFocus` for initial focus.

## 9. State Management (Zustand)

- Per-profile data structure: `byProfile: Record<string, Data>`.
- Access active profile: `useProfileStore.getState().activeProfileId`.
- **Always** use selectors to prevent unnecessary re-renders.

## 10. Data Fetching & Lists

- Use React Query (`@tanstack/react-query`) for all data fetching. Never fetch in raw `useEffect`.
- Use `@shopify/flash-list` for all scrollable lists.
- Use `useRecyclingState` for local state in list items.

## 11. Animation

- Prefer **Moti** for UI animations (fade, slide, scale, skeleton).
- Use **Reanimated** directly only if Moti can't express the behavior.
- **Never** use the legacy `Animated` API.
- Keep animation timings in `src/constants/ui.ts`.

## 12. Routing (expo-router)

- Files in `src/app/` become routes automatically. Dynamic routes: `[id].tsx`.
- Navigation: `router.push({ pathname: '/details/[id]', params: { id, type } })`.
- Params: `const { id, type } = useLocalSearchParams<{ id: string; type: ContentType }>()`.
- Use `_layout.tsx` for shared layouts.

## 13. Testing

- **Unit/Integration:** Jest with `jest-expo` preset. Structure as Arrange / Act / Assert.
- **Component tests:** React Native Testing Library. Test from user perspective (text, accessibility queries). Avoid testing implementation details.
- **Mocking:** Mock external systems (network, native modules). See `jest.setup.js` for existing mocks (AsyncStorage, expo-image, expo-haptics, moti, react-query notifyManager).
- **Snapshots:** Use sparingly. Prefer explicit assertions.
- Run `pnpm lint` and `pnpm test` before finishing any task.

## 14. Forbidden Patterns

- `useMemo` for components (use `memo()` instead).
- Inline styles with magic numbers (`style={{ width: 100 }}`).
- Raw `useEffect` for data fetching (use React Query).
- `renderItem` defined inline (use `useCallback` or stable reference).
- Hardcoded colors, dimensions, or timing values (use theme/constants).
- The legacy `Animated` API (use Moti or Reanimated).
- `render*` methods in functional components.

## 15. Development Workflow

1. **Analyze:** Read related files and existing patterns.
2. **Plan:** Check for existing components/utilities before creating new ones.
3. **Implement:** Follow strict typing, theme usage, and conventions above.
4. **Verify:** Run `pnpm lint` and `pnpm test` before finishing.
