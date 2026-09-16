# DodoStream Agent Guidelines

This is the canonical durable guidance for contributors and coding agents. OMP imports it through `.omp/AGENTS.md`.

## Worktree and permission boundary

- Work only in the assigned Git worktree. Do not stage, modify, or use another worktree's files or processes.
- Every UX, UI, or user-facing functionality change requires live verification through the configured `agent-device` MCP server; tests supplement but do not replace that evidence.
- Interact with `agent-device` only through its OMP MCP server. Do not invoke its CLI directly, use raw `adb`, boot or drive a simulator/emulator through another tool, or run `pnpm android`/`pnpm ios`.
- If no agent-device session is active or the selected target is occupied by another agent, ask the user what to do before acquiring, booting, or reusing a target.
- Do not start Metro unless the task explicitly requires a development-server workflow. The release-APK verification route does not require Metro.
- Do not use Expo web as verification for this TV/mobile application.
- Never claim a command, device observation, CI result, or screenshot that was not actually run or observed.

## Project facts

- DodoStream is an Expo SDK 57 React Native application for Android, Android TV, iOS, and tvOS builds.
- The app uses the `react-native-tvos` 0.86 fork, Expo Router, TypeScript strict mode, Shopify Restyle, Zustand, TanStack React Query, LegendList, Moti/Reanimated, and pnpm 10.
- `APP_VARIANT=dev` produces the separately installable development app (`app.dodora.dodostream.dev`); the default/prod variant uses `app.dodora.dodostream`.
- `EXPO_TV=1` enables TV-specific native configuration. Android E2E builds also use `EXPO_PUBLIC_E2E=1` and `E2E_ORIENTATION=portrait|landscape`.
- `app.config.ts` and the local config plugins are the source of native configuration. Native projects are generated artifacts; review prebuild output and do not hand-edit generated changes when config/plugin changes are the correct source.

## Repository layout

- `src/app/` — Expo Router routes and layouts.
- `src/components/` — reusable UI grouped by basic, media, profile, and video domains.
- `src/api/`, `src/hooks/`, `src/store/`, `src/db/` — API clients/hooks, Zustand state, and SQLite/Drizzle persistence.
- `src/theme/`, `src/constants/`, `src/i18n/`, `src/types/`, `src/utils/` — visual tokens, domain constants, translations, shared types, and utilities.
- `packages/e2e-addon/` — deterministic Stremio fixture used by Android E2E; `packages/remote-ui/` — remote UI package.
- `scripts/` — repository tooling, including the Android E2E runner and fixture helpers.
- `.maestro/` — Android E2E flows, configuration, and reviewed visual baselines.
## MCP services

- `.omp/mcp.json` is the repository MCP configuration. It registers `agent-device` for live Android/iOS interaction and GitHub for repository operations.
- Use the `agent-device` MCP tools for opening, installing, resetting, snapshots, screenshots, logs, D-pad actions, and flow execution. Keep one named session per worktree and release it after verification.

## Commands and gates

Use pnpm for repository commands. Install Expo dependencies with `pnpm exec expo install <package>`; do not use ad-hoc package executors or package-manager add commands.

```bash
pnpm install
pnpm typecheck
pnpm exec eslint <changed-file>...
pnpm lint
pnpm format
pnpm test
pnpm test -- <path/to/file.test.ts>
pnpm test -- -t "test name"
pnpm --filter @dodostream/e2e-addon typecheck
pnpm test:e2e:addon
pnpm test:e2e:tools
pnpm verify:ci
```

`pnpm test:e2e:sync*` is an opt-in real-API suite and requires credentials and authorization. The root Jest suite intentionally excludes `scripts/sync-e2e/` and `packages/e2e-addon/`; run their package-specific commands explicitly.

The release APK is the source for Android E2E. Build it with `pnpm e2e:android:build -- --profile <phone|tablet|tv>` (see [E2E.md](E2E.md)), then use the `agent-device` MCP server for install, launch, reset, interaction, evidence capture, and Maestro-compatible flow execution. Do not use Metro, Expo web, direct `agent-device` CLI calls, or raw `adb` for this route.

Profiles are fixed: `phone` is portrait; `tablet` and `tv` are landscape. The fixture's `/manifest.json` is its readiness and app-contract probe; do not invent a second health endpoint.

