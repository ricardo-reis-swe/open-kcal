# 08 Implementation roadmap (ROAD)

Status: **DRAFT, written one step at a time.** Steps 1–3 approved. Step 4 ready for review.

Read when: deciding what to build next. Milestones are vertical slices, done in order. Each ends with something runnable on both platforms. The specs define behavior; this doc only sequences it.

## ROAD-01 Milestones
| # | Milestone | Builds | Main specs | Exit demo |
|---|---|---|---|---|
| M0 | Skeleton | Expo app (latest SDK, dev builds), strict TS, ESLint/Prettier, Jest + RNTL, CI (lint, `tsc`, tests). Expo Router tabs with a custom `+`. Theme from `tokens.ts` (light/dark). i18n scaffold (en, pt-PT, key-parity check). Logger, typed env config + `.env.example`. DS-12 primitives. | ARCH-01/02/05/06/14/15/22, DS-12 | App launches on iOS + Android. `Diary + Profile` bar; `+` opens an empty sheet. CI green. |
| M1 | Data + domain | Migration 1 from `schema.sql`, DB provider, startup sequence, recovery screen. Repositories. Idempotent seed (settings, localized meals, provisional goal). Domain math (units, nutrition, goals, local dates, unknown macros). `CredentialsService`. | DATA-*, ARCH-04/07–10/13/17, UX-01 (data), UX-20 | App starts through migrations. Repository, migration and domain tests pass on real SQLite. |
| M2 | Diary (read) | Diary: date strip, swipe, Today, calendar → Date Picker, ring, macro strip, meals and rows, default-goals row. Dev-only seed data for display. | UX-02, UX-13, NAV-02/05, DS-07/08 | Browse past/today/future days. Empty days show every meal. Over-goal and unknown macros render. |
| M3 | Quick Calories | Add Action Sheet, Meal Picker, Quick Calories + Edit, delete confirmation. The first write path. | UX-07/09/10/19, NAV-03/04/08 | SCOPE-11 flow 2 end to end; edit + delete from the Diary. |
| M4 | Custom foods + ruler | Create Custom Food, Food Detail / Add Entry with `ServingRuler`, unit tabs, Serving Unit Picker, Edit Food Entry, recents. Food Search with local sections only (My foods, Recent). | UX-05/06/08/11, DATA-11/12/14/16, DS-09 ruler | Create a food → log it with the ruler → edit/delete from the Diary (SCOPE-11 flow 3). |
| M5 | Search + Open Food Facts | Full Food Search (Saved section, statuses, paging, swipe-delete). OFF adapter, request budget, cache + refresh, error mapping, fixtures. | UX-04, PROV-01/03–10/12/13 (OFF) | SCOPE-11 flow 1 with an OFF food. Offline shows saved foods. The budget holds under fast typing. |
| M6 | USDA | USDA adapter, Food Databases screen, key check + `Test key`, generic-before-Branded, fibre subtraction. | UX-18 (Food Databases), PROV-02/05/06/11 (USDA) | Add a key, search USDA, log a food. Rejected-key and missing-key paths work. |
| M7 | Meal Detail + copy | Meal Detail, Copy Meal Sheet, copy transaction. | UX-03/12, NAV-07, DATA-16 | Copy a meal to tomorrow and to a picked date; return rules hold. |
| M8 | Profile | Profile, Calories & Macros (with the UX-01 first save), Meals (reorder, add, edit, delete + reassign), Units, Weight Goal, Weight Entry Sheet, Weight History. | UX-14–17/18, NAV-06, DATA-09/10/13 | Every Profile screen works. Deleting a meal reassigns its entries. Unit changes show everywhere. |
| M9 | Hardening + release | Complete pt-PT translations, accessibility pass, large text, dark mode, DS-13 QA, Maestro E2E suite, performance checks, release builds. | DS-11/13, ARCH-18/19, ROAD step 4 | Every ARCH-18 E2E flow is green on both platforms. Internal test builds are distributed. |

**Order rationale**
- Data before UI, so screens never mock the DB.
- The simplest write path (Quick Calories) comes before the ruler.
- Local search comes before remote search.
- OFF before USDA, because Portugal is the main market (SCOPE-12).
- Profile comes late because M1 seeds working defaults (meals, provisional goals, locale units).
- M7 and M8 are independent of each other and can swap or run in parallel after M6.

