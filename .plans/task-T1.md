# Task T1: export / import the whole diary (SQLite file), implementation plan

**User decision needed: none.** The spec proposal `.plans/task-T1-spec.md` was approved on 2026-11-24 with these answers:
1. Add SCOPE-14 to the MVP and reword DATA-02 as proposed.
2. Unencrypted file in v1; encryption → new POST-17.
3. Profile row `Export & import` under Profile › APP.
4. Import is allowed while other screens have unsaved edits; those edits are lost, and there's no cross-screen dirty tracking.

T11 has landed (ROAD-05 live check, ARCH-14 test-key sentence). The docs below were re-read on 2026-11-24 after that commit. Every anchor quoted here exists in the current text.

Work in the order below. Each sub-step ends green on `npm run check` and can be its own commit (AGENTS.md: direct to `main`; author/committer `ricardo_reis@live.com`, no co-author lines; conventional commit + `Refs:` IDs, ROAD-03).

| Sub-step | What | Commit |
|---|---|---|
| A | Spec edits in `docs/` | `docs(spec): export and import (SCOPE-14)` |
| B | Dependencies, test infrastructure, small shared pieces | `chore(deps): expo-sharing, expo-document-picker, expo-file-system` |
| C | Data layer: export, staged validation, swap/rollback, launch recovery (+ tests) | `feat(data): database export, import validation and replace` |
| D | Bootstrap: StartupGate `replacing`, startServices recovery, app notices (+ tests) | `feat(bootstrap): replace the database at runtime` |
| E | UI: route, UX-29 screen, Profile row, i18n, Diary toasts (+ tests) | `feat(profile): Export & import screen` |
| F | Navigation test, full check, progress log | `test(profile): export/import navigation` + progress |

---

## A. Spec edits (docs only, one commit)

Copy the approved wording from `.plans/task-T1-spec.md` §1–7 **verbatim**, with only the changes listed here. These changes fold in the four answers and remove each "or"/"see Q" ambiguity. Don't touch any other ID or renumber anything.

### `docs/01-scope.md`
- **SCOPE-01**: append the bullet from spec §1 as the last bullet of the list (after "Barcode scanning…").
- **SCOPE-10**: in the list line (line 73), replace `Accounts · cloud sync ·` with `Accounts · cloud sync or automatic/cloud backup ·`. Leave the rest of the line unchanged.
- **SCOPE-14**: append after SCOPE-13, verbatim from spec §1. In the first bullet, use `Profile › APP › \`Export & import\` (UX-29).` (answer 3). In the "Deferred" bullet, use `Deferred (user decision 2026-11-24): encryption (v1 file is unencrypted), scheduled/automatic export, merge import, CSV (POST-17).` (answer 2).

### `docs/03-data.md`
- **DATA-02**: replace the whole section body with the two bullets from spec §2 (answer 1).
- **DATA-17**: append the spec §2 bullet after the "Migration 7 …" bullet.
- **DATA-30, DATA-31, DATA-32**: append after DATA-29, verbatim from spec §2. Two clarifications fold implementation facts the spec left open:
  - DATA-31 first bullet: after "on its own connection (`useNewConnection`)", add `, switched to \`journal_mode = DELETE\` so it stays one file`.
  - DATA-32 step 2: after `PRAGMA wal_checkpoint(TRUNCATE)`, add ` (must report busy = 0, else stop before step 3 with \`importFailed\`)`.
  - DATA-32: add a bullet after "Launch with `import-pending` present…": `- Launch with \`calorie-tracker.pre-import.db\` but no marker (the app died during step 7) → delete the safety copy; the import had succeeded.`
  - DATA-32: add a bullet after the "Failure in steps 4–6" bullet: `- After a rollback the Router remounts as on success (NAV-11) and the Diary shows \`importFailed\` as a toast.` **Why:** the Export & Import screen no longer exists once the Router has unmounted.

### `docs/02-navigation.md`
- **NAV-02** tree, Profile Stack: change `My Foods, Edit Custom Food, My Recipes, Edit Recipe, Import Recipe,` to `My Foods, Edit Custom Food, My Recipes, Edit Recipe, Import Recipe, Export & Import,`. Re-wrap the next line if needed and keep the alignment.
- **NAV-06** `Profile` row: change `… Food Databases, Theme.` to `… Food Databases, Theme, Export & Import.`.
- **NAV-06**: add the `Export & Import` row from spec §3 as the last row (after Food Databases).
- **NAV-08**: append ` · replacing all data with an imported file` after `removing the USDA key` (before the final `.`).
- **NAV-11**: append after NAV-10, verbatim from spec §3, plus a third bullet (answer 4):
  `- Unsaved edits on any other screen (either tab) are discarded without a \`Discard changes?\` dialog; the UX-19 \`Replace all data?\` dialog covers it (user decision 2026-11-24). No cross-screen dirty tracking.`

### `docs/04-architecture.md`
- **ARCH-05**: in the route tree line, change `my-recipes/{index,[foodId],import}}` to `my-recipes/{index,[foodId],import}, data-transfer}`. Add this bullet after the route-tree bullet:
  `- Export/import (ARCH-25): \`src/data/db/transfer/\` (data), screen \`src/features/profile/screens/DataTransferScreen.tsx\`.`
  This drops the spec's "or a new features/data-transfer/ if the user prefers" option, because the user named no preference.
