# Section 5 — Visual Design Direction and Design System

## Purpose

This section defines the visual language and reusable interface system for Calorie Tracker.

The design is inspired by the strongest qualities of the supplied Runtastic Balance references: bright green navigation, clear calorie progress, compact macro summaries, flat diary lists, a central add action, and the ruler-style portion selector.

The adaptation is named **Modern Balance with compact density**. It preserves the reference application's efficient use of space while improving accessibility, consistency, typography, interaction feedback, and support for current iOS and Android conventions.

This is an original design system. It does not reuse the reference application's branding, logos, proprietary icons, photography, or exact visual assets.

---

## Design principles

### Information before decoration

The app exists to make daily logging quick. Every screen should prioritize the values and actions needed to complete the current task.

Decoration must not push diary content below the fold. Photography is limited to rare onboarding or empty-state use and does not appear in routine diary rows.

### Compact, not cramped

The interface should show meaningful information without excessive scrolling, but density must not reduce legibility or touch accessibility.

Compactness comes from:

- Flat lists instead of nested cards.
- Shared alignment and restrained padding.
- Short labels.
- Horizontal grouping of related values.
- Progressive disclosure of secondary details.
- Invisible expansion of touch targets where needed.

Compactness must not come from:

- Tiny text.
- Overlapping controls.
- Truncated essential values.
- Touch targets that are difficult to activate.
- Removing labels and relying only on color or unfamiliar icons.

### One clear focal point

Each screen has one dominant value or task. On Diary it is calories remaining. On Food Detail it is the selected serving amount. On Weight Entry it is the weight input.

Secondary information supports that focal point without competing through unnecessary size, color, or elevation.

### Green means progress and primary action

Green is the brand color and identifies the primary action, selected navigation state, calorie progress, and successful completion.

It must not be used indiscriminately. Neutral text, nutrient colors, warning colors, and destructive colors retain distinct meanings.

### Familiar mobile behavior

Controls follow platform conventions for back navigation, keyboard behavior, sheets, safe areas, text scaling, selection, and destructive confirmation.

The design should feel recognizably related across iOS and Android without forcing pixel-identical platform behavior.

---

## Reference interpretation

The ten reference screenshots contribute visual patterns, not product scope.

| Reference pattern | Calorie Tracker interpretation |
| --- | --- |
| Green app bars and selected states | Accessible deep green for navigation and primary actions |
| White content surface | Neutral, low-noise canvas with mostly flat sections |
| Large calorie ring | Compact diary focal point with remaining and consumed values |
| Three macro progress bars | One concise horizontal macro strip with separate colors and text labels |
| Yesterday / Today / Tomorrow | Compact date strip integrated with the Diary header |
| Meal symbols inside circles | Small neutral meal markers that work with configurable meal names |
| Minimal food lists | Two-line food rows with right-aligned energy values |
| Center `+` action | Raised center action in the three-item bottom navigation |
| Full-width green serving ruler | Branded ruler surface with fixed value indicator and unit strip |
| Green pill actions | Compact rounded primary buttons where a persistent action is needed |
| Uppercase section labels | Small semantic section labels used sparingly |

Barcode scanning, activity tracking, plans, social feeds, nutrition ratings, and other reference features remain outside the approved MVP.

---

## Density requirements

### Diary viewport target

On a typical phone viewport, the Diary should show without scrolling:

- The app and date headers.
- The calorie ring.
- All three macro summaries.
- At least two meal headers.
- At least one food row when the first meal contains an entry.
- The bottom navigation.

This target is evaluated at the default system text size. Larger accessibility text is allowed to increase row and section heights.

### Vertical budget

Recommended default heights, excluding safe-area insets:

