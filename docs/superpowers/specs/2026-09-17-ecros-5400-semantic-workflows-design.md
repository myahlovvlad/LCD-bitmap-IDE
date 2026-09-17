# ECROS-5400 Semantic Workflow Index Design

## Goal

Add a deterministic semantic indexing layer for LCD screens, FSM states, screen layouts, controls, transitions and operator workflows, then provide an ECROS-5400 profile that maps the existing project to Photometry, Quantitative analysis, Kinetics, Multiwavelength, Files and Settings workflows.

The implementation must reuse the current executable project model and the existing UX Semantic Contract. It must not introduce a competing persisted source of truth for screens, FSM structure or controls.

## Inputs and authority

The authoritative executable sources remain:

- `project.screens` and `screenOrder` for LCD layouts;
- `project.fsm` for states, events and transitions;
- `project.controlPanel` and `project.bindings` for physical controls and event linkage;
- `project.uxContract` for operator-facing roles, intents, goals and policies.

The ECROS semantic profile is an additive classification layer. It describes domain concepts such as measurement mode, phase, operation, quantity, input type and workflow membership. It never replaces a state id, screen id, transition id or control id.

The supplied `ECROS-5400_FSM_RU_v3` reference package is treated as domain reference material. It contains 86 logical states, 116 logical transitions and the Russian physical-panel button dictionary. Its logical groups guide the profile, while live project ids remain authoritative.

## Architecture

### 1. Generic derived semantic index

Create `src/domain/semanticIndex.ts` with a read-only `ProjectSemanticIndex` model.

The index contains:

- project identity and generation metadata;
- every LCD screen with layout summary and linked state ids;
- every FSM state with semantic classification and incoming/outgoing transition ids;
- every transition with trigger/event/control linkage and semantic intent;
- every physical button with global intent plus state-specific transition meanings;
- typed relations between screens, states, transitions, controls, events, procedures and workflow steps;
- workflow definitions and coverage diagnostics.

The index is derived on demand and is not persisted inside `.lcdproj`. This preserves the current authority boundary and prevents drift.

### 2. Screen/layout semantic record

Each indexed screen includes:

- `screenId`, name, width, height, tags;
- UX role and purpose;
- linked FSM state ids;
- object count and per-object lightweight layout records (`id`, type, bounds, text when applicable, procedure/algorithm bindings when present);
- inferred input kind when the linked state declares `FsmInputConfig`;
- semantic classification inherited from linked states when unambiguous.

This makes the semantic index useful both for agents and for traceability/report generation without duplicating the full bitmap payload.

### 3. State semantic record

Each state receives a `SemanticStateClassification`:

- `domain`: e.g. `startup`, `measurement`, `files`, `settings`, `auxiliary`;
- `mode`: e.g. `photometry`, `quantitative`, `kinetics`, `multiwave`;
- `phase`: e.g. `configuration`, `zeroing`, `measurement`, `results`, `save`, `print`, `navigation`;
- `operation`: normalized operation id such as `measurement.zero`, `measurement.measure`, `input.wavelength`, `result.save`;
- optional `quantity`: `A`, `E`, `%T`, `C` or profile-specific value;
- optional `inputKind`: `numeric.wavelength`, `numeric.parallel_count`, `numeric.gain`, `numeric.coefficient`, `numeric.concentration`, `text.filename`;
- optional `longRunning` flag;
- workflow ids and step ids.

Classification comes from a profile resolver, not from free-form UI text alone. Text/title pattern matching is only a fallback and must produce ambiguity diagnostics when confidence is insufficient.

### 4. Contextual button semantics

Physical controls retain one global identity, while transition-level semantics provide context.

Examples:

- `НОЛЬ` -> `measurement.zero`;
- `λ` -> `input.wavelength.open`;
- `ПАРАМЕТР` -> `parameters.open`;
- `ФАЙЛ` from main menu -> `files.open`, while in result contexts it may mean `result.save` depending on the actual FSM transition;
- `ВВОД` -> confirmation/submission semantics determined by the transition and current state;
- numeric keys, `-`, `.` -> input mutation semantics on states with `FsmInputConfig`;
- `СТАРТ/СТОП` -> `measurement.start`, `measurement.pause` or `measurement.resume` according to source/target state classification.

No fake FSM navigation transitions are created for individual numeric key presses.

### 5. Workflow graph

Create a generic `SemanticWorkflowDefinition` and `SemanticWorkflowStep` model. A workflow step references real `stateIds` and `screenIds`; its edges reference other workflow step ids.

Required ECROS workflows:

- `startup.standard`;
- `measurement.photometry` with A/E/%T branches;
- `measurement.quantitative.new_calibration`;
- `measurement.quantitative.load_calibration`;
- `measurement.quantitative.coefficients.create`;
- `measurement.quantitative.coefficients.open`;
- `measurement.kinetics`;
- `measurement.multiwave`;
- `files.open_result`;
- `files.open_calibration`;
- `settings.main`.

Reusable result actions are represented as shared semantic operations (`result.clear_selected`, `result.print`, `result.save`) even when the executable FSM uses mode-specific states.

### 6. ECROS-5400 profile

Create `src/services/semantic/profiles/ecros5400Profile.ts`.

The profile uses stable project ids first and normalized title/subsystem matching second. It must cover the current detailed ECROS-5400UV project and remain compatible with the logical v3 reference groups (`P_*`, `Q_*`, `QC_*`, `K_*`, `MW_*`, `F_*`, `S_*`, startup/aux groups).

The profile owns:

- normalized button semantics;
- state classifier rules;
- workflow definitions and step membership predicates;
- measurement quantity detection;
- input-kind detection;
- long-running operation detection;
- profile-specific diagnostics.

The generic semantic index builder must remain device-agnostic.

### 7. Relations

The index exposes explicit relation records. Minimum relation kinds:

- `screen.represents_state`;
- `state.uses_screen`;
- `state.next_state`;
- `transition.triggered_by_event`;
- `control.emits_event`;
- `control.triggers_transition`;
- `transition.invokes_process`;
- `screen_object.invokes_procedure`;
- `state.belongs_to_workflow_step`;
- `workflow_step.next`.

Relations always use existing ids and are deterministic and stably sorted.

### 8. Diagnostics and coverage

The builder returns diagnostics rather than silently guessing.

Required checks:

- screens without linked states;
- states without screens;
- states with ambiguous/no semantic classification;
- transitions whose contextual intent cannot be resolved;
- workflow steps with no matching state;
- workflow steps with unreachable states;
- orphan states not represented in any ECROS workflow where coverage is expected;
- A/E/%T branch contamination;
- zeroing steps that lack a `НОЛЬ`-driven transition where such transition is expected;
- long-running measurement steps that lack `СТАРТ/СТОП` semantics;
- save paths missing storage selection or filename input where applicable.

Diagnostics are non-blocking and do not enter generic project validation.

### 9. Reports and generated ECROS artifact

Add `scripts/generate-ecros-semantic-index.ts` to load the current ECROS project, build the semantic index and write deterministic outputs under `ECROS-5400UV/semantic/`:

- `semantic-index.json`;
- `semantic-screen-index.md`;
- `semantic-state-index.md`;
- `semantic-transition-index.md`;
- `workflow-coverage.md`;
- `orphan-screens.md`;
- `ambiguous-semantics.md`.

Generated output must be stable for unchanged input so it can be reviewed in Git diffs.

### 10. Automation surface

Expose read-only automation commands:

- `get_project_semantic_index`;
- `list_project_semantic_workflows`;
- `get_project_semantic_workflow`.

These commands call the same pure builder used by tests/scripts. They must not mutate the project and must preserve MCP/REST parity.

## Testing strategy

Use TDD.

Generic builder tests verify:

- complete screen/state/transition/control indexing;
- layout object summaries;
- deterministic relation construction;
- contextual transition/control semantics;
- stable ordering;
- diagnostics for orphan/ambiguous entities.

ECROS profile tests verify:

- Photometry A/E/%T branch separation;
- wavelength, gain, parallel-count and filename input classification;
- zero/measure/result/save semantics;
- all four Quantitative sub-workflows;
- Kinetics and Multiwave measurement branches;
- FILE path from main menu;
- contextual `СТАРТ/СТОП` semantics;
- expected workflow coverage against a compact fixture modeled after the supplied v3 reference.

Automation tests verify command registration, schema and dispatcher parity.

## Non-goals

- Do not replace the existing FSM with the 86-state logical reference graph.
- Do not persist a second copy of screen or transition structure in `.lcdproj`.
- Do not treat labels alone as authoritative behavior.
- Do not automatically rewrite ambiguous executable transitions.
- Do not introduce LLM inference into deterministic indexing.

## Success criteria

The implementation is complete when:

1. every live screen/state/transition/control appears in `ProjectSemanticIndex`;
2. ECROS measurement states have deterministic domain/mode/phase/operation classification or an explicit ambiguity diagnostic;
3. the required measurement/file/settings workflows resolve to real project ids;
4. relations are traceable in both directions through ids;
5. generated reports identify uncovered/orphan/ambiguous entities;
6. the feature is available through read-only automation commands;
7. typecheck and semantic/UX/automation tests pass without changing executable behavior of unrelated projects.
