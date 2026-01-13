# Copilot / AI Agent Instructions for DodoStream

## General

- Use fetch/web search tools if available to gather up-to-date information on libraries, tools or best practices.

## Project Overview

This is an Expo React Native app targeting TV platforms (Apple TV, Android TV) and mobile devices. The stack includes:

- **Expo SDK** with file-based routing via `expo-router`
- **React Native TVOS** fork for TV platform support
- **@shopify/restyle** for styling
- **Zustand** for state management
- **Moti** (on top of Reanimated) for animations
- **TypeScript** with strict mode enabled

## Directory Structure

- `src/app/*` — File-system based routes (each file = route)
- `src/components/` — Reusable UI components organized by domain (`media/`, `basic/`, `video/`, `profile/`)
- `src/store/` — Zustand stores for global state
- `src/constants/` — Centralized constants (`playback.ts`, `ui.ts`, `media.ts`, etc.)
- `src/hooks/` — Custom React hooks
- `src/utils/` — Utilities and helpers
- `src/theme/` — Restyle theme configuration
- `src/api/` — API client and React Query hooks

---

## Detailed Instructions

Detailed instructions have been split into path-specific files in `.github/instructions/`:

- **Theme & Styling**: `.github/instructions/theme.instructions.md`
- **TV Platform & Focus**: `.github/instructions/tv-focus.instructions.md`
- **Components**: `.github/instructions/components.instructions.md`
- **React Best Practices**: `.github/instructions/react-best-practices.instructions.md`
- **Routing**: `.github/instructions/routing.instructions.md`
- **State Management**: `.github/instructions/state-management.instructions.md`
- **Testing**: `.github/instructions/testing.instructions.md`

---

## Development Commands

```bash
pnpm start          # Start dev client
pnpm android        # Run on Android
pnpm ios            # Run on iOS
pnpm lint           # ESLint
pnpm format         # Prettier
npx expo install    # Install packages (always use this, not npm/pnpm add)
```

---

## Critical Rules

### Always Do

- Use theme for all colors, spacing, dimensions, and focus values
- Use `<Focusable>` wrapper for TV-interactive components
- Use constants from `playback.ts` and `ui.ts` etc.
- Define TypeScript interfaces for props
- Use React Query for data fetching
- Add debug logs for business logic decisions
- Show toasts for user feedback
- Prefer **Moti** for UI animations (fade/slide/scale/skeleton); use **Reanimated** directly if Moti can’t express the behavior/performance needs
- Keep animation timings in `src/constants/ui.ts` (no magic timing numbers)

### Never Do

- Hardcode colors, dimensions, or timing values
- Create inline styles with magic numbers
- Use `useMemo` to memoize components (use `memo()`)
- Use `render*` methods in functional components
- Fetch data in raw `useEffect` (use React Query)
- Use the legacy `Animated` API when Moti/Reanimated is available
