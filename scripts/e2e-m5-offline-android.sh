#!/bin/bash
# ARCH-18 / ROAD-02 M5: run the offline local-food Maestro flow. Metro must already serve a bundle built with
# EXPO_PUBLIC_DEV_SEED_FOOD_SEARCH=1, and the Android dev build must contain NetInfo.
set -euo pipefail

ADB=${ADB:-$HOME/Android/Sdk/platform-tools/adb}

restore_network() {
  "$ADB" shell svc wifi enable >/dev/null || true
  "$ADB" shell svc data enable >/dev/null || true
}
trap restore_network EXIT

"$ADB" reverse tcp:8081 tcp:8081 >/dev/null
# Load the dev bundle and seed while online, then let NetInfo observe the deliberate offline transition in-place.
scripts/android-drive.sh open
"$ADB" shell svc wifi disable >/dev/null
"$ADB" shell svc data disable >/dev/null
sleep 2
scripts/e2e.sh android .maestro/m5-offline-local-foods.yaml