## ROAD-02 Definition of done
A milestone is done only when **all** of these hold. They are cumulative: earlier milestones must stay green.

**Every milestone**
- Every behavior in its "Main specs" is implemented. Any deviation was approved by the user and written back into the spec.
- CI green: lint, `tsc`, and all Jest suites.
- Tests exist for everything built, at the right ARCH-18 layer:

  | Built | Test |
  |---|---|
  | Domain logic | Pure unit tests |
  | SQL | Repository tests on real SQLite |
  | Screens | Component tests for their applicable states (loading, empty, populated, error) and a11y labels |
  | Routes | Navigation tests for entry, return and back rules |
  | Provider code | Fixture tests |

- Test names cite spec IDs, e.g. `NAV-04: meal change from Meal Detail returns to Diary`.
- Every new string exists in both `en` and `pt-PT` (CI key parity). pt-PT text may be a draft until M9.
- The milestone's Maestro E2E flows (table below) pass on the iOS simulator and the Android emulator.
- The exit demo was run on both platforms. Screenshots of new screens in light + dark, and at default + largest text on a small phone (DS-13 subset), are saved under `docs/qa/<milestone>/`.
- Independent review is clean: no blockers or majors in `docs/qa/<milestone>/review.md` (ROAD-03).
- No placeholder UI for in-scope behavior. Known gaps are listed in the progress log (step 3).
- Nothing sensitive in logs (ARCH-15): no USDA key, diary content, weights or notes.

**E2E flows by milestone** (ARCH-18)
| Milestone | Flows added |
|---|---|
| M2 | Launch to today's diary · swipe to another date and back to Today |
| M3 | Add Quick Calories |
| M4 | Add a (custom) food from a meal · directly edit and delete an entry |
| M5 | Use cached/custom foods while offline |
| M8 | Reorder meals · add and edit weight |

**Milestone extras**
| Milestone | Also required |
|---|---|
| M0 | Dev builds install on both platforms. `.env.example` committed. CI runs on every push. |
| M1 | The seed is idempotent (tested by running init twice). Every migration is tested from an empty DB. Startup failure shows the recovery screen, not a crash. Date tests cover DST, month/year ends and leap days. |
| M2 | DS-02 density check: a screenshot of the Diary at default text on a small phone shows overview + 2 meal headers. |
| M4 | The ruler works as an a11y `adjustable` (test). Haptics are off in tests. |
| M5 | PROV-13 OFF fixtures. Limiter and cooldown tests with fake timers. Fast typing never exceeds the budget (test). |
| M6 | PROV-13 USDA fixtures. A test asserts the key never reaches the logger, errors or query keys. |
| M8 | The meal delete + reassign transaction rolls back fully on failure (test). |
| M9 | The full DS-13 matrix passes. The user reviews the pt-PT copy. ARCH-19 performance checks run. Release builds are made (step 4). |

## ROAD-03 Agent workflow
**Progress log.** `docs/progress.md` is created at the start of M0 and is the single place for status. Per milestone it holds:
- status: not started / in progress / awaiting user acceptance / done
- the ROAD-02 checklist, ticked
- known gaps
- open questions

Update it in the same commit as the work it describes.

**Picking work**
- Work on the first milestone that isn't done (M7 and M8 may run in parallel).
- Within a milestone, go in order: domain → data → services → screens → tests → E2E → QA screenshots.
- Don't start the next milestone until the current one is accepted.
- Blocked on a question? Log it and continue with unblocked tasks in the same milestone.

**Commits** (direct to `main`, per AGENTS.md)
- One coherent change per commit, and CI must stay green. If `main` is red, fixing it comes first.
- Conventional commits, with spec IDs in the body: `feat(diary): date strip and swipe` + `Refs: UX-02, NAV-05`.
- In code, cite a spec ID only where a rule is non-obvious (e.g. `// DATA-05: totals come from snapshots`).

