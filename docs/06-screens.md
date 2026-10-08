# 06 Screens (UX)

Read when: building a specific screen, sheet or dialog. Only screen-specific behavior lives here. Components and styling: DS. Routes and returns: NAV. Data rules: DATA. Wireframes show order, not pixels.

## UX-00 Shared rules (apply to every screen unless a card says otherwise)
- **Copy**: quoted UI text is the English source string; each one is an i18n key with a pt-PT translation (ARCH-22).
- **App bar**: back on every non-root screen; title = screen name unless stated.
- **Primary action**: one labelled text action at the top-right of the app bar (or sheet header), using concise `Add` / `Save` copy. It remains visible with the keyboard open and is disabled until the form is valid; in edit mode also until something changed. There is no duplicate bottom button.
- **Delete** (edit modes): a danger text action at the end of the content, never next to the primary. Always confirmed (UX-19).
- **Leaving a dirty form**: silently discards, EXCEPT Create Custom Food and Calories & Macros, which ask **Discard changes?** (UX-19). Back, swipe-back and the close button share this path (ARCH-06).
- **Validation**: on blur and on submit; the message sits under the field (DS-09) and clears as soon as the value is valid.
- **Keyboard**: Return → next field; on the last field Return submits if valid. Integer fields use `number-pad`, decimal fields `decimal-pad`. Scrolling a list dismisses the keyboard.
- **Units in inputs**: energy fields follow `energy_unit`, body weight `weight_unit`, food mass/volume the food/volume unit. Ranges below are canonical and converted for display.
- **Save failure**: stay on the screen, keep the input, show an inline error after the form content (`Couldn't save. Try again.`).
- **Loading**: local screens render directly. Show a skeleton only if a load takes >300 ms.
- **Not found** (bad params, or the record was deleted from another tab): replace content with `This item no longer exists.` + a button back to the stack root.
- **Number display**: kcal/kJ as integers with grouping; macros as integers ≥10 g and 1 decimal <10 g. A fully unknown macro aggregate shows the known sum `0` with its unknown indicator and screen-reader explanation (see DATA-06). Body weight uses 1 decimal.

| Field | Valid range (canonical) |
|---|---|
| Food / Quick Calories energy | 1–10,000 kcal |
| Calorie goal | 500–10,000 kcal |
| Macro goal, custom food macro | 0–1,000 g |
| Custom food serving amount | >0–10,000 |
| Body weight, goal weight | 20–500 kg |
| Names (food, meal) | 1–80 chars after trim (meal: 40) |
| Quick Calories note | 0–80 chars |

## UX-01 First launch
- No onboarding screen (NAV-02 has none). The first launch opens Diary on today.
- The init transaction (DATA-17) seeds a **provisional goal** effective from the first-launch date: 2,000 kcal · 250 g carbs · 100 g protein · 67 g fat (a fixed 50/20/30 split, not a calculation, per SCOPE-10).
- While goals are provisional, the Diary shows one inline status row under the overview: `Using default goals · Set goals` → Calories & Macros. No dismiss; it disappears after the first goal save.
- Needs `app_settings.goals_confirmed_at TEXT NULL`, set on the first goal save. That first save **updates the provisional row in place** (keeps its `effective_from`), so the user's goals apply from day one. Later saves follow DATA-09.

