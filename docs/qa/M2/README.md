# M2 QA screenshots (ROAD-02, DS-13 subset)

Diary with the dev-only sample data (`EXPO_PUBLIC_DEV_SEED_DIARY=1`), captured by `scripts/qa/m2.sh android|ios`
(Maestro flow `scripts/qa/m2-capture.yaml`; the script resets appearance, text size and display size on exit).

| File | Shows |
|---|---|
| `<platform>-<scheme>-<text>-today.png` | Typical day: ring, partial macros (info icon, Quick Calories), default-goals row, food + Quick Calories rows, long food name truncating before kcal |
| `<platform>-<scheme>-<text>-date-picker.png` | UX-13 Date Picker on the active date: iOS inline calendar in the sheet (native wheel at the largest text), Android platform calendar dialog |
| `<platform>-<scheme>-<text>-over-goal.png` | Tomorrow: `kcal over` in the warning color, full ring, Today action |
| `<platform>-<scheme>-<text>-empty.png` | An empty future day: every meal with 0 kcal + Add food |

- Platforms: Android emulator as a small phone (720×1520 @ 320 dpi = 360 dp wide), iOS iPhone 17e (iOS 27).
- Text: `default` = 1.0 / Large; `largest` = Android font scale 2.0 / iOS `accessibility-extra-extra-extra-large`.
- The round gear on Android is the Expo dev-client menu button (dev builds only).

## DS-02 density check
At default text on the small Android phone (`android-light-default-today.png`) and the iPhone 17e, one screen shows the app bar + date strip, the ring, all 3 macros, the default-goals row, 2 meal headers (Breakfast, Lunch) and the first meal's food rows, above the bottom nav. **Pass.**

## Found and fixed during capture
- Largest text: the ring capped its growth at 2×, so iOS AX5 text overflowed it; the ring now grows with the text up to the screen width, and its secondary lines shrink to fit only at large sizes.
- Largest text: macro values split across lines (`22/250` / `g`); the column basis now grows with the text, so the strip stacks.
- Largest text: the date strip truncated every label (`Ye… Tod… To…`); prev/next become chevron buttons (their full names stay in the accessible labels) and the selected date shrinks to fit.
- Largest text: the iOS inline calendar has a native minimum width wider than the phone, and pushed Done off-screen. At large text the sheet now scrolls, its actions wrap, and the picker uses the native wheel.