| Element | Default visual height |
| --- | ---: |
| Top app bar | 52 pt |
| Date navigation strip | 42 pt |
| Diary overview including ring and macros | 210–224 pt maximum |
| Meal header | 44 pt |
| Single-line food row | 48 pt |
| Two-line food row | 52–56 pt |
| Add Food row | 42–44 pt |
| Standard settings row | 48–52 pt |
| Bottom navigation | 56 pt plus safe area |
| Sheet option row | 48 pt |
| Standard visual button | 44–48 pt |

These are targets rather than rigid constraints. Content, localization, and accessibility settings take priority.

### Avoid card inflation

Routine content uses a shared surface with dividers. Cards are reserved for content that must be perceived as a distinct object or temporary status.

Do not put every meal, setting, statistic, or form field in its own elevated rounded rectangle. One screen should generally use no more than one prominent card treatment at a time.

### Touch size without visual bulk

Interactive targets must be at least 44 × 44 pt on iOS and 48 × 48 dp on Android where possible.

Small visible icons use padding or `hitSlop` to reach the required interaction area without visually enlarging the row. Expanded hit areas must not overlap adjacent actions.

---

## Color system

### Brand palette

The brand keeps the energetic green character of the references but uses darker action colors so white text remains readable.

| Token | Light value | Intended use |
| --- | --- | --- |
| `green.50` | `#EAF8EF` | Selected tint, quiet success surface |
| `green.100` | `#D3F1DD` | Soft progress and focus background |
| `green.300` | `#70D68D` | Decorative progress and charts |
| `green.500` | `#3DBD63` | Brand accent and non-text progress |
| `green.600` | `#238447` | Primary controls and active icons |
| `green.700` | `#1D713D` | App bars and pressed controls |
| `green.800` | `#185C34` | High-contrast green text |

White text is used only on a green shade that passes the required contrast for its text size. The brighter accent greens are for progress graphics, outlines, and large non-text elements.

### Light semantic colors

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F6F8F6` | Screen background |
| `surface` | `#FFFFFF` | Primary content surface |
| `surfaceSubtle` | `#F0F3F1` | Inputs, grouped headers, quiet status |
| `textPrimary` | `#151A17` | Main text |
| `textSecondary` | `#606A63` | Supporting text |
| `textTertiary` | `#7A847D` | Nonessential labels that still pass contrast |
| `divider` | `#E0E5E1` | List and section separators |
| `borderStrong` | `#BBC5BE` | Inputs and focused structures |
| `primary` | `#238447` | Primary action and selected state |
| `primaryPressed` | `#1D713D` | Pressed primary action |
| `primaryTint` | `#EAF8EF` | Selected or success surface |
| `warning` | `#A56300` | Warnings and approaching limits |
| `warningTint` | `#FFF2D9` | Warning surface |
| `danger` | `#B83245` | Destructive actions and errors |
| `dangerTint` | `#FCE8EB` | Error surface |
| `focus` | `#1769D2` | Keyboard or assistive focus outline |
| `scrim` | `rgba(10, 18, 13, 0.46)` | Modal backdrop |

### Macronutrient colors

Each nutrient uses color, text, and stable placement. Color is never its only identifier.

| Nutrient | Token | Light value | Dark value |
| --- | --- | --- | --- |
| Carbohydrates | `macroCarbs` | `#2676C9` | `#6AACEE` |
| Protein | `macroProtein` | `#7450B8` | `#AD91E2` |
| Fat | `macroFat` | `#B86800` | `#E6A348` |

The calorie ring uses the brand green. An over-goal state adds an explicit label and warning/danger treatment rather than changing the ring to red without explanation.

### Dark semantic colors

| Token | Value |
| --- | --- |
| `canvas` | `#101411` |
| `surface` | `#171C18` |
| `surfaceSubtle` | `#202722` |
| `textPrimary` | `#F2F6F3` |
| `textSecondary` | `#B8C2BA` |
| `textTertiary` | `#99A39B` |
| `divider` | `#303832` |
| `borderStrong` | `#59645C` |
| `primary` | `#62D683` |
| `primaryPressed` | `#82E29B` |
| `primaryTint` | `#183D25` |
| `warning` | `#E6A348` |
| `warningTint` | `#3E2B10` |
| `danger` | `#F0818F` |
| `dangerTint` | `#461C24` |
| `focus` | `#72AAFF` |
| `scrim` | `rgba(0, 0, 0, 0.68)` |

