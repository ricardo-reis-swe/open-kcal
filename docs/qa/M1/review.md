# M1 review — round 2

- **Reviewed HEAD:** `ab660c672ab5c2cb03cfedc9efafee819f817a5f` (delta range `2fa66f8..HEAD`, 2 commits: `a70a193` majors fix, `ab660c6` minors fix)
- **Date:** 2026-09-25
- **Reviewer:** independent, read-only. Nothing in the repo was edited; the pre-existing staged rename (`docs/qa/M1/review.md` → `review-round1.md`) and the unstaged `docs/progress.md` reference fix were left untouched.

**Commands run**
| Check | Result |
|---|---|
| `npm run check` (lint `--max-warnings 0`, `tsc --noEmit`, Jest) | **exit 0**. 35/35 suites, **234/234 tests** (+8 vs round 1: `sql.test.ts` +2, `startup.test.tsx` +2, `foods-diary.test.ts` +3, `meals.test.ts` +1), 0 snapshots |
| `scripts/e2e.sh android` (`emulator-5554`, `.maestro/m0-shell.yaml`) | **exit 0**, `[Passed] m0-shell (34s)` |
| `scripts/e2e.sh ios` (iPhone 17e, iOS 27.0, same flow) | **exit 0**, `[Passed] m0-shell (22s)` |
| Metro log (`scratchpad/metro.log`, entries from these two runs) | `app initialized {"appVersion":"0.1.0","pluralRules":true}` logged **before** `database ready {...}` on both platforms — confirms the new startup order (config validated inside the gated `startServices`, i18n first) works end-to-end on real devices |

The `m0-shell` flow is read-only (navigation only, no data entry), so no device state needed resetting. Given `RecoveryScreen.tsx`/`StartupGate.tsx` are unchanged in this delta (not in the diff) and round 1 already reproduced the recovery screen live on iOS, I relied on the new unit/component tests (`startup.test.tsx`, see table below) plus these real-device successful-path launches for the config-path behavior change, rather than re-running the (unrelated, DB-failure) `m1-recovery-ios.sh` script — that script exercises a schema-version failure, a path that didn't change in this delta.

**Verdict: clean.** 0 blockers · 0 majors · 0 minors.

All 9 round-1 findings are fixed, each with a matching new/updated test, and I found no regressions or new bugs introduced by the fixes.

## Round-1 findings

