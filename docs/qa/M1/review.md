# M1 review — round 1

- **Reviewed HEAD:** `2fa66f8d53a7fe002eca8fe902c80d933ee1ed0c` (range `888b774..HEAD`, 13 commits)
- **Date:** 2026-09-25
- **Reviewer:** independent, read-only. Nothing in the repo was edited. The working tree was clean before and after.

**What I ran**
| Check | Result |
|---|---|
| `npm run check` (lint `--max-warnings 0`, `tsc --noEmit`, Jest) | **exit 0**. 35/35 suites, 226/226 tests, 0 snapshots |
| `scripts/e2e.sh android .maestro/m0-shell.yaml` (Pixel_10, emulator-5554) | **exit 0**, every step COMPLETED. The only warning is the optional `Continue` step |
| `scripts/e2e.sh ios .maestro/m0-shell.yaml` (iPhone 17e, iOS 27.0) | **exit 0**. Run twice: before and after the recovery repro |
| Metro log after my launches | `database ready {durationMs: 13/35/31}` and `app initialized {appVersion, pluralRules}`. No diary, weight, key or row data |
| iOS on-device DB (copied to a temp dir, then queried) | `journal_mode=wal` · `integrity_check ok` · `foreign_key_check` empty · `schema_version` = [1] · meals Breakfast/Lunch/Dinner/Snacks at sort_order 0–3 with v4 UUIDs · settings kg/g/kcal/ml, `goals_confirmed_at` NULL · one goal effective 2026-09-25 (2000/250/100/67) · 0 entries/foods/weights · no key column or value anywhere |
| Android on-device DB (`run-as cat` db + wal into a temp dir) | Same checks pass. Units lb/oz/kcal/fl_oz (en-US emulator, measurement system `us`) · provisional goal 2026-09-25 |
| `scripts/qa/m1-recovery-ios.sh <tmp> metro.log` | exit 0. Recovery screen captured in light/dark × default/AX5. Retry is scrollable at the largest size. The DB was restored (`schema_version` back to [1]) and appearance/text size are back to their original light/large |
| Probe tests (scratch Jest config outside the repo, run against the repo code) | Confirmed findings 3, 4 and 2 below |

**Verdict: not clean.** 0 blockers · 2 majors · 7 minors.

The data layer is solid:
- Migration 1 equals `schema.sql` (tested).
- The first launch is one atomic transaction.
- The seed is idempotent and never re-translates.
- A newer-than-app DB is refused, never reset.
- Every write that touches more than one row runs in `BEGIN IMMEDIATE` on the pragma'd connection.
- SQL only interpolates constants.
- Unknown macros stay NULL in every snapshot.
- The USDA key never reaches SQLite, errors or logs.

Two ARCH-13 gaps remain:
- An invalid config still crashes at module load instead of showing the recovery screen. This is the M1 extra "startup failure shows the recovery screen, not a crash".
- Infrastructure (SQLite driver) errors reach callers untyped.

The minors are ordering, refresh and process issues.

### Blockers
None.

### Majors

**1. major. ARCH-13, ARCH-17, UX-20, ROAD-02 M1 extra. `src/app/_layout.tsx:10`, `src/bootstrap/initialize-app.ts:14`**
- **Problem:**
  - `initializeApp()` runs at module scope in the root layout and calls `getConfig()`, which throws `ConfigError` (`src/shared/config/env.ts:37-42, 66-69`).
  - `ConfigError` is not an `AppError`, and nothing catches it. Validating config is the first ARCH-17 step, so an invalid or missing `EXPO_PUBLIC_*` value crashes the root route module (red screen in dev, crash in release) instead of showing the UX-20 recovery screen.
  - `initI18n()` runs *after* `getConfig()`, so even a caught config error would have no translations.
  - The M0 known gap ("A config error currently throws at startup") deferred exactly this to M1. The M1 known gaps don't mention it, and no test covers it.
- **Fix:**
  - Run `initI18n()` first.
  - Move config validation into the gated startup (e.g. inside `startServices`, or a guarded pre-step whose failure `StartupGate` renders), so a `ConfigError` becomes a typed error with a new or existing category.
  - Add a test: an invalid config renders `Couldn't open your diary.` and diagnostic info without values.

**2. major. ARCH-13 ("Map infra errors to these before feature code sees them"). `src/data/db/sql.ts:39-57`, all repositories**
- **Problem:**
  - Neither the `SqlDatabase` adapter nor the repositories map driver failures. Any SQLite error that pre-validation doesn't catch reaches callers as a raw `Error` with no `category`. That includes I/O, disk-full, busy, constraint or trigger aborts, and a failed `BEGIN`/`COMMIT`.
  - The builder's own M8 rollback test shows this (`meals.test.ts:102` only asserts `.rejects.toThrow()`).
  - Probe: I added a `BEFORE INSERT` trigger on `weight_entries` that raises, then called `weight.add(...)`. The result was `isAppError=false, category=undefined, name=Error`.
  - Only startup wraps errors (`database.ts:33-53`).
