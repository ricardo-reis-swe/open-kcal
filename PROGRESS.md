# Orchestrator task list (from TODO.md, 2026-11-24)

| ID | Task | Status | Note |
|---|---|---|---|
| T1 | Backup / export of the diary | DONE | Profile › APP "Export & import": SQLite export via VACUUM INTO + share sheet; import validates a staged copy, migrates it, swaps with safety copy + crash-marker rollback; specs SCOPE-14, DATA-30–32, NAV-11, ARCH-25, UX-29, POST-17. Needs native rebuild + device check. |
| T2 | Release v0.2.0 | BLOCKED | Cancelled for now by user (2026-11-24); no push or release until they say. |
| T3 | ROAD-04 release smoke test + accept M9 | BLOCKED | Needs a device and user acceptance. |
| T4 | Device checks (recipe share between phones, ingredient barcode scan, widget cold start + midnight rollover) | BLOCKED | Needs physical devices. |
| T5 | Docs gap: add an "Ingredient barcode scan" section to docs/progress.md (moved into MVP 14 Oct) | DONE | Added status row + section with spec IDs and commit ee34d4b. |
| T6 | Review pt-PT strings | BLOCKED | Needs the user (native-language review). |
| T7 | Run Maestro E2E suite (ARCH-18) | BLOCKED | Needs a device/emulator; none here. |
| T8 | `m8-weight` SIGSEGV on Android launch | BLOCKED | Seen once, not reproduced; needs a device. |
| T9 | Performance: limit `weight.history()` | DONE | history(limit) reads LIMIT+1 with same-day count in SQL; Weight History pages 100 at a time; docs updated. |
| T10 | Performance: Food Search uses a virtualized list instead of `ScrollView` | DONE | Food Search body is one SectionList (sticky labels per UX-04, testIDs kept); tests read list data; docs updated. |
| T11 | POST-08: weekly CI check of USDA + Open Food Facts schemas against live APIs | DONE | Weekly + manual `live-providers.yml` runs `npm run test:live` with the real clients (DEMO_KEY fallback, schema/404/key = fail, network/429/5xx = warn); POST-08 in MVP, ARCH-14 test-only CI key. User still to add USDA_API_KEY secret. |