Dark mode should retain the compact structure and hierarchy rather than adding glow, translucent glass panels, or heavier elevation.

---

## Typography

Use the native system typeface:

- San Francisco on iOS.
- Roboto on Android.

This avoids an additional font payload, respects platform metrics, and keeps dense layouts legible.

### Type scale

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `displayNumber` | 32 / 36 | 400 | Calories remaining, current weight |
| `screenTitle` | 21 / 26 | 600 | Screen title |
| `sectionTitle` | 17 / 22 | 600 | Meal Detail and major section headings |
| `body` | 16 / 21 | 400 | Primary rows and form values |
| `bodyStrong` | 16 / 21 | 600 | Meal names and emphasized values |
| `compact` | 14 / 18 | 400 | Serving descriptions and secondary values |
| `compactStrong` | 14 / 18 | 600 | Macro values and compact actions |
| `label` | 12 / 16 | 600 | Field and section labels |
| `micro` | 11 / 14 | 500 | Rare metadata where space is constrained |

Default body text must not fall below 14 pt for routine readable content. The `micro` style is limited to nonessential metadata and remains scalable.

### Numeric typography

Progress, calorie, macro, weight, and ruler values use tabular numbers so their width does not jump as values change.

Units use a smaller adjacent style while remaining part of the accessible text string.

### Capitalization

Use sentence case for screens, buttons, settings, and most labels. Uppercase is allowed only for short meal or section labels when it improves scanning.

Do not uppercase user-created meal names automatically. Preserve the user's entered capitalization.

---

## Spacing and layout

### Spacing scale

Use a four-point base grid.

| Token | Value |
| --- | ---: |
| `space.0` | 0 |
| `space.0_5` | 2 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.6` | 24 |
| `space.8` | 32 |

Most screens use 16 pt horizontal padding. Dense rows may align content at 12 pt inside an already padded parent. Twenty-four and 32 pt gaps are reserved for major separation, not routine stacking.

### Alignment

Primary text follows one strong leading edge. Calories and other comparable numeric values align to a shared trailing edge.

Icons occupy a predictable column and do not create different text starts from row to row.

### Responsive width

Phone layouts use the full available width. On large phones and tablets, reading and form content is capped at a comfortable width and centered, while diary lists may use a wider cap.

The system must not simply scale every component larger on a larger screen. Additional space improves margins or enables deliberate multi-column arrangements later.

---

## Shape, borders, and elevation

### Corner radii

| Token | Value | Use |
| --- | ---: | --- |
| `radius.small` | 6 | Value chips and compact controls |
| `radius.medium` | 10 | Inputs and modest containers |
| `radius.large` | 16 | Sheets and rare feature cards |
| `radius.pill` | 999 | Primary pill button and circular actions |

Routine diary rows and settings rows are not rounded cards.

### Borders

Use 1 px dividers for list structure and input boundaries. Hairline platform values may be used when they remain visible across device densities.

### Elevation

Elevation communicates layering, not decoration.

- Level 0: ordinary surfaces and list rows.
- Level 1: sticky navigation or floating center action.
- Level 2: bottom sheets, menus, and dialogs.

Avoid multiple shadow styles. Dark mode relies more on surface contrast and borders than shadows.

---

## Iconography

Use one consistent rounded icon family supported by the chosen Expo stack.

Default sizes:

- 20 pt for inline actions.
- 22–24 pt for navigation and standard rows.
- 28 pt for the central add action.

Icons use a 1.75–2 pt apparent stroke weight. Filled variants indicate selection only when the icon family provides a coherent pair.

Every unfamiliar icon has a visible or accessible label. Delete, save, and provider configuration actions must not depend on ambiguous icons alone.

Configurable meals cannot rely on fixed breakfast, lunch, or dinner illustrations. The default visual is a neutral outlined meal marker. A later enhancement may let users choose from a small accessible icon set without changing meal identity.

---

## App chrome and navigation

### Top app bar

The default app bar uses `green.700` in light mode with high-contrast foreground content. In dark mode it uses the dark surface with a green active accent unless testing confirms that a green bar remains comfortable.

The 52 pt content area includes:

- Back action when needed.
- Compact screen title.
- At most two trailing actions.

Large collapsing titles are not used in the MVP because they consume space without improving navigation.

### Diary date strip

The date strip sits directly under the Diary title within the same visual header family. It is 42 pt high and distributes previous, selected, and next dates evenly.

The selected date uses stronger text and a short underline or selection indicator. Unselected dates remain readable rather than appearing disabled.

When not viewing today, a compact **Today** action appears without creating a second toolbar.

### Bottom navigation

The bottom navigation is 56 pt plus device safe area and contains:

```text
Diary                 +                 Profile
```

Diary and Profile use icon plus label. Selected state uses green plus weight or fill; unselected state uses `textSecondary`.

The central `+` is a 48 pt circular button that rises no more than 8 pt above the bar. It has a clear border or filled treatment, a 28 pt plus icon, and a subtle level-1 shadow.

The center action must not create an oversized notch, decorative wave, or empty vertical region in the navigation bar.

---

## Diary overview

### Overview composition

The overview is one continuous surface, not a stack of cards.

```text
        calorie ring
       remaining value
     consumed supporting text

  Carbs       Protein       Fat
  value       value         value
  progress    progress      progress
