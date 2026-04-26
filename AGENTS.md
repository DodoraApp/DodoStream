# DodoStream Agent Guidelines

Essential context and rules for AI agents working on DodoStream.

## 1. Project Overview

- **Type:** Expo React Native app for TV (Apple TV, Android TV) and Mobile.
- **Stack:** Expo SDK 54, React Native TVOS, TypeScript (strict), Zustand, React Query, Shopify Restyle, Moti, LegendList (`@legendapp/list`).
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
pnpm tsc                            # Type-check (no emit)
pnpm db:generate                    # Generate Drizzle migrations (after schema changes)
pnpm db:studio                      # Open Drizzle Studio (SQLite browser)
```

### App Variant Env Vars

```bash
APP_VARIANT=dev pnpm start          # Dev build (different bundle ID / app name)
APP_VARIANT=prod pnpm start         # Production build
EXPO_TV=1 pnpm start                # Enable TV mode
```

> CI order: `expo install --check` → `pnpm tsc` → `pnpm lint` → `pnpm test`

## 3. Directory Structure

```
src/
  app/          # File-system routes (expo-router). Each file = route.
  components/   # UI components by domain: basic/, media/, video/, profile/
  api/          # API clients: github/, introdb/, stremio/ + errors.ts
  store/        # Zustand stores (profile, settings, watch-history, my-list, addon)
  theme/        # Shopify Restyle theme (theme.ts is the single source of truth)
  constants/    # Centralized constants: playback.ts, ui.ts, media.ts (NO magic numbers)
  db/           # SQLite schema and Drizzle ORM setup
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
  ```ts
  // Good
  const id = getId?.(item) ?? item.fallback;
  const label = getGroupLabel?.(groupId) ?? groupId;

  // Avoid
  const groupIdBad = typeof getItemGroupId === 'function' ? getItemGroupId(item) : item.groupId;
  ```

## 5. Styling (Shopify Restyle)

- **Source of truth:** `src/theme/theme.ts`.
- Use `Box`, `Text` from Restyle for all layout and text.
- Use semantic color names (`mainBackground`, `cardBackground`, `textPrimary`, `focusBackground`).
- Use theme spacing (`xs`, `s`, `m`, `l`, `xl`, `xxl`), border radii, card sizes, and focus values.
- **Never** hardcode hex colors, pixel values, or magic numbers. Use theme tokens or constants.

### Correct vs Wrong Styling

```tsx
// CORRECT - Use Box/Text with theme props
<Box backgroundColor="cardBackground" padding="m" borderRadius="l">
  <Text variant="cardTitle" color="textPrimary">Title</Text>
</Box>

// CORRECT - Use theme values for dimensions
const theme = useTheme<Theme>();
<Box width={theme.cardSizes.media.width} height={theme.cardSizes.media.height} />

// WRONG - Hardcoded values
<Box style={{ width: 140, height: 200, backgroundColor: '#1F222A' }} />
```

### Never Hardcode
- Colors (use theme colors)
- Spacing/padding/margin (use theme spacing)
- Dimensions for cards, inputs, modals (use `theme.cardSizes` or `theme.sizes`)
- Focus border width or scale (use `theme.focus`)
- Toast durations (use constants from `src/constants/ui.ts`)
- Playback timing values (use constants from `src/constants/playback.ts`)
- **User-facing strings** (use i18n)

## 6. Internationalization (i18n)

- **Source of truth:** `src/i18n/translations/en/`.
- **Namespaces:** Translations are split into files (namespaces).
- **Usage:** Use `useTranslation` hook from `react-i18next`.
  ```tsx
  const { t } = useTranslation('profiles');
  return <Text>{t('who_is_watching')}</Text>;
  ```
- **Multiple Namespaces:** `const { t } = useTranslation(['setup', 'common']);` -> `t('common:next')`.
- **Dynamic Languages:** Available languages are automatically detected from the `translations/` directory using `require.context`. Use `AVAILABLE_LANGUAGES` from `@/i18n`.
- **Hardcoded Strings:** NEVER use hardcoded strings in components. Always add them to `en/*.json` first.

## 7. Error Handling & Logging

- Handle API errors in React Query `onError` or try/catch in services.
- Show Toasts for user-facing failures.
- Use debug helpers for important decision points: autoplay, stream selection, navigation branches, error recovery.
  ```ts
  const debug = useDebugLogger('ComponentName'); // In components
  const debug = createDebugLogger('ModuleName'); // In non-React modules
  debug('eventName', { key: value });
  ```

## 8. Component Design & Hooks

- Keep components under ~200 lines. Extract sub-components.
- Use `memo()` for list items and frequently re-rendered components.
- Use `useCallback` for event handlers passed to children.
- Use `useMemo` only for genuinely expensive computations (never for components).
- Define TypeScript interfaces for all component props.
- Check `src/components/basic/` and `src/components/media/` before creating new components.

### useEffect Best Practices
Effects are for synchronizing with **external systems** only.
- **Don't use for:** Deriving state from props (compute during render/useMemo), handling user actions (use event handlers), or chains of state updates.
- **Do use for:** Subscriptions/cleanup, syncing with native modules, timer-based side effects.

