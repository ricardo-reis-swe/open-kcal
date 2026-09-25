# Prompt — continue calorie tracker planning

Planning a local-first React Native calorie tracker. Read `AGENTS.md` first: it indexes the specs and defines the spec format (terse rules, stable IDs, each fact stated once, values in code files).

- Approved: `docs/01-scope.md` through `docs/06-screens.md`, plus `routes.ts`, `schema.sql` and `tokens.ts`. Treat them as requirements; don't redesign them unless asked.
- **Proposed next: `docs/07-providers.md` — Food Provider Integration (PROV).** Not approved for writing yet. Proposed scope: USDA FDC and Open Food Facts endpoints and fields; nutrient mapping and energy fallbacks; serving derivation; minimum-data drop rules; ranking and pagination within sections; cache TTLs and refresh; request headers and rate limits; USDA key validation; error mapping; contract-test fixtures.

Process for new sections, one at a time:
1. Propose the title and scope, and ask whether to add, remove or change anything.
2. Write it only after explicit approval, using the AGENTS.md spec format.
3. Ask for approval of the contents before proposing the next section. Never start the next section automatically.
