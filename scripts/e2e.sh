#!/bin/bash
# Runs the Maestro flows in .maestro/ on one device (ARCH-18, ROAD-02). Needs the dev build installed and
# Metro on localhost:8081 (`npx expo start --dev-client --port 8081`).
#   scripts/e2e.sh android|ios [flow.yaml ...]
set -euo pipefail
java_major() {
  "$1/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -1
}

# Maestro supports Java 17 and 21. Prefer a compatible local runtime when the
# shell's JAVA_HOME points to an unsupported release (for example Android
# Studio's bundled Java 25 runtime).
if [ -z "${JAVA_HOME:-}" ] || ! case "$(java_major "$JAVA_HOME")" in 17|21) true ;; *) false ;; esac; then
  for candidate in "$HOME/.gradle/jdks"/*-21-* "$HOME/.gradle/jdks"/*-17-* \
    /Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home; do
    if [ -x "$candidate/bin/java" ] && case "$(java_major "$candidate")" in 17|21) true ;; *) false ;; esac; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi
[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] || {
  echo "Maestro requires JAVA_HOME with Java 17 or 21" >&2
  exit 1
}
MAESTRO=${MAESTRO:-$HOME/.maestro/bin/maestro}
if [ -z "${ADB:-}" ]; then
  for candidate in "$HOME/Library/Android/sdk/platform-tools/adb" "$HOME/Android/Sdk/platform-tools/adb"; do
    if [ -x "$candidate" ]; then
      ADB="$candidate"
      break
    fi
  done
  ADB=${ADB:-adb}
fi
platform=${1:?usage: scripts/e2e.sh android|ios [flow.yaml ...]}
shift
case "$platform" in
  android)
    "$ADB" reverse tcp:8081 tcp:8081 >/dev/null
    device=$("$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')
    ;;
  ios) device=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1) ;;
  *) echo "unknown platform: $platform" >&2; exit 2 ;;
esac
[ -n "$device" ] || { echo "no booted $platform device" >&2; exit 1; }
[ $# -gt 0 ] || set -- .maestro
# A final summary line that output filters can't hide; the exit code is Maestro's.
start=$SECONDS
status=0
"$MAESTRO" --device "$device" test "$@" || status=$?
[ $status -eq 0 ] && result=PASS || result=FAIL
echo "E2E $platform: $result ($((SECONDS - start))s, exit $status)"
exit $status
