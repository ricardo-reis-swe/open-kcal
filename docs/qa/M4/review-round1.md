# M4 independent review — round 1

Range reviewed: `2fe1dd5..15f14bb` (main), 2026-09-27.

## Findings

- **blocker — ROAD-02 — `scripts/e2e.sh:47`**: Required Android Maestro verification does not run. I retried `scripts/e2e.sh android .maestro/m4-custom-food.yaml` twice on the available Pixel_10 with Metro running. Both fail before the first command with `maestro.android.DeviceServerDiedException` / `StatusRuntimeException: UNAVAILABLE` while requesting `deviceInfo` (debug logs: `/home/reis/.maestro/tests/2026-09-27_053753/maestro.log` and `.../2026-09-27_053812/maestro.log`). Therefore neither M4 nor the cumulative flows have a passing Android result. iOS was intentionally not attempted: the user authorized Android-only Linux testing.

- **major — NAV-04 / UX-05 — `src/features/food-search/screens/FoodDetailScreen.tsx:239`**: Saving an added food always calls `router.dismissTo(routes.diary())`, discarding `mode.origin`. An add flow opened from Meal Detail must return to that Meal Detail; the global `+` exception is only for flows begun from Profile. Add a navigation test for the Meal Detail return rule.

- **major — DS-09 / ROAD-02 — `src/features/food-search/screens/FoodSearchScreen.tsx:257-275`**: Food-result layout does not reserve a non-overlapping kcal column. The captured Android 2.0-text screenshots show repeated/overlapping `200 kcal` text on every Recent row (`docs/qa/M4/android-dark-largest-food-search.png`), rather than the required readable name/basis/kcal result row. This fails the required large-text QA subset.

- **major — DS-09 / ROAD-02 — `src/features/food-search/components/ServingRuler.tsx:147-151`**: Each ruler tick has a fixed 16 px label box. At the required large text scale, a three-digit major value is broken into vertical digits (`1`, `0`, `0`) in `android-dark-largest-add-entry.png`; this makes the ruler’s major labels unusable. The visible unit tabs also have no compact selected-state indicator (`FoodDetailScreen.tsx:301-309`), contrary to DS-09.

## Checks and trace

- `npm run check`: PASS — lint, typecheck, 54 Jest suites / 362 tests.
- M4 domain, repository, component, route, locale-parity, and a11y tests are present. `git diff --check` is clean.
- Reviewed all 20 Android light/dark × default/2.0 captures. The two large-text defects above reproduce in the supplied artifacts.
- No M4 SCOPE-10 / post-MVP feature leak or sensitive diary/key logging found in the reviewed range.
- `en` / `pt-PT` key parity passes as part of `npm run check`.
- iOS device/E2E/visual testing is a non-blocking, user-authorized exception for this Linux review; it remains deferred before formal M4 acceptance.