## UX-02 Diary
```text
[Diary                                   📅]
[‹ Yesterday    TODAY    Tomorrow ›  Today ]   ← days scroll sideways; "Today" only when not on today
[  ‹     ◯ 1,731 kcal left             ›  ]   ← ring tap: Consumed 669/2,400 kcal
[ Carbs 82/250 g │ Protein 41/150 g │ Fat 25/80 g ]
[ Fibre 18 g · Sugars 42 g · Sat. fat 12 g · Salt 3.1 g ]   ← only while open
[                    ⌄                    ]   ← handle: nutrient panel (DATA-21)
[ Using default goals · Set goals           ]   ← UX-01 only
[Breakfast                      700 kcal ⋯ + ]
[  Scrambled eggs                         ⋯ ]
[  2 × egg  199 kcal                        ]
[Lunch                            0 kcal ⋯ + ]
[  No foods logged                          ]
```
- Trailing calendar icon (label "Choose date") → Date Picker.
- Large chevrons beside the calorie ring select the previous/next day; they are buttons, not page-swipe handles.
- Date strip: a horizontally scrollable, windowed row of day buttons (no date bounds; the window extends as the user scrolls). Labels: Yesterday/Today/Tomorrow within ±1 day of today, otherwise a locale short date (`Mon 28 Sep`; year added when not the current year). Selected day = DS-07 marking.
- Scrolling the strip MUST NOT change the day; tapping a day selects it. Whenever the selected day changes (tap, Today, Date Picker) the strip animates to center it, even if the user had scrolled it away.
- The selected day and its immediate previous/next days MUST stay mounted so adjacent-day changes show ready content without a loading blink.
- The selected day's neighbours are labelled prev/next day buttons, and the selected day has increment/decrement accessibility actions. Horizontal swipes on the Diary content MUST NOT change the day.
- Header `+` → Food Search (meal, date); there is no separate Add food row (user decision 2026-09-30). Row tap → matching edit screen. A left swipe reveals a `Delete` button (DS-08); tapping it deletes and shows `<item> deleted · Undo` for 5 seconds. A short swipe springs closed. No long-press actions or confirmation dialog.
- Each meal and entry has a `…` menu. Meal: `Copy meal`; entry: `Copy item`.
- Empty meal = header (0 kcal) + one compact `textSecondary` line `No foods logged`.
- Over goal and unknown macros: DS-08.
- **Nutrient panel**: the chevron handle under the macro strip opens/closes the day's totals for the DATA-21 visible nutrients, in their set order (DS-08). The open state persists (DATA-21). No visible nutrients → no chevron and no panel. No targets (SCOPE-10).
- Error: a DB load failure is full-screen with Retry. Never an offline banner.
- Focus order: app bar → strip days left to right (rendered ones; prev, selected, next among them) → Today → ring (one element) → carbs, protein, fat → each meal (header, menu, header +, entries and their menus).

## UX-03 Meal Detail (removed)
- Removed 2026-09-28 (user request). Entries are edited and copied from the Diary (UX-02, UX-12). ID kept so it is not reused.

## UX-04 Food Search
```text
[‹ [🔍 Search foods            ✕ ▥]       ]
[Adding to Lunch · Today            ✓✓ ⚡ ]
[  All  | Recent | My foods | Recipes    ]
[RECENT / results by section…             ]
```
- Opens with the field focused (not when opened for NAV-03 Scan Barcode). Trailing field icon: scan (a11y `Scan barcode`) → Barcode Scanner (UX-24). Quick-calories ⚡ (a11y `Quick calories`) trails the `Adding to <meal> · <date>` line (user request 2026-10-01) → Quick Calories (same meal/date; back returns here). No action row above the tabs. `Create custom food` → Create Custom Food (`initialName` = current query); it MUST appear only on the `My foods` tab.
- **No query**: Recent (≤20, DATA-14). No recents → `Search for a food to add it.`
- **Query**: local sources search on each keystroke (150 ms debounce). Remote: USDA ≥2 chars / 800 ms, Open Food Facts ≥3 chars / 800 ms with a request budget (PROV-04). **Why 800 ms for USDA:** 400 ms fired mid-word requests that spend quota and risk the 10-minute 429 cooldown (user decision 2026-09-30). Stale requests are cancelled.
- Sections with sticky labels: `My foods` (custom), `Saved` (cached external), `Open Food Facts`, `USDA`, in the order and visibility set in UX-18 `Search results`. Each remote section shows the first page (10, PROV-08) + a `Show more` row for the next page.
- Result row (DS-09): name · brand or basis (`per 100 g`) · kcal · source label.
- Inline section status in place of that section's results:

| Condition | Text |
|---|---|
| Loading | spinner row |
| Offline | `Offline. Showing saved foods only.` (once, above the remote sections) |
| USDA key missing | Section hidden: no header, row or request (its UX-18 switch is off). Only if the key vanishes mid-search: `Add a USDA API key to search USDA` → switches to Profile tab › Food Databases (Diary stack kept) |
| Error / timeout | `USDA search failed.` + `Retry` |
| Rate limited | `USDA is busy. Try again later.` |

