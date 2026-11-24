# Task T10: virtualize Food Search (ARCH-19 known gap)

**User decision needed: one, small.** UX-04 says "Sections with sticky labels" (DS search rule: "Short sticky section labels"). Today's `ScrollView` has no sticky labels at all, so the shipped screen already differs from the spec. A `SectionList` can do it for free (`stickySectionHeadersEnabled`). The plan **turns them on** because that's what the approved spec says. If the user would rather keep the current look, set the prop to `false` instead. It's one line, and nothing else in the plan changes.

Sources: ARCH-19 ("virtualized lists"), `docs/qa/M9/performance-2026-09-28.md` §Known gaps ("Convert it if ... `Show more` depth makes it slow"), `docs/progress.md` §M9 Known gaps (ARCH-19 bullet). UX-04 behaviour, strings, testIDs and a11y stay as they are. No spec text changes.

## Current shape (what has to survive)
`src/features/food-search/screens/FoodSearchScreen.tsx` (846 lines) renders a single `ScrollView` (`keyboardDismissMode="on-drag"`, `keyboardShouldPersistTaps="handled"`, `paddingBottom: spacing[6]`) holding:
1. A context line plus the select-mode ✓✓ and ⚡ icons (`food-search-context`, `food-search-select`, `food-search-quick-calories`).
2. `TabStrip` (`food-search-tab`, tabs `food-search-tab-<id>`).
3. The `deleteFailed` `InlineStatus`.
4. One of 5 bodies:
   - `recent` tab: searching / `emptyRecentTab` / `noResults` / filtered Recent rows.
   - `custom` tab: a `Create custom food` row (`food-create-custom`, hidden in select or ingredient mode), then searching / nothing while loading / empty / `noResults` / rows, then `food-search-custom-show-more`.
   - `recipes` tab: a `Create recipe` row (`food-create-recipe`, hidden in select mode), then the same states, then `food-search-recipes-show-more`.
   - `all` with a query: either a single `Searching…` row, or `visibleSections.map` giving `[offline InlineStatus above the first visible remote section] + sectionContent[id]`, then `noResults` when every visible section is empty and nothing remote is loading.
   - `all` with no query: the `RECENT` header, then the rows or `emptyRecent`.

The select-mode footer, `UndoToast`s and the AppBar search field sit **outside** the ScrollView and stay unchanged.

## Approach: a single `SectionList`, rows as a typed union
Use RN `SectionList` (core). Don't use FlashList: ARCH-20 limits `@shopify/flash-list` to `ServingRuler`, and ROAD/ARCH say no new dependency without a recorded need.

### 1. Row model (in the same file, not exported)
```ts
type SearchRow =
  | { kind: 'food'; key: string; food: Food; rowProps: RowProps }   // FoodResultRow
  | { kind: 'node'; key: string; node: ReactElement };              // status text, InlineStatus, ProviderError, TextAction rows
type SearchSection = { key: string; header?: string; headerTestID?: string; data: SearchRow[] };
```
- `RowProps` = `{ onPress; onDelete?; selected?; dimmed? }`, which is what `storedRowProps(...)` returns today, plus `dimmed` for remote rows.
- `renderItem` for `food` renders `<FoodResultRow food locale energyUnit {...rowProps} />`. For `node` it returns `node`.
- Food rows are the heavy part, so they get the typed variant. Status and action rows are few, and wrapping their existing JSX as `node` keeps the diff small.

### 2. Build `sections: SearchSection[]` instead of JSX
Replace `sectionContent: Record<FoodSearchSectionId, ReactNode>`, `recentTab`, `customTab`, `recipesTab` and the inline `all` branches with one function or block that returns sections. Mapping:

| Body | Sections |
|---|---|
| `all`, no query | `{ key: 'recent', header: t('foodSearch.recent'), data: rows or [node emptyRecent] }` |
| `all`, query, `searching` | `{ key: 'searching', data: [node searchingRow] }` |
| `all`, query | for each `id` of `visibleSections`: if `id === firstVisibleRemote && !online`, first push `{ key: 'offline', data: [node InlineStatus offline] }` (a **header-less section**, so it stays *above* that remote section's sticky header, as now). Then push `{ key: id, header: <same condition as today>, data: [...] }`. Finally, when the "nothing anywhere" condition holds, push `{ key: 'no-results', data: [node noResults] }`. |
| `recent` tab | `{ key: 'tab-recent', data: [...] }` with no header, same branches as `recentTab` |
| `custom` tab | `{ key: 'tab-custom', data: [createCustom node?, ...states/rows, showMore node?] }` |
| `recipes` tab | `{ key: 'tab-recipes', data: [createRecipe node?, ...states/rows, showMore node?] }` |

Per-section `data` keeps today's exact order and conditions:
- `custom` / `saved`: food rows, then `Show more` when `length === pages * 20`.
- `open_food_facts`: `Searching…` (query ≠ `offQuery`), `Searching…` (online && loading && query === `offQuery`), `ProviderError`, rows, `Show more`, `providerNoResults`.
- `usda`: the same pattern with `usdaQuery`.

Copy each condition verbatim. **Why:** existing tests pin them (UX-04/UX-18/PROV-11/PROV-12).

- The header shows only under today's conditions: `custom` when `customFoods.length > 0`, `saved` when `savedFoods.length > 0`, OFF when `query.trim().length >= 3`, USDA when `>= 2`. When there's no header and `data` is empty, drop the section. A section with a header and empty `data` (e.g. the OFF header while offline) stays, because that's what renders today.
- Remote rows are built exactly as today (`id: off-<externalId>` / `usda-<externalId>`, `dimmed={selecting}`, `onPress → onSelectExternal`).
- The paddings that the `View style={{ paddingTop: spacing[2] }}` wrappers gave the 3 tabs move into the tab section. Use `renderSectionHeader` returning a `<View style={{ height: spacing[2] }} />` spacer for `tab-*` sections, or put the same padding on the first node. The result must be pixel-equivalent; check it in the same screenshot pass.

### 3. Keys
- `SectionList` scopes item keys by section, so `keyExtractor={(row) => row.key}` with:
  - food rows: `food.id`, `off-<externalId>`, `usda-<externalId>` (the current React keys);
  - nodes: `<sectionKey>-<role>`, e.g. `off-searching-typing`, `off-searching-loading`, `off-error`, `off-show-more`, `off-no-results`, `custom-create`, `tab-custom-empty`.
- Edge case: on `All`, `customFoods = [...searchedCustom, ...recentRecipes]`. `searchCustom` returns `kind: 'food'` rows only (check `foodsRepository.searchCustom`), so ids can't collide. If they can, dedupe by id before building the rows. Don't change the key scheme to hide it.
- Section keys: `recent`, `searching`, `offline`, `custom`, `saved`, `open_food_facts`, `usda`, `no-results`, `tab-recent`, `tab-custom`, `tab-recipes`.

### 4. The list element
```tsx
<SectionList
  testID="food-search-list"                       // new: test hook only (as T9's weight-history-list)
  sections={sections}
  keyExtractor={(row) => row.key}
  renderItem={renderRow}
  renderSectionHeader={({ section }) => section.header ? (
    <View style={{ backgroundColor: theme.colors.canvas }}>   // opaque so sticky labels don't show rows through them
      <SectionHeader label={section.header} uppercase />
    </View>) : null}
  stickySectionHeadersEnabled                     // UX-04 "sticky labels" (see decision above; RN default is iOS-only)
  ListHeaderComponent={listHeader}                // context line + ✓✓ ⚡, TabStrip, deleteFailed status: the JSX as it is now
  keyboardDismissMode="on-drag"
  keyboardShouldPersistTaps="handled"
  contentContainerStyle={{ paddingBottom: theme.spacing[6] }}
/>
```
- `ListHeaderComponent` takes an **element**, not a component, so the TabStrip and icons keep state and focus across renders.
- Don't set `getItemLayout`: row heights vary (56–64 DS rows, status text, wrapped `InlineStatus`). Don't set `removeClippedSubviews`: it breaks Android a11y focus and swipe rows. Keep the defaults for `initialNumToRender` (10), `windowSize` and `maxToRenderPerBatch`. ARCH-19: "measure before memoizing", so no `React.memo` / `useCallback` / `useMemo` added.
- `sections` is rebuilt on every render, so selection, `dimmed` and the delete state re-render the visible cells. **Don't** memoize `sections` unless `selecting`/`selection` are deps. Otherwise pass `extraData={selection}`, or the select-mode tint goes stale.
- The early `return null` (meal, settings or sections not loaded) stays above everything else.
- Remove `ScrollView` and `Fragment` from the imports. Keep `ReactNode` only if it's still used (`ReactElement` for `node`).

### 5. Behaviour to keep (check each one)
- **Keyboard**: tapping a row while the keyboard is up opens it on the first tap (`handled`), and dragging the list dismisses the keyboard (`on-drag`).
- **Swipe-to-delete** (`SwipeToDelete`, a gesture-handler `Pan`) inside a VirtualizedList: it already works in `DiaryDay`'s FlatList (`DiaryEntryRow`). Vertical scroll vs horizontal swipe is unchanged. The `onDelete` → `UndoToast` flow is untouched.
- **Scroll position** across tab switches, query edits and `Show more`: same component instance, same as the ScrollView. After `Show more` the list grows below, and the anchor doesn't jump.
- **Returning from Food Detail** keeps the query and results: the screen isn't unmounted, so nothing changes.
- **a11y**: `SectionHeader` keeps `accessibilityRole="header"`. Rows keep their labels, actions and states. Sticky headers are plain views, with no extra announcements. TalkBack/VoiceOver traversal order = render order.
- **Select mode**: the footer stays outside the list, and the list's `flex: 1` keeps it above the footer. `SectionList` fills the remaining space by default, as the ScrollView did.
- **Ingredient mode**: no recipes tab and no create row. These are the same conditions, now inside the section builder.

## Edge cases
- `All` + query: every visible section is empty, nothing remote is loading → only `no-results`. While offline, only the `offline` section plus the empty remote headers (today's output).
- Offline while the first visible section is local (`custom`): the offline row sits between `custom` and the first remote section. Keep it as its own header-less section.
- UX-18 order: `saved` first and `custom` hidden, so the header order follows `visibleSections`. A hidden section yields no section.
- A sticky header with zero rows (OFF header offline, or a provider error) must not overlap the next section's header. RN pushes the previous sticky header off; check on a device.
- 5 remote pages × 10 + 20×N local rows: this is the case the task is about. Only the window is mounted.
- Rapid typing: the `searching` section replaces everything, as now. There must be no React key warning when sections swap (the keys are unique per section).
- Empty `data` with no header → section dropped. `SectionList` renders an empty section's header anyway, so dropping it avoids a stray spacer.

## Tests
**Spike first (about 10 minutes):** in Jest, VirtualizedList mounts only `initialNumToRender` (10) cells, because cells never get layout. Several existing assertions need more than 10 cells:
- `FoodSearchScreen.test.tsx:342` (PROV-08 twenty-row paging): `custom-show-more` / `saved-show-more` sit after 20 rows.
- `:355` (OFF + USDA, 10 hits each plus headers and `Show more`): `getAllByTestId(/^food-result-usda-/)` toHaveLength(10).
- `:485` (My foods tab): `toHaveLength(20)` → `21`.

Run them after the change. For each one that fails because the row is outside the window, use the **first** fix that works:
1. A file-local helper `mountAll()` that fires `layout` on `food-search-list` (`{ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 10_000 } } }`), then `contentSizeChange` / `scroll`, so the window covers every row. Check that the cells mount.
2. Otherwise, assert on the data as T9 did: `screen.getByTestId('food-search-list').props.sections` (count food rows, find the `*-show-more` node row and call its `node.props.onPress`).

Don't raise `initialNumToRender` in production to make tests pass. Don't mock `SectionList` / `VirtualizedList` globally in `jest.setup.ts`: other screens' tests rely on the real one.

New and updated tests (`src/features/food-search/__tests__/FoodSearchScreen.test.tsx`):
- `ARCH-19: results render in a virtualized SectionList`: `screen.getByTestId('food-search-list')` is a SectionList (`props.sections` defined, `props.keyboardShouldPersistTaps === 'handled'`, `props.keyboardDismissMode === 'on-drag'`). With `localPaging` and query `al`, there are fewer than 41 `food-result-*` nodes mounted at first while `props.sections` holds all 40 rows. That proves it's windowed.
- `UX-04: section labels are sticky`: `props.stickySectionHeadersEnabled === true` (drop it if the user declines).
- `UX-18: the offline row sits above the first visible remote section`: the section keys in order are `['custom', 'saved', 'offline', 'open_food_facts', 'usda']` when offline. The existing test only counts the row (`:463`).
- Keep every existing test green with no behaviour edits. Only the window/mount mechanics above may change.

Regression suites (unchanged; they must pass): `select-mode.nav.test.tsx`, `my-foods.nav.test.tsx`, `barcode.nav.test.tsx`, `src/features/recipes/__tests__/recipes.nav.test.tsx` (ingredient mode), `src/features/diary/__tests__/quick-calories.nav.test.tsx`.

Maestro (ARCH-18; not runnable here, device needed, T7): `m4-custom-food.yaml` (`food-search-tab-custom`, `food-create-custom`, `food-result-.*`, `food-swipe-.*-delete`, `food-delete-undo`), `m5-offline-foods.yaml`, `m5-offline-local-foods.yaml` (`food-search-input`, results, `food-added-toast`). Every testID is kept, so no flow edits are expected. The rows they tap are near the top, inside the first window.

## Verify
```bash
cd /home/reis/Desktop/open-kcal
npx jest src/features/food-search src/features/recipes/__tests__/recipes.nav.test.tsx \
  src/features/diary/__tests__/quick-calories.nav.test.tsx
npm run lint        # expo lint --max-warnings 0
npm run typecheck   # tsc --noEmit
npm run check       # lint + typecheck + full jest: the gate
```
- `grep -n "ScrollView" src/features/food-search/screens/FoodSearchScreen.tsx` → no matches.
- No new i18n keys (the en/pt-PT key-parity test stays green).
- Device check for the user, optional (T4/T7 are blocked here): Food Search › `al` with many custom/saved foods, `Show more` several times → smooth scroll, sticky labels, swipe-delete + Undo, tapping a row with the keyboard up, select mode in light and dark (sticky header background = canvas), TalkBack/VoiceOver reads the headers as headings.

## Docs (after the code is green)
- `docs/progress.md` §M9 Known gaps: remove the "ARCH-19 (minor): Food Search sections in a `ScrollView`" bullet, and add a dated line under the T9 one, e.g. `- 2026-11-24 T10 (ARCH-19 / UX-04): Food Search renders in a virtualized SectionList (sticky section labels) (<commit>).`
- `docs/qa/M9/performance-2026-09-28.md`: keep the original text and add under Known gaps: `- Fixed 2026-11-24 (T10): Food Search is a SectionList; sections and states unchanged; sticky labels per UX-04.` Optionally fix the table's "Virtualized lists" cell by adding "Food Search (SectionList, T10)".
- `PROGRESS.md`: T10 → `DONE` with a one-line note (the orchestrator does this).
- No spec changes (SCOPE / NAV / DATA / ARCH / DS / UX). Not in scope (note only, don't change): `MyFoodsScreen.tsx` (UX-25/UX-27) is also a paged `ScrollView`. It's the same kind of gap, but it wasn't logged by M9 T4. Mention it in the report as a possible follow-up.

## Commit
`perf(food-search): virtualize results with SectionList (ARCH-19, UX-04)`. Author and committer `ricardo_reis@live.com`, no trailers (AGENTS.md).
