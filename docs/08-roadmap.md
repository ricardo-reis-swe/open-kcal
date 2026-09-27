# 08 Implementation roadmap (ROAD)

Read when: deciding what to build next. Milestones are vertical slices, done in order. Each ends with something runnable on both platforms. The specs define behavior; this doc only sequences it.

## ROAD-01 Milestones
| # | Milestone | Builds | Main specs | Exit demo |
|---|---|---|---|---|
| M0 | Skeleton | Expo app (latest SDK, dev builds), strict TS, ESLint/Prettier, Jest + RNTL, local check scripts (ROAD-04). Expo Router tabs with a custom `+`. Theme from `tokens.ts` (light/dark). i18n scaffold (en, pt-PT, key-parity check). Logger, typed env config + `.env.example`. DS-12 primitives. | ARCH-01/02/05/06/14/15/22, DS-12 | App launches on iOS + Android. `Diary + Profile` bar; `+` opens an empty sheet. `npm run check` passes. |
| M1 | Data + domain | Migration 1 from `schema.sql`, DB provider, startup sequence, recovery screen. Repositories. Idempotent seed (settings, localized meals, provisional goal). Domain math (units, nutrition, goals, local dates, unknown macros). `CredentialsService`. | DATA-*, ARCH-04/07–10/13/17, UX-01 (data), UX-20 | App starts through migrations. Repository, migration and domain tests pass on real SQLite. |
| M2 | Diary (read) | Diary: date strip, swipe, Today, calendar → Date Picker, ring, macro strip, meals and rows, default-goals row. Dev-only seed data for display. | UX-02, UX-13, NAV-02/05, DS-07/08 | Browse past/today/future days. Empty days show every meal. Over-goal and unknown macros render. |
| M3 | Quick Calories | Add Action Sheet, Meal Picker, Quick Calories + Edit, delete confirmation. The first write path. | UX-07/09/10/19, NAV-03/04/08 | SCOPE-11 flow 2 end to end; edit + delete from the Diary. |
| M4 | Custom foods + ruler | Create Custom Food, Food Detail / Add Entry with `ServingRuler`, unit tabs, Serving Unit Picker, Edit Food Entry, recents. Food Search with local sections only (My foods, Recent). | UX-05/06/08/11, DATA-11/12/14/16, DS-09 ruler | Create a food → log it with the ruler → edit/delete from the Diary (SCOPE-11 flow 3). |
| M5 | Search + Open Food Facts | Full Food Search (Saved section, statuses, paging, swipe-delete). OFF adapter, request budget, cache + refresh, error mapping, fixtures. | UX-04, PROV-01/03–10/12/13 (OFF) | SCOPE-11 flow 1 with an OFF food. Offline shows saved foods. The budget holds under fast typing. |
| M6 | USDA | USDA adapter, Food Databases screen, key check + `Test key`, generic-before-Branded, fibre subtraction. | UX-18 (Food Databases), PROV-02/05/06/11 (USDA) | Add a key, search USDA, log a food. Rejected-key and missing-key paths work. |
| M7 | Meal Detail + copy | Meal Detail, Copy Meal Sheet, copy transaction. | UX-03/12, NAV-07, DATA-16 | Copy a meal to tomorrow and to a picked date; return rules hold. |
| M8 | Profile | Profile, Calories & Macros (with the UX-01 first save), Meals (reorder, add, edit, delete + reassign), Units, Weight Goal, Weight Entry Sheet, Weight History. | UX-14–17/18, NAV-06, DATA-09/10/13 | Every Profile screen works. Deleting a meal reassigns its entries. Unit changes show everywhere. |
| M9 | Hardening | Complete pt-PT translations, accessibility pass, large text, dark mode, DS-13 QA, Maestro E2E suite, performance checks, release-config local build. | DS-11/13, ARCH-18/19, ROAD-04 | Every ARCH-18 E2E flow is green on both platforms. A release-config build passes the ROAD-04 smoke test on a real phone. |

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
- `npm run check` green at the milestone boundary.
- Run focused tests only for changed domain, data, provider, or navigation logic; screen and visual regression tests are optional.
- The milestone's Android Maestro flow passes when it exists. iOS device testing is deferred unless explicitly requested.
- Screenshots, exit demos, independent reviews, and text-scale matrices are optional and are not acceptance gates.
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
| M0 | Dev builds run on both platforms. `.env.example` committed. `npm run check` exists and passes. |
| M1 | The seed is idempotent (tested by running init twice). Every migration is tested from an empty DB. Startup failure shows the recovery screen, not a crash. Date tests cover DST, month/year ends and leap days. |
| M2 | DS-02 density check: a screenshot of the Diary at default text on a small phone shows overview + 2 meal headers. |
| M4 | The ruler works as an a11y `adjustable` (test). Haptics are off in tests. |
| M5 | PROV-13 OFF fixtures. Limiter and cooldown tests with fake timers. Fast typing never exceeds the budget (test). |
| M6 | PROV-13 USDA fixtures. A test asserts the key never reaches the logger, errors or query keys. |
| M8 | The meal delete + reassign transaction rolls back fully on failure (test). |
| M9 | The full DS-13 matrix passes. The user reviews the pt-PT copy. ARCH-19 performance checks run. The release-config build passes the ROAD-04 smoke test. |

