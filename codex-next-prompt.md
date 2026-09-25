# Prompt — continue calorie tracker planning

Planning a local-first React Native calorie tracker. Read `AGENTS.md` first: it indexes the specs and defines the spec format (terse rules, stable IDs, each fact stated once, values in code files).

- Approved: `docs/01-scope.md` through `docs/07-providers.md`, plus `routes.ts`, `schema.sql` and `tokens.ts`. Treat them as requirements; don't redesign them unless asked. Deferred ideas go in `docs/post-mvp.md`.
- **Next: `docs/08-roadmap.md` — Implementation Roadmap (ROAD).** Scope approved; writing NOT started. Wait for the user to say start, then write one step at a time, stopping for validation after each:
  1. Milestones in build order (vertical slices): skeleton (Expo, strict TS, lint, CI, tokens, i18n) → data layer + domain math → Diary read + date nav → Quick Calories (first write) → custom foods + ruler → Food Search (local + OFF) → USDA + key screen → Meal Detail + copy → Profile (goals, meals, units, weight) → first launch, a11y, pt-PT, E2E, release prep.
  2. Definition of done per milestone: spec IDs covered, required tests, DS-13 visual QA.
  3. Agent workflow: picking the next task, citing spec IDs in commits, when to stop and ask, recording progress.
  4. Builds and release: EAS setup, dev/preview app IDs, TestFlight / Play internal testing.

Process for new sections, one at a time:
1. Propose the title and scope, and ask whether to add, remove or change anything.
2. Write it only after explicit approval, using the AGENTS.md spec format.
3. Ask for approval of the contents before proposing the next section. Never start the next section automatically.
