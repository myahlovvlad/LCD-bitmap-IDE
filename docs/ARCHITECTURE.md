# Architecture

The Electron/Vite renderer is organized as a project shell plus four isolated
workspaces. Legacy project readers remain at the import boundary; application
state and current exports use schema version 5.

## Layers

- `src/domain`: renderer-independent contracts and pure defaults for language,
  display geometry, canvas objects, fonts, legacy import models and schema-v5
  project data. This layer must not import React, Zustand, Electron, renderer,
  features or DOM-specific modules.
- `src/application`: renderer-independent command bus, session revision model,
  semantic changes, dry-run execution and atomic ChangeSet support for the
  command-based application layer.
- `src/fsm-interchange`: renderer-independent FSM authoring interchange model,
  Mermaid/Python-like DSL writers and safe parsers, semantic diff and pure FSM
  project application helpers.
- `src/screen-interchange`: renderer-independent LCD screen authoring
  interchange model v1, resource closure validation, canonical serialization,
  fingerprints and read-only reconstruction helpers. It does not import the
  renderer, compiler backend, React, Zustand or Electron.
- `src/compiler`: renderer-independent Phase 2A compiler source snapshots,
  normalized semantic IR v1, diagnostics, traceability, canonical
  serialization and deterministic fingerprints. This layer does not import
  application sessions, renderer modules, React, Zustand, Electron, DOM or
  Canvas APIs.
- `src/model`: the schema-v5 project, workspace, control-panel, runtime and
  validation contracts. This path is now a compatibility re-export over
  `src/domain/project`.
- `src/services`: migration, project interoperability, dependency validation and
  runtime execution. These modules do not import renderer, React, Zustand or
  Electron.
- `src/app`: typed workspace routing.
- `src/features/fsm`: FSM graph, inspectors, linked LCD preview and FSM
  validation.
- `src/features/lcd`: screen list, bitmap canvas, pixel import, fonts, glyphs,
  C export and templates.
- `src/features/control-panel`: SVG physical-panel editor and button bindings.
- `src/features/preview`: read-only device simulator and runtime log.
- `src/renderer`: thin shell, v5 Zustand store, canvas renderer and Electron
  integration.

## State

`projectStore.ts` is now a renderer adapter over `ProjectSession` for
canonical engineering state. Project mutations flow through the application
command bus and command-history patches; renderer state still owns selections,
language and local UI resources.

Compiler source snapshots are read-only projections of application workspace
data. They exclude application revision, history, savepoints, processed command
IDs, selections, active workspace, zoom and validation timestamps from compiler
fingerprints.

## Rendering

LCD rendering stays Canvas API based. The control panel uses an SVG design
surface. Runtime consumes the same panel and FSM model but never mutates design
data.

## Compiler

Phase 2A adds a normalized semantic IR but does not move production export. The
current C/binary generator remains `src/renderer/core/ExportEngine.ts` and
`src/renderer/utils/codegen.ts`. See `docs/CURRENT_CODEGEN_AUDIT.md`,
`docs/COMPILER_ARCHITECTURE.md` and `docs/COMPILER_IR_V1.md`.

## Current Component Map

- The former mixed `App.tsx` workspace was split into `FsmWorkspace`,
  `LcdWorkspace`, `ControlPanelWorkspace` and `PreviewWorkspace`.
- `LCDCanvasEditor` remains the LCD object editor and now receives a screen ID
  view instead of an FSM state canvas.
- `PixelImporter` is an LCD-internal tool.
- FSM scripts are exposed from the FSM workspace.
- Phase 3A routes FSM script import through semantic preview and explicit
  ChangeSet Apply; parsers do not mutate Zustand or project JSON directly.
- Phase 3A.1 hardens Script Studio UX: Apply requires a valid current preview,
  stale previews are rejected visibly and targeted E2E tests use semantic
  selectors instead of bitmap snapshots.
- Phase 3C adds controlled Script Studio synchronization through transient
  per-format document sessions. Clean script documents refresh from the graph,
  dirty drafts become stale instead of being overwritten and Apply still crosses
  the existing ChangeSet boundary explicitly.
- Phase 4A adds Screen Interchange Model V1 as a stable authoring package for
  project and single-screen export. It preserves screen object order, geometry,
  localized text, font refs, bitmap refs, resource closure, traceability and a
  canonical fingerprint without changing schema-v5 or generated C/binary output.
- The former project settings "Control panel" drawer is removed; project
  metadata remains in the common header.

## Migration Formats

- Schema v5 (`kind: "lcd-bitmap-project"`, `version: 5`) is the native format.
- SpectroDesigner snapshots v1/v2/v4, portable `.lcdproj` 1.0, universal JSON
  and legacy LCD editor snapshots are input-only compatibility formats.
- Every legacy `canvasByStateId` becomes a separate screen and the matching
  state receives `screenId`.
- Legacy transition trigger strings become `FsmEvent` records.
- Legacy `cliCommands` become `BackendProcess` records.
- Missing panels are populated with an LCD and one button per migrated event.

## Import Safety

Legacy imports are validated by their existing Zod schemas before migration.
Files larger than 10 MB are rejected before parsing. Runtime conditions and
backend commands are declarative and are never evaluated as arbitrary code.

## Document History

Point-in-time audit, QA and roadmap reports authored under the project's earlier working name are retained under `docs/archive/` for provenance. The files under `docs/` (this file, `DATA_MODEL.md`, `SECURITY.md`, `TESTING.md`, `TRACEABILITY_MATRIX.md`, `operation_manual.md`) are the living, authoritative documentation.

## 2026-06-16 Update

- FSM graph nodes expose multi-side connection handles and preserve transition `sourceHandle` / `targetHandle` in schema-v5 projects.
- Feedback routes and self-loop transitions are rendered by a custom React Flow edge.
- The operation manual can be exported as standalone HTML and, in Electron, as PDF generated from the manual HTML document.
- Clipboard operations use an Electron IPC bridge with web fallbacks.

## Known Limitations

- Cross-platform installers should be produced on native CI runners; local `build:all` is a convenience command and may fail when packaging non-native targets.
- Manual screenshots in `docs/manual/` are structured placeholders until the next captured screenshot refresh.
- Target lowering and backend migration are deferred to Phase 2B.
- MCP adapters, REST API, Screen DSL, Behavior DSL, Operation Registry and
  screen live synchronization are deferred beyond Phase 4A.

## Changelog

- 2026-06-24: added Phase 1B.1 application command bus, session revision model,
  dry-run ChangeSets and Zustand adapter for the first vertical slice.
- 2026-06-24: added Phase 2A normalized compiler IR contracts,
  renderer-independent source snapshots and compiler boundary tests.
- 2026-06-24: added Phase 3A.1 FSM round-trip integration hardening and
  targeted E2E acceptance documentation.
- 2026-06-25: added Phase 3C controlled Script Studio synchronization
  architecture and document session boundary.
- 2026-06-25: added Phase 4A Screen Interchange Model V1 architecture,
  resource refs, validation, traceability and canonical serialization.
- 2026-06-24: added Phase 1A domain boundary, renderer compatibility facades,
  pure service project interop and architecture boundary tests.
- 2026-06-16: documented multi-side FSM handles, self-loop edges, HTML/PDF manual export and clipboard IPC.