- **ARCH-13**: append a bullet:
  `- \`ValidationError\` MAY carry a typed \`reason\` (DATA-31 import checks); callers branch on it, never on the message. Import copy/rename/move failures → \`DatabaseError\`. No new error type.`
- **ARCH-15**: append the spec §4 bullet.
- **ARCH-18**: in the `Repository/migration` row's "Must cover" cell, append `, export snapshot, every DATA-31 reason, DATA-32 rollback + interrupted-import recovery`.
- **ARCH-25**: append after ARCH-24, verbatim from spec §4. Replace the bullet "Only `src/data/db/transfer/` imports `expo-file-system`; only a small `shareFile` / `pickFile` service (behind an interface, `src/shared/`) imports `expo-sharing` / `expo-document-picker`." with:
  `- Only \`src/data/db/transfer/files.ts\` imports \`expo-file-system\`; only \`src/shared/files/fileTransfer.ts\` (\`shareFile\`, \`pickFile\`) imports \`expo-sharing\` / \`expo-document-picker\`. Jest replaces both with Node implementations (real files in a temp dir, ARCH-18).`

### `docs/06-screens.md`
- **UX-15** wireframe: after `[Theme                          System   › ]`, add `[Export & import                        › ]`. After the bullet list, add `- \`Export & import\`: no value text (DATA-02: no "last backup").`
- **UX-19** table: add the spec §5 row after `Remove USDA key`.
- **UX-20**: append the spec §5 bullet.
- **UX-29**: append after UX-28, verbatim from spec §5, with these changes:
  - In the `Import:` bullet, change `→ Diary + toast \`Data imported.\`` to `→ Diary root on today + toast \`Data imported.\` (NAV-11); a swap failure → rollback → Diary + toast \`Couldn't import. Your data wasn't changed.\` (DATA-32)`.
  - Add a bullet: `- Leaving the screen during \`Checking file…\` or cancelling the dialog discards the staged copy (DATA-32).`

### `docs/08-roadmap.md` and `docs/releasing.md`
- **ROAD-06** › Android signing, last bullet (line 163, "…Uninstalling first deletes local data."): append ` Export data first (SCOPE-14) and import it after reinstalling.`
- `docs/releasing.md` line 113 (`**Note:** … that deletes its data.`): append the same sentence.

### `docs/post-mvp.md`
- **POST-17**: append after POST-16, verbatim from spec §7.

### Progress
- `docs/progress.md`: add one line under the 2026-11-24 entries: `2026-11-24 spec (user-approved): SCOPE-14 export/import, DATA-02 reworded, DATA-30–32, NAV-11, ARCH-25, UX-29, POST-17; code follows.`

Check: `grep -n "SCOPE-14\|DATA-3[012]\|NAV-11\|ARCH-25\|UX-29\|POST-17" docs/*.md` shows each new ID's heading exactly once. Run `npm run format:check`: Prettier covers `docs/*.md`, so fix the table/wireframe formatting it flags.

---

## B. Dependencies, test infrastructure, shared pieces

### B1. Install (native modules; ARCH-01/ARCH-20/ARCH-25)
```sh
npx expo install expo-sharing expo-document-picker expo-file-system
```
- `bundledNativeModules.json` resolves these as `expo-sharing ~57.0.22`, `expo-document-picker ~57.0.2`, `expo-file-system ~57.0.7`. `expo-file-system` is only a transitive dependency today (`node_modules/expo/node_modules/expo-file-system`); this install makes it a direct, hoisted dependency.
- Then **pin exact versions** (ARCH-01: no floating ranges; every dependency except `expo-haptics` is exact). Read them with `npm ls expo-sharing expo-document-picker expo-file-system --depth=0`, remove the `~` in `package.json`, and run `npm install` so the lockfile matches.
- `app.json`: no plugin entries (ARCH-25). If `expo install` added `expo-document-picker` or `expo-sharing` to `plugins`, remove the entry.
- **A native rebuild is required** (3 new native modules). It can't be done in this environment. Log it as a known gap, and the user runs `npm run android` / `npm run ios`. Until the rebuild, the JS bundle would crash on an old dev client when the screen is opened, so don't ship an OTA/Metro build to a device without rebuilding.

