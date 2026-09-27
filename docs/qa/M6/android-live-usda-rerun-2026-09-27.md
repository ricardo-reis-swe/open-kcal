# M6 Android live USDA selection/add rerun — 2026-09-27

## Target and preparation

- Target: connected `emulator-5554` (`sdk_gphone64_x86_64`), app `com.ricardoreis.calorietracker`.
- Used the existing dev build against local Metro after the owner manually configured the working key.
- No Food Databases controls were changed during the validation.

## Result: passed on the user-configured key

- The rerun used the already-configured emulator state. No credential was entered, replaced, removed, copied, logged, recorded in a fixture, or included in an app environment value or URL.
- Food Search for `egg` initially showed the sanitized `USDA search failed.` state. One in-screen Retry then returned the USDA section, whose first selectable item was generic `Eggs, Grade A, Large, egg white` (Foundation `747997`) before any Branded USDA item.
- Selecting that result opened Food Detail. `Add to Breakfast` wrote the entry and returned immediately to Diary, where Breakfast showed `Eggs, Grade A, Large, egg white`, `1 × egg, white`, and `19 kcal`.
- Redacted evidence (no credential surfaces): `android-live-usda-search-generic-first-2026-09-27.png` and `android-live-usda-diary-updated-2026-09-27.png`. The transient sanitized provider-error capture is `android-live-usda-provider-failure-2026-09-27.png`.

## Next task

- M6 independent review/readiness only. Do not begin M7.
