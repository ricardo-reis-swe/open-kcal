# M6 Android live USDA selection/add rerun — 2026-09-27

## Target and preparation

- Target: connected `emulator-5554` (`sdk_gphone64_x86_64`), app `com.ricardoreis.calorietracker`.
- Started the existing dev build against local Metro and reached Profile → Food Databases → Add key.
- Before entry, the app visibly showed `USDA, Not set up`.

## Result: blocked before live request

- The owner-approved ignored local key was read only inside the input process. An initial direct device-input attempt was interrupted before save; the retry sent individual in-process alphanumeric characters to the focused password-masked field. Its value was not printed, written to a log, URL, fixture, screenshot, app environment variable, or repository artifact.
- Android diverted that input interaction to the system **Display over other apps** settings surface rather than returning focus to the app. The system listed Calorie Tracker as not allowed; no system permission was changed.
- The app had not saved a masked hint or shown `Test key`, so no key reached secure storage. No live USDA request, Food Search result, detail selection, diary write, fixture capture, or screenshot of key-bearing UI occurred.
- Retrying the app launch returned Food Databases to `USDA, Not set up`, confirming there was no temporary emulator credential to remove.

## Retry point

- Resolve the emulator/system input interception without granting unrelated overlay permissions, then repeat the secure-field entry and the required `egg` → generic-first USDA result → detail → log entry → Diary update validation. Do not begin M7 or record fixtures.
