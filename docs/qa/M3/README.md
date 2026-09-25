# M3 QA screenshots (ROAD-02, DS-13 subset)

Quick Calories end to end, captured by `scripts/qa/m3.sh android|ios` (Maestro flow `scripts/qa/m3-capture.yaml`; the
script resets appearance, text size and display size on exit). The flow deletes the entry it adds.

| File | Shows |
|---|---|
| `<platform>-<scheme>-<text>-add-sheet.png` | UX-09 Add Action Sheet: Add food · Quick calories · Update weight (Add food and Update weight disabled until M4/M8) |
| `<platform>-<scheme>-<text>-meal-picker.png` | UX-10 Meal Picker: `Choose meal`, meals in saved order |
| `<platform>-<scheme>-<text>-quick-calories-error.png` | UX-07 with `0` entered: the range message under Calories, Add disabled |
| `<platform>-<scheme>-<text>-quick-calories.png` | UX-07 filled (450 kcal + note), keyboard open, Add pinned above it |
| `<platform>-<scheme>-<text>-edit.png` | Edit quick calories, keyboard dismissed: Save (disabled until a change) and `Delete entry` at the end |
| `<platform>-<scheme>-<text>-delete-dialog.png` | UX-19 `Delete quick calories?` with `<kcal> from <meal> on <date>.` and the danger action |

- Platforms: Android emulator as a small phone (720×1520 @ 320 dpi = 360 dp wide), iOS iPhone 17e (iOS 27).
- Text: `default` = 1.0 / Large; `largest` = Android font scale 2.0 / iOS `accessibility-extra-extra-extra-large`.
- The round gear on Android is the Expo dev-client menu button (dev builds only).

## Found and fixed during M3 device checks
- Android: the keyboard covered the primary action. The app is edge-to-edge, so the window doesn't resize; the form's
  `KeyboardAvoidingView` now pads on both platforms (DS-09).

## Known gap
- iOS largest text: the shared `AppBar` truncates long titles (`Quick ca…`). Logged for the M9 DS-11 pass.
