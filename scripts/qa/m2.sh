#!/bin/bash
# M2 QA capture: Diary in light/dark x default/largest text. Android runs as a small phone (360 dp).
#   scripts/qa/m2.sh android|ios
# Device settings are reset on exit, including after an interrupted run.
set -u
platform=${1:?usage: scripts/qa/m2.sh android|ios}
ADB=~/Library/Android/sdk/platform-tools/adb
PKG=com.ricardoreis.calorietracker
reset_device() {
  if [ "$platform" = android ]; then
    $ADB shell settings put system font_scale 1.0; $ADB shell cmd uimode night no >/dev/null
    $ADB shell wm size reset; $ADB shell wm density reset
  else
    xcrun simctl ui booted appearance light; xcrun simctl ui booted content_size large
    # Restore the dev-client floating button to what it was before the run.
    if [ -n "$fab" ]; then
      xcrun simctl spawn booted defaults write $PKG EXDevMenuShowFloatingActionButton -bool "$fab"
    else
      xcrun simctl spawn booted defaults delete $PKG EXDevMenuShowFloatingActionButton 2>/dev/null
    fi
  fi
}
fab=
trap reset_device EXIT
if [ "$platform" = android ]; then
  $ADB shell wm size 720x1520; $ADB shell wm density 320
else
  fab=$(xcrun simctl spawn booted defaults read $PKG EXDevMenuShowFloatingActionButton 2>/dev/null)
  [ "$fab" = 1 ] && fab=YES; [ "$fab" = 0 ] && fab=NO
  xcrun simctl spawn booted defaults write $PKG EXDevMenuShowFloatingActionButton -bool NO
fi
status=0
for scheme in light dark; do
  for text in default largest; do
    if [ "$platform" = android ]; then
      [ $scheme = dark ] && $ADB shell cmd uimode night yes >/dev/null || $ADB shell cmd uimode night no >/dev/null
      [ $text = largest ] && $ADB shell settings put system font_scale 2.0 || $ADB shell settings put system font_scale 1.0
    else
      xcrun simctl ui booted appearance $scheme
      [ $text = largest ] && size=accessibility-extra-extra-extra-large || size=large
      xcrun simctl ui booted content_size $size
    fi
    scripts/e2e.sh "$platform" -e SHOT="docs/qa/M2/$platform-$scheme-$text" scripts/qa/m2-capture.yaml | tail -1 || status=1
  done
done
# Maestro 2.x writes screenshots under its own run folders. Copy this platform's shots oldest run first, so the
# newest capture wins even when both platforms run at the same time.
for run in $(ls -tdr ~/.maestro/tests/*/); do
  cp "$run"m2-capture/takeScreenshot/docs/qa/M2/"$platform"-*.png docs/qa/M2/ 2>/dev/null
done
exit $status
