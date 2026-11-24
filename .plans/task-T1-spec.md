# Task T1: spec-change proposal: export / import the whole diary (DB file)

Status: **PROPOSAL, not applied.** Nothing in `docs/` or `src/` is edited by this task. The user approves (or edits) each block below; a worker then copies the approved wording into the docs in one commit.

User decision (2026-11-24): v1 backup = export the whole SQLite DB file through the OS share sheet; import = pick a file, validate it, replace the current DB, run migrations.

Concurrent work: another agent is editing ROAD-05 / ARCH-14 / POST-08. This proposal touches ROAD-06 and ARCH-13 only by appended lines; apply after that work lands to avoid conflicts.

New IDs (appended, nothing renumbered): SCOPE-14 · NAV-11 · DATA-30, DATA-31, DATA-32 · ARCH-25 · UX-29 · POST-17. Changed: SCOPE-01, SCOPE-10, DATA-02, DATA-17 (one bullet), NAV-02, NAV-06, NAV-08, ARCH-05, ARCH-18 (one row each), UX-15, UX-19, UX-20, ROAD-06 (one bullet), `docs/releasing.md` note.

---

## 1. SCOPE (`docs/01-scope.md`)

**SCOPE-01**: append bullet:
```md
- Export and import all data as one file (user decision 2026-11-24; SCOPE-14).
```

**SCOPE-10**: change `cloud sync` → `cloud sync or automatic/cloud backup`:
```md
Accounts · cloud sync or automatic/cloud backup · social · meal plans · …(rest unchanged)
```

**SCOPE-14** (new, appended):
```md
## SCOPE-14 Export and import
- User decision 2026-11-24. Profile › `Export & import` (UX-29).
- Export: one file holding the whole local database, handed to the OS share sheet. The user picks where it goes (Files, Drive, email, another app). The app never uploads anything itself.
- Import: pick an exported file → validate → confirm → it **replaces** all data on this phone → migrations bring it to this app version. No merge.
- Not exported: the USDA API key (secure storage, DATA-01). It stays on the phone that has it.
- **Why:** with no backend (SCOPE-09), uninstalling (e.g. a ROAD-06 signing-key change) or losing the phone deletes the diary. A manual file is the only backup; it adds no account, server or sync (SCOPE-10).
- Deferred: encryption, scheduled/automatic export, merge import, CSV (POST-17).
```

## 2. DATA (`docs/03-data.md`)

**DATA-02** (replace the bullet):
```md
## DATA-02 No backend, no sync
- No user IDs, server revisions or sync state. UUIDs and timestamps are kept so a future migration stays possible.
- The only backup is the manual file export/import (SCOPE-14, DATA-30–32). Nothing may imply automatic backup or sync exists: no "backed up", "synced" or "last backup" status, no reminders.
```

**DATA-17**: append bullet:
```md
- An imported file is migrated like an older install (DATA-31). A file newer than the app is refused, never downgraded.
```

**DATA-30** (new):
```md
## DATA-30 Export
- `exportDatabase()` in the data layer (DATA-18). Steps:
  1. `VACUUM INTO ?` on the app connection, to a new file in `<cache>/export/`. **Why:** one consistent snapshot, WAL contents included, no `-wal`/`-shm` side files, free pages dropped. It reads only; concurrent app writes wait or land after the snapshot.
  2. Hand the file to the share sheet (ARCH-25), MIME `application/vnd.sqlite3`, iOS UTI `public.database`.
- File name: `open-kcal-YYYY-MM-DD.db`, the local date (DATA-08). A second export the same day overwrites the cached file.
- The cached file is kept until the next export or the next app start, then deleted. **Why:** Android returns from the share sheet before some targets finish reading the file.
- Contents: the whole DB as is, including `schema_version`, cached provider foods and soft-deleted rows. No extra header, manifest or encryption (POST-17).
- Share sheet dismissed or cancelled → not an error, nothing shown.
```