## ROAD-03 Agent workflow
**Progress log.** `docs/progress.md` is created at the start of M0 and is the single place for status. Per milestone it holds:
- status: not started / in progress / awaiting user acceptance / done
- the ROAD-02 checklist, ticked
- known gaps
- open questions

Update it in the same commit as the work it describes.

**Picking work**
- Work on the first milestone that isn't done (M7 and M8 may run in parallel).
- Within a milestone, go in order: domain → data → services → screens → focused tests → Android E2E.
- When a milestone is ready, set it to awaiting user acceptance; user-authorized roadmap work may continue with the next milestone before formal acceptance.
- Blocked on a question? Log it and continue with unblocked tasks in the same milestone.

**Commits** (direct to `main`, per AGENTS.md)
- One coherent change per commit. Use focused checks while building and run `npm run check` before completing a milestone; if `main` is broken, fixing it comes first.
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

**Milestone acceptance:** when ROAD-02 is met, set the status to "awaiting user acceptance" and report to the user:
- what was built
- the exit demo steps
- test counts
- known gaps and deferred validation

The milestone is done only after the user accepts it.

## ROAD-04 Local builds (no CI, no distribution)
The MVP has **no CI and no distribution**: no hosted pipelines, EAS builds, store submission or build-number automation. All of that is deferred (POST-11, POST-12).

**Checks** run locally before every commit, via package scripts:
- `npm run lint` · `npm run typecheck` (`tsc`) · `npm test` (Jest, including the i18n key-parity test)
- `npm run check` runs all three
- Maestro E2E runs locally on the iOS simulator and Android emulator (ROAD-02).

**Builds** are made locally with Continuous Native Generation:
- Dev builds: `npx expo run:ios` and `npx expo run:android`, on the simulator/emulator or a USB-connected phone.
- A real iPhone uses free personal signing with the Apple ID **ricardo_reis@live.com**. No Apple Developer Program, Google Play or Expo account is needed.
- Release-config build (M9 smoke test): `npx expo run:ios --configuration Release` and `npx expo run:android --variant release`.
- One app ID: `com.ricardoreis.calorietracker`, display name `Calorie Tracker`. Separate dev/preview IDs come with distribution (ARCH-14, POST-12).
- Public config goes in the local `.env` (from `.env.example`): OFF contact email `ricardo_reis@live.com` (the PROV-01 `User-Agent`) and base URLs. No secrets; the USDA key is entered in the app.
- Never use or mention any other account or email in code, config, docs or commits.

**M9 finish checklist**
1. Every milestone accepted; `npm run check` green.
2. Add a short changelog entry to `docs/progress.md`.
3. Install a release-config build on the user's iPhone and/or Android phone.
4. Smoke test: first launch, add Quick Calories, log an OFF food, go offline and log a saved food, relaunch and check the data persisted.
5. Report to the user (ROAD-03 acceptance).
