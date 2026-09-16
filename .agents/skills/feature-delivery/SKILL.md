---
name: feature-delivery
description: Deliver a feature end to end from user-visible goal to PR-ready branch. Use when implementing a new feature: composes slice-development, android-interactive-verification, What's New generation, the verify:ci gate, and pr-handoff.
---

# Feature delivery

## Compose, don't duplicate

This skill routes; it does not restate content. `slice-development` owns slicing, RED, checkpoints, and the final evidence structure. `android-interactive-verification` owns the device boundary. Link to them by skill name.

## Pipeline

1. Write the goal as user-visible behavior.
2. Slice with `slice-development`.
3. Implement with the invariants in `AGENTS.md` (Restyle tokens, i18n strings, `Focusable`, LegendList, React Query).
4. Prove each slice at the lowest observing ladder level.
5. Any UI change requires a live `agent-device` check of the real surface — Jest alone never closes a UI slice.
6. Add a What's New entry if noteworthy per CONTRIBUTING.md's "Noteworthy feature release notes" criteria (`pnpm new-whats-new` + `pnpm generate-whats-new`).
7. Run the final `pnpm verify:ci`.
8. Hand off via the `pr-handoff` skill.

## Completion rule

The feature is done only when every slice is checkpointed, the UI is verified on device with recorded evidence, `verify:ci` is green, and the PR (or approved local-commit delivery, if the user pushes themselves) is out for review.