`pnpm verify:ci` is the local PR-equivalent gate: Expo dependency compatibility, Expo Doctor, Android prebuild, root typecheck, full lint, Jest, no-device E2E tool contracts, fixture-package typecheck, and fixture protocol tests. It excludes credentialed sync E2E and live agent-device verification.

## UI, platform, and data invariants

- Use Restyle `Box`/`Text` and tokens from `src/theme/theme.ts` for colors, spacing, dimensions, radii, and focus styling. Never add hardcoded visual values or magic animation/playback timing.
- Put user-facing strings in `src/i18n/translations/en/` and access them through `react-i18next`; do not hardcode UI copy.
- Use `useDebugLogger`/`createDebugLogger` for meaningful business decisions and Toasts for user-facing failures. Handle API failures in React Query or service error paths.
- Use React Query for data fetching. Effects synchronize with external systems only; do not fetch or derive state through raw `useEffect` chains.
- Use `memo()` for frequently rendered/list components and `useCallback` for handlers passed to children. Do not use the legacy React Native `Animated` API; prefer Moti and use Reanimated directly only where Moti cannot express the behavior.
- Use `Focusable` from `src/components/basic/Focusable.tsx` for interactive TV/mobile controls. Use `variant="outline"` only for `MediaCard` and `ContinueWatchingCard`; other controls use background/text focus tokens. Keep focus and selected state visually distinct.
- Use `TVFocusGuideView`, `hasTVPreferredFocus`, `nextFocus*`, and imperative/native focus APIs only when the focus graph requires them. Native focus, D-pad transitions, real list recycling, player engines, and Android geometry require a real Android/TV check; Jest mocks cannot prove them.
- Use LegendList for scrollable lists with stable `keyExtractor`, fixed item sizing when known, recycling only when local state permits it, and stable `renderItem` callbacks. Use `.map()` for non-scrollable lists.
- Use expo-router file routes and layouts. Keep per-profile Zustand state keyed by profile and select only the state needed by a component.

## Testing boundaries

Choose the lowest verification level that observes the stated behavior:

- Static: `pnpm typecheck` and changed-file ESLint.
- Focused Jest unit/integration: utilities, parsers, stores, hooks, data transforms, API mapping, and database behavior.
- Focused component/integration tests: rendered interactions, React Query/Zustand boundaries, and mocked native edges.
- Affected package/build checks: fixture package, remote UI, or Expo config/native generation as applicable.
- Authorized interactive Android/TV checks: native focus, D-pad behavior, player/lifecycle/system behavior, real recycling, and rendered geometry.
- Targeted Maestro: only after an important deterministic path has stable selectors and reviewed baselines.

Do not create a low-value unit test for behavior that only a native device can observe. Record the exact interaction and evidence instead.

## Generated files, formatting, and commits

- Use the owning generator for generated content. In particular, create What's New entries with `pnpm new-whats-new` and rebuild `src/constants/whats-new/_registry.ts` with `pnpm generate-whats-new`; see [CONTRIBUTING.md](CONTRIBUTING.md).
- Agents must read the “Noteworthy feature release notes” section in [CONTRIBUTING.md](CONTRIBUTING.md) for the complete What's New criteria and procedure; do not duplicate that procedure here.
- Lefthook formats staged JavaScript/TypeScript/JSON with ESLint and Prettier at commit time. Include only formatting caused by the change.

## Incremental workflow

For non-trivial behavior changes, load the `slice-development` skill. Define one observable behavior at a time, establish automated RED where meaningful (or a reproducible native expectation), implement the smallest coherent change, select proportionate proof, review the slice, and report exact evidence. Use `android-interactive-verification` only for an authorized native boundary.

Autonomous work containing multiple behavioral slices creates a checkpoint commit after each verified slice before starting the next. A one-slice task gets one verified final commit. An OMP conversation checkpoint is never a Git checkpoint.

Final evidence uses this structure:

```md
Implemented:

- <observable behavior>

Checkpoints:

- <hash> <subject>

Verified:

- <level>: <command or interaction> — <observed result>

Not run:

- <check> — <concrete reason>

Remaining concerns:

- <actual concern, or none>
```
