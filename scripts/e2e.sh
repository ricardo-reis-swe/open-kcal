#!/bin/bash
# Runs the Maestro flows in .maestro/ on one device (ARCH-18, ROAD-02). Needs the dev build installed and
# Metro on localhost:8081 (`npx expo start --dev-client --port 8081`).
#   scripts/e2e.sh android|ios [flow.yaml ...]
set -euo pipefail
export JAVA_HOME=${JAVA_HOME:-/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}
MAESTRO=${MAESTRO:-$HOME/.maestro/bin/maestro}
ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
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