```

The entire overview, including macros, should remain within 210–224 pt at the default text size.

### Calorie ring

Recommended default diameter: 136–148 pt.

Recommended stroke: 8–10 pt with rounded ends.

The ring contains:

- Large remaining energy value.
- Compact unit-aware label such as `kcal left`.
- Smaller consumed value below when space allows.

The ring background track uses the divider or subtle surface color. The progress arc uses brand green.

When the goal is exceeded:

- The central value changes to the amount over.
- The label explicitly says `kcal over`.
- Warning or danger color supplements the text.
- The screen-reader label announces the full state.

Decorative food imagery around the ring from the reference is not retained because it consumes vertical space and reduces clarity.

### Macro strip

All three macros share one horizontal row. Each column includes:

- Nutrient label.
- Consumed and target values.
- A 4 pt progress track.
- Optional unknown-data indicator.

The macro strip uses the nutrient colors defined above. When a Quick Calories or incomplete external food makes a macro total partial, display a small explicit indicator such as `Known: 82 g` or an info icon with an accessible explanation.

---

## Meal sections and diary rows

### Meal header

The default meal header is 44 pt high and uses:

- Optional 28 pt meal marker.
- User-configured meal name.
- Meal calorie total aligned right.
- A compact add action with an accessible 44/48 pt target.

Headers use a subtle surface tint or strong divider rather than an enclosing card. They remain visually distinct when a meal has no entries.

Long meal names receive the available center space and truncate only after the calorie total and add action remain visible. The full name is available to screen readers.

### Food row

A standard two-line food row is 52–56 pt:

```text
Food name                         199 kcal
2 eggs
```

Rules:

- Food name uses `body` or `bodyStrong` depending on hierarchy.
- Serving text uses `compact` and `textSecondary`.
- Energy uses tabular numbers and aligns with other rows.
- The entire row opens editing.
- A pressed state tints the row without shifting its layout.

Avoid per-row thumbnails, chevrons, shadows, and rounded containers. Direct interactivity is communicated by consistent behavior and pressed feedback.

### Quick Calories row

Quick Calories uses the same row height and alignment. A small lightning or plus-energy marker differentiates it from a food entry.

If a note exists, it occupies the primary text line and `Quick Calories` becomes supporting context. Unknown macros are represented in the accessible entry summary.

### Add Food row

The final row in each meal is a 42–44 pt text action using the primary green. It is visually lighter than a filled button and remains easy to scan.

---

## Meal Detail

Meal Detail retains the flat food-row system from Diary.

Its header summary is compact:

- Meal marker and calorie total.
- Selected date.
- One text action for **Copy meal**.

Do not use a large empty hero region like the historical reference. The first food row should begin near the top of the content area.

Add Food is available through the header action and a final list row. Duplicate access is acceptable when one remains visible and the other aids list completion, but neither should create a large persistent footer.

---

## Search and result lists

### Search header

Food Search uses a 48 pt search field directly below or within the app bar. The field includes:

- Search icon.
- Clear text action when populated.
- Loading indicator only while remote providers are active.

Quick Calories and Create Custom Food are compact actions near the top of the results, not large promotional tiles.

There is no barcode action.

### Search result

A result is typically 56–64 pt and includes:

- Food name.
- Optional brand or serving basis.
- Energy value.
- Compact source label when useful.

Provider badges use neutral text and do not compete with food identity. Results do not show product images by default.

Local, recent, cached, and remote sections use short sticky labels when the combined list would otherwise be confusing.

---

## Serving ruler

The ruler is the defining interaction and retains the strongest visual relationship to the references.

### Composition

```text
Food name                         live kcal
Serving context

                 2.00
                   ▼
 ┃  │  │  ┃  │  │  ┃  │  │  ┃
 0        1        2        3

          eggs    g    oz
