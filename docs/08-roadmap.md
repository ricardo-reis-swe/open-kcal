# 08 Implementation roadmap (ROAD)

Status: **DRAFT, written one step at a time.** Step 1 of 4 is ready for review.

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

<!-- Steps 2–4 pending: definition of done · agent workflow · builds and release -->
