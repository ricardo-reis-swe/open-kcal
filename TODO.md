# Open Kcal: what's missing (2026-11-24)

Based on `docs/progress.md`, the roadmap, the POST backlog and git history. The app's features are all built. What's left is mostly checking, releasing and protecting your data, and after that the backlog.

## P0: protect your diary

- [ ] **Add backup / export.** The app is local-only and has no way to get your data out. If you lose the phone, uninstall the app, or have to reinstall because of a signing-key change (ROAD-06 warns about this), the whole diary is gone. An export/import file (JSON or the SQLite file through the share sheet) isn't cloud sync, so SCOPE-10 doesn't exclude it. But DATA-02 currently says "Nothing may imply backup/sync exists", so it needs an approved spec change first.

## P1: finish and ship what's built

- [ ] **Release v0.2.0.** 6 commits since `v0.1.0` (9 Oct) haven't been released: barcode scanning in custom foods and recipes, recipe share/import, the Open Kcal icon and name, and the recipe multiplier fix. Obtainium users are still on the old build.
- [ ] **Run the ROAD-04 release smoke test** on that build, then accept M9. It's the last milestone still "awaiting user acceptance".
- [ ] **Check these on a device.** The 9 Oct "daily use" note covers what existed then. These came after it and are unchecked:
  - [ ] Recipe sharing between two phones: share sheet, import, a bad paste leaves data unchanged.
  - [ ] Ingredient barcode scan (moved into the MVP 14 Oct). It also has no section in `progress.md` (docs gap).
  - [ ] Widget: tap it from a cold start in a release build, and check it rolls over after midnight.
- [ ] **Review the pt-PT strings.** The full review sheet (`docs/qa/M9/pt-PT-copy-review.md`) is still open, plus the strings added since: `nutrients.*`, `barcode.*`, `recipe.share` / `recipe.copy`, `importRecipe.*`, `myRecipes.import`.

## P2: quality debt

- [ ] **Maestro E2E suite (ARCH-18).** 9 flows exist and have never been run on a device since the September flow fixes. CI only runs Jest.
- [ ] **`m8-weight` crash on Android launch:** a native SIGSEGV, seen once and not reproduced.
- [ ] **Performance gaps** (minor, from M9 T4): `weight.history()` has no limit, and Food Search uses a `ScrollView` instead of a virtualized list.
- [ ] **POST-08:** a weekly CI check of the USDA and Open Food Facts schemas against the live APIs, so a provider change doesn't break search without anyone noticing.

## P3: feature backlog (each needs approval before work starts)

1. [ ] **POST-01 Open Food Facts Portugal filter.** Biggest quality win for a Portuguese user: Brazilian products currently rank first.
2. [ ] **POST-02 INSA Portuguese generic foods** (bacalhau, broa…): USDA returns nothing for Portuguese terms.
3. [ ] **POST-15 recipe extras:** recipes inside recipes, and linking imported ingredients to your own foods.
4. [ ] **POST-04** choose the date a goal takes effect · **POST-05** meal icons · **POST-07** purge deleted foods.
5. [ ] **POST-06** crash reporting (opt-in) · **POST-09** over-the-air updates · **POST-10/12** TestFlight, Play Store, F-Droid.
6. [ ] **POST-13** full visual QA matrix (other screen sizes, large text, contrast).

Left out on purpose by SCOPE-10, so not listed: Health Connect / Apple Health, exercise tracking, automatic goal calculation, and the rest of that list.
