# 05 Design system (DS)

Read when: building or styling any UI. Values (colors, type, spacing, radii, sizes, motion): `src/shared/theme/tokens.ts` (source of truth). This doc holds the rules. Per-screen layout: `06-screens.md`.

Name: **Modern Balance, compact density**. An original system inspired by Runtastic Balance (refs: `https://mobile-cdn.softpedia.com/apk/images/runtastic-balance_{1..10}.jpg`). MUST NOT reuse its branding, logos, icons, photos or assets. Visual patterns only, not scope (SCOPE-10).

## DS-01 Principles
- **Information before decoration.** Nothing decorative pushes diary content below the fold. No photos in routine rows (rare onboarding/empty use only).
- **Compact, not cramped.** Get density from flat lists, shared alignment, short labels, horizontal grouping, progressive disclosure and invisible hit expansion. NEVER from tiny text, overlaps, truncated essential values, small targets, or color/icon-only meaning.
- **One focal point per screen.** Diary = kcal remaining. Food Detail = serving amount. Weight Entry = weight input.
- **Green = progress + primary action + selected nav + success.** Don't use it indiscriminately. Neutral, nutrient, warning and danger colors keep their own meanings.
- **Platform conventions** for back, keyboard, sheets, safe areas, text scaling, selection and destructive confirmation. Related across iOS/Android, not pixel-identical.

## DS-02 Density
- Diary at default text size on a typical phone shows, without scrolling: app bar + date strip, calorie ring, all 3 macros, ≥2 meal headers, ≥1 food row (if the first meal has one), bottom nav.
- Heights in `sizes` are targets. Content, localization and accessibility win.
- **No card inflation:** routine content is a shared surface + dividers. Cards only for distinct objects or temporary status; ≤1 prominent card per screen. Meals, settings, stats and fields are never individual elevated cards.
- Touch targets ≥44×44 (iOS) / 48×48 (Android) where possible, via padding or `hitSlop`, without growing the visual. Expanded areas must not overlap neighbors.

## DS-03 Color
- White text only on greens that pass contrast for that size; bright greens are for progress/graphics/outlines.
- Macros: fixed color + text label + fixed position (carbs, protein, fat). Color is never the only identifier.
- Calorie ring is brand green. Over goal → explicit label + warning/danger color, never an unexplained red ring.
- Light and dark themes from `tokens.ts`. UX-23 picks one or follows the OS (`System`, the default). Dark keeps the same structure and hierarchy: no glow, glass or heavier shadows; it relies on contrast + borders, not shadows (DS-05). System UI (keyboard, date picker, alerts) follows the chosen scheme. Before the DB is ready (launch, UX-20 recovery) the app follows the OS.

## DS-04 Type
- System font. Routine readable text ≥14 (`compact`). `micro` only for nonessential metadata and it still scales.
- Tabular numbers for kcal, macros, weight, progress and ruler. Units in a smaller adjacent style but part of the accessible string.
- Sentence case everywhere. Uppercase only for short meal/section labels when it helps scanning. NEVER auto-uppercase user meal names; keep the user's capitalization.

## DS-05 Layout
- 4pt grid. Screen horizontal padding 16; dense rows may inset 12 inside a padded parent. 24/32 only for major separation.
- One leading text edge; comparable numbers share a trailing edge; icons sit in a fixed column.
- Phones: full width. Large phones/tablets: cap and center reading/form width (diary lists may be wider). Never just scale components up.
- Radii: `small` chips/compact controls · `medium` inputs/modest containers · `large` sheets/rare cards · `pill` primary pill + circles. Rows are never rounded cards.
- Dividers 1px (a platform hairline is fine if it stays visible).
- Elevation: 0 surfaces/rows · 1 sticky nav / center action · 2 sheets/menus/dialogs. One shadow style.

## DS-06 Icons
- One rounded icon family from the Expo stack. Sizes and stroke in `sizes.icon`. Filled = selected only if the family has coherent pairs.
- Unfamiliar icons get a visible or accessible label. Delete, save and provider config never rely on an ambiguous icon alone.
- Meals use a neutral outlined marker, never breakfast/lunch/dinner art (a user-chosen icon set may come later without changing meal identity).

## DS-07 Chrome
- **App bar** (52): light = `appBar` green + high-contrast content; dark = surface + green accent. Back (when needed), compact title, ≤2 trailing actions. A screen's major commit action (`Add`, `Save`) is a right-aligned text action here, iOS-style; it is never duplicated at the bottom. No large collapsing titles.
- **Date strip** (42): directly under the Diary title, same header family; prev / selected / next evenly spaced. Selected = stronger text + short underline or selection indicator. Unselected stays readable (not disabled-looking). Compact **Today** when not on today, with no second toolbar.
- **Bottom nav** (56 + safe area): `Diary  +  Profile`. Diary/Profile = icon + label; selected = green + weight/fill, unselected = `textSecondary`. `+` = 48 circle, rises ≤8, border or fill, 28 icon, level-1 shadow. No oversized notch, wave or empty band. Hide the entire bottom nav while the software keyboard is open; restore it when the keyboard closes.