- **Fix:**
  - In `createSqlDatabase`, wrap every driver call and the transaction path so non-`AppError` throws become `DatabaseError('…', { cause })`. The message must be static, with no SQL values.
  - Map SQLite constraint failures to `ConflictError` or `ValidationError` where that makes sense.
  - Test that a driver failure surfaces as `category: 'database'` and that its message contains no SQL or values.

### Minors

**3. minor. DATA-15, PROV-09, UX-05 (initial serving). `src/data/db/repositories/foodsRepository.ts:229`**
- **Problem:**
  - `upsertExternal` handles an existing food with `DELETE FROM food_servings` and then reinserts every serving under new IDs. PROV-09 says to match servings by `(label, unit)`, update matches in place, insert new ones and delete only missing ones.
  - Every refresh therefore sets `recent_foods.last_serving_id` to NULL, even when the serving is unchanged, which defeats UX-05 "Initial serving: the recent `last_serving_id` …".
  - Probe: `lastServingId` was `…0007` before an identical refresh and `null` after it.
- **Fix:** Match on `(lower(label), lower(unit))`: update in place, insert new, delete missing. Add a test that an unchanged serving keeps its ID and the recent keeps `last_serving_id`. This must land by M5 at the latest.

**4. minor. DATA-10. `src/data/db/repositories/mealsRepository.ts:116-120`**
- **Problem:**
  - Delete + reassign moves entries without changing their `sort_order`, so they collide with the target meal's entries on the same date.
  - Probe: Dinner had d1(0), d2(1). After Lunch l1(0), l2(1) was reassigned to Dinner, `loadDay` returned `d1 0, l1 0, d2 1, l2 1`: interleaved, with duplicate sort orders.
  - Copy-meal "append after existing `sort_order`" (DATA-16) and any future entry ordering assume these values are distinct.
- **Fix:**
  - Per `(diary_date)`, append moved entries after the target meal's max `sort_order`, keeping their relative order. An `UPDATE … FROM` or a small loop inside the same transaction works.
  - Test the order after reassign.

**5. minor. DATA-12, ROAD-02 (tests assert what their names claim). `src/data/db/repositories/diaryRepository.ts:267-293`, `src/data/db/repositories/__tests__/foods-diary.test.ts:269`**
- **Problem:**
  - DATA-12 says moving an entry "changes only `meal_id` + `updated_at`". The implementation also rewrites `sort_order` (appends it in the destination) and upserts the recent (`use_count + 1`, `last_used_at`).
  - The test named "moving an entry changes only meal_id + updated_at" asserts neither `sort_order` nor that the other columns are unchanged.
  - Appending is sensible, but it is a spec deviation that nobody approved.
- **Fix:** Either ask the user and amend DATA-12 ("… + `sort_order` appended in the destination meal"), or keep `sort_order`. Then make the test compare the full row before and after.

**6. minor. DATA-05, DATA-16 (edit: "recompute snapshot only if serving changed"). `src/data/db/repositories/diaryRepository.ts:249-253`**
- **Problem:**
  - Any `servingId` passed to `editFoodEntry` triggers a recompute from the food's *current* nutrients. Entries don't store the serving ID, so the repository can't tell whether the serving actually changed.
  - A UI that always passes the selected serving would silently rewrite history after a cache refresh, which DATA-05 forbids.
  - The contract is only a doc comment (`:162`).
- **Fix:**
  - Detect "serving changed" in the repository: compare against the snapshot's `serving_unit_snapshot` / label, or store the serving ID if the schema is ever extended (ask first).
  - Alternatively, make the parameter explicit (`changeServing: { servingId }`) and test that passing the same serving after a food refresh leaves the nutrients unchanged.

**7. minor. DATA-16 (Load day), ARCH-19. `src/data/db/repositories/diaryRepository.ts:171-190`**
- **Problem:**
  - `loadDay` issues four separate statements (goal, meals, entries, totals) outside a transaction. The serial queue lets another queued write run between them.
  - Once writes and invalidation land (M3+), the entries and the SQL totals can disagree, or an entry can reference a meal missing from the list.
- **Fix:** Run the reads inside one `db.transaction` (a read snapshot), or derive the totals from the fetched rows with `sumNutrients`.

