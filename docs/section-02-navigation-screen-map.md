# Section 2 — Navigation and Screen Map

## Navigation principles

The MVP uses a small, task-focused navigation model:

- **Diary** is the default destination and the center of day-to-day use.
- The central **+** action starts food and weight logging flows without acting as a persistent screen.
- **Profile** contains progress, goals, preferences, configurable meals, units, and food database settings.
- A selected diary date remains in context while the user opens meals, adds food, or edits entries.
- The Android system back action and iOS back gesture follow the same hierarchy as visible back or close controls.

The bottom navigation contains exactly three items:

```text
Diary                 +                 Profile
```

`Diary` and `Profile` are navigation destinations. The center `+` is an action button that opens a bottom sheet; it does not own a tab stack and is never shown as selected.

---

## Root navigation structure

```text
App Root
├── Main Tabs
│   ├── Diary Stack
│   │   ├── Diary
│   │   ├── Meal Detail
│   │   ├── Food Search
│   │   ├── Food Detail / Add Entry
│   │   ├── Edit Food Entry
│   │   ├── Quick Calories
│   │   ├── Edit Quick Calories
│   │   └── Create Custom Food
│   └── Profile Stack
│       ├── Profile
│       ├── Calories & Macros
│       ├── Meals
│       ├── Add / Edit Meal
│       ├── Units
│       ├── Weight Goal
│       ├── Weight History
│       └── Food Databases / USDA API Key
└── App-level overlays
    ├── Add Action Sheet
    ├── Date Picker
    ├── Meal Picker
    ├── Serving Unit Picker
    ├── Copy Meal Sheet
    ├── Weight Entry Sheet
    └── Destructive-action Confirmation Dialogs
```

The Diary and Profile tabs each retain their own stack state when switching tabs. Returning to a tab restores the last screen in that tab unless the user taps the already-selected tab, which returns that tab to its root screen.

---

## Bottom navigation behavior

### Diary

Tapping **Diary** opens the diary for the currently selected date. On a fresh app launch, the selected date is today.

The Diary root screen contains:

- Date navigation.
- A calendar picker action.
- A visible **Today** action whenever the selected date is not today.
- Daily calorie and macro progress.
- User-configured meals in their saved order.
- Food and Quick Calories entries beneath their assigned meals.
- An **Add Food** action for every meal.

Tapping the selected Diary tab while deeper in the Diary stack returns to the Diary root without changing the selected date. Tapping it while already at the root scrolls the diary to the top.

### Central + action

Tapping **+** opens the **Add Action Sheet** over the current screen. The sheet offers:

- **Add Food**
- **Quick Calories**
- **Update Weight**

`Add Food` and `Quick Calories` need a target meal. If the action starts from a meal-specific control, that meal is already selected. If it starts from the global `+`, the app asks the user to select from their current configurable meals before continuing.

The selected diary date is used for food and Quick Calories entries. Updating weight is date-aware but defaults to today rather than the selected diary date; the user can change the entry date in the Weight Entry sheet.

The `+` button must not contain a barcode option because barcode scanning is outside the MVP.

### Profile

Tapping **Profile** opens the Profile root screen. It provides access to:

- Weight summary and history.
- Calories & Macros.
- Meals.
- Units.
- Weight Goal.
- Food Databases / USDA API Key.

Profile is for configuration and history, not daily food logging. The global `+` remains available from Profile so the user can quickly add food, Quick Calories, or weight without returning to Diary first.

---

## Diary stack

### 1. Diary

**Purpose:** Show the complete diary for one date and act as the main app screen.

**Primary navigation:**

- Swipe horizontally to the adjacent day.
- Tap the calendar action to open the Date Picker.
- Tap **Today** to return directly to today.
- Tap a meal header to open Meal Detail for that meal and date.
- Tap a food row to open Edit Food Entry for that specific diary entry.
- Tap a Quick Calories row to open Edit Quick Calories for that specific diary entry.
- Tap a meal's **Add Food** action to open Food Search with the meal and date preselected.

Changing dates replaces the entire daily view, including calorie progress, macros, meal totals, and entries. Past, current, and future dates use the same screen and behavior.

### 2. Meal Detail

**Purpose:** Show and manage one configurable meal on one date.

**Required context:**

- `mealId`
- `date`

The screen shows the meal name, selected date, calorie total, food entries, Quick Calories entries, **Add Food**, and **Copy Meal**.

**Navigation:**

- Tap a normal food entry to open Edit Food Entry.
- Tap a Quick Calories entry to open Edit Quick Calories.
- Tap **Add Food** to open Food Search with this meal and date preselected.
- Tap **Copy Meal** to open the Copy Meal sheet.
- Back returns to the same date in Diary.

Meal identity is always based on `mealId`, not on a hard-coded name such as Breakfast or Lunch.

### 3. Food Search

**Purpose:** Find a USDA, Open Food Facts, recent, or locally created custom food.

**Required context:**

- `date`
- `mealId`