## DS-08 Diary components
- **Overview**: one continuous surface (no cards), 210–224 total. Ring (136–148, stroke 8–10, round caps, track = divider/subtle) with large previous/next day chevron buttons at its sides. Ring: remaining value (`displayNumber`) + unit-aware label `kcal left`; no persistent consumed line or no-goal message. Ring tap toggles an inner `Consumed` tooltip with `<consumed>/<goal> kcal` when a goal applies. Over goal: show the amount over + `kcal over` + warning/danger color + full screen-reader state. No food imagery around the ring.
- **Macro strip**: one row, 3 columns, each with label, consumed/target, 4pt track in its macro color, and an optional unknown indicator (`Known: 82 g` or info icon with an accessible explanation) when Quick Calories or incomplete foods make the total partial. A compact centered chevron handle under the strip (full touch target via hit slop, label `Show more nutrients` / `Hide more nutrients`, expanded state exposed) toggles the nutrient panel, which opens between the strip and the handle. The strip itself never changes width or position. **Why:** a trailing chevron in the strip's row squeezed the 3 columns into one (2026-09-30).
- **Nutrient panel** (UX-02): directly under the macro strip, same surface, compact. A wrapping grid of `<name> <value> <unit>` items (`compact`, value tabular), with the same unknown indicator as the macros. No tracks or targets. Open/close animates height; reduced motion switches instantly.
- **Meal header** (44): user name, kcal right-aligned, `…` menu, compact add action (full touch targets). No leading marker or chevron. Subtle tint or strong divider, not a card; still distinct when empty. Long names truncate before kcal/actions lose space; full name goes to the screen reader.
- **Food row** (52–56, two lines): name `body`/`bodyStrong`; serving followed immediately by kcal (tabular) on the second line in `compact` `textSecondary`; `…` menu. Main row opens edit; a left swipe reveals a danger `Delete` button (trash icon + label) at the trailing edge; tapping it deletes the row and shows Undo. A short swipe, a right swipe or a tap on the open row closes it (user decision 2026-09-30). Pressed = tint, no layout shift. NO thumbnail, chevron, shadow or rounded container.
- **Quick Calories row**: same size/alignment + small lightning/energy marker. If a note exists it's the primary line and "Quick Calories" is secondary. Unknown macros are stated in the accessible label.
- **Empty meal line**: `No foods logged` in `compact` `textSecondary` under the header; no Add Food row (the header `+` adds).

## DS-09 Other components
- **Search**: 48 field under/in the app bar with search icon, clear (when filled), a trailing `barcode-outline` scan button (48 target, a11y label), spinner only while remote providers load. Quick Calories and Create Custom Food are compact actions near the top, not tiles. Result (56–64): name, brand or basis, kcal, neutral source label when useful (must not compete with food identity). No product images by default. Short sticky section labels (local/recent/cached/remote) when mixing would confuse.
- **Ruler** (module 196–218): summary (name, live kcal, serving context) → floating value chip over a fixed center pointer → full-width green field with high-contrast ticks hanging from its top edge (major/minor differ by **length**; a major on every `majorStep` with its value printed below; pointer is a notch, no center line; geometry and fling copied from the Runtastic Balance ruler, 2026-09-29; `patches/react-native-ruler-picker+*.patch` adds the labels) → text unit tabs directly below with a compact selection indicator (valid units only). Pointer fixed, ticks move; snap to useful increments; live kcal/macros with no layout jump; throttled haptics on meaningful ticks; reduced motion removes settle animation only; value chip may open direct numeric entry. Nutrition below = compact rows/disclosure; the UX-05 Nutrition facts list uses `compact` name/value rows under short group labels, values tabular and right-aligned, up to the catalog's display decimals. No nutrition rating.
- **Scanner** (UX-24): normal app bar; the camera preview fills the body with a rounded frame guide (~70% width, 2px white stroke over a dimmed `scrim` surround). Hint, manual entry and every state message sit on a `surface` panel below the preview, never as text over the camera image.
- **Actions**: Major form commits use a labelled text action at the trailing edge of the app bar or sheet header; it has a full touch target plus disabled/loading states. Filled primary buttons are reserved for important in-content actions without a header alternative (e.g. Update Weight), ≥44 high with 16–20 horizontal padding and pill or medium radius. Secondary = text/outline, never competes. Tertiary = text (+icon), no container (Copy Meal, Today). Destructive = danger color, separated from save; dialogs use explicit verbs (`Delete entry`, never `Yes`). Icon action = 20–24 icon in a full target + accessible label.
- **Forms**: 12–16 between related fields, 20–24 between groups; label above (or a persistent inline label); inputs ~48 on `surfaceSubtle` or 1px border, never inside cards. Errors directly below the field, not red-only, shown until fixed. Numeric: numeric keyboard, locale decimal separator, unit adjacent, full precision internally. The keyboard never covers the active field; the header commit action remains available while it is open.
- **Profile/settings**: grouped flat lists; rows 48–52 with optional icon, label, current value when useful, chevron only if it navigates. Section labels `label`, restrained uppercase where appropriate, 12–16 padding. Weight summary is one concise region above the list, not a big card.
- **Sheets** (Add Action, Meal Picker, Unit Picker, Copy Meal, Weight Entry if it fits): smallest snap height, 4×36 handle, 48 rows, no empty top or big title; full height only for keyboard or large text.
- **Dialogs**: confirmations and short critical info only; clear title, concise copy, two actions when possible. Use a sheet, inline message or screen when better.

