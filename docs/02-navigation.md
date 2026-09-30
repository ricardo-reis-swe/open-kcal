# 02 Navigation (NAV)

Read when: adding routes, wiring save/cancel/back, or changing where a flow returns. Route params: `src/shared/navigation/routes.ts` (source of truth). Per-screen UX: `06-screens.md`.

## NAV-01 Principles
- Diary is the default destination. `+` starts logging flows and is never a screen. Profile holds settings and history.
- The selected diary date stays in context across meals, add and edit.
- Android system back and the iOS back gesture follow the same hierarchy as visible back/close controls.

## NAV-02 Tree
```text
App Root
├── Tabs: Diary | + (action) | Profile
│   ├── Diary Stack: Diary, Food Search, Food Detail / Add Entry,
│   │                Edit Food Entry, Quick Calories, Edit Quick Calories, Create Custom Food
│   └── Profile Stack: Profile, Calories & Macros, Meals, Add / Edit Meal, Units,
│                      Weight Goal, Weight History, Food Databases / USDA API Key
└── App-level overlays: Add Action Sheet, Date Picker, Meal Picker, Serving Unit Picker,
                        Dashboard Action Sheet, Copy Sheet, Weight Entry Sheet, Confirmation Dialogs
```
- Bottom bar has exactly 3 items: `Diary  +  Profile`. `+` owns no stack and is never shown as selected.
- Each tab keeps its own stack when switching tabs. Tapping the already-selected tab pops it to root.
- Diary tab tapped while deeper → root, same date. Tapped while at root → scroll to top.

## NAV-03 `+` Add Action Sheet
```text
+ ├── Add Food       → Meal Picker → Food Search
  ├── Quick Calories → Meal Picker → Quick Calories
  └── Update Weight  → Weight Entry Sheet
```
- Available from both tabs.
- Meal Picker is skipped when a valid meal is already in context (meal-specific control).
- Global `+` food and Quick Calories flows end on **Diary on the target date** after saving, even when started from Profile.
- Food and Quick Calories use the selected diary date. Weight defaults to **today** (editable in the sheet), not the diary date.
- Dismiss: swipe down, tap outside, back. Picking an action closes the sheet before opening the next route or sheet.
- MUST NOT include barcode (SCOPE-10).

## NAV-04 Diary stack screens
| Screen | Shows / does | Exits |
|---|---|---|
| Diary | Date nav, calendar action, Today (when ≠ today), progress, meals in saved order, entries under meals, Add Food per meal. Day content MUST NOT page on horizontal swipes; the date strip remains horizontally scrollable. | Food row → matching edit screen. Swipe entry left → reveals Delete; tap deletes. Meal/entry `…` → dashboard actions. Add Food → Food Search(meal, date). |
| Food Search | Search input; recents before a query; custom foods; USDA (if configured); Open Food Facts; Create Custom Food. Results show their source. No barcode. Swipe a custom or saved food → reveals Delete; tap soft-deletes (UX-04). | Result → Food Detail. Create Custom Food → keeps date + meal. Back → origin, nothing created. |
| Food Detail / Add Entry | Food identity, units, ruler, live kcal/macros, target meal (changeable via Meal Picker), target date. | Save → writes, returns to Diary, refreshed, target date visible. Cancel/back → nothing saved. |
| Edit Food Entry | Loads date, meal, food, serving and nutrition from `entryId`. Ruler, unit, reassign meal, Save, Delete. | Save/delete → Diary, totals refreshed. |
| Quick Calories | Meal (changeable via Meal Picker), calories, optional note, Add. Macros unknown. | Add → origin, totals refreshed. |
| Edit Quick Calories | Meal, calories, note; Save, Delete. | Same return and delete rules as Edit Food Entry. |
| Create Custom Food | Fields from SCOPE-06. | Save → stores food → Food Detail with that food, original date + meal. Does NOT log automatically. Cancel → Food Search with query and results intact. |

## NAV-05 Date
- The selected date is owned by the Diary stack (not a component). It survives search, add/edit and tab switches. Fresh launch = today.
- Date Picker: app-level modal from Diary or any diary screen showing a date control. Opens on the active date; any date allowed; confirm → close + Diary on that date; cancel → no change; choosing today = Today action.
- No separate future-planning route or mode.

## NAV-06 Profile stack screens
| Screen | Behavior |
|---|---|
| Profile | Current weight, goal weight, Update Weight, link to Weight History, rows: Calories & Macros, Meals, Units, Weight Goal, Food Databases. |
| Calories & Macros | Edit kcal/carb/protein/fat goals. Save → Profile; diary targets update immediately. |
| Meals | Meals in saved order. Reorder in the list; tap → Add/Edit Meal; add new; delete via confirmation. Defaults are ordinary records. |
| Add / Edit Meal | Create or rename. Save → Meals. Delete only in edit mode (protected, NAV-08). |
| Units | Weight kg/lb, food weight g/oz, energy kcal/kJ, volume ml/fl oz. After save, applies to Diary, add/edit, weight screens and Profile. |
| Weight Goal | View/edit goal in the configured unit. Save → Profile. |
| Weight History | Dated entries + Update Weight. Row → Weight Entry Sheet (edit mode). |
| Food Databases | Lists Open Food Facts + USDA. Add, replace or remove USDA key; shows whether USDA search is available. Key goes to secure storage; never shown in full after saving. |

## NAV-07 Sheets
- **Meal Picker**: current meals in user order. Used for global add and for changing an entry's meal. Never assumes fixed names.
- **Serving Unit Picker**: only units valid for the food. Pick → close + recalc ruler value, kcal, macros.
- **Dashboard Action Sheet**: entry `…` offers Copy item; meal `…` offers Copy meal.
- **Copy Sheet**: choose Today / Tomorrow / another date, then always choose the destination meal. The shortcuts are absolute today/tomorrow. Entry and meal copies preserve stored snapshots and append to the chosen meal/date.
- **Weight Entry Sheet** (from `+`, Profile, Weight History): date, weight, configured unit, Save, Delete (edit only). Date ≤ today. Create mode defaults to today and the configured unit; edit mode loads the record. Save → close, refresh Profile/History.

## NAV-08 Confirmation required before
Deleting a food entry from its edit screen · deleting a Quick Calories entry from its edit screen · deleting a weight entry · deleting a meal · removing the USDA key.
- The dialog names the object; the destructive action is visually distinct.
- Deleting a meal that has entries MUST require picking another existing meal to reassign them to. Never silently delete diary history.
- Not in this list, so no dialog: the swipe-revealed Delete on a Diary entry or saved food. The row deletes immediately and offers a temporary Undo toast.
- Also confirmed: leaving a dirty Create Custom Food or Calories & Macros form (`Discard changes?`, UX-00).

## NAV-09 Route rules
- Routes pass IDs and lightweight context only, never DB objects.
- `origin` (Diary | Profile | Weight History) decides where save/cancel return.
- DB-backed screens reload by ID after mutations, so totals can't go stale.
- No routes for anything in SCOPE-10.
