# M9 T4: ARCH-19 performance checks (2026-09-28)

Code-level review. No device profiling, because the user ruled out device tests for M9.

| ARCH-19 item | Result |
|---|---|
| Indexed, bounded queries | Diary day `diary_entries (diary_date, meal_id, sort_order)`; goals `effective_from DESC` + `LIMIT 1`; weight `measured_at DESC`; recents `last_used_at DESC` + `LIMIT`; food search `LIMIT/OFFSET` pages of 20. Exceptions: food name/brand `LIKE '%token%'` can't use an index (accepted in PROV-08, bounded by `LIMIT`); `weight.history()` reads every weight entry (see gaps). |
| Totals aggregated in SQL | Meal and day totals, including the unknown-macro counts, come from one `SUM`/`COUNT` query grouped by meal (`diaryRepository.ts`). |
| Debounce + cancel stale remote search | Local 150 ms; USDA ≥2 chars / 400 ms; OFF ≥3 chars / 800 ms + limiter (PROV-04); `AbortController` + stale-response guard (PROV-08). Hidden sections send nothing (UX-18, M9 T1). |
| Paginate providers and large lists | Remote 10 per page, cap 5 pages (PROV-08); local sections 20 per page + `Show more`; weight list paged API exists. |
| Virtualized lists | Diary day (`DiaryDay`), date strip (windowed FlatList), Weight History (FlatList). Food Search is a `ScrollView`, bounded by paging (see gaps). |
| Ruler off the JS thread | `ServingRuler` runs on Reanimated worklets (M4). |
| No sync SQLite in interaction paths | No `*Sync` SQLite calls in app code (only in the Node test adapters). |
| Measure before memoizing | No speculative memoization found worth removing. |

## Known gaps (minor, not fixed)
- `weight.history()` has no `LIMIT`, because each row's change needs its predecessor. That's fine at realistic sizes (about 365 rows a year) since the list is virtualized. Page it (fetch limit + 1) if history grows large.
- Food Search renders its sections in a `ScrollView`, not a virtualized `SectionList`. Rows are bounded by paging (remote at most 50 per section, local 20 per `Show more`). Convert it if a heavy user's `Show more` depth makes it slow.