**8. minor. DATA-16 (Copy meal), ROAD-02 ("Known gaps are listed"). `docs/progress.md:107-111`**
- **Problem:** M1's main specs are `DATA-*`, but the DATA-16 Copy meal transaction isn't implemented. ROAD-01 puts it in M7, but the M1 known gaps list only local search, the launch-screen hold and edit scaling.
- **Fix:** Add "Copy meal transaction (DATA-16) arrives with M7" to the known gaps.

**9. minor. ROAD-03, ARCH-20. `docs/progress.md:96-132`**
- **Problem:**
  - At HEAD, the M1 section has no ROAD-02 checklist. The brief said it was ticked, but it isn't present.
  - It also has no dependency notes for the five packages added in this range: `@tanstack/react-query`, `expo-sqlite`, `expo-secure-store`, `expo-crypto` and `expo-clipboard` (`package.json`). Only M1-Q1 mentions the last two.
  - ARCH-20 requires every dependency to have a recorded need.
- **Fix:** Add the ticked ROAD-02 checklist for M1 and a dependency table (package → need), as in M0.

## Spec traceability

| Spec | Code | Test | Status |
|---|---|---|---|
| DATA-01 storage split, FK on, tx for multi-row writes | `sql.ts:44-64`, `database.ts:30-37`; `goalsRepository.ts:67`, `mealsRepository.ts:51,79,104`, `foodsRepository.ts:181,216`, `diaryRepository.ts:195,243,316,342` | `migrations.test.ts:132` (FK); `meals.test.ts:91` (rollback) | OK |
| DATA-01 / ARCH-10 USDA key only in secure storage | `credentialsService.ts:1-58` | `credentialsService.test.ts:16-58` | OK. Verified on-device: no key in either DB |
| DATA-02 no sync | n/a (no sync fields) | — | OK |
| DATA-03 UUID IDs | `ids.ts`, `appIds.ts:6` | `ids.test.ts`, `seed.test.ts:106` | OK. On-device IDs are v4 |
| DATA-04 canonical units, constants, no rounding | `domain/units/units.ts:16-109`; `settingsRepository.ts:46` | `units.test.ts:14-40`; `settings-goals.test.ts:14`; `foods-diary.test.ts:169` | OK |
| DATA-05 snapshots | `diaryRepository.ts:193-231, 239-310` | `foods-diary.test.ts:175` | OK, see minor 6 |
| DATA-06 unknown ≠ 0; Quick Calories NULLs + note | `nutrients.ts:28-90`; `diaryRepository.ts:88-104, 313-338`; `entries.ts:6` | `nutrients.test.ts:22,40`; `foods-diary.test.ts:209,248` | OK |
| DATA-07 derived day | `diaryRepository.ts:171` | `foods-diary.test.ts:134` | OK, see minor 7 |
| DATA-08 local dates, DST, UTC ms timestamps | `shared/dates/localDate.ts`, `clock.ts`; `jest.config.js:2` | `localDate.test.ts:17-88` | OK |
| DATA-09 goals + UX-01 exception | `domain/nutrition/goals.ts:22-45`; `goalsRepository.ts:40-105` | `goals.test.ts`; `settings-goals.test.ts:49-92` | OK |
| DATA-10 meals: seed names, reorder two-phase, delete + reassign, last meal | `seed.ts:41`; `mealsRepository.ts:27-130` | `seed.test.ts:81`; `meals.test.ts:20-113` | Partial (minor 4) |
| DATA-11 foods, servings, soft delete, conversion | `foodsRepository.ts:94-202`; `nutrients.ts:34` | `foods-diary.test.ts:50-130`; `nutrients.test.ts:6,32` | OK |
| DATA-12 entries: move, delete | `diaryRepository.ts:239-360` | `foods-diary.test.ts:269,291` | Deviation (minor 5) |
| DATA-13 weight | `domain/weight/weight.ts`; `weightRepository.ts:23-93` | `weight.test.ts` (domain + repository) | OK |
| DATA-14 recents | `diaryRepository.ts:141-153, 376-401` | `foods-diary.test.ts:148,248,102` | OK |
| DATA-15 cache upsert, expiry, dedupe | `foodsRepository.ts:208-268` | `foods-diary.test.ts:72,85` | Partial (minor 3). Local search deferred (known gap) |
| DATA-16 operations | `diaryRepository.ts`, `foodsRepository.ts`, `goalsRepository.ts` | as above | Copy meal missing (minor 8) |
| DATA-17 init, migrations, never reset | `migrations/runner.ts:44-109`, `001_initial.ts`, `seed.ts`, `database.ts:39-55` | `migrations.test.ts:24-130`; `seed.test.ts:37-117` | OK |
| DATA-18 access boundary | `bootstrap/services.tsx:15-44`; no SQL outside `src/data` (grep) | — | OK |
| ARCH-03 validation at boundaries | `settingsRepository.ts:17-29`; `credentialsService.ts:13,40,48`; `env.ts` | `settings-goals.test.ts:41`; `credentialsService.test.ts:37` | OK (only the settings row is Zod-validated; other rows are cast) |
| ARCH-04/05 layers | domain imports only `@/shared/dates` (types and pure helpers); no React/Expo/SQLite in `src/domain` (grep) | — | OK |
| ARCH-07 state / Query | `query-client.ts:6-13`; `StartupGate.tsx:41,56-58` | `startup.test.tsx:44` | OK (no persistence) |
| ARCH-08 data flow | no mutations or screens yet | — | N/A in M1 |
| ARCH-09 SQLite runtime | `database.ts:15-55`, `sql.ts:61-64`; bound params everywhere | `migrations.test.ts:132` | OK |
| ARCH-10 CredentialsService | `credentialsService.ts:15-58` | `credentialsService.test.ts` | OK |
| ARCH-13 typed errors, recovery | `shared/errors/errors.ts`; `RecoveryScreen.tsx`; `StartupGate.tsx:61-69` | `errors.test.ts`; `startup.test.tsx:59-123` | **Gaps (majors 1, 2)** |
| ARCH-15 logging | `runner.ts:59-72`; `start-services.ts:45-53`; `logger.ts` | `migrations.test.ts:44,90` | OK. Verified in the Metro log |
| ARCH-17 startup order + launch hold | `initialize-app.ts:13-20`; `start-services.ts:29-56`; `StartupGate.tsx` | `startup.test.tsx:34,44` | Partial (major 1) |
| ARCH-18 test layers | `node:sqlite` driver (`shared/testing/nodeSqlite.ts`); `expoSqliteMock.ts` | repository/migration suites on real SQL | OK |
| ARCH-20 dependency notes | `package.json` (+5 deps) | — | Missing (minor 9) |
| ARCH-22 en + pt-PT | `locales/{en,pt-PT}.json` (`seed.meals.*`, `startup.*`) | `locales.test.ts` (parity); `startup.test.tsx:110` | OK |
| UX-01 (data) | `seed.ts:51-66`; `goals.ts:14-19`; `goalsRepository.ts:57,97` | `seed.test.ts:56`; `settings-goals.test.ts:50,58` | OK. Verified on-device |
| UX-20 | `RecoveryScreen.tsx:14-67`; `_layout.tsx:13` | `startup.test.tsx:80-123`; `docs/qa/M1/*` | OK for DB/migration failures (config failure: major 1). Reproduced on iOS |

