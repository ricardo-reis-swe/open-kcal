#!/bin/bash
# M1 QA capture on iOS (iPhone 17e): the UX-20 recovery screen in the light theme at default/largest text.
# It triggers a real startup failure ("database newer than this app") by adding a schema_version row. The EXIT trap
# removes that row and resets appearance + text size. Needs Metro on localhost:8081, logging to $METRO_LOG.
#   scripts/qa/m1-recovery-ios.sh <out-dir> <metro-log>
set -u
OUT=$1
METRO_LOG=$2
PKG=com.ricardoreis.calorietracker
DEV="exp+calorie-tracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
DB="$(xcrun simctl get_app_container booted $PKG data)/Documents/SQLite/calorie-tracker.db"
[ -f "$DB" ] || { echo "no app database at $DB (launch the app once first)" >&2; exit 1; }

cleanup() {
  xcrun simctl terminate booted $PKG 2>/dev/null
  sqlite3 "$DB" "DELETE FROM schema_version WHERE version = 999"
  xcrun simctl ui booted appearance light
  xcrun simctl ui booted content_size large
}
trap cleanup EXIT

# Waits for the next "startup failed" line in the Metro log (the recovery screen renders right after it).
wait_for_failure() {
  local before=$1
  for _ in $(seq 1 60); do
    [ "$(grep -c 'startup failed' "$METRO_LOG")" -gt "$before" ] && { sleep 1; return 0; }
    sleep 1
  done
  echo "recovery screen did not appear" >&2
  return 1
}

xcrun simctl terminate booted $PKG 2>/dev/null
sqlite3 "$DB" "INSERT INTO schema_version (version, applied_at) VALUES (999, 'qa')"
for scheme in light; do
  xcrun simctl ui booted appearance $scheme
  for text in default largest; do
    [ $text = largest ] && size=accessibility-extra-extra-extra-large || size=large
    xcrun simctl ui booted content_size $size
    xcrun simctl terminate booted $PKG 2>/dev/null
    before=$(grep -c 'startup failed' "$METRO_LOG")
    xcrun simctl openurl booted "$DEV"
    wait_for_failure "$before" || exit 1
    xcrun simctl io booted screenshot "$OUT/ios-recovery-$scheme-$text.png" >/dev/null 2>&1
    echo "captured ios-recovery-$scheme-$text.png"
  done
done
