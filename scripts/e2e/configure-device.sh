#!/usr/bin/env bash
# Apply post-boot display settings for a DodoStream E2E device profile.
#
# Usage: configure-device.sh <phone|tablet|tv> [-s <adb-serial>]
#
#   phone  1080x2400 @ 420 dpi, portrait
#   tablet 2560x1600 @ 320 dpi, landscape
#   tv     3840x2160 @ 320 dpi, landscape
set -euo pipefail
PROFILE="${1:-phone}"
shift || true
ADB_SERIAL=""
if [[ "${1:-}" == "-s" ]]; then
  ADB_SERIAL="${2:?missing adb serial after -s}"
  shift 2
fi
if (($#)); then
  echo "unexpected adb arguments: $*" >&2
  exit 1
fi

adb_cmd() {
  if [[ -n "$ADB_SERIAL" ]]; then
    adb -s "$ADB_SERIAL" "$@"
  else
    adb "$@"
  fi
}

adb_cmd wait-for-device

# Deterministic rendering: disable system animations.
adb_cmd shell settings put global window_animation_scale 0
adb_cmd shell settings put global transition_animation_scale 0
adb_cmd shell settings put global animator_duration_scale 0

# Suppress Android's first-run immersive-mode confirmation dialog so it cannot
# cover the app or consume Maestro taps during full-screen playback.
adb_cmd shell settings put secure immersive_mode_confirmations confirmed

# The isolated E2E emulator does not need background Google services. Disable
# their update and wellbeing UI so they cannot interrupt Maestro with a dialog.
adb_cmd shell pm disable-user --user 0 com.android.vending >/dev/null 2>&1 || true
adb_cmd shell pm disable-user --user 0 com.google.android.apps.wellbeing >/dev/null 2>&1 || true

case "$PROFILE" in
  phone)
    # `wm size` uses the natural portrait orientation.
    adb_cmd shell wm size 1080x2400
    adb_cmd shell wm density 420
    adb_cmd shell settings put system accelerometer_rotation 0
    adb_cmd shell settings put system user_rotation 0
    ;;
  tablet)
    # `wm size` uses the natural portrait orientation; locked rotation
    # transposes the configured surface into landscape.
    adb_cmd shell wm size 1600x2560
    adb_cmd shell wm density 320
    adb_cmd shell settings put system accelerometer_rotation 0
    adb_cmd shell settings put system user_rotation 1
    ;;
  tv)
    adb_cmd shell wm size 3840x2160
    adb_cmd shell wm density 320
    adb_cmd shell settings put system accelerometer_rotation 0
    adb_cmd shell settings put system user_rotation 0
    ;;
  *)
    echo "unknown profile: ${PROFILE} (expected phone|tablet|tv)" >&2
    exit 1
    ;;
esac
echo "[e2e] configured device profile: ${PROFILE}"
