# Task T9: bound `weight.history()` (ARCH-19 known gap)

**User decision needed: none.** No spec requires loading the full weight history at once:
- UX-18 Weight History: "newest first, virtualized"; each row shows date (+ time when several on one day), weight, and the change vs the previous entry. It says nothing about a page size, a `Show more` row or a total count.
- UX-15 Profile only uses `current()`, which already has `LIMIT 1`.
- There is no weight chart or trend in the MVP (SCOPE: "Body weight: current, goal, history"). `history()` has one caller: `useWeightHistory` → `WeightHistoryScreen`.
- ARCH-19 asks for "paginate ... large lists". Sources: `docs/qa/M9/performance-2026-09-28.md` §Known gaps ("Page it (fetch limit + 1)") and `docs/progress.md` §M9 Known gaps.

So we load more rows invisibly as the list scrolls. The rows look and read the same as now, and the plan adds no new UI or strings.

## Why it isn't just `LIMIT n`
Each row gets two values from data next to it:
1. **`changeKg`** needs the next older entry. If the oldest loaded row isn't the last entry overall, it would wrongly show as "first" (`rowFirst` label, no change). Fix: fetch `limit + 1` rows. The extra row is only used for the change and to know there's more; it isn't shown.
2. **`showTime`** needs to know how many entries share the row's `local_date`. If a page ends in the middle of a day, the last loaded row would lose its time. Fix: get the same-day count in SQL with a correlated subquery that uses `idx_weight_local_date (local_date, measured_at DESC)`. That's one indexed lookup per returned row, so the work stays bounded.

## Files to change

### 1. `src/data/db/repositories/weightRepository.ts`
- Add `export const WEIGHT_HISTORY_PAGE = 100;`. That's about 3 months of daily weigh-ins and fills several screens. Its only job is to keep the read bounded; users never see it.
- Replace `history()` with `history(limit: number)`, which returns `Promise<{ entries: WeightHistoryEntry[]; older: WeightEntry | null }>`:
  ```sql
  SELECT id, measured_at, local_date, weight_kg, created_at,
         (SELECT COUNT(*) FROM weight_entries d WHERE d.local_date = w.local_date) AS same_day
  FROM weight_entries w
  ORDER BY measured_at DESC, created_at DESC
  LIMIT ?          -- limit + 1
  ```
  - `entries` = the first `limit` rows, mapped to `WeightEntry & { sameDayCount: number }`. Export the type `WeightHistoryEntry`, or put it in `domain/weight/weight.ts`.
  - `older` = row `limit + 1` (mapped with `toWeight`), or `null`. `older !== null` means there are more rows.
  - Validate the argument: if `limit` isn't a positive integer, throw `ValidationError('Invalid limit', ['limit'])`. Don't fall back to the old unbounded read.
  - Update the doc comment: cite ARCH-19 and UX-18, and remove "Every entry ... needs the full list".
- Keep `ORDER` as it is. Don't use OFFSET: every load is a single query with a growing `LIMIT`, so rows can't drift or repeat between pages when writes happen in between. **Why:** an OFFSET page plus a write in between would skip or repeat a row.
- Leave `list(limit, offset)` alone. Only tests call it today.

### 2. `src/domain/weight/weight.ts`
- `weightHistoryRows(newestFirst, older: WeightEntry | null = null)`:
  - `changeKg` for the last row = `entry.weightKg - older.weightKg` when `older` is set, else `null`, as now.
  - `showTime`: use `entry.sameDayCount > 1` when the entry has `sameDayCount`. Otherwise use the current in-list count, which keeps the existing domain tests and any caller that passes plain entries working.
  - Keep the generic `T extends WeightEntry`. Update the JSDoc.

### 3. `src/features/profile/profile.queries.ts`
- `useWeightHistory(pages = 1)`:
  - `queryKey: [...weightKeys.history, pages]`. It stays under `weightKeys.all`, so `useWeightWrites`' `invalidateQueries({ queryKey: weightKeys.all })` still refreshes it.
  - `queryFn: () => weight.history(pages * WEIGHT_HISTORY_PAGE)`.
  - `placeholderData: keepPreviousData` (TanStack v5). Without it, raising `pages` makes `data` undefined for a moment. The screen then renders `rows = null`, so the list disappears and the scroll position is lost.
- Same shape as `useCustomFoodList(pages)` / `useRecipeList(pages)`, except it's one query with a growing LIMIT instead of a `Promise.all` of offset pages, for the reason given in step 1.

