# Technical And UX Debt Register

This register captures current debt discovered during the 2026-07 architecture
and onboarding audit. Priorities describe user and maintenance risk, not effort.

## P0 — Prevent Wrong Mental Models

| Item | Why it matters | Exit criterion |
|---|---|---|
| Keep living docs aligned with schema 6 and current workspaces | Schema-5/four-workspace text sends users and contributors to obsolete concepts and paths | Documentation checks fail on obsolete living-doc claims |
| Establish one onboarding route | Manuals, tour, wizard and workspace tabs currently compete as entry points | Start screen and Manual visibly link the same recommended workflow |
| Explain sources of truth | DSL, runtime, store and compiler representations can look like independent project models | UI help and contributor docs use the state categories in `CONCEPTUAL_MODEL.md` |

## P1 — Reduce Product And Architecture Friction

| Item | Evidence | Recommended change |
|---|---|---|
| Flat top-level navigation | Eleven workspaces have equal visual weight | Group into Design, Integrate, Validate, Deliver and Advanced; preserve direct routing |
| Oversized UI modules | `LCDCanvasEditor`, operation manual, i18n and several workspaces are large single files | Extract cohesive panels/hooks and split manual/i18n by section and locale |
| Oversized mutation surface | `projectMutations.ts` and `projectStore.ts` centralize many unrelated changes | Split commands by domain while retaining one command/ChangeSet boundary |
| Central bridge types | Graph analysis identifies `LanguageCode`, `LcdBitmapProject` and `CanvasObject` as cross-community bridges | Narrow imports, avoid broad barrels and add contract-focused tests |
| Legacy naming in current APIs | `ProjectFileV5`, `ProjectSnapshotV5`, `createProjectFileV5` can contain schema 6 | Introduce neutral names with compatibility aliases; migrate callers incrementally |
| Factory passes through legacy shape | New-project creation still carries migration-era terminology and paths | Create schema-6 domain objects directly and retain migration only at imports |
| Two desktop shells | Electron and Tauri share renderer code but have different native capabilities | Define a typed desktop capability port and parity matrix before extracting packages |
| Manual sources overlap | In-app manual and generated/downloadable manuals have separate pipelines | Choose canonical structured content and derive all editions from it |
| Traceability drift | Test/doc tables reference removed paths and old workspace counts | Generate or validate path references in CI |

## P2 — Repository Hygiene

| Item | Recommended policy |
|---|---|
| Local build volume | Keep `target/`, `release/`, `dist/`, coverage and Playwright output ignored; provide an explicit cleanup script that prints and confirms exact targets |
| Diagnostic artifacts | Ignore `build-diagnostics/` and keep only curated incident reports |
| Architecture graph output | Keep a small report or regenerate on demand; do not commit temporary extraction caches |
| Generated user manuals | Decide explicitly whether release artifacts remain versioned; if yes, verify regeneration in CI |
| Documentation inventory | Move historical audits into a real archive or add status metadata; do not claim a nonexistent archive directory |

## Suggested Delivery Order

1. Documentation and terminology guardrails.
2. Navigation grouping and first-project onboarding.
3. Neutral schema API names and direct schema-6 factory.
4. Store/mutation and large-workspace extraction.
5. Desktop capability abstraction and shell parity.
6. Generated-artifact and historical-document policy.

## Verification

For each debt item, add a narrow acceptance check: a boundary unit test, a
route-level UI test, a documentation link/path check or a deterministic build
command. Do not close an item based only on file movement or renaming.