**Stop and ask the user before:**
- Resolving a spec conflict or ambiguity that changes behavior.
- Deviating from a spec, or changing the schema beyond `schema.sql`.
- Adding a dependency (ARCH-20 note required).
- Anything in SCOPE-10 or `post-mvp.md`. New ideas go to `post-mvp.md` as proposals and are never implemented.
- Destructive operations on user data or shipped migrations.
- Needing secrets, e.g. a USDA key to capture fixtures. The user provides it in the local env.

**Don't ask about:** implementation details the specs leave open (internal naming, file layout within ARCH-05, choosing between equivalent approaches). Decide and move on.

**Spec changes:** only after user approval. Update the spec in place (never renumber IDs), mention it in the commit, and log it.

**Independent review** (before asking the user to accept)
- Once the builder believes ROAD-02 is met, it spins up a **separate reviewer agent** with fresh context: a new session or subagent, never the builder's own context. It may use a different model.
- The reviewer is **read-only** (no edits or commits) and is given the milestone ID, its spec IDs, the ROAD-02 checklist, and the commit range `<milestone start>..HEAD`.
- The reviewer:
  - traces every listed spec ID to its code and tests
  - runs lint, `tsc`, the tests and the milestone's E2E flows itself (and the exit demo when a simulator is available)
  - checks for spec deviations, SCOPE-10/POST leaks, sensitive logging (ARCH-15), missing pt-PT keys and correctness bugs
- Output: `docs/qa/<milestone>/review.md`, with findings labeled **blocker / major / minor**, each citing a spec ID and `file:line`.
- The builder fixes every blocker and major, then runs a **new** reviewer (fresh again). Repeat until none remain. Minors may be fixed or logged as known gaps.

**Milestone acceptance:** when ROAD-02 is met and the review is clean, set the status to "awaiting user acceptance" and report to the user:
- what was built
- the exit demo steps
- test counts
- the path to the QA screenshots
- known gaps
- the review summary (rounds run, findings fixed, minors left)

The milestone is done only after the user accepts it.

## ROAD-04 Builds and release
**Accounts (the user creates these; agents never do):** Expo, Apple Developer Program, Google Play Console, all under **ricardo_reis@live.com**. Never use or mention any other account or email in code, config, docs or commits. Signing credentials are EAS-managed and never committed. The user keeps a download of the Android upload-key backup.

**Build profiles** (`eas.json`)
| Profile | Purpose | App ID / name | Distribution | From |
|---|---|---|---|---|
| `development` | Dev client for daily work (plus an iOS simulator build) | `<bundle-prefix>.calorietracker.dev` · `Calorie Tracker (Dev)` | Internal | M0 |
| `preview` | Release-like build on real phones | `<bundle-prefix>.calorietracker.preview` · `Calorie Tracker (Preview)` | Internal | M3, optional |
| `production` | Store builds | `<bundle-prefix>.calorietracker` · `Calorie Tracker` | TestFlight + Play internal testing | M9 |
- Separate IDs let all three coexist on one phone without sharing data (ARCH-14).
- Each profile sets its public `EXPO_PUBLIC_*` values in `eas.json` `env`: variant, OFF contact email (`ricardo_reis@live.com`, used in the PROV-01 `User-Agent`), base URLs. No secrets anywhere; the USDA key is user-supplied at runtime.

**Versioning:** a semver `version` in app config (user-facing, bumped per release). `buildNumber`/`versionCode` come from EAS with `appVersionSource: remote` + `autoIncrement` on `production`.

**CI and builds**
- GitHub Actions on every push: lint, `tsc`, Jest (M0).
- EAS builds run manually or on a `v*` tag, never on every push.
- Maestro E2E runs locally on the simulator and emulator per ROAD-02. E2E in CI is not part of the MVP.

**MVP release = internal testing only:** production builds submitted with `eas submit` to TestFlight (internal testers) and the Play internal testing track. Public store release is a separate, later decision (POST-10).

**M9 release checklist**
1. Every milestone accepted; `main` green.
2. Bump `version`; add a short changelog entry to `docs/progress.md`.
3. `eas build --profile production` for both platforms, then `eas submit`.
4. Smoke-test the installed store builds on a real phone: first launch, add Quick Calories, log an OFF food, go offline and log a saved food, relaunch and check the data persisted.
5. Report to the user (ROAD-03 acceptance).