### B2. Jest doubles (repo pattern: native packages replaced by real Node equivalents, `jest.setup.ts`)
- `src/shared/testing/expoSqliteMock.ts`: honour the third `directory` argument.
  - `openDatabaseAsync(name, options, directory)`: if `name === ':memory:'`, or `directory` is undefined or equals the exported `defaultDatabaseDirectory` sentinel `'jest-memory://SQLite'` → a fresh in-memory DB (today's behaviour, so every existing test is unchanged). Otherwise → `new DatabaseSync(path.join(directory, name))`, a real file.
  - Export `defaultDatabaseDirectory = 'jest-memory://SQLite'`.
- `src/shared/testing/nodeFiles.ts` (new): a Node `fs/promises` implementation of `src/data/db/transfer/files.ts` (same exports, C1).
  - `cacheDirectory()` = a per-worker temp dir from `fs.mkdtempSync(os.tmpdir()/open-kcal-jest-)`, created lazily.
  - Every function on a path under `jest-memory://` resolves to "missing" or a no-op, so the startup recovery/cleanup in ordinary app tests does nothing.
  - Add `__resetFiles()` for tests, which removes the temp dir.
- `src/shared/testing/fileTransferMock.ts` (new): an in-memory double for `src/shared/files/fileTransfer.ts`.
  - `shareFile` and `pickFile` are `jest.fn`s that are controllable per test: `__setPickResult({ canceled } | { uri, size })`, `__setShareAvailable(bool)`, and `shareFile` records the uri.
- `jest.setup.ts`: add
  ```ts
  // ARCH-25: file ops run on real temp files; share sheet and picker are system UI.
  jest.mock('@/data/db/transfer/files', () => require('./src/shared/testing/nodeFiles'));
  jest.mock('@/shared/files/fileTransfer', () => require('./src/shared/testing/fileTransferMock'));
  ```
  ARCH-18 forbids mocking repositories, not infrastructure adapters. These two thin adapters are the only code that isn't exercised in Jest, so the device check (F3) covers them.

### B3. Shared pieces
- `src/shared/errors/errors.ts`:
  - `export type ImportRejectReason = 'empty' | 'tooLarge' | 'notSqlite' | 'corrupt' | 'notOpenKcal' | 'newerVersion' | 'migrationFailed';`
  - `ValidationError` constructor: add `reason` to the options object: `options?: { cause?: unknown; reason?: ImportRejectReason }`. Set `readonly reason?: ImportRejectReason`. Existing call sites are unchanged.
  - Extend `errors.test.ts`.
- `src/shared/files/fileTransfer.ts` (new; the only importer of `expo-sharing` / `expo-document-picker`):
  - `shareFile(uri, { dialogTitle }): Promise<'shared' | 'unavailable'>`: `Sharing.isAvailableAsync()` false → `'unavailable'`. Otherwise `Sharing.shareAsync(uri, { mimeType: 'application/vnd.sqlite3', UTI: 'public.database', dialogTitle })`. It resolves on dismiss or cancel too; that isn't an error (DATA-30).
  - `pickFile(): Promise<{ canceled: true } | { canceled: false; uri: string; size: number | null }>`: `DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false })`. **Never log the uri or name** (ARCH-15).
- `src/shared/notices/appNotice.ts` (new): a one-shot store, same shape as `features/food-search/addedNotice.ts` (`useSyncExternalStore`).
  - Kinds: `'dataImported' | 'importFailed' | 'importInterrupted'`. API: `announceAppNotice(kind)`, `clearAppNotice(key)`, `useAppNotice()`.
  - It lives in `shared/` because bootstrap writes it and the Diary feature reads it (ARCH-05: no feature-to-feature imports).
- `src/shared/i18n/format.ts`: add `formatFullDate(date: LocalDate, locale)` using `Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })`. The confirm dialog needs it because an export can be from another year. Add a unit test in `format.test.ts` for en and pt-PT.

---

## C. Data layer: `src/data/db/transfer/`

### C1. `files.ts`: the only importer of `expo-file-system` (new `File` / `Directory` / `Paths` API)
Every function works on **plain absolute paths** (what `expo-sqlite` and `VACUUM INTO` need):
- `cacheDirectory(): string` = `toPath(Paths.cache.uri)`.
- `toPath(uri)`: strip `file://` and `decodeURIComponent`.
- `toUri(path)`: `'file://' + encodeURI(path)`.
- `exists(path)`, `size(path)`, `readHead(path, n)` (`file.open()` → `readBytes(n)` → `close()` in `finally`).
- `copy(from, to)` and `move(from, to)`, both with `{ overwrite: true }`.
- `remove(path)`: no-op if missing.
- `ensureDir(path)`: `create({ intermediates: true, idempotent: true })`.
- `removeDir(path)`: no-op if missing.
- `writeText(path, text)`.

Wrap every failure as `DatabaseError('File operation failed', { cause })` (ARCH-13). The message never contains a path, and the cause stays on `cause` only.
- `appDatabaseLocation()` lives in `database.ts` (C5): `{ directory: defaultDatabaseDirectory, name: DATABASE_NAME }`. `defaultDatabaseDirectory` is a plain path on both platforms: Android `filesDir/SQLite`, iOS `Documents/SQLite` (checked in `expo-sqlite` 57 native source).

### C2. `exportDatabase.ts`: DATA-30
```ts
export async function exportDatabase(deps: { db: SqlDatabase; clock: Clock }): Promise<{ uri: string; bytes: number }>
```
1. `dir = cacheDirectory() + '/export'`. Run `removeDir(dir)` then `ensureDir(dir)`. That removes an older day's file and the same-day file. `VACUUM INTO` fails on an existing non-empty target.
2. `path = \`${dir}/open-kcal-${todayLocal(clock)}.db\`` (DATA-08 local date).
3. `await db.run('VACUUM INTO ?', [path])`. It's bound, never interpolated (ARCH-09). It runs on the app connection through the serial queue, so it waits behind in-flight writes and gets a consistent snapshot, WAL included. It's outside any transaction (`VACUUM` can't run inside one).
4. On error: `remove(path)` (best effort), then rethrow as `DatabaseError`.
5. Return `{ uri: toUri(path), bytes: await size(path) }`.
6. Log `info('export finished', { outcome, sizeBucket, durationMs })` with no path (ARCH-15). Size buckets: `<1MB`, `1–10MB`, `10–50MB`, `50–200MB`, `>200MB`.

Cache cleanup at the next app start is in C5 (`cleanTransferCache`).

### C3. `validateImport.ts`: DATA-31 (staged copy, checks 1–9 in order)
```ts
export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
export type ImportSummary = { schemaVersion: number; entryCount: number; latestDiaryDate: LocalDate | null };
export async function stageImport(
  pickedUri: string,
  deps: { clock: Clock; logger: Pick<Logger, 'info' | 'error'>; size?: number | null; maxBytes?: number },
): Promise<{ stagedPath: string; summary: ImportSummary }>
export async function discardStagedImport(): Promise<void>   // removeDir(<cache>/import)
```
**Staging:**
- `importDir = <cache>/import`; run `removeDir` then `ensureDir`. `staged = importDir/staged.db`.
- Check 1 first, on the picked file: size 0 → `empty`; size > `maxBytes` → `tooLarge`. Use `pickFile`'s `size` when present to fail before any copy, else `size(path)`.
- Then `move(picked, staged)`. The picker already copied the file into the app cache, so moving saves space. If the move fails, try `copy` then `remove(picked)`.
- Any file error here → `DatabaseError`. The screen shows `errorReadFailed`.

**Checks** (each failure → `throw new ValidationError('Import rejected', [], { reason })`; the message is the same for all, ARCH-13):
2. `readHead(staged, 16)` equals the bytes of `SQLite format 3\0` → else `notSqlite`.
3. Open: `openDatabaseAsync('staged.db', { useNewConnection: true }, importDir)` → `createSqlDatabase` (same driver adapter as `database.ts`; export the private `openExpoSqliteDriver` from `database.ts` with a `directory` parameter rather than duplicating it). Then:
   - `PRAGMA journal_mode = DELETE`. **Why:** a single file to move, no `-wal`/`-shm` to carry.
   - `PRAGMA integrity_check` → every row `ok`.
   - `PRAGMA foreign_key_check` → 0 rows.
   - Any throw in this step (open, a pragma, "file is not a database", "malformed") → `corrupt`.
4. `readSchemaVersion(staged)` (runner) < 1 → `notOpenKcal`.
5. Version > `LATEST_SCHEMA_VERSION` → `newerVersion`.
6. Required tables by version: `REQUIRED_TABLES: { fromVersion: number; tables: string[] }[]`:
   - v1: `schema_version, app_settings, nutrition_goals, meals, foods, food_servings, diary_entries, weight_entries, recent_foods, food_cache_metadata`
   - ≥4: `food_nutrients, diary_entry_nutrients`
   - ≥7: `recipes, recipe_ingredients`

   Read them from `sqlite_master WHERE type='table'`. Any missing → `notOpenKcal`.
7. `migrate(staged, MIGRATIONS, { clock, logger })` with no seed. A `MigrationError` or any throw → `migrationFailed`.
8. Schema equality against a reference built once per call: `openDatabaseAsync(':memory:', { useNewConnection: true })` + `migrate(MIGRATIONS)`, no seed, closed afterwards.
   - Fingerprint = sorted list of:
     - every `sqlite_master` object except names `LIKE 'sqlite_%'`, as `(type, name, tbl_name)`, which catches extra triggers/views/indexes;
     - per table, `PRAGMA table_info` → `(name, type, notnull, dflt_value, pk)`;
     - per table, `PRAGMA index_list` + `index_info` → `(index, unique, columns)`;
     - per table, `PRAGMA foreign_key_list` → `(table, from, to, on_delete)`.
   - Compare structurally, not by `sql` text. **Why:** whitespace and comment edits to shipped migration text must not reject an old install's export.
   - Any difference → `notOpenKcal`.
9. `SELECT COUNT(*) FROM app_settings` = 1, and `SELECT COUNT(*) FROM meals` ≥ 1 → else `notOpenKcal`. Meals and diary entries are hard-deleted; there's no `is_deleted` on them.

**Summary:**
- `SELECT COUNT(*) AS n, MAX(diary_date) AS latest FROM diary_entries`, plus `schemaVersion` (the pre-migration version from check 4, for logging).
- `finally`: close the staged and reference connections. On any failure, also `discardStagedImport()`.
- Log `info('import checked', { outcome, reason?, schemaVersion?, sizeBucket, durationMs })`.

### C4. `replaceDatabase.ts`: DATA-32 file steps (pure file ops on a location; no React)
`type DatabaseLocation = { directory: string; name: string }`. Derived paths:
- `main` = `dir/calorie-tracker.db`
- `safety` = `dir/calorie-tracker.pre-import.db`
- `marker` = `dir/import-pending`
- sidecars = `main + '-wal'`, `main + '-shm'`

Functions:
- `closeForSwap(db)`: step 2 data part.
  - `exec('PRAGMA busy_timeout = 2000')`.
  - `getFirst<{busy:number}>('PRAGMA wal_checkpoint(TRUNCATE)')`. `busy !== 0` → throw `DatabaseError` (the import stops before the marker, nothing has changed).
  - Then `db.close()`.
- `swapIn(location, stagedPath)`: steps 3–5.
  - `writeText(marker, '1')`.
  - `move(main, safety)`.
  - `remove(sidecars)`. Safe only because the checkpoint emptied the WAL.
  - `move(stagedPath, main)` with overwrite. **Why:** the widget may have created an empty `main` in the gap (ARCH-25 says the widget is unchanged; its schema-version check then shows "unavailable").
  - `remove(sidecars)` again.
- `commitImport(location)`: step 7. `remove(marker)` **then** `remove(safety)`, then `removeDir(<cache>/import)`.
- `rollbackImport(location)`: used for in-session failure and launch recovery. Idempotent.
  - If `exists(safety)`: `remove(main)`, `remove(sidecars)`, `move(safety, main)`.
  - Then `remove(marker)` (last, so a crash mid-rollback retries on the next launch).
  - Then `removeDir(<cache>/import)`.
- `recoverInterruptedImport(location): Promise<'none' | 'rolledBack'>`:
  - marker present → `rollbackImport` → `'rolledBack'`.
  - else if `safety` exists (the app died inside step 7, so the import had succeeded) → `remove(safety)` → `'none'`.
  - else `'none'`.
- `cleanTransferCache()`: `removeDir(<cache>/export)`, `removeDir(<cache>/import)`. Best effort; log category on failure.

### C5. Changes to existing data files
- `src/data/db/database.ts`:
  - Export `appDatabaseLocation()`.
  - `openExpoSqliteDriver(name, options?, directory?)`: export it for `validateImport.ts`.
  - `openAppDatabase(options, location = appDatabaseLocation())` passes `location.directory` explicitly to `openDatabaseAsync`. `openWidgetDatabase` stays as is.
- No repository changes. Export/validate/replace aren't repository methods; they take the `SqlDatabase` directly (DATA-18 boundary preserved: only `src/data/db` runs SQL).

### C6. Data tests: real SQLite + real temp files (`src/data/db/transfer/__tests__/`)
Helpers in `src/shared/testing/transferFixtures.ts`:
- `makeDbFile(dir, { version, seed, rows })`: `openTestDatabase(path)` (real file, WAL) + `migrate(MIGRATIONS.slice(0, version))` + optional seed via `seedDefaults` + a few rows.
- `corruptPages(path)`: overwrite bytes from offset 4096 × 2 onwards with 0xFF, keeping the 100-byte header.
- `sha256(path)`.

Tests (cite IDs in `describe` names):
- `exportDatabase.test.ts`:
  - The export is one file and nothing else in `export/`.
  - Its rows equal the source's, including rows written after the last checkpoint: the source is a WAL file DB with `wal_autocheckpoint = 0`.
  - Fresh-install DB and a populated v7 DB.
  - A second export the same day overwrites; an older day's file is removed.
  - A failure (target dir made read-only, or `VACUUM INTO` spied to reject) → `DatabaseError`, no partial file.
- `validateImport.test.ts`: one test per reason:
  - `empty` (0-byte file)
  - `tooLarge` (`maxBytes: 10`)
  - `notSqlite` (random bytes)
  - `corrupt` (corrupted pages; also an FK violation inserted with `foreign_keys = OFF`)
  - `notOpenKcal`, five variants: a plain SQLite DB with one unrelated table; `schema_version` with no rows; a missing `meals` table; an extra table; an extra column via `ALTER TABLE … ADD COLUMN`
  - `newerVersion` (`INSERT INTO schema_version VALUES (8, …)`)
  - `notOpenKcal` for zero meals and for zero `app_settings` rows (`app_settings.id CHECK (id = 1)` makes a second row impossible)
  - `migrationFailed`: a file at v3 whose `app_settings` was pre-altered so migration 4's `ALTER TABLE ADD COLUMN` collides. Any version < 7 with a conflicting column works, as long as check 6 passes.

  Plus:
  - Fixtures at every prior version v1–v6 (built with `MIGRATIONS.slice(0, v)`, with rows) migrate and pass; the staged file is then v7. v7 passes unchanged.
  - The summary has the count and latest date.
  - The live DB is untouched (`sha256` before/after).
  - `import/` is removed after every failure.
- `replaceDatabase.test.ts` (location = temp dir; the app DB is a real file opened with `openAppDatabase(opts, location)`):
  - The success path swaps, reopens with the imported data, and removes the marker, safety copy and `import/`.
  - Injected failure at step 4 (`move` → reject once), step 5 (second `move` rejects) and step 6 (the reopen throws) → `rollbackImport` restores the original **byte-for-byte** (`sha256` after a TRUNCATE checkpoint), and no marker remains.
  - Marker present at "launch" → `recoverInterruptedImport` = `'rolledBack'`, original data back.
  - Safety copy but no marker → deleted, imported data kept.
  - `closeForSwap` with a second open connection holding a read transaction → `busy` path → `DatabaseError`, nothing moved.

---

## D. Bootstrap

### D1. `src/bootstrap/start-services.ts`
- `StartOptions` gains:
  - `location?: DatabaseLocation` (default `appDatabaseLocation()`), passed to `openAppDatabase` and stored on services (`services.databaseLocation`).
  - `afterImport?: boolean`.
- Before opening SQLite (ARCH-17 step "open SQLite"), when `!afterImport`:
  - `const recovered = await recoverInterruptedImport(location)`. On `'rolledBack'` → `announceAppNotice('importInterrupted')` and log `info('import rolled back at launch')`.
  - `cleanTransferCache()`. Best effort: a failure is logged, never blocks startup.
  - A recovery **throw** propagates → UX-20 recovery screen. Retry runs the recovery again, never a reset.
  - **Why skip when `afterImport`:** during DATA-32 step 6 the marker exists on purpose.
- If anything after `openAppDatabase` throws, `await db.close().catch(() => undefined)` before rethrowing, so a failed step-6 start leaves no open connection for the rollback.
- `createServices` (`services.tsx`): add `databaseLocation` and `transfer`:
  ```ts
  transfer: {
    exportSnapshot: () => exportDatabase({ db, clock }),
    stageImport: (uri, size) => stageImport(uri, { clock, logger, size }),
    discardStaged: discardStagedImport,
  }
  ```
  `createTestServices` (`src/shared/testing/services.tsx`) gets these for free.

### D2. `src/bootstrap/StartupGate.tsx`
- New state: `{ status: 'replacing'; previous: Ready; stagedPath: string }`.
- New context `DatabaseReplaceContext` + hook `useReplaceDatabase(): (stagedPath: string) => void`, exported from `src/bootstrap/databaseReplace.ts`. It's provided only in `ready`. Features import it like `useServices` (existing `@/bootstrap/services` precedent).
- Prop `start` widens to `(options?: { afterImport?: boolean }) => Promise<AppServices>`. Test lambdas `() => promise` stay valid. `RootLayout` passes `startServices` unchanged.
- In `replacing`, render a full-screen view: `ActivityIndicator` + `t('dataTransfer.importing')`, `testID="import-replacing"`, a11y live region. Register `BackHandler.addEventListener('hardwareBackPress', () => true)` while mounted (NAV-11: the Router is unmounted, so Android back would otherwise leave the app).
- Effect on entering `replacing` (runs after commit, so the Router, services and screens are already unmounted):
  1. `previous.queryClient.cancelQueries()` → `previous.queryClient.clear()`.
  2. `try { await closeForSwap(previous.services.db) } catch` → reopen normally: `start()` → `ready` + `announceAppNotice('importFailed')`. Nothing was touched.
  3. `try { await swapIn(location, stagedPath); services = await start({ afterImport: true }) }`, with `location` = `previous.services.databaseLocation`.
     - Success → `await commitImport(location)` (a failure here is logged only) → new QueryClient + theme preload (same code path as normal start: extract `finishStart(services)` from the existing effect) → `ready` → `refreshWidget()` → `announceAppNotice('dataImported')`.
     - Failure → `await rollbackImport(location)` → `services = await start({ afterImport: true })` → `ready` + `refreshWidget()` + `announceAppNotice('importFailed')`. If the rollback or that start throws → `failed` (UX-20 recovery; its Retry runs the normal `start()`, which retries `recoverInterruptedImport` if the marker is still there).
  4. Log `info('import finished', { outcome: 'imported' | 'rolledBack' | 'failed', schemaVersion, durationMs })`.
- Rendering `ready` again mounts `children` fresh. React Navigation clears the root navigator's state when it unmounts, so the remount starts at `index` → `<Redirect href="/diary">`, with both stacks at root and `DiaryDateProvider` re-initialised to today (NAV-05/NAV-11).
  - If F1 shows stale stack state, add a `key={generation}` on the children wrapper. Also, on the first `ready` after a replace, call `router.dismissAll()` + `router.replace(routes.diary())` from a tiny `AfterImportReset` child.
- The dev-seed effect already depends on `ready` and tears down in `replacing`.

### D3. Bootstrap tests (`src/bootstrap/__tests__/`)
- `startup.test.tsx` additions:
  - A marker in a temp location → `startServices({ location })` rolls back, announces `importInterrupted` once, and opens the original data.
  - Stale `export/` and `import/` are removed.
  - A recovery failure (spy `move` rejects) → `startServices` rejects → the gate shows the recovery screen.
- `replace.test.tsx` (new):
  - Gate with `start = (o) => startServices({ ...o, location: tmp })` and a child that calls `useReplaceDatabase()(staged)` → shows `Importing…`, the child unmounts, then the child remounts with services reading the imported rows.
  - The QueryClient instance changes (capture it via `useQueryClient` in the child).
  - `refreshWidget` is called (spy on the module).
  - The `dataImported` notice is set.
  - Failure in step 6 (a `start` that throws once with `afterImport`) → original data and `importFailed`.
  - A hardware back press while replacing is consumed (pattern from `calories-macros.nav.test.tsx`).

---

## E. UI

### E1. Route and navigation
- `src/shared/navigation/routes.ts`:
  - `RouteParams.dataTransfer: undefined` with the doc comment `/** UX-29 Export & Import (Profile stack, NAV-06). */`.
  - Param schema `dataTransfer: z.object({})`.
  - Builder `dataTransfer: (): Href => '/profile/data-transfer' as Href`.
- `src/app/(tabs)/profile/data-transfer.tsx` (new), the same shape as `theme.tsx`: `<DataTransferScreen onBack={() => router.back()} />`, with the comment `/** NAV-06 / UX-29: back → Profile; a successful import remounts the Router (NAV-11). */`.
- `src/app/(tabs)/profile/index.tsx`: `onDataTransfer={() => router.push(routes.dataTransfer())}`.
- `src/shared/testing/appRoutes.tsx`: register `'(tabs)/profile/data-transfer'`.

### E2. Profile row (UX-15)
`ProfileScreen.tsx`: `ProfileNavigation.onDataTransfer?: () => void`. A row after Theme in the `APP` section: `row(t('profile.dataTransfer'), undefined, nav.onDataTransfer, 'profile-data-transfer')`, with no value (DATA-02). Extend `ProfileScreen.test.tsx`: the row renders, has no value text, and the press calls the handler.

### E3. `src/features/profile/screens/DataTransferScreen.tsx` (new, UX-29)
- Layout: `AppBar` (title `dataTransfer.title`, back), then a `ScrollView` with:
  - the intro `AppText`
  - `SectionHeader` `exportSection` (uppercase)
  - `ListRow` `export` (`testID="data-transfer-export"`), helper texts `exportHelp` + `exportPrivacy`
  - `SectionHeader` `importSection`
  - `ListRow` `import` (`testID="data-transfer-import"`), helper `importHelp`
  - An inline status/error under each row through `InlineStatus`

  No primary action (UX-29 exception). Use existing DS components only.
- State machine (local `useState`, ARCH-07): `idle | exporting | checking | confirm(summary, stagedPath) | importing`, with `exportError` / `importError` message keys. Both rows are disabled while not idle.
- **Export**:
  1. `exporting` (row shows `InlineStatus` spinner `exporting`).
  2. `services.transfer.exportSnapshot()` → `shareFile(uri, { dialogTitle: t('dataTransfer.shareTitle') })`.
  3. `'unavailable'` → `shareUnavailable`.
  4. Any throw → `exportFailed`.
  5. Back to `idle`. Dismiss/cancel shows nothing.

  Check availability first? `shareFile` checks before sharing, but the snapshot is made first. Acceptable, and simpler. If you want to avoid the wasted VACUUM, expose `isShareAvailable()` and check first. Either matches the spec.
- **Import**:
  1. `pickFile()`; canceled → `idle`, nothing shown.
  2. `checking` (`InlineStatus` `checking`) → `services.transfer.stageImport(uri, size)`.
  3. `ValidationError` with `reason` → message map: `empty → errorEmpty`, `tooLarge → errorTooLarge`, `notSqlite | notOpenKcal → errorNotOpenKcal`, `corrupt → errorCorrupt`, `newerVersion → errorNewerVersion`, `migrationFailed → importFailed`. `DatabaseError` → `errorReadFailed`. Other errors → `importFailed`. Use an exhaustive `switch` on the `ImportRejectReason` union (ARCH-02).
  4. Success → `confirm`. `ConfirmationDialog`: title `confirmTitle`, body `confirmBody` with `{ count, date: formatFullDate(latest, locale) }` or `confirmBodyEmpty` when count = 0, destructive `confirmAction`, cancel `common.cancel`.
  5. Cancel → `transfer.discardStaged()` → `idle`.
  6. Confirm → `importing` → `useReplaceDatabase()(stagedPath)`. The gate unmounts this screen; nothing runs after that call.
- Unmount cleanup: if state is `checking` or `confirm`, call `discardStaged()` (leaving mid-check, UX-29 added bullet). Guard the async results with an `active` ref (pattern from `ImportRecipeScreen`).
- No `usePreventRemove`. Back works in every state except `importing`, which can't be observed because the gate has taken over (NAV-11).
- Haptics: none (DS-10).

### E4. Diary toasts (`src/features/diary/components/DiaryDay.tsx`)
- Subscribe with `useAppNotice()`. When a notice is present, show it through the existing single-toast path (`setToast({ message })`, no undo) with `dataTransfer.imported` / `importFailed` / `importInterrupted`, then `clearAppNotice(key)`. That makes it once only.
- If `DiaryDay` renders more than once (one per day page), consume it in `DiaryScreen` instead and pass it down. Check before wiring.

### E5. i18n (ARCH-22): `src/shared/i18n/locales/en.json` + `pt-PT.json`
- Add `profile.dataTransfer` and a new top-level `dataTransfer` object with **exactly** the keys and texts from the spec's "UI strings" table.
- Write the shortened rows out in full:
  - `confirmBody_one`
    - en: `This phone's diary, foods, recipes, meals, goals and weight will be replaced by the file ({{count}} entry, latest {{date}}). This can't be undone.`
    - pt-PT: `O diário, os alimentos, as receitas, as refeições, os objetivos e o peso deste telemóvel serão substituídos pelo ficheiro ({{count}} registo, o último a {{date}}). Não é possível anular.`
  - `confirmBody_other`: the same with `entries` / `registos`.
  - `confirmBodyEmpty`
    - en: `This phone's diary, foods, recipes, meals, goals and weight will be replaced by the file (no diary entries). This can't be undone.`
    - pt-PT: `O diário, os alimentos, as receitas, as refeições, os objetivos e o peso deste telemóvel serão substituídos pelo ficheiro (sem registos no diário). Não é possível anular.`
- pt-PT plurals use only `_one` / `_other`, as the rest of the file does (no `_many`).
- `startup.loading` already exists; the gate's replacing view uses `dataTransfer.importing`.
- `locales.test.ts` (key parity) and `plurals.test.ts` cover the new keys automatically. Run both.

### E6. Component tests: `src/features/profile/screens/__tests__/DataTransferScreen.test.tsx`
Use `createTestServices` + `renderWithServices`, with `fileTransferMock` controlling pick/share, and a `DatabaseReplaceContext` test provider capturing the staged path. Cover:
- idle copy
- export: spinner text while pending; `shareFile` called with a `file://…open-kcal-2026-09-25.db` uri (test clock); `shareUnavailable`; `exportFailed` (spy `exportSnapshot` rejects)
- import:
  - picker cancel → nothing
  - `Checking file…`
  - every reason's message (spy `stageImport` rejecting with each `ValidationError` reason + a `DatabaseError`)
  - dialog body with count/date and the empty variant
  - cancel → `discardStaged` called
  - confirm → replace called with the staged path
- unmount during checking → `discardStaged`
- one pt-PT smoke render (ARCH-22)

---

## F. Navigation, checks, progress

### F1. `src/features/profile/__tests__/data-transfer.nav.test.tsx`
- Profile → `Export & import` → back → Profile.
- End-to-end in Jest with real files:
  - Routes = `{ ...appRoutes(), _layout: TestRootLayout }`. `TestRootLayout` is RootLayout with `start={(o) => startServices({ ...o, location: tmpLocation })}`; extract a `RootLayoutView({ start })` from `src/app/_layout.tsx` so the test doesn't copy JSX.
  - Build an import file with `makeDbFile` (v5, 3 entries, a meal named `Ceia`).
  - `__setPickResult({ uri })`.
  - Open the Diary on a past date, then the Profile tab → Export & import → Import → confirm `Replace data`.
  - Assert: `Importing…`, then the Diary root on **today**, toast `Data imported.`, the meal `Ceia` visible, and the Profile tab tap shows the Profile root (not Export & import).
- A dirty Calories & Macros form left open on the Profile stack before the import is gone afterwards, with no `Discard changes?` dialog (NAV-11 answer 4).
- Import with a validation error stays on the screen with the inline message.

### F2. Checks
- Focused while building: `npx jest src/data/db/transfer src/bootstrap src/features/profile src/shared/i18n src/shared/errors`.
- Before each commit and at the end: `npm run format:check` and `npm run check` (lint + `tsc` + full Jest). The CI gate is the same (ROAD-05).
- `grep -rn "expo-file-system" src` → only `src/data/db/transfer/files.ts`. `grep -rn "expo-sharing\|expo-document-picker" src` → only `src/shared/files/fileTransfer.ts` (+ the test mocks).
- ARCH-15 check: `grep -n "logger\." src/data/db/transfer src/bootstrap/StartupGate.tsx`. No path, uri, file name, count or date is logged.

### F3. Progress / known gaps
- `docs/progress.md`: one line for the feature (files, test counts, evidence).
- Known gaps:
  - Native rebuild not done here (3 new native modules).
  - Device check pending on both platforms: export → save to Files/Drive → uninstall/reinstall → import → data back; import an export from an older app version; cancel the share sheet and the picker; kill the app during `Importing…` → relaunch shows `importInterrupted` and the old data.
  - `files.ts` / `fileTransfer.ts` only run on a device (Jest uses Node doubles).
- Root `PROGRESS.md`: the orchestrator owns T1's status. Leave it unless told otherwise.

---

## Edge cases (covered by the plan above; worker checklist)
| Case | Handling |
|---|---|
| Writes during export | `VACUUM INTO` queues on the serial connection; the snapshot is consistent (C2) |
| Uncheckpointed WAL rows | Included by `VACUUM INTO` (tested, C6) |
| Same-day re-export / older cached exports | `export/` cleared first (C2); cleared at next start (D1) |
| Android target still reading after the share sheet returns | File kept until the next export or app start (DATA-30) |
| Huge picked file | Picker `size` checked before any copy; else after the move (C3) |
| WAL-mode file from the user | Staged connection switches to `journal_mode = DELETE`: one file to move (C3) |
| Old export (v1–v6) | Migrated on the staged copy; live DB untouched until confirm (C3) |
| Newer export | `newerVersion`, never downgraded (DATA-17) |
| Shipped migration text reformatted | Structural schema comparison, not SQL text (C3 check 8) |
| Imported DB has no goals row | Step 6 idempotent seed may add the provisional goal (DATA-17); expected |
| Widget redraw during swap | May open/create an empty `main`; staged move overwrites; widget shows unavailable, then `refreshWidget()` after (C4, D2) |
| Widget holds a read lock at checkpoint | `busy_timeout`; still busy → `importFailed`, nothing changed (C4) |
| App killed between marker and step 7 | Next launch rolls back + `importInterrupted` (D1) |
| App killed during step 7 | Safety copy without marker → deleted, import kept (C4) |
| Rollback startup fails | UX-20 recovery; Retry re-runs recovery; never a reset (D2) |
| Unsaved edits on other screens | Discarded by the Router remount, no dialog (NAV-11, answer 4) |
| Back during checking / dialog cancel | Staged copy discarded (E3) |
| Android back while replacing | Consumed by the gate's `BackHandler` (D2) |
| Theme of the imported DB | Preloaded by the normal start path before the Router mounts (UX-23) |
| USDA key | Untouched; availability re-read from secure storage (DATA-01) |
| Disk full on export / staging | `exportFailed` / `errorReadFailed`; partial files removed |
| Privacy | No uri, file name, path or diary data in logs (ARCH-15); the file is unencrypted and the UI says so (`exportPrivacy`) |
