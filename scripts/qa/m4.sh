#!/bin/bash
# M4 Android visual QA: light/dark x default/largest on a 360 dp-wide emulator.
set -euo pipefail
platform=${1:?usage: scripts/qa/m4.sh android}
[ "$platform" = android ] || { echo "M4 QA is Android-only per the active user instruction" >&2; exit 2; }
ADB=${ADB:-$HOME/Android/Sdk/platform-tools/adb}
reset_device() {
  "$ADB" shell settings put system font_scale 1.0
  "$ADB" shell cmd uimode night no >/dev/null
  "$ADB" shell wm size reset
  "$ADB" shell wm density reset
}
trap reset_device EXIT
"$ADB" shell wm size 720x1520
"$ADB" shell wm density 320
for scheme in light dark; do
  for text in default largest; do
    [ "$scheme" = dark ] && "$ADB" shell cmd uimode night yes >/dev/null || "$ADB" shell cmd uimode night no >/dev/null
    [ "$text" = largest ] && "$ADB" shell settings put system font_scale 2.0 || "$ADB" shell settings put system font_scale 1.0
    scripts/e2e.sh android -e SHOT="docs/qa/M4/android-$scheme-$text" scripts/qa/m4-capture.yaml
  done
done
for run in $(ls -tdr ~/.maestro/tests/*/); do
  cp "$run"m4-capture/takeScreenshot/docs/qa/M4/android-*.png docs/qa/M4/ 2>/dev/null || true
done
