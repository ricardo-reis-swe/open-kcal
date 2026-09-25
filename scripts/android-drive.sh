#!/bin/bash
# Compact Android emulator driver (adb), the counterpart of the iOS simulator tool.
# Output is kept to one short line per action so agents don't pull raw XML or screenshots into context.
#
#   scripts/android-drive.sh open                 # adb reverse + launch the dev build on localhost Metro, wait for the tab bar
#   scripts/android-drive.sh inspect              # labelled/clickable elements: "label [x,y]" (no XML)
#   scripts/android-drive.sh tap "Profile"        # tap the element whose content-desc or text equals the label (waits up to 30 s)
#   scripts/android-drive.sh wait "Add"           # wait until an element with that label exists
#   scripts/android-drive.sh gone "Close"         # wait until it no longer exists
#   scripts/android-drive.sh swipe x1 y1 x2 y2 [ms]
#   scripts/android-drive.sh text "eggs"          # type into the focused field
#   scripts/android-drive.sh key BACK             # KEYCODE_<name>
#   scripts/android-drive.sh shot out.png         # screenshot to a file (read it only when pixels matter)
#   scripts/android-drive.sh display small|reset  # 360x760 dp small phone, or physical size
#   scripts/android-drive.sh font 2.0 | dark on|off
set -euo pipefail

ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
PKG=com.ricardoreis.calorietracker
DEV_URL="exp+calorie-tracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

nodes() { # prints "label<TAB>cx<TAB>cy" per labelled node
  "$ADB" exec-out uiautomator dump /dev/tty 2>/dev/null | python3 -c '
import re, sys
xml = sys.stdin.read()
for m in re.finditer(r"<node [^>]*>", xml):
    n = m.group(0)
    attr = lambda k: (re.search(k + r"=\"([^\"]*)\"", n) or [None, ""])[1]
    label = attr("content-desc") or attr("text")
    b = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n)
    if label and b:
        x1, y1, x2, y2 = map(int, b.groups())
        print(f"{label}\t{(x1 + x2) // 2}\t{(y1 + y2) // 2}")
'
}

find_node() { nodes | awk -F'\t' -v l="$1" '$1 == l { print $2, $3; exit }'; }

wait_for() {
  for _ in $(seq 1 30); do
    [ -n "$(find_node "$1")" ] && return 0
    sleep 1
  done
  echo "timeout: no element labelled \"$1\"" >&2
  return 1
}

cmd=${1:-}
shift || true
case "$cmd" in
  open)
    "$ADB" reverse tcp:8081 tcp:8081 >/dev/null
    "$ADB" shell am force-stop "$PKG"
    "$ADB" shell am start -a android.intent.action.VIEW -d "$DEV_URL" "$PKG" >/dev/null
    wait_for "${1:-Add}" && echo "open: ready"
    ;;
  inspect) nodes | awk -F'\t' '{ printf "%s [%s,%s]\n", $1, $2, $3 }' ;;
  tap)
    wait_for "$1"
    read -r x y <<<"$(find_node "$1")"
    "$ADB" shell input tap "$x" "$y"
    echo "tap: \"$1\" at $x,$y"
    ;;
  wait) wait_for "$1" && echo "wait: \"$1\" present" ;;
  gone)
    for _ in $(seq 1 30); do
      [ -z "$(find_node "$1")" ] && echo "gone: \"$1\"" && exit 0
      sleep 1
    done
    echo "timeout: \"$1\" still present" >&2
    exit 1
    ;;
  swipe) "$ADB" shell input swipe "$1" "$2" "$3" "$4" "${5:-300}" && echo "swipe: done" ;;
  text) "$ADB" shell input text "${1// /%s}" && echo "text: typed" ;;
  key) "$ADB" shell input keyevent "KEYCODE_$1" && echo "key: $1" ;;
  shot) "$ADB" exec-out screencap -p >"$1" && echo "shot: $1" ;;
  display)
    if [ "${1:-}" = small ]; then
      "$ADB" shell wm size 720x1520
      "$ADB" shell wm density 320
    else
      "$ADB" shell wm size reset
      "$ADB" shell wm density reset
    fi
    echo "display: ${1:-reset}"
    ;;
  font) "$ADB" shell settings put system font_scale "$1" && echo "font: $1" ;;
  dark)
    [ "${1:-on}" = on ] && mode=yes || mode=no
    "$ADB" shell cmd uimode night "$mode" >/dev/null && echo "dark: ${1:-on}"
    ;;
  *)
    sed -n '2,17p' "$0"
    exit 1
    ;;
esac
