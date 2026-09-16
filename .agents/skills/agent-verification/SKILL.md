---
name: agent-verification
description: Select and run concise deterministic DodoStream verification checks. Use for implementation validation, CI-equivalent checks, static quality checks, or rerunning one failing verification phase.
---

# Agent verification

Use this skill to select the narrowest deterministic check that observes the changed contract. It complements `slice-development`; it does not replace focused tests or authorized native evidence.

## Commands

```bash
# List stable phase keys.
pnpm --silent verify:agent --list

# Run one or more named phases with concise output.
pnpm --silent verify:agent --only typecheck,lint

# Emit newline-delimited JSON for an automated caller.
pnpm --silent verify:agent --only format,typecheck --json

# Stream a child command while diagnosing it.
pnpm --silent verify:agent --only android-prebuild --verbose

# Run the complete deterministic gate after the last slice.
pnpm --silent verify:agent
# `pnpm verify:ci` is the CI alias.
```

`verify:agent` preserves a failing command's output and exit status. It suppresses successful child output so an agent retains the phase result, elapsed time, and failure evidence instead of routine logs.

## Phase selection

| Changed area                                    | First check                                            |
| ----------------------------------------------- | ------------------------------------------------------ |
| TypeScript code or imports                      | `typecheck`                                            |
| Formatting-only or config/documentation changes | `format`                                               |
| JavaScript/TypeScript lint rules                | `lint`                                                 |
| Expo dependency versions                        | `expo-deps`, then `expo-doctor`                        |
| Native config or config plugins                 | `android-prebuild`                                     |
| Root Jest contract                              | a focused `pnpm --silent test:agent <path-or-pattern>` |
| Android E2E runner scripts                      | `e2e-tools`                                            |
| Deterministic fixture add-on                    | `e2e-addon-types,e2e-addon`                            |

Run the complete gate only after the changed slice's focused check passes. Do not substitute it for a focused RED/GREEN test.

## Native and diagnostic boundaries

- `verify:agent` never builds an APK, starts Metro, acquires a device, or proves UI/focus/player behavior.
- For rendered Android/TV behavior, use `android-interactive-verification` after this gate; the device proof is separate.
- Use direct `pnpm lint` when the current warning text matters. The gate intentionally reports a successful lint phase concisely.
- The Jest phase does not force-exit or otherwise conceal open handles. Investigate a handle warning as its own defect; do not weaken the gate to hide it.

## Exit criteria

Report the exact phase keys and observed result. A complete UI or native-feature claim also needs the focused test and, when applicable, the authorized device evidence named by `slice-development`.
