# 06 Screens (UX)

Read when: building a specific screen, sheet or dialog. Only screen-specific behavior lives here. Components and styling: DS. Routes and returns: NAV. Data rules: DATA. Wireframes show order, not pixels.

## UX-00 Shared rules (apply to every screen unless a card says otherwise)
- **Copy**: quoted UI text is the English source string; each one is an i18n key with a pt-PT translation (ARCH-22).
- **App bar**: back on every non-root screen; title = screen name unless stated.
- **Primary action**: one filled button pinned to the bottom of the screen, above the keyboard and safe area. Disabled until the form is valid; in edit mode also until something changed.
- **Delete** (edit modes): a danger text action at the end of the content, never next to the primary. Always confirmed (UX-19).
- **Leaving a dirty form**: silently discards, EXCEPT Create Custom Food and Calories & Macros, which ask **Discard changes?** (UX-19). Back, swipe-back and the close button share this path (ARCH-06).
- **Validation**: on blur and on submit; the message sits under the field (DS-09) and clears as soon as the value is valid.
- **Keyboard**: Return → next field; on the last field Return submits if valid. Integer fields use `number-pad`, decimal fields `decimal-pad`. Scrolling a list dismisses the keyboard.
- **Units in inputs**: energy fields follow `energy_unit`, body weight `weight_unit`, food mass/volume the food/volume unit. Ranges below are canonical and converted for display.
- **Save failure**: stay on the screen, keep the input, show an inline error above the primary action (`Couldn't save. Try again.`).
- **Loading**: local screens render directly. Show a skeleton only if a load takes >300 ms.
- **Not found** (bad params, or the record was deleted from another tab): replace content with `This item no longer exists.` + a button back to the stack root.
- **Number display**: kcal/kJ as integers with grouping; macros as integers ≥10 g and 1 decimal <10 g; unknown macro = `—` (screen reader: "unknown"); body weight 1 decimal.

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
[        ◯ 1,731 kcal left / 669 eaten      ]
[ Carbs 82/250 g │ Protein 41/150 g │ Fat 25/80 g ]
[ Using default goals · Set goals           ]   ← UX-01 only
[◦ Breakfast                    700 kcal  + ]
[  Scrambled eggs                 199 kcal  ]
[  2 × egg                                  ]
[  + Add food                               ]
[◦ Lunch …                                  ]
```
- Trailing calendar icon (label "Choose date") → Date Picker.
- Date strip: a horizontally scrollable, windowed row of day buttons (no date bounds; the window extends as the user scrolls). Labels: Yesterday/Today/Tomorrow within ±1 day of today, otherwise a locale short date (`Mon 28 Sep`; year added when not the current year). Selected day = DS-07 marking.
- Scrolling the strip MUST NOT change the day; tapping a day selects it. Whenever the selected day changes (swipe, tap, Today, Date Picker) the strip animates to center it, even if the user had scrolled it away. **Why:** the strip browses, the page swipe decides the day.
- Gesture alternative: the selected day's neighbours are labelled prev/next day buttons, and the selected day has increment/decrement accessibility actions. The strip's own sideways scroll never swipes the page.
- Swipe horizontally anywhere except the ruler (none on this screen) → adjacent day. Adjacent days are pre-rendered. A new day opens scrolled to top.
- Meal header tap → Meal Detail. Header `+` and the `+ Add food` row → Food Search (meal, date). Row tap → matching edit screen. No long-press actions.
- Empty meal = header (0 kcal) + `+ Add food` row only (no empty text on Diary, to protect density).
- Over goal and unknown macros: DS-08.
- Error: a DB load failure is full-screen with Retry. Never an offline banner.
- Focus order: app bar → strip days left to right (rendered ones; prev, selected, next among them) → Today → ring (one element) → carbs, protein, fat → each meal (header, header +, entries, Add food).

## UX-03 Meal Detail
```text
[‹  Breakfast                            + ]   ← "+" = Add food
[Friday, 25 September           Copy meal ]
[◦ 700 kcal                               ]
[  entries… (same rows as Diary)          ]
[  + Add food                             ]
```
- Empty: `No foods logged for this meal.` + `+ Add food`. `Copy meal` disabled.
- Meal deleted from Profile while this is open → Not found (UX-00).

## UX-04 Food Search
```text
[‹ [🔍 Search foods             ✕]        ]
[Adding to Lunch · Today                  ]
[⚡ Quick calories    ＋ Create custom food ]
[RECENT  — or, with a query:              ]
[MY FOODS · SAVED   (local, instant)      ]
[ONLINE                                   ]
[ Chicken, breast, raw     120 kcal  USDA ]
[ Chicken breast fillets   110 kcal  Open Food Facts ]
[ Show more                               ]
[ one compact status row (see table)      ]
```
- Opens with the field focused. `Quick calories` → Quick Calories (same meal/date; back returns here). `Create custom food` → Create Custom Food (`initialName` = current query).
- **No query**: Recent (≤20, DATA-14). No recents → `Search for a food to add it.`
- **Query**: local sources search on each keystroke (150 ms debounce). Remote: USDA ≥2 chars / 400 ms, Open Food Facts ≥3 chars / 800 ms with a request budget (PROV-04). Stale requests are cancelled.
- Section order with sticky labels: `My foods` (custom) → `Saved` (cached external) → `Online` (USDA + Open Food Facts merged, PROV-08). `My foods` and `Saved` keep their own labels and PROV-08 local rules. `Online` shows from 2 characters.
- `Online`: one list ranked and interleaved per PROV-08; the first render waits ≤1.5 s for the other provider, and late items are appended, never reordering visible rows (PROV-08). One `Show more` row fetches the next page from each provider that has one.
- Result row (DS-09): name · brand or basis (`per 100 g`) · kcal · source label (`USDA` / `Open Food Facts`).
- One compact status row under the `Online` list merges both providers' states (nothing when both are fine; one line per affected provider):

| Condition | Text |
|---|---|
| Loading | spinner row `Searching…` |
| Offline | `Offline. Showing saved foods only.` (replaces the other states) |
| USDA key missing | `Add a USDA API key to search USDA` → switches to Profile tab › Food Databases (Diary stack kept) |
| Error / timeout | `USDA search failed.` / `Open Food Facts search failed.` + `Retry <provider>` |
| Rate limited | `USDA is busy. Try again later.` / `Open Food Facts is busy. Try again later.` |
| Searched, no online hits | `No online results.` |

- Nothing anywhere: `No foods found for "<q>".` + `Create custom food`.
- Tapping a remote result: row spinner → upsert (DATA-15) → Food Detail. Failure → inline row error `Couldn't load this food.`
- Tapping an expired cached food opens it immediately with cached values; a background refresh (when online) updates it for next time and never changes values on an open screen.
- **Delete custom food**: swipe left on any custom-food row (in `My foods` or Recent) to reveal a danger `Delete` button. Tapping it soft-deletes the food (DATA-11): the row disappears, and existing diary entries keep their snapshots. No dialog, because tapping the revealed button is the confirmation. Non-gesture alternative: the row's accessibility action `Delete food` (DS-11). External-food rows have no swipe action. Custom foods can't be edited in the MVP.
- Clearing the field returns to the no-query state. Returning from Food Detail keeps the query and results. Search key = `search`.