## ROAD-02 checklist

| Item | Assessment |
|---|---|
| Every behavior in Main specs implemented; deviations approved | **No.** Majors 1–2 (ARCH-13/17). Unapproved DATA-12 deviation (minor 5). Copy meal not implemented and not logged (minor 8) |
| `npm run check` green | **Yes.** Exit 0, 226/226 tests |
| Tests at the right ARCH-18 layer | **Yes.** Domain is pure; repositories and migrations run on real SQLite; startup has component tests. One test name overclaims (minor 5) |
| Test names cite spec IDs | **Mostly.** `describe` blocks cite IDs; a few `it`s rely on them |
| Every new string in en + pt-PT | **Yes.** Parity test passes; pt-PT is European Portuguese |
| Milestone E2E flows | **N/A for M1.** `m0-shell` still passes on both platforms (regression) |
| Exit demo on both platforms | **Yes.** Both apps start through migration 1 (on-device DBs checked). Repository, migration and domain tests pass on real SQLite |
| Screenshots of new screens (light/dark × default/largest, small phone) | **Yes.** 8 files in `docs/qa/M1/`. I reproduced the iOS set |
| Independent review clean | **No.** This round: 2 majors |
| No placeholder UI for in-scope behavior | **Yes.** The launch hold is a plain canvas, logged as a known gap |
| Nothing sensitive in logs | **Yes.** Migration logs carry version/duration/outcome; startup logs carry code/version. Release keeps only allowlisted keys |
| M1 extra: seed idempotent (init twice) | **Yes.** `seed.test.ts:72`, plus the never-re-translate test at `:81` |
| M1 extra: every migration tested from an empty DB | **Yes.** `migrations.test.ts:24` (matches `schema.sql`), plus rollback, detection and newer-DB tests |
| M1 extra: startup failure shows the recovery screen, not a crash | **Partial.** DB/migration failures do (tested, and reproduced on iOS). A config failure still crashes (major 1) |
| M1 extra: date tests cover DST, month/year ends, leap days | **Yes.** `localDate.test.ts:28-74` under `TZ=Europe/Lisbon` |
| Progress log holds the ticked ROAD-02 checklist | **No.** Missing from the M1 section (minor 9) |