### 4. `src/features/profile/screens/WeightHistoryScreen.tsx`
- `const [pages, setPages] = useState(1)`; `const history = useWeightHistory(pages)`.
- `rows = history.data ? weightHistoryRows(history.data.entries, history.data.older) : null`.
- FlatList: `onEndReached={() => { if (history.data?.older && !history.isFetching) setPages((p) => p + 1); }}` and `onEndReachedThreshold={0.5}`. This is the same mechanism as `DiaryDateStrip`.
- No footer spinner, no `Show more` row, no new strings. UX-18 is unchanged and pt-PT has no new keys.
- Empty state: `entries.length === 0` behaves exactly as now.
- Don't reset `pages` after a write. It stays as it is: an add moves one row out past the window, which is fine; a delete pulls one in.

## Edge cases to cover
- No entries: `entries` = `[]`, `older` = `null`, empty state.
- Exactly `limit` entries: `older` = `null`, no more pages, and the oldest row shows "first" (no change).
- `limit + 1` entries: the oldest shown row has a change computed against the hidden `older` row.
- A day split by the page boundary, for example 3 entries on one date with the boundary after the first: the last shown row has `showTime` = true.
- Same `measured_at` with tie-break on `created_at` (DATA-13) at the boundary: order stays the same as `current()`.
- A write while several pages are loaded: the refetch uses the same `pages`, and the list doesn't blank (`keepPreviousData`).
- `onEndReached` on a short list, or while a fetch is running, must not loop: guard on `older` and `!isFetching`.
- `limit` of 0, negative, or not an integer: `ValidationError`.

## Tests

| File | Change |
|---|---|
| `src/data/db/repositories/__tests__/weight.test.ts` | New `describe('ARCH-19 / UX-18: history is bounded')`: (a) 5 entries, `history(3)` → 3 entries newest first, `older` = 4th; (b) `history(5)` → `older` null; (c) split day: 3 entries on one date and an older date, `history(1)` → `entries[0].sameDayCount === 3`; (d) `history(0)` rejects with `fields: ['limit']`. |
| `src/domain/weight/__tests__/weight.test.ts` | `UX-18` describe: `older` gives the last row its change; `sameDayCount` overrides the in-list count; the old call with no second argument still passes. |
| `src/features/profile/__tests__/profile.queries.test.tsx` | Update the existing `UX-14 / DATA-13` test for the `{ entries, older }` shape (`history.data.entries`). |
| `src/features/profile/screens/__tests__/WeightHistoryScreen.test.tsx` | Add: seed `WEIGHT_HISTORY_PAGE + 2` entries (spread over past dates, all inside the 20–500 kg range). Assert that the row at index `WEIGHT_HISTORY_PAGE - 1` has a change in its a11y label (`/, −?\d.*$/`, not the `rowFirst` form). Fire `onEndReached` on the FlatList (`fireEvent(screen.getByTestId(...).parent..., 'onEndReached')`, or give the FlatList `testID="weight-history-list"`) and assert that `weight-history-row-${WEIGHT_HISTORY_PAGE + 1}` appears. Keep the pt-PT smoke test. |
| `src/features/profile/__tests__/weight.nav.test.tsx` | Should pass unchanged (testIDs and labels are the same). Run it as a regression check. |

Adding a FlatList `testID` is a test hook only, not a UX change.

## Verify
```bash
cd /home/reis/Desktop/open-kcal
npx jest src/data/db/repositories/__tests__/weight.test.ts src/domain/weight/__tests__/weight.test.ts \
  src/features/profile/__tests__/profile.queries.test.tsx \
  src/features/profile/screens/__tests__/WeightHistoryScreen.test.tsx \
  src/features/profile/__tests__/weight.nav.test.tsx
npm run check   # lint (0 warnings) + tsc + full jest
```
- `grep -rn "\.history(" src` should find only the new call and the tests.
- Optional, on a device: Profile › Weight history with more than 100 entries (dev seed) scrolls smoothly, the row before the boundary shows its change, and Update weight / edit / delete refresh the list without it jumping to the top.

## Docs (after the code is green)
- `docs/progress.md` §M9 Known gaps: remove the `weight.history()` part of the ARCH-19 bullet, and add a dated line under a T9 note that cites ARCH-19 / UX-18 and the commit.
- `docs/qa/M9/performance-2026-09-28.md`: keep the original text; add a line under Known gaps: "Fixed in T9 (`<commit>`): paged by growing LIMIT + 1; same-day count in SQL."
- No spec (SCOPE / NAV / DATA / ARCH / UX) changes.

## Commit
`fix(weight): page Weight History reads (ARCH-19, UX-18)`. Author and committer `ricardo_reis@live.com`, no trailers (AGENTS.md).
