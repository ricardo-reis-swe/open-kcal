#!/bin/bash
# M1 QA capture on Android (Pixel_10 as a 360x760 dp small phone): the UX-20 recovery screen in light/dark x
# default/largest text. It triggers a real startup failure ("database newer than this app"): the app DB is pulled,
# a schema_version row is added with the host's sqlite3, and the file is pushed back through run-as (there's no
# sqlite3 on the emulator). The EXIT trap restores the original DB and resets display, font and dark mode.
#   scripts/qa/m1-recovery-android.sh <out-dir>
set -u
OUT=$1
ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
PKG=com.ricardoreis.calorietracker
DRIVE="$(dirname "$0")/../android-drive.sh"
DIR=files/SQLite
TMP=$(mktemp -d)

pull_db() { # $1 = local dir; checkpoints the WAL into the main file
  for f in calorie-tracker.db calorie-tracker.db-wal; do "$ADB" exec-out run-as $PKG cat $DIR/$f >"$1/$f" 2>/dev/null; done
  sqlite3 "$1/calorie-tracker.db" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null
}
push_db() { # $1 = local db file
  "$ADB" shell am force-stop $PKG
  "$ADB" push "$1" /data/local/tmp/ct-qa.db >/dev/null
  "$ADB" shell run-as $PKG sh -c "'cp /data/local/tmp/ct-qa.db $DIR/calorie-tracker.db && rm -f $DIR/calorie-tracker.db-wal $DIR/calorie-tracker.db-shm'"
  "$ADB" shell rm -f /data/local/tmp/ct-qa.db
}

mkdir -p "$TMP/orig"
"$ADB" shell am force-stop $PKG
pull_db "$TMP/orig"
cleanup() {
  push_db "$TMP/orig/calorie-tracker.db"
  "$DRIVE" font 1.0 >/dev/null; "$DRIVE" dark off >/dev/null; "$DRIVE" display reset >/dev/null
  rm -f "$TMP"/orig/* && rmdir "$TMP/orig" "$TMP"
}
trap cleanup EXIT

cp "$TMP/orig/calorie-tracker.db" "$TMP/broken.db"
sqlite3 "$TMP/broken.db" "INSERT INTO schema_version (version, applied_at) VALUES (999, 'qa')"
push_db "$TMP/broken.db"
rm -f "$TMP/broken.db"

"$DRIVE" display small >/dev/null
for scheme in light dark; do
  [ $scheme = dark ] && "$DRIVE" dark on >/dev/null || "$DRIVE" dark off >/dev/null
  for text in default largest; do
    [ $text = largest ] && "$DRIVE" font 2.0 >/dev/null || "$DRIVE" font 1.0 >/dev/null
    "$DRIVE" open Retry >/dev/null || { echo "recovery screen did not appear" >&2; exit 1; }
    "$DRIVE" shot "$OUT/android-recovery-$scheme-$text.png" >/dev/null
    echo "captured android-recovery-$scheme-$text.png"
  done
done
