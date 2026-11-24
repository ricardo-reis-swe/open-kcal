# Orchestrator task list (from TODO.md, 2026-11-24)

| ID | Task | Status | Note |
|---|---|---|---|
| T1 | Backup / export of the diary | BLOCKED | Needs user-approved spec change: DATA-02 says nothing may imply backup/sync exists. |
| T2 | Release v0.2.0 | BLOCKED | Outward-facing release; user does it (docs/releasing.md). |
| T3 | ROAD-04 release smoke test + accept M9 | BLOCKED | Needs a device and user acceptance. |
| T4 | Device checks (recipe share between phones, ingredient barcode scan, widget cold start + midnight rollover) | BLOCKED | Needs physical devices. |
| T5 | Docs gap: add an "Ingredient barcode scan" section to docs/progress.md (moved into MVP 14 Oct) | DONE | Added status row + section with spec IDs and commit ee34d4b. |
| T6 | Review pt-PT strings | BLOCKED | Needs the user (native-language review). |
| T7 | Run Maestro E2E suite (ARCH-18) | BLOCKED | Needs a device/emulator; none here. |
| T8 | `m8-weight` SIGSEGV on Android launch | BLOCKED | Seen once, not reproduced; needs a device. |
| T9 | Performance: limit `weight.history()` | DONE | history(limit) reads LIMIT+1 with same-day count in SQL; Weight History pages 100 at a time; docs updated. |
| T10 | Performance: Food Search uses a virtualized list instead of `ScrollView` | TODO | |
| T11 | POST-08: weekly CI check of USDA + Open Food Facts schemas against live APIs | TODO | |
