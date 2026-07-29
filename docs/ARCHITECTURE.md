# Architecture

LCD-bitmap IDE is a shared React/Vite editor hosted by two desktop shells:
Electron is the established shell and Tauri 2 is the Rust-based migration
target. Both operate on the same schema-6 domain model and renderer.

For the product vocabulary and state categories, read
[CONCEPTUAL_MODEL.md](CONCEPTUAL_MODEL.md) first.

## Runtime Shape

```text
Electron main/preload ─┐
                       ├─ desktop capability boundary ─ React renderer
Tauri Rust backend ────┘                              │
                                                      ↓
                                            application commands
                                                      ↓
                                             schema-6 project
                                               ├─ runtime
                                               └─ compiler/export
```

The shells provide file, clipboard and native integration. Product behavior
belongs in the shared TypeScript layers unless an operating-system capability
requires a native adapter.

## Layers

- `src/domain`: framework-independent contracts for the schema-6 project, FSM,
  LCD canvas, localization, tags, procedures, alarms and trends.
- `src/application`: command bus, `ProjectSession`, revisions, semantic
  ChangeSets, dry runs, history integration and application facades.
- `src/entities`: project and screen factories.
- `src/services`: migration, interoperability, dependency validation and runtime
  execution.
- `src/fsm-behavior`: typed FSM behavior storage and codecs.
- `src/fsm-interchange`: safe FSM interchange models, parsers, writers,
  semantic diff and project application helpers.
- `src/screen-interchange`: stable screen authoring package, resources,
  canonicalization, traceability and reconstruction.
- `src/screen-dsl`: JSON/YAML screen DSL contracts and conversion.
- `src/compiler`: read-only source snapshots, normalized IR, target lowering,
  backend registry and deterministic artifact generation.
- `src/app`: typed workspace routing.
- `src/features`: user-facing workspace and workflow modules.
- `src/renderer`: React shell, Zustand adapter, rendering, i18n and desktop
  integration.
- `src/shared`: narrow cross-boundary contracts and security utilities.
- `src/main` and `src/preload`: Electron-only host and IPC bridge.
- `apps/tauri`: isolated Tauri package and Rust host.

The repository has no `src/model` compatibility directory and no
`src/features/preview` workspace. Current contracts live in `src/domain`;
runtime UI lives in `src/features/runtime-workspace`.

## Workspaces

The router supports these current modes:

- Design: FSM, LCD and Control panel.
- Integrate: Tags, Procedures and Alarms.
- Validate: Runtime.
- Deliver: Text registry and Handoff.
- Advanced: Screen DSL and Settings.

`preview` remains in the routing type for compatibility, but the active
navigation uses `runtime`. The flat navigation does not yet express the groups
above; this is tracked in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).

## State And Mutation Boundary

`LcdBitmapProject` is canonical persisted engineering state.
`projectStore.ts` adapts a `ProjectSession` to React and owns UI-facing state
such as selection, language and local resources.

Normal project mutations cross the application command bus and produce
revision-aware changes. Atomic imports and DSL applies use ChangeSets. Parsers,
renderers, runtime simulation and compiler stages must not mutate the canonical
project directly.

Application revision, command history, savepoints, processed command IDs,
selection, active workspace, zoom and validation timestamps are not persisted
domain data and do not affect compiler fingerprints.

## Persistence And Migration

- Schema 6 (`kind: "lcd-bitmap-project"`, `version: 6`) is current.
- Schema 5 is accepted as a legacy project version.
- SpectroDesigner snapshots, portable `.lcdproj` 1.0, universal JSON and older
  LCD editor snapshots are input compatibility formats.
- Legacy input is size-checked, schema-validated and migrated before it enters
  the application store.
- Runtime conditions and backend commands are declarative and are never
  evaluated as arbitrary JavaScript.

Some public TypeScript symbols still use a `V5` suffix while accepting current
schema-6 data. This is legacy naming debt, not a second native schema.

## Rendering And Runtime

LCD authoring and preview use the Canvas API. The physical control panel uses
SVG. Runtime builds a derived execution context from the FSM, bindings, tags,
procedures and alarms; it records execution without becoming a second editable
project model.

## Compiler And Export

The compiler path is:

```text
CompilerSourceSnapshot
  → NormalizedCompilerIrV1
  → LoweredTargetIrV1
  → backend artifacts and integrity metadata
```

The project also retains legacy renderer export surfaces in
`src/renderer/core/ExportEngine.ts` and `src/renderer/utils/codegen.ts`.
Migration toward one production backend is incremental and guarded by
characterization and deterministic-equivalence tests.

See [COMPILER_ARCHITECTURE.md](COMPILER_ARCHITECTURE.md),
[COMPILER_IR_V1.md](COMPILER_IR_V1.md) and
[CURRENT_CODEGEN_AUDIT.md](CURRENT_CODEGEN_AUDIT.md).

## Automation Boundary

The Electron host exposes local REST and MCP adapters bound to `127.0.0.1`.
Mutation requests are routed back through the application mutation surface.
These endpoints are implemented features, not deferred roadmap items. See
[API_MCP_CONNECTORS.md](API_MCP_CONNECTORS.md).

## Enforced Invariants

`tests/utils/architectureBoundary.test.ts` checks that the domain, application,
compiler, interchange, services and entity layers remain independent of React,
Zustand and desktop infrastructure. It also protects the Screen DSL file and
IPC boundaries.

These tests complement, but do not replace, review of broad barrel exports and
cross-community bridge types identified in the architecture graph.

## Known Limitations

- Navigation exposes advanced and primary workspaces at equal weight.
- Several central UI, mutation, manual and localization modules are too large.
- Electron and Tauri do not yet share one explicit typed capability port.
- Some current APIs and tests retain schema-5 names.
- Legacy and normalized compiler export paths coexist.
- Cross-platform installers must be built on native runners.
- Manual screenshots under `docs/manual/` require a current capture refresh.

The prioritized remediation plan is in
[TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).