- Nothing anywhere: `No foods found for "<q>".`
- Tapping a remote result opens Food Detail immediately. Food Detail performs the provider detail read and upsert (DATA-15); Food Search MUST NOT replace the row with a loading label.
- Tapping an expired cached food opens it immediately with cached values; a background refresh (when online) updates it for next time and never changes values on an open screen.
- **Delete saved food**: a left swipe on any stored-food row (`My foods`, `Saved` or Recent) reveals a `Delete` button (DS-08); tapping it soft-deletes the food (DATA-11) and shows `<food> deleted · Undo` for 5 seconds. A short swipe springs closed; no dialog. Existing diary entries keep their snapshots. Non-gesture alternative: the row's accessibility action `Delete food` (DS-11), with the same Undo toast. Remote provider rows (not yet saved) have no swipe action. Custom foods are edited from Profile › My foods (UX-25).
- Clearing the field returns to the no-query state. Returning from Food Detail keeps the query and results. Search key = `search`.
- **Tabs** (DS-15, user request 2026-10-01): `All` · `Recent` · `My foods` · `Recipes`, under the search field. Opens on `All`; switching keeps the query. Outside select mode, Scan, Quick calories and swipe-delete work on every tab.
  | Tab | No query | Query |
  |---|---|---|
  | All | Recent (above) | the sections above |
  | Recent | the ≤20 Recents (DATA-14) | those Recents filtered in memory, PROV-08 token rule |
  | My foods | every custom food (no recipes), DATA-25 order, 20 per page + `Show more` | `searchCustom` (PROV-08 rank), 20 per page |
  | Recipes | every recipe, DATA-28 `listRecipes`, 20 per page + `Show more` | `searchRecipes`, 20 per page |
- Recipes on `All` (user decision 2026-10-01): only while they are in Recents. No query → the Recent list as usual; query → matching recent recipes in the `My foods` section (DATA-28). Never just because they exist.
- `Recent`, `My foods` and `Recipes` are local only: no provider request, no offline row. UX-18 `Search results` visibility applies to `All` only (a hidden `My foods` section still has its tab).
- `My foods` tab: a `Create custom food` row always comes first, above the list or empty state. `Recipes` tab: a `Create recipe` row first → Create Recipe (UX-26, `initialName` = current query); hidden in select mode.
- Empty: Recent `No recent foods yet.`; My foods `No custom foods yet.`; Recipes `No recipes yet.`; a query with no match → `No foods found for "<q>".`
- Recipe rows: source label `Recipe`, basis `per serving`.
- **Ingredient mode** (Ingredient Search, NAV-04; UX-26 `Add ingredient`): same screen with tabs `All` · `Recent` · `My foods` only; recipes are excluded everywhere (POST-15). Context line `Adding to <recipe name>` (`Adding to new recipe` while unnamed). No scan, no ⚡, no select mode, no `Create custom food`, no swipe-delete. Result → Ingredient Detail (UX-05 ingredient mode). Remote results upsert on open as usual (DATA-15).
- **Select mode** (multi-add, user request 2026-10-01):
  - Toggle: `checkmark-done` icon (a11y `Select multiple`, `selected` state) directly before ⚡ on the context line. Tap → select mode; tap again or Back → leaves select mode and clears the selection (Back does not leave the screen while select mode is on).
  - Selectable: stored foods only (Recent, `My foods`, `Saved`, `Recipes` rows). Remote rows not yet saved are dimmed and inert. **Why:** no network read at Add, works offline, no partial failures.
  - Tapping a selectable row toggles it; it MUST NOT open Food Detail. Selected = `primaryTint` row tint + trailing check icon; no checkboxes. Row a11y: `selected` state; hint `Double tap to select`.
  - Off while active: swipe-delete, scan, Quick calories (disabled). `Create custom food` row hidden. Tabs, query, `Show more` keep working.
  - Selection keyed by `food_id`, kept in tap order across tabs and query changes; a food on two tabs is one item. Soft-deleted elsewhere → dropped from the selection.
  - Sticky bottom bar: `<n> selected` + filled primary `Add to <meal>` (DS-09 in-content primary), disabled at 0.
  - Each food is logged with its UX-05 initial serving (last serving if valid, else the default). No review step; adjust via Edit entry (UX-06).
  - Add → DATA-16 `Add food entries (batch)` → exit per NAV-04. Failure: stays in select mode, selection kept, `Couldn't add foods. Try again.`; nothing saved.