```

### Dimensions

- Food summary: 56–64 pt.
- Floating value chip: approximately 64 × 42 pt.
- Ruler field: 108–120 pt.
- Unit selector: 42–44 pt.
- Total ruler module target: 196–218 pt.

The ruler is large enough for precise touch interaction but does not consume most of the screen.

### Appearance

The ruler field uses brand green with high-contrast ticks and labels. The fixed center pointer aligns with the floating value chip.

Major and minor ticks differ by length rather than color alone. Numeric labels appear only on major ticks.

The unit selector sits directly below the ruler and uses text tabs with a compact selection indicator. Only valid units are displayed.

### Behavior

- The pointer remains fixed while ticks move underneath.
- Values snap to useful increments.
- Live calories and macros update without layout jumping.
- Haptic feedback occurs only at meaningful tick points and is throttled.
- Reduced-motion mode removes decorative settling motion without changing ruler usability.
- Direct numeric entry may be offered through the value chip for accessibility and precision.

Nutrition detail below the ruler uses compact rows or disclosure sections. The MVP does not include the reference application's nutrition rating.

---

## Buttons and actions

### Primary button

- Minimum visual height: 44 pt.
- Horizontal padding: 16–20 pt.
- Pill or medium radius depending on available width.
- Filled accessible green with high-contrast text.
- One primary filled button per immediate task region.

Full-width buttons are reserved for important persistent actions such as Update Weight when no compact toolbar action is appropriate.

### Secondary button

Uses text or outline treatment. It must not visually compete with the primary action.

### Tertiary action

Text plus optional icon, with no container in its resting state. Used for Add Food, Copy Meal, Today, and similar contextual actions.

### Destructive action

Uses danger color and appears separately from primary save actions. Destructive confirmation dialogs use explicit verbs such as **Delete entry** rather than a generic **Yes**.

### Icon action

Visible icon size is 20–24 pt within the required touch area. A tooltip or accessible label provides its name.

---

## Forms and inputs

Forms use a compact vertical rhythm:

- 12–16 pt between related fields.
- 20–24 pt between distinct groups.
- Labels immediately above fields or as persistent inline labels when clarity remains.
- Field height of approximately 48 pt for single-line input.

Inputs use `surfaceSubtle` or a one-pixel boundary. They do not sit inside additional cards.

Validation messages appear directly below the relevant field and do not rely only on red. The message remains present until the error is resolved.

Numeric inputs:

- Open the appropriate numeric keyboard.
- Accept locale-aware decimal separators.
- Display the unit adjacent to the value.
- Preserve full precision internally while formatting appropriately.

The keyboard must not cover the active field or save action.

---

## Settings and Profile

Profile uses grouped flat lists inspired by the reference Settings screen.

Each row is 48–52 pt and contains:

- Optional leading icon.
- Clear label.
- Current value when it helps decision-making.
- Navigation indicator only when it opens another screen.

Section labels use `label`, restrained uppercase where appropriate, and 12–16 pt horizontal padding.

Current weight and goal weight may appear in one concise summary region above the settings list. Avoid a large dashboard card that pushes settings off-screen.

---

## Bottom sheets and dialogs

### Bottom sheets

Sheets are used for short, contextual choices:

- Add Action.
- Meal Picker.
- Serving Unit Picker.
- Copy Meal.
- Weight Entry when content fits comfortably.

Guidelines:

- Use the smallest practical snap height.
- Show a compact 4 × 36 pt drag handle.
- Use 48 pt option rows.
- Avoid empty top padding and oversized sheet titles.
- Expand to full height only when the keyboard or accessible text requires it.

### Dialogs

Dialogs are limited to confirmation and short critical information. They use clear titles, concise copy, and two actions when possible.

Do not use a dialog where a sheet, inline message, or full screen better supports the content.

---

## Feedback and status states

### Pressed

Rows and tertiary actions receive a subtle tint. Filled controls darken or lighten according to theme. Layout must not scale enough to cause surrounding movement.

### Focused

Keyboard and assistive focus uses a 2 px focus outline with sufficient contrast. Focus order follows visual order.

### Disabled

Disabled controls reduce emphasis but retain readable text. Opacity alone must not make labels fail contrast.

### Loading

Use a small inline spinner for short actions and skeleton shapes only where they meaningfully preserve layout. The local-first Diary should rarely need a full-screen loading state after startup.

### Empty

Empty states are compact and action-oriented:

```text
No foods logged for this meal.
+ Add food
```

Large illustrations are not required.

### Offline

Food Search shows an inline provider status while retaining local and cached results. The Diary does not show an offline banner unless connectivity affects the current action.

### Error

Field errors remain local to the field. Provider errors remain local to the provider section. Full-screen errors are reserved for cases where the screen cannot function.

### Success

Successful fast actions normally return to the updated screen. A short toast or banner is used only when the result would otherwise be unclear, such as copying a meal to another date.

---

## Motion and haptics

Motion reinforces cause and effect while remaining brief.

| Motion | Typical duration |
| --- | ---: |
| Press or color response | 100–150 ms |
| Row insertion or removal | 180–220 ms |
| Sheet or modal transition | 220–300 ms |
| Calorie and macro progress update | 250–400 ms |

Use platform-appropriate easing and interruptible interactions.

Do not animate the full Diary when one food row changes. Update the affected row and progress indicators.

Haptics are reserved for:

- Meaningful ruler ticks.
- Successful save where feedback is not otherwise obvious.
- Destructive confirmation when platform conventions support it.

Reduced-motion mode:

- Removes large translation and decorative progress animation.
- Uses fades or immediate updates.
- Preserves all information and interaction states.

---

## Accessibility

### Contrast

- Normal text targets WCAG AA contrast of at least 4.5:1.
- Large text targets at least 3:1.
- Essential control boundaries and graphical indicators target at least 3:1 against adjacent colors.
- Exact token combinations must be tested on-device before release.

### Text scaling

All meaningful text supports system scaling. At larger sizes:

- Horizontal macro layout may wrap or become a compact vertical list.
- Food rows expand rather than clip essential text.
- App-bar actions may move into an overflow menu.
- Fixed height targets become minimum heights.

### Screen readers

Interactive rows expose one coherent label and action.

Examples:

```text
Scrambled eggs, 2 eggs, 199 kilocalories. Button. Edit diary entry.
Protein, 41 of 150 grams. Some entries have unknown protein.
Calories remaining, 1,731 of 2,400 kilocalories.
```

Decorative graphics and duplicated labels are hidden from the accessibility tree.

### Color independence

Macro identity always includes text. Warning and error states include icons or words. Selected tabs use color plus weight, indicator, or fill.

### Gesture alternatives

Every swipe or drag interaction has a non-gesture alternative:

- Diary dates can be changed through buttons and the calendar.
- Ruler value can be adjusted through accessible increment/decrement actions or direct entry.
- Reordering meals provides accessible move actions in addition to drag-and-drop.

---

## Design tokens in React Native

Tokens should be semantic at the component boundary.

```ts
type Theme = {
  colors: {
    canvas: string;
    surface: string;
    surfaceSubtle: string;
    textPrimary: string;
    textSecondary: string;
    divider: string;
    primary: string;
    primaryPressed: string;
    primaryTint: string;
    danger: string;
    warning: string;
    macroCarbs: string;
    macroProtein: string;
    macroFat: string;
  };
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};
```

Feature components request semantic tokens such as `textPrimary` or `macroProtein`; they do not import raw green or purple values directly.

Reusable primitives should include:

- `AppText`
- `AppIcon`
- `PressableIcon`
- `PrimaryButton`
- `TextAction`
- `FormField`
- `ListRow`
- `SectionHeader`
- `ProgressTrack`
- `BottomSheet`
- `ConfirmationDialog`
- `InlineStatus`

Feature components build on these primitives:

- `CalorieRing`
- `MacroStrip`
- `DiaryDateStrip`
- `MealHeader`
- `DiaryEntryRow`
- `QuickCaloriesRow`
- `ServingRuler`
- `WeightSummary`

Primitives own theme, typography, focus, press, disabled, and accessibility behavior. Feature components should not recreate those rules.

---

## Visual QA requirements

Before a component is considered complete, review it in:

- Light and dark themes.
- iOS and Android.
- Small supported phone width.
- Large phone width.
- Default and large accessibility text.
- Empty, typical, long-content, loading, offline, error, and disabled states as applicable.
- Increased contrast or equivalent platform accessibility settings where available.
- Reduced motion.

Diary density should be checked with realistic long food names and user-configured meal names rather than short placeholder text only.

Screenshot regression tests may protect stable primitives and signature components, but visual review must also occur on real device densities.

---

## Acceptance criteria

Section 5 is satisfied when:

- The app clearly reflects the bright, food-focused simplicity of the references without copying their brand assets.
- The Diary uses a compact flat layout rather than a collection of oversized cards.
- The overview and beginning of multiple meals are visible on a typical phone without scrolling.
- Calorie, macro, meal, food, and serving information remain easy to scan.
- The serving ruler is visually distinctive and precise without occupying most of the screen.
- Interactive targets remain accessible despite compact visual presentation.
- Nutrients and state changes never rely only on color.
- Large text can expand layouts without hiding essential values or actions.
- Light and dark themes use the same semantic hierarchy.
- Design tokens can be implemented directly in React Native.
- Reusable primitives centralize state, theme, and accessibility behavior.
- Features excluded from the approved MVP do not appear in the visual system.

---

## Reference screenshots

The supplied visual references are:

- [Runtastic Balance 1](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_1.jpg)
- [Runtastic Balance 2](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_2.jpg)
- [Runtastic Balance 3](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_3.jpg)
- [Runtastic Balance 4](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_4.jpg)
- [Runtastic Balance 5](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_5.jpg)
- [Runtastic Balance 6](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_6.jpg)
- [Runtastic Balance 7](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_7.jpg)
- [Runtastic Balance 8](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_8.jpg)
- [Runtastic Balance 9](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_9.jpg)
- [Runtastic Balance 10](https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_10.jpg)
