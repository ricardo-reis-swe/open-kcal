# M0 QA screenshots (ROAD-02, DS-13 subset)

Captured 2026-09-25 from dev builds (Expo SDK 57) with `scripts/qa/m0-android.sh` and `scripts/qa/m0-ios.sh`.

| Platform | Device | Small phone | Text sizes |
|---|---|---|---|
| Android | `Pixel_10` emulator (Android 16/API 36+) at `wm size 720x1520`, density 320 = 360×760 dp | yes | `font_scale` 1.0 · 2.0 (largest) |
| iOS | iPhone 17e simulator, iOS 27 | smallest available | `large` (default) · `accessibility-extra-extra-extra-large` |

| Screen | Android | iOS |
|---|---|---|
| Diary (tab root) | `android-diary-{light,dark}-{default,largest}.png` | `ios-diary-{light,dark}-{default,largest}.png` |
| Add Action Sheet (`+`, empty in M0) | `android-add-sheet-{light,dark}-{default,largest}.png` | not captured (needs a tap, see below) |
| Profile (tab root) | `android-profile-{light,dark}-{default,largest}.png` | not captured (needs a tap, see below) |

Notes
- The round gear on Android is the dev client's floating Tools button (dev builds only). It's hidden on iOS via `EXDevMenuShowFloatingActionButton`.
- iOS taps aren't available in this environment yet (the Claude simulator tool needs `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`; Maestro isn't installed). Deep links trigger a system "Open in…" prompt that can't be dismissed without a tap. The iOS sheet/Profile behavior is covered by the navigation tests and the Android run.
- Findings fixed while capturing: Android threw on the iOS-only `tabbar` a11y role; unselected tab labels used `micro`; tab labels clipped ("Profi…") at iOS AX sizes (now scale up to 2×); iOS 27 aborted without the UIScene life cycle; Hermes lacked `Intl.PluralRules`.
