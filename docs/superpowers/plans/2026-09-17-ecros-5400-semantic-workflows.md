# ECROS-5400 Semantic Workflow Index Implementation Plan

> Design: `docs/superpowers/specs/2026-09-17-ecros-5400-semantic-workflows-design.md`

## Task 1 — Define the semantic-index contract with tests first

**Create:** `tests/utils/semanticIndexBuilder.test.ts`

Write failing tests against `buildProjectSemanticIndex()` using the existing demo-project factory. Assert that:

- every live screen, FSM state, transition and physical control is represented;
- state↔screen, state→state, transition→event and control→event relations are present;
- screen records contain deterministic lightweight object/layout summaries;
- repeated builds are deep-equal except for no volatile timestamp fields;
- orphan/ambiguous entities produce diagnostics rather than being silently dropped.

Run the focused test and confirm RED because the semantic-index module does not exist yet.

**Create:** `src/domain/semanticIndex.ts`

Define read-only generic types for semantic classifications, indexed screens/states/transitions/controls, typed relations, workflow steps/definitions and diagnostics.

**Create:** `src/services/semantic/semanticIndexBuilder.ts`

Implement a pure deterministic builder over `LcdBitmapProject`. Reuse normalized `project.uxContract` and current project references; do not mutate or persist any semantic-index data.

Run the focused test and confirm GREEN.

## Task 2 — Add ECROS-5400 state/action classification with tests first

**Create:** `tests/utils/ecros5400SemanticProfile.test.ts`

Build a compact fixture using real ECROS conventions (`PHOT_*`, `QUANT_*`, `KIN_*`, `MW_*`, `FILE_*`, `SET_*`) and the physical events already used by the ECROS reconstruction script. Write failing tests for:

- Photometry A/E/%T classification without branch contamination;
- wavelength, parallel-count, gain, coefficient, concentration and filename input kinds;
- `НОЛЬ`, `λ`, `ПАРАМЕТР`, `ФАЙЛ`, `ВВОД`, `ОЧИСТИТЬ`, `ПЕЧАТЬ`, `ВЕРХ/ВНИЗ`, `Выход` semantics;
- numeric keys, `-`, `.` as input mutations rather than navigation;
- `СТАРТ/СТОП` as start vs pause/resume based on source/target state context;
- deterministic fallback classification from Russian/English titles when a stable id is unavailable.

Run the focused test and confirm RED.

**Create:** `src/services/semantic/profiles/ecros5400Profile.ts`

Implement the device-specific classifier and button/action resolver. Stable ids and subsystem prefixes win; title matching is a fallback and ambiguous results generate diagnostics.

Wire the profile into `buildProjectSemanticIndex()` only when the project identifies as ECROS-5400/5400UV or when explicitly supplied by the caller.

Run the focused tests and confirm GREEN.

## Task 3 — Encode the requested measurement workflows with tests first

Extend `tests/utils/ecros5400SemanticProfile.test.ts` with failing assertions for workflow ids and ordered/branched steps:

- `startup.standard`;
- `measurement.photometry`;
- `measurement.quantitative.new_calibration`;
- `measurement.quantitative.load_calibration`;
- `measurement.quantitative.coefficients.create`;
- `measurement.quantitative.coefficients.open`;
- `measurement.kinetics`;
- `measurement.multiwave`;
- `files.open_result`;
- `files.open_calibration`;
- `settings.main`.

Assert Photometry A/E/%T and Kinetics/Multiwave A/%T branch membership separately. Assert the Quantitative paths resolve calibration/analyte/coefficient states separately and reuse result/save semantic operations.

Implement workflow definitions in `src/services/semantic/profiles/ecros5400Profile.ts`. Workflow steps reference actual project state/screen ids and contain deterministic edges, not copied FSM structures.

Add workflow coverage diagnostics to `src/services/semantic/semanticIndexBuilder.ts` for empty/unresolved steps, orphan expected states, branch contamination, missing zero/start-stop/save semantics.

Run both focused tests and confirm GREEN.

## Task 4 — Expose read-only automation commands with tests first

**Create:** `tests/utils/automationDispatcherSemanticIndex.test.ts`

Using the same project-store setup pattern as `automationDispatcherUx.test.ts`, write failing tests for:

- `get_project_semantic_index` succeeding without `expectedRevision`;
- `list_project_semantic_workflows` returning deterministic workflow summaries;
- `get_project_semantic_workflow` returning one workflow by id;
- unknown workflow id returning structured failure;
- none of the three commands mutating project or application revision.

**Modify:** `src/shared/automation/registry.ts`

Register the three read commands with strict input schemas (`get_project_semantic_workflow` requires `workflowId`).

**Modify:** `src/renderer/automation/automationDispatcher.ts`

Route the read commands through `buildProjectSemanticIndex()` and return structured outputs/errors, following current UX automation behavior.

**Modify:** `tests/utils/automationRegistry.test.ts`

Require the three new command names in the shared registry so Electron/Tauri REST/MCP parity stays automatic.

Run the automation-focused tests and confirm GREEN.

## Task 5 — Add deterministic ECROS report generation with tests first

**Create:** `src/services/semantic/semanticReport.ts`

Add pure deterministic Markdown renderers for screen, state, transition, workflow-coverage, orphan-screen and ambiguous-semantic reports.

**Create:** `tests/utils/semanticReport.test.ts`

Assert stable output ordering, expected headings, workflow ids, diagnostics and no volatile timestamps.

**Create:** `scripts/generate-ecros-semantic-index.ts`

Default input: `ECROS-5400UV/ECROS-5400UV_FSM_11-09-2026.lcdproj`. Load/migrate the project with the existing migration service, build the semantic index and write:

- `ECROS-5400UV/semantic/semantic-index.json`
- `ECROS-5400UV/semantic/semantic-screen-index.md`
- `ECROS-5400UV/semantic/semantic-state-index.md`
- `ECROS-5400UV/semantic/semantic-transition-index.md`
- `ECROS-5400UV/semantic/workflow-coverage.md`
- `ECROS-5400UV/semantic/orphan-screens.md`
- `ECROS-5400UV/semantic/ambiguous-semantics.md`

**Modify:** `package.json`

Add `generate:ecros-semantic` for the script.

Run report tests and generator. Inspect generated diagnostics; do not suppress unresolved mappings merely to get a clean report.

## Task 6 — Verify the real ECROS project

Run:

- semantic builder/profile/report tests;
- automation semantic-index tests;
- existing UX graph/UX automation tests;
- automation registry tests;
- TypeScript typecheck;
- project validation tests relevant to schema/architecture boundaries;
- the ECROS semantic generator against the real `.lcdproj`.

Inspect `workflow-coverage.md`, `orphan-screens.md` and `ambiguous-semantics.md`. Fix deterministic mapping defects in the profile; retain genuine source-model ambiguities as diagnostics.

## Task 7 — Integration review

Compare the feature branch to `main` and verify:

- no `.lcdproj` executable behavior was silently rewritten;
- no second persisted FSM/screen source of truth was introduced;
- existing UX semantic contract remains authoritative for generic operator-facing labels/intents;
- semantic index is derived-only;
- ECROS workflow definitions refer back to real state/screen/transition/control ids;
- all new automation operations are read-only.

Open a pull request from `feat/ecros-5400-semantic-workflows` to `main` with test/coverage results and any remaining source-model ambiguities called out explicitly.