## UX-05 Food Detail / Add Entry
```text
[‹  Add food                              ]
[Scrambled eggs                  156 kcal ]
[Brand · per 100 g                        ]
[            [ 2.00 ]                     ]
[   ┃ │ │ ┃ │ │ ┃ │ │ ┃   (ruler)         ]
[        egg    g    oz                   ]
[ Carbs 1 g │ Protein 13 g │ Fat 11 g     ]
[Meal                              Lunch ›]   → Meal Picker
[Date                    Fri 25 Sep       ]   (display only)
[        [ Add to Lunch ]                 ]
```
- **Initial serving**: the recent `last_serving_id` + `last_serving_quantity` if still valid; otherwise the default serving at 1 (count units) or the basis quantity (mass/volume, e.g. 100 g).
- **Unit tabs**: valid servings (DATA-11). Mass-based foods offer g and oz, volume-based ml and fl oz, with the preferred unit first. More than 3 units → third tab is `More…` → Serving Unit Picker.
- Switching units converts the quantity so the amount of food stays the same where convertible; otherwise the new unit starts at 1.
- **Ruler steps** (snap / major tick): count 0.25 / 1 · g 1 / 10 · oz 0.1 / 1 · ml 5 / 50 · fl oz 0.1 / 1. Minimum = one step (0 can't be saved).
- Tapping the value chip → direct numeric entry (up to 2 decimals).
- Ruler a11y: role `adjustable`, increment/decrement = one step, label `Serving, 2, egg, 156 kilocalories`.
- Primary label: `Add to <meal>`. Returns per NAV-04.

## UX-06 Edit Food Entry
- Same layout as UX-05. Title `Edit entry`, primary `Save`, `Delete entry` at the end. Loads quantity + unit from the snapshot.
- If the original food or serving can't be resolved (`food_id` NULL, food deleted, serving gone): hide the unit tabs and scale the snapshot proportionally (`snapshot value / old qty × new qty`). Meal can still change.
- Date is display-only (moving between dates is not in scope).

## UX-07 Quick Calories / Edit Quick Calories
```text
[‹  Quick calories                        ]
[Meal                              Lunch ›]
[Calories   [      450 ] kcal             ]   ← focused on open, focal point
[Note       [ Restaurant meal          ]  ]
[Date                    Fri 25 Sep       ]
[             [ Add ]                     ]
```
- Calories: integer, required, 1–10,000 kcal (in the energy unit). Note: single line, optional.
- Edit: title `Edit quick calories`, primary `Save`, `Delete entry`.

## UX-08 Create Custom Food
```text
[‹  New food                              ]
[Name*            [                     ] ]
[Brand            [                     ] ]
[Serving*   [ 2    ] [ slice ▾ ]          ]   unit: g · oz · ml · fl oz · Other…
[NUTRITION PER 2 SLICE                    ]
[Calories*  [     ] kcal                  ]
[Protein*   [     ] g   Carbs* [   ] g   Fat* [   ] g ]
[             [ Save ]                    ]
```
- `Other…` takes a free-text count unit (e.g. `slice`, `bar`) and becomes the food's default serving (DATA-11).
- Name uses word autocapitalization and is prefilled from `initialName`.
- Carbs helper text: `As on EU labels (fibre not included)` (PROV-05).
- Save → NAV-04 (continues to Food Detail). Dirty exit → Discard dialog.

## UX-09 Add Action Sheet
Rows: `Add food` · `Quick calories` · `Update weight` (icon + label). No title. Behavior: NAV-03.

## UX-10 Meal Picker
- Compact title `Choose meal`. Meals in order; the current meal gets a check when changing. Tap = select + close.
- With exactly one meal, global add flows skip the picker.

## UX-11 Serving Unit Picker
Rows: label + conversion hint (`1 egg · 50 g`); check on the current unit. Tap = select + close (NAV-07).

## UX-12 Copy Meal Sheet
- Title `Copy <meal> to`. Rows: `Today · Fri 25 Sep`, `Tomorrow · Sat 26 Sep`, `Choose date…` (→ Date Picker, title `Copy to date`).
- Copying onto the source date is allowed (appends duplicates).
- Success toast: `Copied 3 items to Lunch, Sat 26 Sep`.

## UX-13 Date Picker
- Modal with the native calendar, `Cancel`, `Done`, and a `Today` shortcut. Any date allowed (NAV-05). Destination mode only changes the title.

## UX-14 Weight Entry Sheet
```text
[Update weight                            ]   (edit: "Edit weight")
[Date                  Today, 25 Sep     ]   native date control, max = today
[Weight     [  82.4 ] kg                  ]   focused on open, decimal
[             [ Save ]                    ]
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
[FOOD DATA                                ]
[Food databases              USDA on     › ]
```
- No weight yet: `No weight logged yet`. No goal: `Goal —`.

## UX-16 Calories & Macros
- Fields: Calories, Carbs, Protein, Fat. Under each macro, a read-only helper `≈ 1,000 kcal · 50%` (4/4/9 kcal per g).
- Footnote: `Changes apply from today. Past days keep their goals.` (DATA-09; UX-01 on the first save).
- Dirty exit → Discard dialog.

## UX-17 Meals / Add-Edit Meal
- **Meals**: rows with a drag handle. Long-press or handle drag reorders and commits on drop (one transaction, DATA-10); no Save button. A11y actions `Move up` / `Move down`. Row tap → edit. Last row `+ Add meal`. New meals append at the end.
- **Add/Edit Meal**: one Name field (focused). A duplicate name shows a non-blocking warning `You already have a meal named Lunch.` `Delete meal` in edit mode → UX-19 meal flow. With only one meal, Delete is disabled with helper `At least one meal is required.`

## UX-18 Units · Weight Goal · Weight History · Food Databases
- **Units**: 4 segmented controls (kg|lb, g|oz, kcal|kJ, ml|fl oz). Each change saves immediately; no Save button.
- **Weight Goal**: one weight field + `Clear goal` text action (sets NULL). Save → Profile.
- **Weight History**: newest first, virtualized. Row = date (+ time when several on one day) · weight · change vs previous entry (`−0.4 kg`, neutral color, no judgment). App bar `+` (label "Update weight"). Empty: `No weight entries yet.` + Update weight.
- **Food Databases**: `Open Food Facts · Always on`. USDA status is one of `Not set up`, `Active`, `Saved · will check when online`, `Key rejected`. The saved key shows masked with its last 4 characters (`••••3f9a`). Actions: `Add key` / `Replace key` / `Test key` / `Remove key` (UX-19). Test behavior: PROV-11.
  - Key input: secure entry, no autocorrect/autocap, paste allowed, with a link to the USDA key signup page.
  - On save when online: a test request runs. On 401/403 the key is not saved and shows an inline error. When offline the key is saved as `will check`.

## UX-19 Dialogs (DS-09: explicit verb, two actions)
| Trigger | Title | Body | Destructive button |
|---|---|---|---|
| Delete food entry | `Delete <food>?` | `Removes it from <meal> on <date>.` | `Delete entry` |
| Delete quick entry | `Delete quick calories?` | `<kcal> from <meal> on <date>.` | `Delete entry` |
| Delete weight | `Delete weight entry?` | `<weight> on <date>.` | `Delete weight` |
| Delete meal, no entries | `Delete <meal>?` | — | `Delete meal` |
| Remove USDA key | `Remove USDA API key?` | `USDA search will stop. Saved foods stay.` | `Remove key` |
| Dirty exit (UX-00) | `Discard changes?` | — | `Discard` (other button: `Keep editing`) |
- **Delete meal with entries** uses a sheet, not a dialog: `Delete <meal>? It has <n> entries. Move them to:` + radio list of the other meals + danger `Delete and move entries` (disabled until a meal is picked). Implements NAV-08 and DATA-10.

## UX-20 System screens
- Launch screen until config + migrations finish (ARCH-17).
- Startup/migration failure: `Couldn't open your diary.` + `Retry` + `Copy diagnostic info` (versions and error category only, ARCH-15). Never a reset.