## DS-10 States
- Pressed: subtle tint (rows/tertiary); filled controls darken/lighten; no scale that moves neighbors.
- Focus: 2px `focus` outline; focus order = visual order.
- Disabled: less emphasis, text stays readable (opacity alone must not fail contrast).
- Loading: small inline spinner; skeletons only where they preserve layout. The Diary should almost never full-screen load after startup.
- Empty: compact (`No foods logged` under an empty meal; its header `+` adds). No big illustrations.
- Offline: inline provider status in Food Search, local/cached results kept. No Diary offline banner unless the current action is affected.
- Error: field errors at the field; provider errors in the provider section; full screen only if the screen can't work.
- Success: return to the updated screen. Toast/banner only when the result isn't visible (e.g. meal copied to another date), except the temporary Undo toast after a swipe-revealed Delete.
- Motion: durations in `motionMs`, platform easing, interruptible. Animate only the changed row + progress, never the whole Diary. Reduced motion: no big translations or decorative progress animation, use fades/instant updates, keep all info and states.
- Haptics only for: meaningful ruler ticks, a successful barcode read, save success when not otherwise obvious, destructive confirmation where the platform supports it.

## DS-11 Accessibility
- Contrast: text ≥4.5:1, large text ≥3:1, essential boundaries/indicators ≥3:1 against adjacent colors. Test token pairs on device before release.
- Text scaling: all meaningful text scales. At large sizes the macro strip may wrap/stack, rows grow (never clip), app-bar actions may move to overflow, fixed heights become minimums.
- Screen readers: one coherent label + action per row; hide decorative and duplicate elements. Examples: `Scrambled eggs, 2, egg, 199 kilocalories. Button. Edit diary entry.` · `Protein, 41 of 150 grams. Some entries have unknown protein.` · `Calories remaining, 1,731 of 2,400 kilocalories.`
- Color independence: macros always have text; warnings/errors have an icon or words; selected tabs use color + weight/indicator/fill.
- Every gesture has an alternative: date via buttons + calendar; ruler via increment/decrement actions or direct entry; meal reorder via move actions as well as drag.

## DS-12 Theme implementation
- Components use semantic tokens (`textPrimary`, `macroProtein`), never raw palette values.
- Primitives own theme, type, focus, press, disabled and a11y: `AppText, AppIcon, PressableIcon, HeaderAction, PrimaryButton, TextAction, FormField, ListRow, SectionHeader, ProgressTrack, BottomSheet, ConfirmationDialog, InlineStatus`.
- Feature components build on them: `CalorieRing, MacroStrip, DiaryDateStrip, MealHeader, DiaryEntryRow, QuickCaloriesRow, ServingRuler, WeightSummary`. They don't re-implement primitive behavior.

## DS-13 Visual QA (per component, before done)
MVP: light theme · iOS + Android · one phone size · default text. Check the states that apply (empty/typical/long/loading/offline/error/disabled) through the Maestro flows and by hand on both platforms; screenshots aren't required.
- The matrix (small + large width, large text, increased contrast, reduced motion, screenshot sets) is deferred (POST-13). DS-11 behavior still applies. **Why:** speed for the MVP proof of concept (user decision 2026-09-28).

## DS-14 Android widget (UX-22)
- Follows UX-23 (user decision 2026-09-30). `System` hands the launcher a light and a dark version, so it switches with the phone's dark mode without a redraw; a forced `Light`/`Dark` draws only that one. Colors from `lightColors`/`darkColors` in `tokens.ts`, never raw hex in widget code.
- Background `surface`, corner radius `radii.large`, no shadow or border. Padding `spacing[3]`.
- Content left-aligned, vertically centered:
  - Number: `typography.displayNumber`, tabular figures, `textPrimary`; over goal → `warning`, as the Diary ring (DS-03 explicit label: "over").
  - Label (`kcal left` / `kcal over`, or kJ): `typography.compact`, `textSecondary`.
  - Unavailable: `Open Calorie Tracker` in `compact`, `textSecondary`, no number.
- Single line each. The number MUST NOT truncate; the label may ellipsize (pt-PT is longer).
- Accessibility: the whole widget is one tap target with one content description, e.g. `1,731 kcal left`, `250 kcal over`.
- Picker preview: a static PNG in `assets/` (en, a typical value), shown in the launcher's widget picker.