**DATA-31** (new):
```md
## DATA-31 Import validation
- The picked file is copied to `<cache>/import/staged.db` first; the live DB is not touched until DATA-32. All checks run on the staged copy, on its own connection (`useNewConnection`), in this order; the first failure stops with `ValidationError` + `reason`:

| # | Check | `reason` |
|---|---|---|
| 1 | Size > 0 and ≤ 200 MB | `empty` / `tooLarge` |
| 2 | First 16 bytes = `SQLite format 3\0` | `notSqlite` |
| 3 | Opens; `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` returns no rows | `corrupt` |
| 4 | `schema_version` exists with a version ≥ 1 | `notOpenKcal` |
| 5 | Version ≤ `LATEST_SCHEMA_VERSION` | `newerVersion` |
| 6 | Every table its version requires exists (`schema_version, app_settings, nutrition_goals, meals, foods, food_servings, diary_entries, weight_entries, recent_foods, food_cache_metadata`; ≥ v4 also `food_nutrients, diary_entry_nutrients`; ≥ v7 also `recipes, recipe_ingredients`) | `notOpenKcal` |
| 7 | Migrate the staged copy with `migrate()` (DATA-17, no seed) | `migrationFailed` |
| 8 | Its schema (tables, columns, indexes from `sqlite_master` + `table_info`) equals a fresh DB built from `MIGRATIONS` | `notOpenKcal` |
| 9 | Exactly 1 `app_settings` row and ≥ 1 meal (DATA-10) | `notOpenKcal` |

- `reason` is a typed field, never parsed from the message (ARCH-13).
- After check 9, read a summary for the confirm dialog (UX-19): diary entry count and latest `diary_date`.
- **Why migrate before the swap:** a migration failure then never touches the live DB.
- Unknown extra tables or columns fail check 8. **Why:** an Open Kcal export never has them; anything else isn't ours.
```

**DATA-32** (new):
```md
## DATA-32 Replace and rollback
- Runs only after the user confirms (UX-19). One app-level operation, never concurrent with app reads/writes:
  1. Close the staged connection.
  2. Stop the app: StartupGate leaves `ready` (Router, services and the Query client unmount), `PRAGMA wal_checkpoint(TRUNCATE)`, close the app connection.
  3. Write marker `<db dir>/import-pending`.
  4. Rename `calorie-tracker.db` → `calorie-tracker.pre-import.db` (safety copy); delete leftover `-wal`/`-shm`.
  5. Move `staged.db` → `calorie-tracker.db`.
  6. Normal startup (ARCH-17: pragmas → migrate (no-op) → idempotent seed).
  7. Success → delete the marker, then the safety copy.
- Failure in steps 4–6 → close, delete the new file, rename the safety copy back, delete the marker, normal startup. The user sees `importFailed` (data unchanged). If that startup also fails → UX-20 recovery screen (never a reset, DATA-17).
- Launch with `import-pending` present (the app died mid-import) → roll back as above before opening, and show UX-29 `importInterrupted` once on the Diary. **Why:** an import applies completely or not at all.
- The staged copy and the cache folders are deleted after success, failure or cancel.
- After success: a new Query client (no stale cache, ARCH-07), Diary root on today (NAV-05 fresh launch), `refreshWidget()` (DATA-22: not a mutation, so call it explicitly). Also call it after a rollback.
- The USDA key and its secure-storage availability are untouched; availability is still read from secure storage (DATA-01).
```

## 3. NAV (`docs/02-navigation.md`)

**NAV-02** tree, Profile Stack: add `Export & Import` after `Import Recipe`.

**NAV-06** table:
- `Profile` row: append `Export & Import` to the row list (after Theme).
- New row:
```md
| Export & Import | UX-29. `Export data` → share sheet; stays on this screen. `Import data` → document picker → validation → `Replace all data?` (NAV-08) → replace (DATA-32) → Diary root on today with `Data imported.`. Cancel anywhere → this screen, nothing changed. Back → Profile (disabled while an import runs). |
```

**NAV-08**: append `· replacing all data with an imported file` to the list.

