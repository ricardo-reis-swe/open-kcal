#!/bin/bash
# M0 QA capture on iOS (iPhone 17e): light/dark x default/largest text. No taps available (see progress log).
set -u
OUT=$1
PKG=com.ricardoreis.calorietracker
DEV="exp+calorie-tracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
xcrun simctl spawn booted defaults write $PKG EXDevMenuShowFloatingActionButton -bool NO
for scheme in light dark; do
  xcrun simctl ui booted appearance $scheme
  for text in default largest; do
    [ $text = largest ] && size=accessibility-extra-extra-extra-large || size=large
    xcrun simctl ui booted content_size $size
    xcrun simctl terminate booted $PKG 2>/dev/null
    xcrun simctl openurl booted "$DEV"; sleep 9
    xcrun simctl io booted screenshot "$OUT/ios-diary-$scheme-$text.png" >/dev/null 2>&1
  done
done
xcrun simctl ui booted appearance light; xcrun simctl ui booted content_size large
