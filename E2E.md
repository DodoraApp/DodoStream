# Android E2E

Maestro runs deterministic Android UI journeys against the local fixture add-on.
Every E2E run includes visual assertions from committed snapshots.

## Prerequisites

- Node.js 24 and pnpm 10
- Java 17 and Android API 35
- A booted Android emulator or device available through `adb`
- [Maestro](https://maestro.mobile.dev/):

  ```bash
  curl -Ls https://get.maestro.mobile.dev | bash
  ```

The runner starts the fixture add-on, builds and installs a release APK, configures the
selected device profile, then runs Maestro. Metro is not required.

## Run tests

```bash
# Phone full journey
pnpm e2e:android

# One profile
pnpm e2e:android -- --profile tablet
pnpm e2e:android -- --profile tv

# One flow
pnpm e2e:android -- --profile tv --flow tv-navigation.yaml

# Phone, tablet, TV, and TV navigation
pnpm e2e:android:all
```

Use `--device <adb-serial>` to select a specific connected device. Physical devices also
need `ADDON_MANIFEST_URL=http://<host-ip>:8765/manifest.json`, because `10.0.2.2` is an
Android-emulator host alias.

Profiles are fixed: `phone` is portrait; `tablet` and `tv` are landscape. Flows are in
`.maestro/flows/`.

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
