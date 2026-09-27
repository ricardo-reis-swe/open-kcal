#!/bin/bash
# M0 QA capture on Android: small phone (360dp), light theme x default/largest text.
set -u
ADB=~/Library/Android/sdk/platform-tools/adb
OUT=$1
PKG=com.ricardoreis.calorietracker
URL="exp+calorie-tracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
bounds_of() { # prints "x1 y1 x2 y2" of the node whose content-desc == $1, or nothing
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  $ADB shell cat /sdcard/ui.xml | tr '>' '\n' | grep "content-desc=\"$1\"" | head -1 | grep -o 'bounds="[^"]*"' | grep -o '[0-9]\+' | tr '\n' ' '
}
wait_for() { for i in $(seq 1 30); do [ -n "$(bounds_of "$1")" ] && return 0; sleep 2; done; echo "timeout waiting for $1" >&2; return 1; }
tap_desc() {
  wait_for "$1" || return 1
  local b=($(bounds_of "$1"))
  $ADB shell input tap $(( (${b[0]}+${b[2]})/2 )) $(( (${b[1]}+${b[3]})/2 ))
}
launch() {
  $ADB shell am force-stop $PKG
  $ADB shell am start -a android.intent.action.VIEW -d "$URL" $PKG >/dev/null
  wait_for "Add"; sleep 4; wait_for "Add"
}
reset_device() {
  $ADB shell settings put system font_scale 1.0; $ADB shell cmd uimode night no >/dev/null
  $ADB shell wm size reset; $ADB shell wm density reset
}
trap reset_device EXIT # an interrupted run must not leave the emulator altered
$ADB reverse tcp:8081 tcp:8081 >/dev/null
$ADB shell wm size 720x1520; $ADB shell wm density 320
for scheme in light; do
  $ADB shell cmd uimode night no >/dev/null
  for text in default largest; do
    [ $text = largest ] && $ADB shell settings put system font_scale 2.0 || $ADB shell settings put system font_scale 1.0
    launch
    $ADB exec-out screencap -p > "$OUT/android-diary-$scheme-$text.png"
    tap_desc "Add"; sleep 3
    $ADB exec-out screencap -p > "$OUT/android-add-sheet-$scheme-$text.png"
    $ADB shell input keyevent KEYCODE_BACK; sleep 1
    tap_desc "Profile"; wait_for "Profile"; sleep 1.5
    $ADB exec-out screencap -p > "$OUT/android-profile-$scheme-$text.png"
  done
done
