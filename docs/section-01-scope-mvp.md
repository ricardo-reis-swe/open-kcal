# Section 1 — Scope and MVP

## Product goal

Build a focused React Native calorie and food diary app inspired by the strongest interactions from the reference app, especially the daily diary layout and ruler-style portion selector.

The MVP should be local-first, fast to use, and intentionally narrow in scope.

## Core user goals

A user should be able to:

- Set daily calorie and macro goals.
- Configure their own meals instead of being locked to Breakfast, Lunch, Dinner, and Snacks.
- Log foods into those meals.
- Add calories quickly without searching for a food.
- Search foods from USDA FoodData Central and Open Food Facts.
- Adjust serving sizes with a ruler-style control.
- See calories and macros update immediately.
- Swipe horizontally between diary dates.
- Jump quickly back to Today.
- Log and edit past, current, and future days.
- See each food item directly underneath its meal in the diary.
- Edit a diary item directly by tapping it on the dashboard.
- Open a meal to see and edit its contents.
- Track body weight.
- Configure measurement units.

---

## Configurable meals

The app ships with these defaults:

- Breakfast
- Lunch
- Dinner
- Snacks

Users can:

- Rename meals.
- Add meals.
- Delete meals.
- Reorder meals.

Examples of valid meal setups:

- Breakfast / Morning Snack / Lunch / Afternoon Snack / Dinner
- Meal 1 / Meal 2 / Meal 3 / Meal 4 / Meal 5 / Meal 6

Meals must be stored as configurable records rather than hard-coded categories.

---

## Diary and date navigation

The diary is horizontally scrollable by day.

The user can swipe between adjacent dates. The whole diary view changes with the selected date, including:

- Calorie ring.
- Macro totals.
- Meals.
- Food entries.
- Daily totals.

When viewing today, the date navigation can visually communicate Yesterday / Today / Tomorrow.

When farther away from today, actual dates should be shown for clarity.

Users can freely log food into future dates for meal planning.

The diary must also provide:

- A visible **Today** action whenever the selected date is not today.
- A calendar picker for jumping directly to any date.

Future dates should behave like normal diary days rather than using a separate planning mode.

---

## Daily overview

Each diary day includes:

- Daily calorie goal.
- Calories consumed.
- Calories remaining.
- Circular calorie progress widget.
- Carbohydrates consumed versus target.
- Protein consumed versus target.
- Fat consumed versus target.

Example concept:

```text
        1,731
       Cal left

Carbs       Protein       Fat
82 / 250g   41 / 150g     25 / 80g
```

---

## Diary meals

Each meal on the main diary screen shows:

- Meal name.
- Meal calorie total.
- Individual food entries underneath.
- Serving amount for each entry.
- Calories for each entry.
- An Add Food action.

Example:

```text
BREAKFAST                         700 kcal

Scrambled eggs
2 eggs                            199 kcal

Coffee with cream
1 cup                              50 kcal

Whole wheat bread
2 slices                          256 kcal

+ Add food
```

A meal header can open a dedicated meal-detail screen.

---

## Direct dashboard item editing

Every diary entry displayed on the main diary/dashboard is directly interactive.

Tapping a food row opens that specific diary entry in edit mode without requiring the user to open Meal Detail first.

Example path:

```text
Diary → tap food → Edit Entry
```

The Meal Detail path must also work:

```text
Diary → tap meal header → Meal Detail → tap food → Edit Entry
```

When editing a normal food entry, the user can:

- Change serving amount using the ruler.
- Change serving unit when supported.
- Change the meal.
- Delete the entry.
- Save changes.

Quick Calories entries must behave the same way: tapping them on the dashboard opens their edit screen.

---

## Food logging

The normal food logging flow is:

```text
Choose meal
→ search food
→ choose result
→ adjust portion with ruler
→ save
```

Food search uses:

- USDA FoodData Central.
- Open Food Facts.

Barcode scanning is **not part of the MVP**.

---

## Quick Calories

Quick Calories is part of the MVP.

It is intended for cases where the user knows the calorie amount but does not want to search for a food.

Fields:

- Meal.
- Calories.
- Optional note.

Example:

```text
Quick Calories

Meal
Lunch

Calories
450

Optional note
Restaurant meal

[ Add ]
```

A Quick Calories entry stores calories only.

Protein, carbs, and fat remain unknown rather than being assumed to be zero.

Quick Calories entries can be edited or deleted later by tapping them directly in the diary.

---

## Custom foods

If the user cannot find a suitable food, they can create one manually.

Minimum fields:

- Food name.
- Calories.
- Serving amount.
- Serving unit.
- Protein.
- Carbohydrates.
- Fat.

Brand is optional.

Custom foods are stored locally and should appear in future searches and recent-food flows.

---

## Ruler serving selector

The ruler is one of the app's defining interactions.

The selected value stays visually fixed in the center while the ruler moves underneath it.

Concept:

```text
              2.00
                ▼

|   |   |   |   |   |   |   |
0       1       2       3

         eggs   g   oz
```

The ruler should support:

- Smooth dragging.
- Snapping to useful increments.
- Live calorie updates.
- Live macro updates.
- Multiple valid serving units when available.
- Subtle haptic feedback on useful tick points.

---

## Meal detail

Opening a meal shows:

- Selected date.
- Meal name.
- Meal calorie total.
- List of foods.
- Serving amounts.
- Edit food.
- Delete food.
- Add food.
- Copy meal.

Copying meals should support at least:

- Copy to today.
- Copy to tomorrow.
- Choose another date.

---

## Weight tracking

The MVP includes:

- Current weight.
- Goal weight.
- Weight-entry history.
- Update-weight action.

Weight history should be stored from the beginning even if the first UI is simple.

---

## Profile and settings

The MVP Profile area contains:

- Calories & Macros.
- Meals.
- Units.
- Weight Goal.
- Food Databases / USDA API Key.

---

## Units

Support:

- Weight: kg / lb.
- Food weight: g / oz.
- Energy: kcal / kJ.
- Volume: ml / fl oz.

---

## Food databases

The app uses:

- Open Food Facts.
- USDA FoodData Central.

For the MVP, the user supplies their own USDA API key.

The USDA API key must be stored in secure device storage rather than ordinary SQLite or AsyncStorage.

No backend is required for the MVP.

---

## Local storage

The app is local-first.

Store locally:

- Diary entries.
- Meal definitions.
- Goals.
- Unit preferences.
- Weight history.
- Custom foods.
- Recent foods.
- Cached API foods.
- USDA configuration.

SQLite is the main persistent database.

---

## Explicitly out of MVP

The following are intentionally excluded from the MVP:

- Barcode scanner.
- Accounts.
- Cloud sync.
- Social features.
- Recipes.
- Meal plans.
- Exercise tracking.
- Apple Health / Health Connect.
- AI food recognition.
- Subscriptions.
- Nutrition scoring.
- Restaurant database.
- Micronutrient-focused UI.
- Automatic calorie-goal calculation.
- Gamification and streaks.

---

## MVP success flows

Primary flow:

```text
Open app
→ Today
→ choose a meal
→ search "eggs"
→ select food
→ ruler to 2 eggs
→ save
→ diary updates instantly
```

Fast calorie-only flow:

```text
Open app
→ Quick Calories
→ Lunch
→ 450 kcal
→ save
```

Direct edit flow:

```text
Open app
→ tap an existing diary item
→ edit amount / unit / meal
→ save
→ diary updates instantly
```
