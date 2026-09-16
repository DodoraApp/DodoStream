---
name: android-interactive-verification
description: Session-scoped Android and Android TV fixture, APK, interaction, evidence, and Maestro procedure through the agent-device MCP server.
---

# Android interactive verification

Use this skill only when the slice's expectation crosses a native Android/Android TV boundary: focus routing, D-pad semantics, native players, lifecycle or system UI, real list recycling, Android-only behavior, rendered geometry, or a stable Maestro regression. Pure parsing, state, hook, transformation, and mockable API work stays on the lower verification ladder.

## Permission and ownership gate

Before acquiring or driving a device, confirm that the task explicitly requires device evidence or that the user authorized it. Stop before device acquisition when neither is true. If no agent-device session is active or the selected target is occupied by another agent, ask the user what to do before acquiring, booting, or reusing a target. Never start Metro, use Expo web, call the `agent-device` CLI directly, or use raw `adb`.

All device interaction goes through the repository's `agent-device` MCP server (`.omp/mcp.json`): keep exactly one MCP session per worktree and bind every operation to it. Keep the session for nearby repairs; release it with `close` after the last related L4/L5 slice, including failure paths.

## Required inputs

Record these before starting:

- The slice's exact expectation and RED interaction, including the expected initial and final state.
- `phone`, `tablet`, or `tv` profile; dev app id `app.dodora.dodostream.dev`; and the required orientation.
- The release APK path recorded by `pnpm e2e:android:build` in `artifacts/e2e/<profile>/artifact.json`.
- The seeded fixture manifest URL. The fixture's `GET /manifest.json` must identify `com.dodostream.e2e-fixture` before install or launch; do not invent a second health endpoint.
- The affected existing Maestro flow, if a stable regression path already exists.

## Session sequence

1. Start the fixture add-on for this worktree (`pnpm e2e:addon`) and probe its `/manifest.json`.
2. Build the release APK artifact: `pnpm e2e:android:build -- --profile <phone|tablet|tv>`. The build applies `APP_VARIANT=dev`, `EXPO_PUBLIC_E2E=1`, the profile orientation, and `EXPO_TV=1` for TV. Never substitute a Metro bundle.
3. Through the MCP tools: list or boot the profile-matching device and bind the worktree's MCP session to it.
4. Through the MCP tools: disable animations, set the profile orientation, install the artifact, and launch `app.dodora.dodostream.dev`. Clear only the app state when the slice needs a clean start, then capture the initial screenshot, hierarchy snapshot, and app logs before interacting.
5. Execute the recorded sequence through MCP interactions (`tv_remote` for `DPAD_*` and `BACK`, press, type, swipe). Capture the resulting screenshot, hierarchy, and focused-component or app logs at each meaningful state.
6. On failure, return to the same slice's DEBUG loop: repeat the exact sequence, state one causal hypothesis, change one causal area, and retest on the same session.
7. Release the MCP session with `close` when no nearby slice needs it, and stop the fixture add-on process.

Captures belong beneath the current worktree's ignored `artifacts/` directory. A local emulator reaches the fixture through `http://10.0.2.2:<port>/manifest.json`; record the exact URL the session used. Never assume a host address works from a physical device.

## Evidence and Maestro promotion

The final slice record must state `initial state → key/action → observed state` and identify which screenshot, hierarchy, and log artifacts support it. A screenshot alone does not prove focus; name the visual focus indicator plus hierarchy or focused-component evidence. Do not overwrite committed snapshots during exploration.

Promote the sequence to a targeted Maestro flow only when L4 establishes a stable, user-important regression with reliable selectors and reviewed screenshots. Run the flow through the MCP server (`test` with the flow file and session env such as `ADDON_MANIFEST_URL`, `PROFILE`, `E2E_ORIENTATION`); inspect every screenshot and baseline change before staging. Do not use Maestro as the first debugger for an unclear focus graph, a positional workaround, or a one-off exploratory trace.

## Exit criteria

The skill exits only when the slice has concrete interaction evidence, a targeted Maestro result when promotion is warranted, and no live agent-device MCP session or fixture add-on process is left running.