## 9. TV Focus & Navigation

- **Always** use `<Focusable>` from `src/components/basic/Focusable.tsx` for interactive elements.
- Prefer `variant="background"` or `variant="outline"` (no re-renders).
- Only use render function `({ isFocused }) => ...` when children must react to focus state.
- **Outline focus** (`variant="outline"`): Only for MediaCard and ContinueWatchingCard.
- **Background focus** (`variant="background"`): All other components (buttons, tags, list items).
- Focus vs Active: `focusBackground`/`focusForeground` for focus; `primaryBackground`/`primaryForeground` for selected.
- Use `TVFocusGuideView` for focus groups/traps and `hasTVPreferredFocus` for initial focus.
- Use `nextFocus*` props (`nextFocusDown`, `nextFocusRight`, etc.) to override default directional navigation.
- Always test with D-pad/remote controls.

### Focus Patterns

**Pattern 1: Simple focus (Best performance)**
```tsx
// Focus handled automatically via variant
<Focusable variant="background" onPress={handlePress}>
  <Box padding="m" borderRadius="l">
    <Text>Card Content</Text>
  </Box>
</Focusable>
```

**Pattern 2: Custom focus (Render function)**
```tsx
// Only use when children need to react to focus state (e.g., text color change)
<Focusable variant="none" onPress={handlePress}>
  {({ isFocused }) => (
    <Box backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}>
      <Text color={isFocused ? 'focusForeground' : 'textPrimary'}>Card Content</Text>
    </Box>
  )}
</Focusable>
```

## 10. State Management (Zustand)

- Per-profile data structure: `byProfile: Record<string, Data>`.
- Access active profile: `useProfileStore.getState().activeProfileId`.
- **Always** use selectors to prevent unnecessary re-renders.

### Available Stores
- `profile.store.ts` — Profile management
- `app-settings.store.ts` — Global app settings
- `profile-settings.store.ts` — Per-profile settings (player, languages)
- `watch-history.store.ts` — Watch progress
- `my-list.store.ts` — Saved items
- `addon.store.ts` — Installed Stremio addons
- `integrations.store.ts` — External service integrations (Simkl, etc.)

## 11. Data Fetching & Lists

- Use React Query (`@tanstack/react-query`) for all data fetching. Never fetch in raw `useEffect`.
- Use `@legendapp/list` (LegendList) for all scrollable lists.
- Use `useRecyclingState` for local state in list items.
- For non-scrollable lists, use regular `.map()` instead.

### LegendList Key Points
- Use `keyExtractor` for proper recycling and layout caching.
- Use `getFixedItemSize` when item sizes are known (skips measuring).
- Use `recycleItems` for lists where items have no local state.
- Wrap `renderItem` in `useCallback` with correct dependencies.

## 12. Animation

- Prefer **Moti** for UI animations (fade, slide, scale, skeleton).
- Use **Reanimated** directly only if Moti can't express the behavior.
- **Never** use the legacy `Animated` API.
- Keep animation timings in `src/constants/ui.ts`.

## 13. Routing (expo-router)

- Files in `src/app/` become routes automatically. Dynamic routes: `[id].tsx`.
- Navigation: `router.push({ pathname: '/details/[id]', params: { id, type } })`.
- Params: `const { id, type } = useLocalSearchParams<{ id: string; type: ContentType }>()`.
- Use `_layout.tsx` for shared layouts.

## 14. Testing

- **Static analysis:** Catch issues early with **TypeScript** (type checking) and **ESLint** (linting).
- **Write testable code:** Keep modules small; separate **UI (components)** from **business logic/state** so logic can be tested without rendering.
- **Unit/Integration:** Jest with `jest-expo` preset. Structure as **Arrange / Act / Assert**.
- **Component tests:** React Native Testing Library. Test from **user perspective** (text, accessibility queries). Avoid testing implementation details.
- **Mocking:** Prefer real dependencies when practical, but mock **external systems** (network, native modules). See `jest.setup.js` for existing mocks.
- **Snapshots:** Use sparingly and keep them small. Prefer explicit expectations.
- **E2E tests:** Use device/simulator tests (Detox/Maestro) for critical flows.
- Run `pnpm lint` and `pnpm test` before finishing any task.

## 15. Forbidden Patterns

- `useMemo` for components (use `memo()` instead).
- Inline styles with magic numbers (`style={{ width: 100 }}`).
- Raw `useEffect` for data fetching (use React Query).
- `renderItem` defined inline (use `useCallback` or stable reference).
- Hardcoded colors, dimensions, or timing values (use theme/constants).
- The legacy `Animated` API (use Moti or Reanimated).
- `render*` methods in functional components.

## 16. Development Workflow

1. **Analyze:** Read related files and existing patterns.
2. **Plan:** Check for existing components/utilities before creating new ones.
3. **Implement:** Follow strict typing, theme usage, and conventions above.
4. **Verify:** Run `pnpm lint` and `pnpm test` before finishing.
