# Android E2E

Two supported routes share one contract: the release APK built from the E2E
profile, the seeded fixture add-on (`/manifest.json`), and Maestro. Metro is
never part of an E2E run.

## Prerequisites

- Node.js 24 and pnpm 10
- Java 17 and Android API 35
- An Android emulator or device; agent verification uses the `agent-device` MCP server, the runner route uses `adb`
- [Maestro](https://maestro.mobile.dev/):

  ```bash
  curl -Ls https://get.maestro.mobile.dev | bash
  ```

## Build the release APK (both routes)

```bash
pnpm e2e:android:build -- --profile <phone|tablet|tv> [--abi <abi>]
```

The build applies `APP_VARIANT=dev`, `EXPO_PUBLIC_E2E=1`, the profile
orientation, `EXPO_TV=1` for TV, and `ADDON_MANIFEST_URL` (default
`http://10.0.2.2:8765/manifest.json`, the Android-emulator host alias). It
never touches a device: it prints the selected APK and records
`artifacts/e2e/<profile>/artifact.json`. Pass `--abi` when the target ABI is
known; otherwise the build selects a universal APK when one exists.

## Agent route (agent-device MCP)

This route is required for agent verification and for every UX, UI, or
user-facing change. Interact with `agent-device` only through its MCP tools —
never through the CLI, raw `adb`, or Metro.

1. Start the fixture add-on for the worktree (`pnpm e2e:addon`) and probe its
   `/manifest.json`.
2. Build the release APK for the profile (above).
3. Through the MCP tools, list or boot the profile-matching device and bind
   the session to this worktree. If no target is free or it is occupied by
   another agent, ask the user what to do.
4. Through the MCP tools: animations off, profile orientation, install the
   APK, launch `app.dodora.dodostream.dev`, and clear only the app state when a
   clean start is needed. Capture the initial screenshot, hierarchy snapshot,
   and app logs before interacting.
5. Interact through the MCP tools (`tv_remote` for `DPAD_*` and `BACK`, press,
   type, swipe) and capture evidence at each meaningful state.
6. Run a committed flow through the MCP tools only when it is the reviewed
   regression path: `test` with the flow file plus `ADDON_MANIFEST_URL`,
   `PROFILE`, and `E2E_ORIENTATION` env.
7. Release the MCP session when finished.

Profiles are fixed: `phone` is portrait; `tablet` and `tv` are landscape. Flows
are in `.maestro/flows/`.

## Human and CI route (runner)

```bash
# Phone full journey
pnpm e2e:android

# One profile
pnpm e2e:android -- --profile tablet
pnpm e2e:android -- --profile tv

# One flow
pnpm e2e:android -- --profile tv --flow tv-navigation.yaml

# Phone, tablet, TV, and TV navigation
pnpm e2e:android:all -- --device <adb-serial>
```

The runner starts the fixture add-on, builds the release APK, installs it
through `adb`, applies `scripts/e2e/configure-device.sh`, and runs Maestro.
Use `--device <adb-serial>` to select a specific connected device; forward it
to `pnpm e2e:android:all` so every profile targets the same device. Physical
devices also need `ADDON_MANIFEST_URL=http://<host-ip>:8765/manifest.json`,
because `10.0.2.2` is an Android-emulator host alias.

## Visual snapshots

Snapshots live in `.maestro/snapshots/<profile>/`. A run always asserts the current UI
against them and never overwrites an existing snapshot.

When adding a new profile or checkpoint, the runner captures its missing snapshots, then
reruns the flow with assertions enabled. For an intentional visual change:

1. Inspect the failed Maestro artifact in `artifacts/maestro/`.
2. Delete only the reviewed snapshot, for example:

   ```bash
   rm .maestro/snapshots/phone/home/01-home.png
   ```

3. Rerun the affected profile and flow. The runner captures the missing snapshot and
   verifies the complete flow.
4. Commit the reviewed snapshot.

If the change is not intended, adjust the app and rerun the same command. Do not lower
the visual assertion threshold.

## CI

`.github/workflows/e2e-android.yaml` has only `workflow_dispatch`; it never starts
automatically. Trigger it manually for the branch containing the change (including a PR
branch). It runs the phone, tablet, TV, and TV-navigation journeys and uploads Maestro
artifacts for each entry.