**NAV-11** (new):
```md
## NAV-11 Import restart
- A successful import remounts the Router (DATA-32): every stack resets, both tabs return to root, the Diary shows today. No route carries import state.
- System back and the Android back button are ignored while an import replaces data (an in-place progress state, no route).
```

## 4. ARCH (`docs/04-architecture.md`)

**ARCH-05**: route tree, Profile: add `data-transfer`. Code: `src/data/db/transfer/{exportDatabase,validateImport,replaceDatabase}.ts`, screen in `src/features/profile/` (or a new `features/data-transfer/` if the user prefers).

**ARCH-13**: no new error type. `ValidationError` gets an optional typed `reason` (DATA-31). Copy/rename failures → `DatabaseError`.

**ARCH-15**: append bullet:
```md
- Export/import log only outcome category, `reason`, schema version, size bucket and duration. Never file URIs or names (cloud-provider URIs can hold account names).
```

**ARCH-18**: Repository/migration row, append `export snapshot, every DATA-31 reason, DATA-32 rollback + interrupted-import recovery`.

**ARCH-25** (new):
```md
## ARCH-25 Export and import (SCOPE-14)
- Libraries (Expo-maintained, `npx expo install`, pinned; ARCH-20):
  - `expo-sharing` (new): share sheet with a file. Rejected: RN `Share` (Android shares text only, not a file URI).
  - `expo-document-picker` (new): pick the file, `copyToCacheDirectory: true`, `type: '*/*'`. **Why `*/*`:** providers report `.db` files as `application/octet-stream`; validation decides (DATA-31).
  - `expo-file-system` (new direct dep; today only a transitive dep of `expo`): read the 16-byte header, size, copy/move/delete files, cache paths.
  - `expo-sqlite` (installed): `VACUUM INTO`, staged connection via `openDatabaseAsync(name, { useNewConnection: true }, directory)`, `defaultDatabaseDirectory`.
- No config plugins or permissions: the picker and share sheet are system UI. Needs a native rebuild (new native modules).
- Only `src/data/db/transfer/` imports `expo-file-system`; only a small `shareFile` / `pickFile` service (behind an interface, `src/shared/`) imports `expo-sharing` / `expo-document-picker`.
- StartupGate gets a `replacing` state and a `replaceDatabase(stagedPath)` entry point; it owns stop → swap → restart (DATA-32) so no screen holds a closed DB.
- The widget handler (ARCH-23) needs no change: during a swap it may fail to open → unavailable state; the post-import `refreshWidget()` redraws it.
```

## 5. UX (`docs/06-screens.md`)

**UX-15** wireframe, under `APP`: add `[Export & import                        › ]` after Theme. No value text (DATA-02: no "last backup").

**UX-19** table, new row:
```md
| Import data (UX-29) | `Replace all data?` | `This phone's diary, foods, recipes, meals, goals and weight will be replaced by the file (<n> entries, latest <date>). This can't be undone.` | `Replace data` |
```

**UX-20**: append `- An interrupted import is rolled back before this screen could appear (DATA-32).`

**UX-29** (new):
```md
## UX-29 Export & Import
[Export & import                          ]
[Your data is stored only on this phone.  ]
[EXPORT                                   ]
[Export data                              ]
[  One file with all your data. …         ]
[  The file isn't encrypted. …            ]
[IMPORT                                   ]
[Import data                              ]
[  Replaces all data on this phone. …     ]
- Two `ListRow`s with helper text under each; no app-bar primary action (UX-00 exception: actions, not a form).
- Export: row shows an inline spinner `Preparing file…` until the share sheet opens; the row is disabled meanwhile. Failure → inline error under the row `Couldn't export. Try again.` Sharing unavailable → `Sharing isn't available on this device.`
- Import: picker → inline `Checking file…` → validation error inline under the row (DATA-31 message per `reason`), or the UX-19 dialog → `Importing…` full-screen state with the app bar back disabled (NAV-11) → Diary + toast `Data imported.`
- Picker or dialog cancelled → nothing shown.
- `importInterrupted` toast once on the Diary after a launch rollback (DATA-32).
- Haptics: none (DS-10).
```

## 6. ROAD / releasing

**ROAD-06** › Android signing, last bullet: append `Export data first (SCOPE-14) and import it after reinstalling.`
`docs/releasing.md` line 113 note: append the same sentence.
(ROAD-05 is being edited by another agent; this touches only ROAD-06.)

## 7. POST (`docs/post-mvp.md`)

**POST-17** (new):
```md
## POST-17 Backup extras
- Encrypted export (password), scheduled/automatic export to a user-chosen folder, merge import, CSV/JSON export for other apps, a "last exported" date. Deferred by user decision 2026-11-24: v1 is a plain manual file (SCOPE-14).
```

---

## UI strings (en + pt-PT; new keys, ARCH-22)

| Key | en | pt-PT |
|---|---|---|
| `profile.dataTransfer` | Export & import | Exportar e importar |
| `dataTransfer.title` | Export & import | Exportar e importar |
| `dataTransfer.intro` | Your data is stored only on this phone. Export a copy to keep it safe or move it to another phone. | Os seus dados estão guardados apenas neste telemóvel. Exporte uma cópia para a guardar em segurança ou passá-la para outro telemóvel. |
| `dataTransfer.exportSection` | Export | Exportar |
| `dataTransfer.export` | Export data | Exportar dados |
| `dataTransfer.exportHelp` | Creates one file with all your data. Choose where to save or send it. | Cria um ficheiro com todos os seus dados. Escolha onde o guardar ou para onde o enviar. |
| `dataTransfer.exportPrivacy` | The file isn't encrypted. It contains your diary and weight history. | O ficheiro não está encriptado. Contém o seu diário e o histórico de peso. |
| `dataTransfer.exporting` | Preparing file… | A preparar o ficheiro… |
| `dataTransfer.shareTitle` | Export Open Kcal data | Exportar dados do Open Kcal |
| `dataTransfer.exportFailed` | Couldn't export. Try again. | Não foi possível exportar. Tente novamente. |
| `dataTransfer.shareUnavailable` | Sharing isn't available on this device. | A partilha não está disponível neste dispositivo. |
| `dataTransfer.importSection` | Import | Importar |
| `dataTransfer.import` | Import data | Importar dados |
| `dataTransfer.importHelp` | Replaces all data on this phone with an exported file. | Substitui todos os dados deste telemóvel por um ficheiro exportado. |
| `dataTransfer.checking` | Checking file… | A verificar o ficheiro… |
| `dataTransfer.importing` | Importing… | A importar… |
| `dataTransfer.confirmTitle` | Replace all data? | Substituir todos os dados? |
| `dataTransfer.confirmBody_one` / `_other` | This phone's diary, foods, recipes, meals, goals and weight will be replaced by the file ({{count}} entry / entries, latest {{date}}). This can't be undone. | O diário, os alimentos, as receitas, as refeições, os objetivos e o peso deste telemóvel serão substituídos pelo ficheiro ({{count}} registo / registos, o último a {{date}}). Não é possível anular. |
| `dataTransfer.confirmBodyEmpty` | …replaced by the file (no diary entries). This can't be undone. | …substituídos pelo ficheiro (sem registos no diário). Não é possível anular. |
| `dataTransfer.confirmAction` | Replace data | Substituir dados |
| `dataTransfer.imported` | Data imported. | Dados importados. |
| `dataTransfer.importInterrupted` | The last import didn't finish. Your previous data was kept. | A última importação não terminou. Os dados anteriores foram mantidos. |
| `dataTransfer.errorEmpty` | This file is empty. | Este ficheiro está vazio. |
| `dataTransfer.errorTooLarge` | This file is too large to be an Open Kcal export. | Este ficheiro é demasiado grande para ser uma exportação do Open Kcal. |
| `dataTransfer.errorNotOpenKcal` | This file isn't an Open Kcal export. | Este ficheiro não é uma exportação do Open Kcal. |
| `dataTransfer.errorCorrupt` | This file is damaged and can't be imported. | Este ficheiro está danificado e não pode ser importado. |
| `dataTransfer.errorNewerVersion` | This file comes from a newer version of Open Kcal. Update the app, then try again. | Este ficheiro vem de uma versão mais recente do Open Kcal. Atualize a aplicação e tente novamente. |
| `dataTransfer.errorReadFailed` | Couldn't read the file. Try again. | Não foi possível ler o ficheiro. Tente novamente. |
| `dataTransfer.importFailed` | Couldn't import. Your data wasn't changed. | Não foi possível importar. Os seus dados não foram alterados. |

`notSqlite` and `notOpenKcal` share `errorNotOpenKcal`; `migrationFailed` uses `importFailed`. Confirm/cancel buttons reuse `common.cancel`. The confirm `{{date}}` is formatted with `Intl` in the app locale (ARCH-22).

## Error cases (summary)

| Case | Result |
|---|---|
| Share sheet / picker cancelled | Nothing shown |
| `VACUUM INTO` or file write fails (disk full) | `exportFailed`; cache file deleted |
| Sharing unavailable | `shareUnavailable` |
| Picker copy fails / unreadable URI | `errorReadFailed` |
| DATA-31 reasons 1–9 | Message per reason; live DB untouched |
| Newer schema | `errorNewerVersion` |
| Swap or restart fails | Rollback → `importFailed`; if rollback startup fails → UX-20 |
| App killed mid-swap | Rollback on next launch → `importInterrupted` |
| Import while a form is dirty elsewhere (other tab) | Lost by the Router remount; the confirm dialog's "replaces all data" covers it (see Q4) |

## Tests (ARCH-18)
- **Repository/migration (real SQLite, Node driver):** export produces a single valid file whose rows match the source, including uncheckpointed WAL writes; export of a fresh-install DB and of a populated v7 DB.
- **Validation:** one test per `reason` (empty, oversize via stub, random bytes, non-Open-Kcal SQLite, corrupted page, FK violation, version 8 > latest, missing table, extra table/column, zero meals); fixtures for every prior version v1–v6 migrate and pass; v7 passes unchanged.
- **Replace:** success swaps and reopens with the imported data; injected failure at steps 4, 5, 6 restores the original byte-for-byte; marker present at launch → rollback; staged/cache files cleaned.
- **Component (RNTL):** UX-29 states (idle, exporting, checking, each error message, importing), dialog copy with count/date, cancel paths; pt-PT smoke render.
- **StartupGate:** `replacing` state unmounts children, creates a new Query client, calls `refreshWidget()`; the Diary opens on today.
- **Navigation:** Profile → Export & Import → back; post-import lands on Diary root.
- `expo-sharing`, `expo-document-picker`, `expo-file-system` mocked per suite (as `expo-camera`). i18n key-parity test covers the new keys.
- **Manual device check (both platforms):** export → save to Files/Drive → uninstall/reinstall → import → data back; import an export from an older app version.

## Libraries
| Package | Status | Use |
|---|---|---|
| `expo-sqlite` 57.0.3 | installed | `VACUUM INTO`, staged connection, integrity checks |
| `expo-file-system` ~57.0.7 | **new direct dep** (already in the lockfile as a transitive dep of `expo`) | header read, size, copy/move/delete, cache dir |
| `expo-sharing` ~57.0.22 | **new** (native) | share sheet with a file |
| `expo-document-picker` ~57.0.2 | **new** (native) | pick the import file |
All three are Expo-maintained, SDK-57 versions from `bundledNativeModules.json`, no config plugin, no permissions. They need a native rebuild and an ARCH-20 note (ARCH-25 above).

## Open questions (user only)
1. **Approve the scope change**: SCOPE-14 in the MVP + the DATA-02 rewording (manual export now *is* a backup; still no automatic/cloud backup)?
2. **Unencrypted file OK for v1?** It holds the diary and body weights in plain SQLite; the user decides where it goes. (Encryption → POST-17.)
3. **Profile row name / placement**: `Export & import` under `APP`, as proposed, or another label (e.g. `Backup`)?
4. **Import while unsaved edits exist elsewhere**: accept losing them (the dialog says all data is replaced), or block import while any form is dirty?
