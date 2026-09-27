# M5 post-correction Android E2E attempt

- Time: 2026-09-27T16:38:32+01:00
- Commit under test: `0a83d3619c45ab551d0214845ce0defda7f45823` (`fix(search): close M5 OFF review findings`)
- Command: `scripts/e2e-m5-offline-android.sh`
- Result: **FAIL** (exit 1 before Maestro began its flow): `timeout: no element labelled "Add"`.
- Scope: the Android dev client did not reach its tab bar after the wrapper opened it, so this attempt did not prove the offline cached OFF-food path, the `2 × egg` serving, or the `Offline E2E saved yoghurt` 95 kcal Diary row.
- Environment finding: port 8081 was already occupied. The available Metro log shows the server loaded `.env` without `EXPO_PUBLIC_DEV_SEED_FOOD_SEARCH=1`; the required deterministic offline-search fixtures were therefore not established for this run.
- Retry point: stop or replace the existing Metro service on port 8081 with `EXPO_PUBLIC_DEV_SEED_FOOD_SEARCH=1 npx expo start --dev-client --port 8081`, wait for the seeded app tab bar, then rerun the exact command above. Do not begin M6.
