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

- `github` is the read-only GitHub MCP server; `github-write` is the write-capable one. Use `github` for all reading. Never call `github-write` tools (labels, comments, issues, PRs) without explicit user approval in the conversation for that specific action; prepare the exact payload and ask first.
- Both servers authenticate via the `GITHUB_MCP_PAT` environment variable; if it is unset, tell the user rather than retrying.
- Use the `agent-device` MCP tools for opening, installing, resetting, snapshots, screenshots, logs, D-pad actions, and flow execution. Keep one named session per worktree and release it after verification.

## Commands and gates

Use pnpm for repository commands. Install Expo dependencies with `pnpm exec expo install <package>`; do not use ad-hoc package executors or package-manager add commands.

```bash
pnpm install
pnpm typecheck
pnpm exec eslint <changed-file>...
pnpm lint
pnpm format
pnpm format:check
pnpm test
pnpm --silent test:agent
pnpm test -- <path/to/file.test.ts>
pnpm test -- -t "test name"
pnpm --filter @dodostream/e2e-addon typecheck
pnpm test:e2e:addon
pnpm test:e2e:tools
pnpm --silent verify:agent [--only <check-key>] [--json] [--verbose]
pnpm verify:ci
pnpm verify:workflows
```

`pnpm test:e2e:sync*` is an opt-in real-API suite and requires credentials and authorization. The root Jest suite intentionally excludes `scripts/sync-e2e/` and `packages/e2e-addon/`; run their package-specific commands explicitly.

The release APK is the source for Android E2E. Build it with `pnpm e2e:android:build -- --profile <phone|tablet|tv>` (see [E2E.md](E2E.md)), then use the `agent-device` MCP server for install, launch, reset, interaction, evidence capture, and Maestro-compatible flow execution. Do not use Metro, Expo web, direct `agent-device` CLI calls, or raw `adb` for this route.

Profiles are fixed: `phone` is portrait; `tablet` and `tv` are landscape. The fixture's `/manifest.json` is its readiness and app-contract probe; do not invent a second health endpoint.

`pnpm verify:ci` is the local PR-equivalent gate: Expo dependency compatibility, Expo Doctor, Android prebuild, root typecheck, full lint, Jest, no-device E2E tool contracts, fixture-package typecheck, and fixture protocol tests. It excludes credentialed sync E2E and live agent-device verification. Run `pnpm verify:workflows` whenever `.github/workflows/**` changes.

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

## Code review rules

- Generated `android/`/`ios/` output must trace to `app.config.ts` or a config plugin. Reject hand-edits to generated files; fix the owning config instead.
- The fixture `/manifest.json` is the only health probe. Reject a second health endpoint.
- Focus and selected states must stay visually distinct. Reject token changes that merge them — TV users navigate by focus alone.
- Never weaken the deterministic gates (`verify:agent`, `verify:workflows`) to hide a failure; fix the failure or record the debt explicitly.

## Generated files, formatting, and commits

- Use the owning generator for generated content. In particular, create What's New entries with `pnpm new-whats-new` and rebuild `src/constants/whats-new/_registry.ts` with `pnpm generate-whats-new`; see [CONTRIBUTING.md](CONTRIBUTING.md).
- Agents must read the “Noteworthy feature release notes” section in [CONTRIBUTING.md](CONTRIBUTING.md) for the complete What's New criteria and procedure; do not duplicate that procedure here.
- Lefthook formats staged JavaScript/TypeScript/JSON with ESLint and Prettier at commit time. Include only formatting caused by the change.

## Agent workflows

- If the task is prioritizing issues or choosing the next feature: load the `issue-triage` skill first.
- If a bug report must be reproduced: load the `bug-reproduction` skill, then `slice-development` for the fix.
- If a feature is delivered end to end: load the `feature-delivery` skill; it composes `slice-development` and `android-interactive-verification`.
- If any code, test, or build behavior changed: run the owning check from the `agent-verification` skill before the next checkpoint.
- If substantive work is ready for review: load the `pr-handoff` skill.
- If a PR, comment, or label write is pending: create it only via `pr-handoff` and `github-write` with the exact approved payload. Never push, open a PR, or merge without explicit user approval for that action.
- All non-trivial changes follow `slice-development` for slicing, proof levels, checkpoint commits, and the final evidence structure.
