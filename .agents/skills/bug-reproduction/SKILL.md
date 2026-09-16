---
name: bug-reproduction
description: Reproduce a reported bug on Android/Android TV and capture evidence. Use when a bug report, GitHub issue, or regression must be confirmed before fixing; release-APK route via agent-device, never Metro or Expo web.
---

# Bug reproduction

## Intake

Extract from the issue: repro steps, affected variant (`app.dodora.dodostream.dev` vs prod), platform (phone portrait / tablet / tv landscape), and expected vs actual behavior.

## Permission gate

Per `AGENTS.md`, only acquire a device through the `agent-device` MCP server, one named session per worktree, and only when the user authorized device use for this task.

## Build route

Default is the release-APK route: `pnpm e2e:android:build -- --profile <phone|tablet|tv>` with the deterministic Stremio fixture (`packages/e2e-addon/`, readiness probe `/manifest.json`). Do not start Metro or use Expo web. If the issue only reproduces in a dev build, ask the user before starting Metro.

## Reproduce loop

Install the APK via agent-device, reset state, drive the exact repro steps with D-pad/tap tools, and capture snapshot/screenshot/logs each attempt. Keep going until the bug reproduces or 3 attempts make no progress — report findings instead of thrashing.

## Regression windows

If the issue is a regression and the breaking window is unclear, never start a `git bisect` loop unprompted — each step costs a full release-APK build. Present the bisect plan (candidate commits, build count, expected duration) and ask the user first; prefer reasoning from the issue's reported version and `git log` over blind bisection.

## Fix handoff

Once reproduced, switch to the `slice-development` skill state loop with the reproduction as the RED expectation; re-verify on device post-fix.

## Close the loop

Prepare the issue comment (repro summary + fix commit) as a dry run for `github-write`, and hand the fix off through `pr-handoff`. Post either only after explicit user approval.
