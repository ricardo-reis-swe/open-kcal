# M5 seeded Android E2E retry

- Time: 2026-09-27T16:46:22+01:00
- Commit under test: `10775a17a04fe276493d14e0c78fb63579673b55` (`docs(qa): record M5 Android E2E blocker`), including the post-`0a83d36` corrected `.maestro/m5-offline-local-foods.yaml`.
- Port 8081 finding: no listener remained when inspected with `lsof`, `fuser`, `/proc/net`, and the Metro/Node process list. Started the replacement seeded Metro process with `EXPO_PUBLIC_DEV_SEED_FOOD_SEARCH=1 npx expo start --dev-client --port 8081`.
- Precondition: `ADB="$HOME/Android/Sdk/platform-tools/adb" scripts/android-drive.sh open` reached the Android dev-client tab bar; the online seeded Diary showed `Offline E2E custom oats`.
- Command: `ADB="$HOME/Android/Sdk/platform-tools/adb" scripts/e2e-m5-offline-android.sh`
- Result: **FAIL** (exit 1). Maestro completed the offline status, custom-food, and saved-yoghurt assertions, selected the saved food, edited the serving input to `2`, and saved it. The final assertion failed: `Assertion is false: "Offline E2E saved yoghurt.*95.*" is visible`.
- Final Android UI: `Offline E2E saved yoghurt, 102 g, 97 kilocalories` in Lunch, rather than the required `2 × egg` / 95 kcal Diary row.
- Scope: this retry proves the seeded Metro and offline cached-food setup now work, but does not satisfy SCOPE-11 flow 1 / UX-04/05 / ARCH-12/18 / ROAD-02 / PROV-09 because the count-serving save produces the wrong rendered amount and nutrition.
- Retry point: diagnose and correct the cached OFF count-serving path or its Maestro expectation, then rerun the exact seeded Metro command and `scripts/e2e-m5-offline-android.sh`. Independent M5 re-review/readiness and M6 remain blocked.