The screen includes:

- Search input.
- Recent foods before a query is entered.
- Local custom-food results.
- USDA FoodData Central results when configured.
- Open Food Facts results.
- A **Create Custom Food** action for missing foods.

Results should identify their source. The screen has no barcode action.

**Navigation:**

- Tap a result to open Food Detail / Add Entry.
- Tap **Create Custom Food** to open Create Custom Food while preserving the target date and meal.
- Back returns to the initiating Diary or Meal Detail screen without creating an entry.

### 4. Food Detail / Add Entry

**Purpose:** Configure a selected food before adding it to the diary.

The screen shows food identity, available serving units, the ruler serving selector, calculated calories and macros, target meal, and target date.

**Actions:**

- Adjust the serving amount with the ruler.
- Change serving unit when the selected food supports alternatives.
- Change the target meal through the Meal Picker.
- Save the entry.
- Cancel or go back without saving.

Saving writes the entry and returns to the initiating Diary or Meal Detail screen. That screen refreshes immediately and keeps the target date visible.

### 5. Edit Food Entry

**Purpose:** Edit one existing normal food diary entry.

**Required context:**

- `entryId`

The screen resolves the date, meal, food, serving data, and nutrition values from the entry. It supports:

- Serving amount changes through the ruler.
- Supported serving-unit changes.
- Reassignment to any current configurable meal.
- Save.
- Delete.

Save returns to the exact originating screen: Diary for direct dashboard editing, or Meal Detail when opened from that meal. If the meal changes while editing from Meal Detail, return to Diary so the result is not hidden on a now-unrelated meal screen.

Delete requires confirmation, then returns to the originating screen and refreshes its totals immediately.

### 6. Quick Calories

**Purpose:** Create a calorie-only diary entry.

**Required context:**

- `date`
- `mealId`, either preselected or chosen before the screen opens

The screen contains:

- Meal.
- Calories.
- Optional note.
- Add action.

Changing the meal opens the Meal Picker. Saving returns to the initiating Diary or Meal Detail screen and updates daily and meal totals immediately. Protein, carbohydrates, and fat remain unknown.

### 7. Edit Quick Calories

**Purpose:** Edit an existing Quick Calories entry.

**Required context:**

- `entryId`

The screen supports changing the meal, calorie amount, and optional note, plus save and delete. It follows the same return and delete-confirmation rules as Edit Food Entry.

### 8. Create Custom Food

**Purpose:** Create a reusable local food when search does not provide a suitable result.

The screen contains the approved minimum food fields:

- Food name.
- Calories.
- Serving amount.
- Serving unit.
- Protein.
- Carbohydrates.
- Fat.
- Optional brand.

When opened from Food Search, saving the custom food stores it locally and continues to Food Detail / Add Entry with that food selected and the original date and meal preserved. It does not add the food to the diary automatically.

Cancel returns to Food Search with the previous query and results intact.

---

## Date navigation and Date Picker

The selected diary date belongs to the Diary stack rather than to an individual component. It must survive navigation to Meal Detail, Food Search, add/edit screens, and tab switching.

The Date Picker opens as an app-level modal from Diary and any diary-related screen that exposes its date control.

**Date Picker behavior:**

- Opens with the active diary date selected.
- Allows selection of past, current, or future dates.
- Confirming a date closes the modal and returns to Diary on that date.
- Canceling closes the modal without changing the active date.
- Choosing today has the same result as the Diary **Today** action.

No separate future-planning route or mode exists.

---

## Profile stack

### 1. Profile

**Purpose:** Provide the user's current weight summary and all MVP settings destinations.

The root screen shows current weight, goal weight, an **Update Weight** action, a link to Weight History, and settings rows for Calories & Macros, Meals, Units, Weight Goal, and Food Databases / USDA API Key.

### 2. Calories & Macros

Allows editing the daily calorie, carbohydrate, protein, and fat goals. Saving returns to Profile and updates diary targets immediately.

### 3. Meals

Shows all meal records in their saved display order. The defaults may begin as Breakfast, Lunch, Dinner, and Snacks, but the navigation and UI treat them as ordinary editable records.

The screen supports:

- Reordering meals directly in the list.
- Opening a meal in Add / Edit Meal.
- Adding a new meal through Add / Edit Meal.
- Deleting a meal through a confirmation flow.

If deleting a meal that has diary entries requires entry reassignment, the confirmation flow must require selection of another existing meal before deletion completes. The app must not silently delete diary history.

### 4. Add / Edit Meal

Supports creating a meal or renaming an existing meal. Save returns to Meals. Delete is available only in edit mode and uses the same protected deletion behavior described above.

### 5. Units

Allows selection of:

- Weight: kg or lb.
- Food weight: g or oz.
- Energy: kcal or kJ.
- Volume: ml or fl oz.

Changes apply across Diary, food add/edit screens, weight screens, and Profile after saving.

### 6. Weight Goal

Allows the user to view and edit their goal weight in the configured weight unit. Save returns to Profile.

