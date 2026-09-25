# M1 QA

M1's only new screen is the UX-20 recovery screen. The dev build logs the failure with `console.error`, so the dev-only LogBox toast shows at the bottom; release builds don't have it.

| File | What |
|---|---|
| `ios-recovery-{light,dark}-{default,largest}.png` | iPhone 17e (iOS 27). Captured by `scripts/qa/m1-recovery-ios.sh`, which triggers a real "database newer than this app" failure (it adds a `schema_version` row and removes it on exit). At the largest size the screen scrolls, so Retry is below the fold |

Device checks (2026-09-25, dev builds rebuilt with `expo-sqlite` + `expo-secure-store`):
- Android (Pixel_10) and iOS (iPhone 17e): `.maestro/m0-shell.yaml` passes (21 s / 14 s) through the real SQLite startup. Metro log: `migration applied {version: 1, outcome: ok}` then `database ready` (239 ms on Android).
- On-device DBs checked with `sqlite3`: WAL on, `schema_version` 1, meals `Breakfast, Lunch, Dinner, Snacks` in order, provisional 2,000 kcal goal from 2026-09-25, `goals_confirmed_at` NULL. Units follow the device measurement system: `lb` on the en-US emulator, `kg` on the simulator.
