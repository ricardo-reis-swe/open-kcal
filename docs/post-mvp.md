# Post-MVP backlog (POST)

Read when: someone asks for a feature that isn't in the MVP. Items here are **candidates, not requirements**. MUST NOT be built, stubbed or given placeholder routes during the MVP (SCOPE-10 rules apply). Each item is re-scoped and approved before work starts.

Format: one item per heading. Say what it is, why it's deferred, and any known details.

## POST-01 Open Food Facts region filter
- Filter OFF search to the device region, e.g. `q=<terms> countries_tags:"en:portugal"` on Search-a-licious (PROV-03). If the filtered page 1 returns 0 hits, retry once unfiltered.
- Needs a small ISO region → OFF country tag map (PT → `en:portugal`); unmapped regions get no filter.
- Evidence (2026-09-25): `iogurte grego` gave 1,287 hits unfiltered with Brazilian products first, vs 528 filtered with Portuguese products only.
- Cost: the unfiltered retry spends OFF search budget (PROV-04).
- Deferred by product decision; the MVP accepts Brazilian results.

## POST-02 Portuguese generic foods (INSA table)
- Bundle INSA's Portuguese food composition table (~1,000 generic foods, e.g. bacalhau, broa) as an offline source. USDA returns nothing for Portuguese terms.
- It's a new data source: check licensing, the import format, and how it fits DATA-15 search.

## POST-03 Edit custom foods
- Moved into the MVP 2026-10-01 (user request): UX-25, DATA-26. ID kept so it is not reused.

## POST-04 Choose the goal effective date
- The schema supports goals effective on any date (DATA-09). The MVP UI always uses today.

## POST-05 Meal icons
- Let users pick a meal icon from a small accessible set, without changing meal identity (DS-06).

## POST-06 Crash reporting
- An optional provider behind the logger interface (ARCH-15). It must exclude health data and secrets, and its privacy impact must be documented.

## POST-07 Purge soft-deleted foods
- Physically remove unreferenced soft-deleted custom foods during maintenance (DATA-11).

## POST-08 Scheduled live API contract check
- A weekly CI job runs the provider Zod schemas (PROV-13) against the live USDA and OFF APIs, with a CI-secret USDA key. A failure opens an issue and never blocks PRs or normal test runs.
- Deferred: during the MVP, fixtures alone cover contract tests.

## POST-09 Over-the-air updates
- EAS Update (`expo-updates`) to ship JS fixes without a store build. Needs a runtime-version policy and update channels per build profile. Depends on POST-12.

## POST-10 Public store release
- App Store and Play production listing: privacy labels (health data stays on device), screenshots in en + pt-PT, store copy, support URL, review submission. Depends on POST-12. The MVP has no distribution (ROAD-04).

## POST-11 Continuous integration
- A hosted pipeline running `npm run check` on every push. The remote is Gitea, so this means Gitea Actions (GitHub-compatible workflow syntax in `.gitea/workflows/`), which needs a runner on the Gitea server. Maestro E2E in CI is a later extension.

## POST-12 Distribution
- EAS Build profiles in `eas.json`:
  - `development`: `com.ricardoreis.calorietracker.dev`, "Calorie Tracker (Dev)"
  - `preview`: `.preview`, "Calorie Tracker (Preview)"
  - `production`: `com.ricardoreis.calorietracker`
- Per-profile `EXPO_PUBLIC_*` env. Separate IDs let the builds coexist without sharing data (ARCH-14).
- Versioning: semver `version` bumped per release; `buildNumber`/`versionCode` from EAS (`appVersionSource: remote`, `autoIncrement` on production).
- Builds run manually or on a `v*` tag. `eas submit` to TestFlight (internal) and the Play internal testing track.
- Accounts, all under ricardo_reis@live.com: Expo, Apple Developer Program, Google Play Console. Signing credentials EAS-managed; keep a backup of the Android upload key.

## POST-13 Visual QA matrix
- The full DS-13 matrix: small + large phone widths, large text, increased contrast, reduced motion, and screenshot sets per screen. The MVP runs the reduced DS-13 check only.

## POST-14 Recipes
- Recipes are excluded from the MVP (SCOPE-10). When built, they get a 4th Food Search tab next to `My foods` (UX-04). User request 2026-10-01.