### 7. Weight History

Shows dated weight entries and exposes an **Update Weight** action. Selecting an existing history row opens the Weight Entry sheet in edit mode.

### 8. Food Databases / USDA API Key

Shows the two MVP food sources:

- Open Food Facts.
- USDA FoodData Central.

The screen allows the user to add, replace, or remove their USDA API key and explains whether USDA search is currently available. The key is written to secure device storage. It is never displayed in full after saving.

---

## Modal, sheet, and dialog flows

### Add Action Sheet

Opened by the central `+`. It is dismissible by swiping down, tapping outside, or using back. Selecting an action closes the sheet before opening the next route or sheet.

```text
+
├── Add Food → Meal Picker → Food Search
├── Quick Calories → Meal Picker → Quick Calories
└── Update Weight → Weight Entry Sheet
```

If a valid meal is already in context, the Meal Picker step is skipped.

### Meal Picker

Shows current meal records in user-defined order. It is used when globally adding food or Quick Calories and when changing an entry's meal. It must never assume a fixed set of meal names.

### Serving Unit Picker

Shows only units valid for the selected food. Selecting a unit closes the picker and recalculates the ruler value, calories, and macros.

### Copy Meal Sheet

Opened from Meal Detail. It offers:

- Copy to today.
- Copy to tomorrow.
- Choose another date.

If the source is already today or tomorrow, the corresponding shortcut still refers to that absolute destination date. Choosing another date opens the Date Picker in destination-selection mode. The copy targets the same `mealId` on the destination date and then returns to the source Meal Detail with a success confirmation.

### Weight Entry Sheet

Opened from the global `+`, Profile, or Weight History. Create mode defaults to today's date and the configured weight unit. Edit mode loads the chosen history record.

The sheet contains:

- Date.
- Weight.
- Configured weight unit.
- Save.
- Delete in edit mode.

Saving closes the sheet and refreshes Profile and Weight History where applicable.

### Confirmation dialogs

Confirmation is required before:

- Deleting a food diary entry.
- Deleting a Quick Calories entry.
- Deleting a weight entry.
- Deleting a configured meal.
- Removing a stored USDA API key.

Dialogs name the affected object and make the destructive action visually distinct.

---

## Required user paths

### Add a normal food from a meal

```text
Diary
→ meal Add Food
→ Food Search
→ select result
→ Food Detail / Add Entry
→ adjust portion
→ Save
→ Diary on the same date
```

### Add a normal food from the global action

```text
+
→ Add Food
→ Meal Picker
→ Food Search
→ select result
→ Food Detail / Add Entry
→ Save
→ Diary on the target date
```

### Direct dashboard item editing

```text
Diary
→ tap food row
→ Edit Food Entry
→ Save or Delete
→ Diary on the same date
```

### Edit through Meal Detail

```text
Diary
→ tap meal header
→ Meal Detail
→ tap entry
→ Edit Food Entry or Edit Quick Calories
→ Save or Delete
→ Meal Detail, or Diary if reassigned to another meal
```

### Quick Calories

```text
+
→ Quick Calories
→ Meal Picker
→ enter calories and optional note
→ Add
→ Diary on the target date
```

### Create and log a custom food

```text
Food Search
→ Create Custom Food
→ Save
→ Food Detail / Add Entry
→ adjust portion
→ Save
→ Diary or Meal Detail
```

### Update weight

```text
+ or Profile or Weight History
→ Weight Entry Sheet
→ enter date and weight
→ Save
→ return to the initiating screen
```

### Jump to a date

```text
Diary
→ Date Picker
→ select any date
→ Diary on selected date
```

---

## Navigation state and route contracts

Navigation routes should pass stable identifiers and lightweight context, not copied database objects.

| Route | Required parameters | Optional parameters |
| --- | --- | --- |
| Diary | None | `date` |
| Meal Detail | `mealId`, `date` | None |
| Food Search | `mealId`, `date` | `initialQuery`, `origin` |
| Food Detail / Add Entry | `foodId`, `foodSource`, `mealId`, `date` | `origin` |
| Edit Food Entry | `entryId` | `origin` |
| Quick Calories | `mealId`, `date` | `origin` |
| Edit Quick Calories | `entryId` | `origin` |
| Create Custom Food | `mealId`, `date` | `initialName`, `origin` |
| Add / Edit Meal | `mode` | `mealId` in edit mode |
| Weight Entry | `mode` | `weightEntryId` in edit mode, `date` |

`origin` identifies whether the flow began from Diary, Meal Detail, Profile, or Weight History so save and cancel can return predictably. Database-backed screens reload by identifier after mutations so displayed totals and values cannot become stale.

---

## Out-of-scope navigation

The MVP navigation must not expose placeholder routes for excluded features. In particular, it includes no routes for barcode scanning, accounts, cloud sync, social features, recipes, meal plans, exercise, health-platform integrations, AI recognition, subscriptions, restaurant search, nutrition scoring, or streaks.
