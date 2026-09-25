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
- The MVP only soft-deletes custom foods (UX-04 swipe). Editing needs a screen and a rule for existing entries (snapshots stay unchanged, DATA-05).

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
