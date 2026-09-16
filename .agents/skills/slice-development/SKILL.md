---
name: slice-development
description: Behavior-first planning, verification, debugging, review, and checkpointing for non-trivial DodoStream changes.
---

# Slice development

Use this skill for a non-trivial behavior change. It is mandatory when autonomous work contains two or more behavioral slices. A slice is one user-visible or system-observable outcome plus the smallest coherent state, UI, API, and test work required to deliver it. Do not split a behavior into technical layers such as types, service, component, and tests.

## Inputs

Before editing, identify:

- The requested outcome and affected platforms.
- The existing tests, flows, fixtures, utilities, and components that own the behavior.
- Every known caller of an exported symbol that will change; use LSP references when available.
- Whether device verification is authorized and whether an agent-device MCP session is available.
- Already-created checkpoints and any contracts they establish.

Write no more than one concise record per slice:

```md
Goal: <single user or system outcome>

Slice <n> — <observable behavior, not implementation layer>
Expectation: <user/system can ...>
RED: <focused failing test command, or reproducible device interaction + expected evidence>
GREEN scope: <smallest named files/symbols; existing utility/component to reuse>
Verify: <L0–L6 command(s) and expected observation>
Device: no | conditional <specific trigger> | yes <native boundary>
Checkpoint: <Conventional Commit subject, or “single-slice final commit”>
```

## State loop

1. **INTAKE** — confirm the outcome, affected platforms, number of behavioral slices, assigned worktree, and permission boundary.
2. **SLICE_PLAN** — record the selected slice and its existing callers, owner, RED expectation, proof path, and checkpoint subject.
3. **DEFINE_EXPECTATION** — state the exact observable behavior before changing code.
4. **ESTABLISH_RED** — use a focused failing Jest test for deterministic utilities, parsers, stores, reducers, hooks, transforms, and API behavior. For native focus, visual, lifecycle, player, or layout behavior, use a repeatable interaction and expected hierarchy, screenshot, or log evidence; never invent a low-value unit test.
5. **IMPLEMENT_MINIMUM** — change only the causal code and the tests/flow needed for this slice. Reuse existing repository primitives and leave the app coherent.
6. **TARGETED_VERIFY** — run the lowest ladder level that can observe the expectation. Escalate only when a changed boundary is not observable at that level.
7. **DEVICE_REQUIRED?** — if the expectation involves native Android/TV behavior, use `android-interactive-verification` only with explicit authorization and an agent-device MCP session.
8. **SLICE_REVIEW** — inspect the slice for unrelated files, unnecessary abstractions, duplicate or stale paths, weak assertions, debug noise, accidental snapshots, and behavior outside the stated expectation.
9. **CHECKPOINT_COMMIT** — commit the reviewed slice before selecting the next one. A conversation checkpoint is not a Git checkpoint.
10. **INTEGRATION_VERIFY** — after the last slice, run the union of affected checks and the final gate, then compare the complete change against the original request.

If a check fails, enter **DEBUG**: rerun the same reproduction, narrow the failure using the relevant diff/log/hierarchy, state one causal hypothesis, change one causal area, and rerun the targeted check. After three consecutive attempts without new evidence, return to `SLICE_PLAN` and split or replace the remaining slice, add diagnostic evidence, or escalate only if the current level cannot observe it. Completed checkpoints remain valid unless their contract is disproven. Revise only unstarted slice records when understanding changes.

## Verification ladder

Select the first level that observes the stated behavior; higher levels are for newly exposed boundaries, not ceremony.

| Level                              | Execute                                                                   | Use for                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| L0 — static                        | `pnpm typecheck` and `pnpm exec eslint <changed-file>...`                 | Every TypeScript slice before checkpoint; imports, types, hooks, and token names.                              |
| L1 — focused unit                  | `pnpm test -- <test-file>` or `pnpm test -- -t "<name>"`                  | Pure parsers, reducers/stores, utilities, transforms, and API error mapping.                                   |
| L2 — focused integration/component | The owning hook, RNTL component, database, or API test file               | Rendered interactions and React Query/Zustand, SQLite, or mocked-network boundaries.                           |
| L3 — affected family/build         | The narrow affected directory/package and required non-device build       | Cross-component/package boundaries, fixture changes, remote UI, or Expo/native plugin generation.              |
| L4 — interactive Android/TV        | The authorized agent-device MCP session                                   | Native focus, D-pad, player/lifecycle/system behavior, real recycling, Android defects, and rendered geometry. |
| L5 — targeted Maestro              | The named flow with stable selectors and reviewed baselines               | Important deterministic regression paths after interactive behavior is understood.                             |
| L6 — final affected gate           | `pnpm verify:ci` plus affected package/build checks and selected L5 flows | The final union after all slices, not every edit.                                                              |

Skip L4/L5 for pure logic and mockable behavior. Enter L4 before claiming behavior involving `Platform.isTV`, `TVFocusGuideView`, `hasTVPreferredFocus`, `nextFocus*`, `useTVEventHandler`, real LegendList recycling, native players, immersive/system UI, lifecycle, or Android/TV geometry. Run L5 only when L4 establishes a stable, important, selector- and baseline-backed regression path. Never start Metro or use Expo web for the release-APK Android E2E route.

## Checkpoint policy

For autonomous multi-slice work, each checkpoint contains exactly one observable behavior and everything required for it: production code, focused tests or a reviewed flow/baseline, translations, and tracked generated content when applicable. It passes L0 and its selected targeted proof and uses `<type>(<scope>): <imperative summary>`.

Amend the preceding checkpoint only when all of these hold: the next slice has not started, the correction is solely required by that same slice's expectation or test, and the commit has not been reported, handed off, or used as a later baseline. Otherwise create a new `fix(...)` checkpoint, including for integration defects found after valid checkpoints. Do not create commits for discovery, failed experiments, formatting-only churn, or ignored generated artifacts.

## Final evidence

Report only observed evidence using this literal structure:

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

Do not claim a skipped device, CI, credentialed API, screenshot, or Maestro result. Do not duplicate the repository's durable styling, focus, API, or command rules; those remain in `AGENTS.md`.
