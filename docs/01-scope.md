# 01 Scope (SCOPE)

Read when: deciding whether a feature belongs in the MVP. Local-first React Native calorie and food diary. Inspired by a reference app's daily diary layout and ruler portion selector.

## SCOPE-01 In scope
- Daily calorie and carb/protein/fat goals (user-entered; no automatic calculation, SCOPE-10).
- Configurable meals (SCOPE-02).
- Log foods into meals; search USDA FoodData Central + Open Food Facts.
- Quick Calories: calories without a food (SCOPE-05).
- Custom foods (SCOPE-06).
- Ruler serving selector with live kcal/macro updates (SCOPE-07).
- Diary per date: date-strip or large overview chevrons change days; Today action and calendar jump. Past, today and future dates all editable.
- Entries shown directly under their meal; tap any entry on the Diary to edit it.
- Dashboard entry/meal menus copy an item or whole meal to a chosen date and meal; swipe an entry left to reveal Delete.
- Body weight: current, goal, history.
- Unit preferences (SCOPE-08).
- Food Search sections: reorder and show/hide `My foods`, `Saved`, `Open Food Facts`, `USDA` (UX-18, DATA-19).
- Nutrient details beyond macros (user decision 2026-09-30): Food Detail lists every catalog nutrient a food carries; the Diary opens the day's totals for user-chosen nutrients; custom foods may carry them (DATA-20/21, UX-02, UX-05, UX-21).
- Android home-screen widget showing today's calories left (user decision 2026-09-30; UX-22). iOS widget not in scope.

## SCOPE-02 Configurable meals
- Defaults: Breakfast, Lunch, Dinner, Snacks.
- User can rename, add, delete and reorder. Examples of valid setups: `Breakfast / Morning Snack / Lunch / Afternoon Snack / Dinner`, `Meal 1…Meal 6`.
- MUST be stored as records, never hard-coded categories.

## SCOPE-03 Diary
- One date at a time. Changing the date changes everything: ring, macros, meals, entries, totals.
- When viewing today, the date strip may show Yesterday / Today / Tomorrow; farther from today it shows actual dates.
- Visible **Today** action whenever the selected date ≠ today. Calendar picker for any date.
- Future dates behave like normal days (no separate planning mode).
- Overview: calorie goal, consumed, remaining, circular calorie progress, carbs/protein/fat consumed vs target.
- Each meal: name, meal kcal total, `+` to add food, entries (name, serving, kcal), and a copy menu.

```text
BREAKFAST                     700 kcal  +
Scrambled eggs
2 × egg                           199 kcal
```

## SCOPE-04 Food logging and editing
- Flow: choose meal → search → pick result → ruler → save.
- Edit path: `Diary → tap entry → Edit`.
- Editing a food entry can change: amount (ruler), unit (when supported), meal; can also delete and save.
- Quick Calories entries open their own edit screen the same way.

## SCOPE-05 Quick Calories
- Fields: meal, calories, optional note.
- Stores calories only. Protein/carbs/fat are **unknown**, never 0.
- Editable and deletable from the Diary.

## SCOPE-06 Custom foods
- Required: name, calories, serving amount, serving unit, protein, carbs, fat. Optional: brand, catalog nutrients (DATA-20, UX-08).
- Stored locally; appear in future searches and in recents.

## SCOPE-07 Ruler
- Value fixed at center; ruler moves underneath.
- Smooth drag, snap to useful increments, live kcal + macros, multiple units when available, subtle haptics on useful ticks.

## SCOPE-08 Units
- Weight kg/lb · food weight g/oz · energy kcal/kJ · volume ml/fl oz.

## SCOPE-09 Food databases and storage
- Open Food Facts + USDA FoodData Central. User supplies their own USDA API key, stored in secure device storage (never SQLite/AsyncStorage).
- No backend. SQLite is the main store for diary entries, meals, goals, units, weight history, custom foods, recents, cached API foods and USDA config state.
- Weight history is stored from day one, even if the first UI is simple.

## SCOPE-10 Out of MVP — MUST NOT build or add placeholders for
Barcode scanner · accounts · cloud sync · social · recipes · meal plans · exercise tracking · Apple Health / Health Connect · AI food recognition · subscriptions · nutrition scoring · restaurant database · nutrient goals beyond kcal/macros · micronutrient reports or trends · automatic calorie-goal calculation · gamification/streaks.

Other docs refer to this list instead of repeating it.

## SCOPE-11 Success flows (acceptance)
1. Open → Today → meal → search "eggs" → select → ruler to 2 × egg → save → diary updates instantly.
2. Open → Quick Calories → Lunch → 450 kcal → save.
3. Open → tap an existing entry → change amount/unit/meal → save → diary updates instantly.

## SCOPE-12 Languages and region
- UI in **English** (default and fallback) and **European Portuguese (pt-PT)**. The app follows the device/OS per-app language; there is no in-app switcher.
- Primary market: Portugal. Units, decimals and dates follow the device locale.
- User data (food and meal names, notes) is never translated.
