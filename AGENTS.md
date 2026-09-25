# Repository Instructions

Local-first React Native (Expo) calorie and food diary. iOS + Android only. No backend.

Agents may commit and push changes directly to the `main` branch.

## Specs — read only what the task needs
Approved requirements. Don't reinterpret or redesign them unless the user explicitly asks. Rules have stable IDs (`NAV-04`); cite them in code comments, tests and commits when relevant.

| Task | Read |
|---|---|
| Is feature X in the MVP? | `docs/01-scope.md` (SCOPE); exclusions in SCOPE-10 |
| Routes, back/save/cancel, where a flow returns | `docs/02-navigation.md` (NAV) + `src/shared/navigation/routes.ts` |
| SQLite, repositories, migrations, nutrition math, dates, USDA key | `docs/03-data.md` (DATA) + `src/data/db/schema/schema.sql` |
| Libraries, layers, folders, errors, offline, logging, tests | `docs/04-architecture.md` (ARCH) |
| UI strings, translations, locale formatting | ARCH-22 + SCOPE-12 |
| Food search providers (USDA, Open Food Facts) | `docs/07-providers.md` (PROV, draft) |
| Styling, components, a11y | `docs/05-design.md` (DS) + `src/shared/theme/tokens.ts` |
| Building a specific screen | `docs/06-screens.md` (UX) + the DS components it names |

Precedence when docs conflict: lower number wins (SCOPE > NAV > DATA > ARCH > DS > UX > PROV). Code files named above are the source of truth for the values they hold. If a conflict looks real, stop and ask.

## Spec format (when editing docs)
- Terse bullets and tables; `MUST` / `MUST NOT` / `SHOULD`. Add a one-line **Why** only where it stops a wrong "fix".
- State each fact once and link it (`see DATA-06`) instead of repeating it.
- Never renumber existing IDs; append new ones.
- New planning sections are proposed to the user and approved before they're written.