## UX-05 Food Detail / Add Entry
```text
[‹  Add food                         Add ]
[Scrambled eggs                  156 kcal ]
[Brand · per 100 g                        ]
[            [ 2.00 ]                     ]
[   ┃ │ │ ┃ │ │ ┃ │ │ ┃   (ruler)         ]
[        egg    g    oz                   ]
[ Carbs 1 g │ Protein 13 g │ Fat 11 g     ]
[Meal                              Lunch ›]   → Meal Picker
[Date                    Fri 25 Sep       ]   (display only)
```
- **Initial serving**: the recent `last_serving_id` + `last_serving_quantity` if still valid; otherwise the default serving at 1 (count units) or the basis quantity (mass/volume, e.g. 100 g).
- **Unit tabs**: valid servings (DATA-11). Mass-based foods offer g and oz, volume-based ml and fl oz, with the preferred unit first. Every unit stays visible in a horizontally scrollable row; there is no `More…` picker.
- Switching units converts the quantity so the amount of food stays the same where convertible; otherwise the new unit starts at 1.
- **Ruler steps** (snap / major tick): count 0.25 / 1 · g 1 / 10 · oz 0.1 / 1 · ml 5 / 50 · fl oz 0.1 / 1. Minimum = one step (0 can't be saved).
- Tapping the value chip → direct numeric entry (up to 2 decimals).
- Ruler a11y: role `adjustable`, increment/decrement = one step, label `Serving, 2, egg, 156 kilocalories`.
- Header action label: `Add`. The Meal row already makes the target explicit. Returns per NAV-04.
- **Recipes** (DATA-27): unit tabs `serving`, then `g cooked` / `oz cooked` and `g raw` / `oz raw` when known, the preferred weight unit first in each pair (no plain g/oz). Subtitle `Recipe · per serving`. Initial serving as above (default = 1 serving).
- **Ingredient mode** (Ingredient Detail): title `Add ingredient`, header action `Add`; no Meal or Date rows; nothing is logged and Recents aren't touched. Opened from an existing ingredient row (UX-26): title `Edit ingredient`, header `Save`, the ingredient's serving + quantity preselected. Add/Save writes into the UX-26 draft, not SQLite.
- **Nutrition facts** (below Date, always shown): every catalog nutrient the food has (DATA-20), grouped (`Carbs & fats`, `Minerals`, `Vitamins`, `Other`) in catalog order, scaled live to the chosen serving like the macros; unknown nutrients are left out. Nothing known: `No other nutrients listed.` Compact rows per DS-09.

## UX-06 Edit Food Entry
- Same layout as UX-05. Title `Edit entry`, header action `Save`, `Delete entry` at the end. Loads quantity + unit from the snapshot.
- If the original food or serving can't be resolved (`food_id` NULL, food deleted, serving gone): hide the unit tabs and scale the snapshot proportionally (`snapshot value / old qty × new qty`). Meal can still change.
- Date is display-only (moving between dates is not in scope).
- Nutrition facts (UX-05) come from the entry's snapshot rows, scaled with the quantity; a serving change recomputes them from the food (DATA-16).

## UX-07 Quick Calories / Edit Quick Calories
```text
[‹  Quick calories                   Add ]
[Meal                              Lunch ›]
[Calories   [      450 ] kcal             ]   ← focused on open, focal point
[Note       [ Restaurant meal          ]  ]
[Date                    Fri 25 Sep       ]
```
- Calories: integer, required, 1–10,000 kcal (in the energy unit). Note: single line, optional.
- Edit: title `Edit quick calories`, primary `Save`, `Delete entry`.

## UX-08 Create Custom Food
```text
[‹  New food                         Save ]
[Name*            [                     ] ]
[Brand            [                     ] ]
[Serving*   [ 2    ] [ slice ▾ ]          ]   unit: g · oz · ml · fl oz · Other…
[NUTRITION PER 2 SLICE                    ]
[Calories*  [     ] kcal                  ]
[Protein    [     ] g   Carbs  [   ] g   Fat  [   ] g ]
```
- `Other…` takes a free-text count unit (e.g. `slice`, `bar`) and becomes the food's default serving (DATA-11).
- Name uses word autocapitalization and is prefilled from `initialName`.
- Carbs helper text: `As on EU labels (fibre not included)` (PROV-05).
- Protein, carbs and fat are optional; an empty field saves as unknown (DATA-06).
- **More nutrients**: a collapsed disclosure under the macros with one optional field per catalog nutrient (DATA-20), grouped as UX-05, in the catalog unit (g / mg / µg), per the entered serving like the macros. `Salt` is offered and `sodium` is derived (EU labels list salt). Empty = unknown. Collapsed by default; opens when any value is set.
- **From a scan** (`barcode` param, DATA-24): a display-only `Barcode  5601009983179` row under Brand; the code is saved with the food. Name starts empty.
- Save → NAV-04 (continues to Food Detail). Dirty exit → Discard dialog.
- **Edit mode** (UX-25): title `Edit food`; every field filled from the food (the default serving's unit; amounts to 2 decimals; More nutrients open when any is set); the barcode row when it has one (not editable); `Save` disabled until something changed (UX-00); `Delete food` at the end (UX-19).

## UX-09 Add Action Sheet
Rows: `Add food` · `Scan barcode` · `Quick calories` · `Update weight` (icon + label). No title. Behavior: NAV-03.

## UX-10 Meal Picker
- Compact title `Choose meal`. Meals in order; the current meal gets a check when changing. Tap = select + close.
- With exactly one meal, global add flows skip the picker.

## UX-11 Serving Unit Picker
Rows: label + conversion hint (`1 egg · 50 g`); check on the current unit. Tap = select + close (NAV-07).

## UX-12 Copy Sheet
- Title `Copy <item/meal> to`. First step: `Today · Fri 25 Sep`, `Tomorrow · Sat 26 Sep`, `Choose date…` (→ Date Picker, title `Copy to date`). Second step always opens `Choose meal`.
- Copying onto the source date and meal is allowed (appends duplicates).
- Success toast: `Copied 3 items to Lunch, Sat 26 Sep`.

## UX-13 Date Picker
- Modal with the native calendar, `Cancel`, `Done`, and a `Today` shortcut. Any date allowed (NAV-05). Destination mode only changes the title.

## UX-14 Weight Entry Sheet
```text
[Update weight                       Save ]   (edit: "Edit weight")
[Date                  Today, 25 Sep     ]   native date control, max = today
[Weight     [  82.4 ] kg                  ]   focused on open, decimal
[             Delete weight               ]   (edit only)
```
- Create: empty field with the current weight as placeholder. The sheet grows above the keyboard.
- Time rules: DATA-13.

## UX-15 Profile
```text
[Profile                                  ]
[Current 82.4 kg        Goal 75.0 kg      ]
[        [ Update weight ]                ]
[Weight history                         › ]
[GOALS                                    ]
[Calories & macros            2,000 kcal › ]
[Weight goal                     75 kg   › ]
[DIARY                                    ]
[Meals                          4 meals  › ]
[Units                  kg · g · kcal · ml › ]
[Dashboard nutrients           4 shown › ]
[FOOD DATA                                ]
[My foods                     12 foods   › ]
[My recipes                    3 recipes › ]
[Food databases              USDA on     › ]
[APP                                      ]
[Theme                          System   › ]
```
- No weight yet: `No weight logged yet`. No goal: `Goal —`.
- `My foods` value: `<n> food(s)` (DATA-25 count); none → `None`. `My recipes` value: `<n> recipe(s)` (DATA-28 count); none → `None`.

## UX-16 Calories & Macros
- Fields: Calories, Carbs, Protein, Fat. `Set macros by` toggles `Fixed grams` / `Percentages` and is persisted with the goal.
- Fixed grams: macro fields use g. Under each macro, a read-only helper `≈ 1,000 kcal · 50%` (4/4/9 kcal per g).
- Percentages: macro fields use whole percentages from 0–100 and MUST total 100%. Helpers show the derived grams and energy; saved canonical gram targets use the calorie target and 4/4/9.
- Footnote: `Changes apply from today. Past days keep their goals.` (DATA-09; UX-01 on the first save).
- Dirty exit → Discard dialog.

## UX-17 Meals / Add-Edit Meal
- **Meals**: rows with a drag handle. Long-press or handle drag reorders and commits on drop (one transaction, DATA-10); no Save button. A11y actions `Move up` / `Move down`. Row tap → edit. Last row `+ Add meal`. New meals append at the end.
- **Add/Edit Meal**: one Name field (focused). A duplicate name shows a non-blocking warning `You already have a meal named Lunch.` `Delete meal` in edit mode → UX-19 meal flow. With only one meal, Delete is disabled with helper `At least one meal is required.`

## UX-18 Units · Weight Goal · Weight History · Food Databases
- **Units**: 4 segmented controls (kg|lb, g|oz, kcal|kJ, ml|fl oz). Each change saves immediately; no Save button.
- **Weight Goal**: one weight field + `Clear goal` text action (sets NULL). Save → Profile.
- **Weight History**: newest first, virtualized. Row = date (+ time when several on one day) · weight · change vs previous entry (`−0.4 kg`, neutral color, no judgment). App bar `+` (label "Update weight"). Empty: `No weight entries yet.` + Update weight.
- **Food Databases**: `Open Food Facts · Always on`. The USDA row is an inline disclosure; tapping anywhere on it expands/collapses its contained configuration. Status is one of `Not set up`, `Active`, `Saved · will check when online`, `Key rejected`. The expanded content holds the masked saved key (`••••3f9a`) and `Replace key` / `Test key` / `Remove key` actions (UX-19), or the key form when not configured. A successful key save collapses the disclosure. Test behavior: PROV-11.
  - Key input: secure entry, no autocorrect/autocap, paste allowed, with a link to the USDA key signup page.
  - On save when online: a test request runs. On 401/403 the key is not saved and shows an inline error. When offline the key is saved as `will check`.
  - **Attribution (ODbL)**: under the Open Food Facts row, a secondary caption `Food data from Open Food Facts, available under the Open Database License (ODbL).` and two text actions with the open icon: `Open Food Facts website` (openfoodfacts.org) and `Open Database License` (ODbL 1.0 page), both opened in the system browser. Always shown, even when the `Open Food Facts` search section is hidden. **Why:** ODbL requires attribution where the data is used; this is the screen about data sources.
  - **`Search results` group**: the 4 Food Search (UX-04) sections in their current order. Row = section name · visibility switch · drag handle. Reorder as UX-17 Meals (handle drag, a11y `Move up` / `Move down`). Every switch change or drop saves immediately, as Units; no Save button. Default: `My foods` → `Saved` → `Open Food Facts` → `USDA`, all visible. Storage: DATA-19.
  - At least one section MUST stay visible: the last visible row's switch is disabled, with helper `At least one section must be shown.`
  - Without a configured USDA key, the `USDA` switch is off and disabled with an accessible explanation. It becomes available after key setup.
  - Effects on Food Search with a query (Recent, the no-query state, is unaffected):
    - Visible sections render in the set order. A hidden section renders nothing, and a hidden remote section MUST NOT send requests (saves the OFF budget, PROV-04).
    - `No foods found` considers visible sections only. The offline row shows only while a remote section is visible, once, above the first visible remote section.
    - While `Saved` is hidden, the PROV-08 Saved dedupe doesn't apply: remote hits already cached show in their remote section. Tapping one still upserts or opens the cached copy (DATA-15).

## UX-19 Dialogs (DS-09: explicit verb, two actions)
| Trigger | Title | Body | Destructive button |
|---|---|---|---|
| Delete food entry | `Delete <food>?` | `Removes it from <meal> on <date>.` | `Delete entry` |
| Delete quick entry | `Delete quick calories?` | `<kcal> from <meal> on <date>.` | `Delete entry` |
| Delete weight | `Delete weight entry?` | `<weight> on <date>.` | `Delete weight` |
| Delete meal, no entries | `Delete <meal>?` | — | `Delete meal` |
| Delete custom food (UX-25 edit) | `Delete <food>?` | `Your diary entries keep their nutrition.` | `Delete food` |
| Delete recipe (UX-26 edit) | `Delete <recipe>?` | `Your diary entries keep their nutrition.` | `Delete recipe` |
| Remove USDA key | `Remove USDA API key?` | `USDA search will stop. Saved foods stay.` | `Remove key` |
| Dirty exit (UX-00) | `Discard changes?` | — | `Discard` (other button: `Keep editing`) |
- **Delete meal with entries** uses a sheet, not a dialog: `Delete <meal>? It has <n> entries. Move them to:` + radio list of the other meals + danger `Delete and move entries` (disabled until a meal is picked). Implements NAV-08 and DATA-10.

## UX-20 System screens
- Launch screen until config + migrations finish (ARCH-17).
- Startup/migration failure: `Couldn't open your diary.` + `Retry` + `Copy diagnostic info` (versions and error category only, ARCH-15). Never a reset.

## UX-21 Dashboard nutrients
```text
[‹  Dashboard nutrients                   ]
[SHOWN                                    ]
[≡ Fibre                              ●  ]   ← drag handle · switch
[≡ Sugars                             ●  ]
[CARBS & FATS                             ]
[  Added sugars                       ○  ]
[MINERALS · VITAMINS · OTHER  …           ]
```
- Opened from Profile › Diary › `Dashboard nutrients` (value `<n> shown`, or `None`).
- `Shown`: the visible nutrients in dashboard order, with drag handle + switch. Reorder as UX-17 Meals (handle drag, a11y `Move up` / `Move down`).
- Below, the hidden nutrients grouped as UX-05, in catalog order, with a switch. Switching one on appends it to the end of `Shown`; switching off moves it back to its group.
- Every change saves immediately (DATA-21), as Units; no Save button. Zero shown is allowed; helper: `The Diary shows no nutrient panel.`

## UX-22 Android widget (calories left)
```text
[ 1,731        ]
[ kcal left    ]      over goal: [ 250 / kcal over ] in `warning`
```
- One size, 2×1 cells, resizable horizontally only. Android only.
- Value = the Diary overview's remaining for **today** (UX-02, DATA-09 goal for today − today's consumed). Same rounding, grouping and locale as the Diary (UX number display); energy unit follows Units (kcal|kJ).
- States:
  | State | Shows |
  |---|---|
  | Remaining ≥ 0 | `{n} kcal left` |
  | Over goal | `{n} kcal over`, number in `warning` (as the ring, DS-03) |
  | No goal applies to today (DATA-09) | `{n} kcal eaten`, as the ring |
  | Provisional goal (UX-01) | Same as above; no "default goals" hint |
  | DB not ready / read fails | `Open Calorie Tracker` |
- Tap anywhere → the app opens on the Diary at today (NAV-10).
- Strings in en + pt-PT (ARCH-22). No other data on the widget: no meals, macros or food names.
- MUST NOT show stale data after a write in the app or after local midnight beyond the limits in DATA-22.

## UX-23 Theme
- One segmented control `System | Light | Dark` (DS-03), with helper `System follows your phone's light or dark setting.` Default `System`.
- Each choice saves (DATA-23) and re-themes the whole app at once, as Units; no Save button. Back → Profile. A failed save shows an inline error and keeps the previous choice.
- The Android widget follows it too (DS-14); a change redraws it (DATA-22).

## UX-24 Barcode Scanner
```text
[‹  Scan barcode                     🔦 ]   torch toggle (only while the camera is on)
[                                        ]
[      ┌──────────────────────┐          ]   camera preview fills the body
[      │      frame guide      │          ]
[      └──────────────────────┘          ]
[ Point the camera at a barcode.         ]   panel below the preview
[ Enter code manually                    ]
```
- Reads EAN-13, EAN-8, UPC-A, UPC-E (ARCH-24). A read that fails the check digit is ignored (keeps scanning). The first valid read stops scanning, fires a light haptic (DS-10) and starts the PROV-15 lookup.
- **Enter code manually** → a field (`Barcode`, number pad) + `Look up`. Invalid → field error `Enter a valid barcode (8–14 digits).` Also the only path on devices without a camera.

| State | Shows |
|---|---|
| Permission not asked | the system prompt on open |
| Permission denied | `Allow camera access to scan barcodes.` + `Allow camera` (asks again) or, once the OS won't ask, `Open settings`; the manual field |
| Camera unavailable / error | `Camera unavailable.` + the manual field |
| Scanning | preview, frame, hint, torch, manual entry |
| Looking up | preview frozen; `Looking up <code>…` + spinner |
| Found | NAV-04: replaced by Food Detail |
| Not found | `No food found for <code>.` + `Checked: <sources>.` + `Create custom food` (primary) + `Scan again` |
| Not found, a provider failed | as Not found, plus `Couldn't check <Provider>.` + `Retry` |

- `<sources>` lists what PROV-15 actually checked, e.g. `saved foods, Open Food Facts, USDA`. Notes: `Offline. Only saved foods were checked.`, or per provider hidden in UX-18 `<Provider> is turned off in Food Databases.` (both: `Open Food Facts and USDA are turned off in Food Databases.`). USDA without a key is simply not listed.
- `<code>` shows the GTIN-13 (or EAN-8) form, digits only.
- Back → Food Search. `Scan again` returns to Scanning. Leaving mid-lookup cancels it (PROV-15).
- Strings in en + pt-PT (ARCH-22), including the camera permission text (ARCH-24).

## UX-25 My Foods
```text
[‹  My foods                              ]
[Profile porridge                 300 kcal]
[per 100 g · My food                      ]
[Granola bar                      180 kcal]
[Show more                                ]
```
- Profile › `My foods` (UX-15). User request 2026-10-01. Rows as UX-04 results (DS-09), DATA-25 order, 20 per page + `Show more`. No search field and no create action (create from Food Search).
- Tap → the food's details in the UX-08 form, edit mode (user decision 2026-10-01: Profile is for viewing and editing, not logging). Save edits the food (DATA-26) → My foods. Returns per NAV-06.
- Swipe left → `Delete` + `<food> deleted · Undo` (UX-04 rules, DATA-11).
- Empty: `No custom foods yet. Create them from Food Search.`

## UX-26 Create / Edit Recipe
```text
[‹  New recipe                       Save ]
[Name*            [                     ] ]
[Servings*        [ 4    ]                ]
[Cooked weight    [ 350  ] g per serving  ]
[Raw weight       [ 250  ] g per serving  ]   auto · Reset when overridden
[INGREDIENTS                              ]
[Rice                     400 g   1,440 kcal]
[Chicken breast           600 g     990 kcal]
[+ Add ingredient                         ]
[PER SERVING   608 kcal                   ]
[Carbs 72 g │ Protein 46 g │ Fat 9 g      ]
[Whole recipe  2,430 kcal                 ]
```
- SCOPE-13, DATA-27/28. User request 2026-10-01. Create from Food Search `Recipes` (Diary stack); edit from My recipes (Profile stack, UX-27).
- Name: word autocapitalization, prefilled from `initialName`. Servings: decimal > 0, required.
- Weights in the preferred food weight unit, stored in g. Cooked weight optional, helper `The weight of one serving once cooked.` Raw weight shows the computed value (DATA-27) as the field value with helper `From the ingredients`; typing overrides it, helper becomes `Your value` + a `Reset` text action back to computed. Not computable and not overridden → empty, helper `Add the raw weight to log in g raw.`
- Ingredient rows (DS-09): name · amount + unit (`· Deleted food` appended for a soft-deleted food) · kcal. Tap → Ingredient Detail (UX-05, edit). Swipe left → `Remove` (draft only, no Undo, no dialog). Order = add order.
- `+ Add ingredient` → Ingredient Search (UX-04 ingredient mode).
- Totals update live. An unknown macro (DATA-06, DATA-27) shows `—`, as in UX-05.
- Draft: held in memory for the editor and its ingredient screens until Save; never written to SQLite before Save. Dirty exit → `Discard changes?` (UX-00).
- Save enabled when valid (name, servings, ≥1 ingredient) and, in edit mode, changed. Create → NAV-04 (Food Detail for the recipe). Edit → My recipes.
- Edit mode: title `Edit recipe`, filled from `getRecipe`; `Delete recipe` at the end (UX-19). Diary entries keep their snapshots.

## UX-27 My Recipes
- Profile › `My recipes` (UX-15). As UX-25 with recipe rows (`per serving · Recipe`), DATA-28 `listRecipes` order, 20 per page + `Show more`. No search, no create (create from Food Search `Recipes`).
- Tap → UX-26 edit mode. Swipe left → `Delete` + `<recipe> deleted · Undo` (UX-04 rules, DATA-11).
- Empty: `No recipes yet. Create them from Food Search.`