| # | Finding | Fixed? | Evidence |
|---|---|---|---|
| 1 | major. Config validation crashed at module load, before recovery screen could catch it; i18n ran after config | **Yes** | `src/bootstrap/initialize-app.ts` now only calls `initI18n()` + the `Intl.PluralRules` check (no `getConfig()`). `src/bootstrap/start-services.ts:29-44` calls `loadConfig()` (default `getConfig`) as step 1 inside the gated `startServices`, logs `app initialized` there. `src/shared/config/env.ts:28` `ConfigError extends ValidationError`. `src/app/_layout.tsx:11` `initializeApp()` no longer destructures `config`; uses new `getAppVersion()` for the recovery screen's version. Test: `src/bootstrap/__tests__/startup.test.tsx:80-111` (`ARCH-13 / ROAD-02 M1: an invalid config shows the recovery screen, not a crash`) asserts `category: 'validation'`, fields redacted, and the recovery screen renders with the diagnostic copy excluding secret values. Live: Metro log shows `app initialized` → `database ready` order on both platforms this session. |
| 2 | major. Raw SQLite driver failures reached callers untyped (`category: undefined`) | **Yes** | `src/data/db/sql.ts:35` `toDatabaseError`, `:39` `mapped()`, `:57-62` wraps every `tx` method with `mapped`, so `BEGIN`/statements/`COMMIT` all map driver throws to `DatabaseError('Database operation failed', { cause })`; `isAppError` typed errors pass through unchanged (no double-wrap). Test: `src/data/db/__tests__/sql.test.ts` (`ARCH-13: driver failures surface as DatabaseError with a static message`, and `... typed errors thrown inside a transaction pass through and still roll back`). `src/data/db/migrations/__tests__/migrations.test.ts:138-141` and `src/data/db/repositories/__tests__/meals.test.ts:99` (the round-1 trigger-based rollback probe) now assert `category: 'database'` instead of a bare `.rejects.toThrow()`. |
| 3 | minor. `upsertExternal` deleted+reinserted every serving on refresh, nulling `last_serving_id` even when unchanged | **Yes** | `src/data/db/repositories/foodsRepository.ts:137` `mergeServings` matches existing rows by `(lower(label), lower(unit))`, updates in place, inserts new, deletes only missing — matches `docs/07-providers.md:170` (PROV-09) verbatim. Test: `foods-diary.test.ts` `PROV-09: refresh merges servings by (label, unit)` confirms the matched serving keeps its id (case-insensitive match too) and the recent's `last_serving_id` survives. |
| 4 | minor. Meal delete+reassign didn't renumber `sort_order`, causing collisions/interleaving | **Yes** | `src/data/db/repositories/mealsRepository.ts:116-139` computes per-`diary_date` max `sort_order` in the target meal and appends moved entries after it, preserving their relative order. Test: `meals.test.ts` (`DATA-10: reassigned entries append after the target meal, per date, in their original order`) — multi-date, multi-entry case, exact expected order asserted. |
| 5 | minor. "Moving an entry changes only meal_id + updated_at" test didn't match implementation (it also touched `sort_order`) | **Yes** | Implementation now matches spec literally: `diaryRepository.ts`'s `editFoodEntry` meal-only move and `updateQuickCalories` move both do `UPDATE ... SET meal_id = ?, updated_at = ? WHERE id = ?` (quick-calories: `+ energy_kcal, note`), no `sort_order` touch — comment explicitly cites DATA-12. Test renamed/tightened: `foods-diary.test.ts` (`DATA-12: moving an entry changes only meal_id + updated_at`) now diffs the **entire row** before/after via `rowOf()`, closing the "test name overclaims" gap. `docs/03-data.md:68` (DATA-12) was not amended — the code was changed to match the existing spec text, which is a valid resolution per round 1's "or keep sort_order [as spec'd]" option. |
| 6 | minor. `editFoodEntry` recomputed the snapshot from current food data whenever any `servingId` was passed, even if unchanged (risk of silently rewriting history after a cache refresh) | **Yes** | `diaryRepository.ts:141` `sameServingLabel`, `:258-266` — the repository now compares the chosen serving's label against the entry's stored `servingUnit` snapshot to decide `servingChanged`; only then recomputes from the food, otherwise scales the existing snapshot. Test: `foods-diary.test.ts` (`DATA-05: passing the same serving after a cache refresh never rewrites the snapshot`) — refreshes the food (400→999 kcal/100g) then edits with the "same" (now different-id) serving and asserts nutrients stay scaled from the old 100-kcal snapshot, not recomputed from 999. |
| 7 | minor. `loadDay` ran 4 unguarded statements outside a transaction, risking a torn read once writes land | **Yes** | `diaryRepository.ts:179` wraps goal/meals/entries/totals reads in `db.transaction(async (tx) => {...})`. No dedicated new test, but this is exercised by every existing `loadDay` call in `foods-diary.test.ts`, and `npm run check` passing confirms no regression; the `sql.ts` transaction tests independently verify atomicity/queuing semantics. |
| 8 | minor. Copy meal (DATA-16) not implemented and not in the M1 known-gaps list | **Yes** | `docs/progress.md`: "The Copy meal transaction (DATA-16) arrives with M7, per ROAD-01. Search queries arrive with M4/M5, and the add/edit write paths are exercised by screens from M3." |
| 9 | minor. M1 progress section missing the ROAD-02 checklist and dependency notes | **Yes** | `docs/progress.md` now has a ticked `### ROAD-02 checklist` (9 items, only "Independent review clean" unticked pending this review) and a `### Dependency notes (ARCH-20)` table for all 5 M1 packages (`expo-sqlite`, `expo-secure-store`, `@tanstack/react-query`, `expo-crypto`, `expo-clipboard`) with need + version. |

No new bugs found. Things I specifically checked for regressions and found clean:
- `mergeServings`'s "clear `is_default` then set it once per loop" never exposes two default rows to the partial unique index, even mid-transaction.
- `createServices` signature change (positional args → single options object with `config`) has exactly one call site (`start-services.ts:55`); no stale callers.
- `ConfigError extends ValidationError` correctly passes `invalidKeys` as `fields`; `isAppError`/`toAppError` treat it as a typed error with no double-wrap through `sql.ts`'s new `mapped()`.
- The `sql.ts` transaction path's `catch` calls `toDatabaseError(error)` on an already-mapped `AppError` from `tx.exec`/`tx.run` — `isAppError` short-circuits, so no double-wrapping.
- Both commits (`a70a193`, `ab660c6`) are authored/committed as `ricardo_reis@live.com`, no co-author trailer, matching AGENTS.md.

## ROAD-02 checklist

Matches `docs/progress.md`'s own (now-present) checklist, independently confirmed:
- Every M1 Main-spec behavior implemented, deviations resolved (not "approved as a deviation" — the DATA-12 code was fixed to match spec instead): **Yes**.
- `npm run check` green: **Yes**, verified this session (234/234).
- Tests at the right ARCH-18 layer, spec IDs cited: **Yes** — new tests are repository/component-level as appropriate, and the round-1 "test name overclaims" gap (finding 5) is closed.
- Independent review clean: **Yes, as of this round** (0/0/0).
- Everything else in the checklist (strings, E2E, exit demo, screenshots, no placeholder UI, nothing sensitive in logs, M1 extras) is unchanged from round 1's "Yes" and this round's `m0-shell` re-runs on both platforms plus `npm run check` don't contradict it.
