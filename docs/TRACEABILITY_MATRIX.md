# Traceability Matrix

Every functional requirement maps to a concrete implementation file and at
least one automated or manual verification. The matrix is the single source of
truth for coverage; new features must add a row here when merged.

| Requirement | Implementation | Tests |
| --- | --- | --- |
| Four isolated workspaces | `src/app/WorkspaceRouter.tsx`, `src/features/{fsm,lcd,control-panel,preview}` | `tests/e2e/app.spec.ts` |
| Schema-v5 project and legacy migration | `src/model/project.ts`, `src/services/projectMigrationService.ts` | `tests/utils/projectMigrationV5.test.ts` |
| Separate FSM states and LCD screens | `src/model/project.ts`, `src/renderer/store/projectStore.ts` | migration and E2E workspace tests |
| Physical control-panel editor | `src/features/control-panel/ControlPanelWorkspace.tsx` | `tests/e2e/app.spec.ts` |
| Runtime FSM engine | `src/services/runtimeEngine.ts`, `src/features/preview/PreviewWorkspace.tsx` | `tests/utils/runtimeEngine.test.ts`, `tests/e2e/app.spec.ts` |
| Dependency validation and gates | `src/services/projectValidationService.ts`, `src/renderer/App.tsx` | `tests/utils/projectValidationService.test.ts` |
| IDE/device token separation | `src/renderer/styles.css`, `src/model/project.ts` | `tests/e2e/visual.spec.ts` |
| Preserve 128x64 LCD constants | `src/shared/constants/display.ts`, `src/renderer/config/constants.ts` | `tests/utils/render.test.ts` |
| Preserve design tokens | `src/shared/constants/tokens.ts`, `src/renderer/styles.css` | `tests/e2e/visual.spec.ts` |
| Zustand project state | `src/renderer/store/projectStore.ts` | `tests/utils/history.test.ts`, `npm run typecheck` |
| Project-wide undo/redo | `src/renderer/store/projectStore.ts`, `src/shared/lib/history.ts` | `tests/utils/history.test.ts` |
| Application command bus vertical slice | `src/application/`, `src/renderer/store/projectStore.ts` | `tests/utils/commandBus.test.ts`, `tests/utils/projectStoreCommandAdapter.test.ts` |
| Atomic ChangeSet dry-run/apply | `src/application/changeSet.ts`, `src/application/commandBus.ts` | `tests/utils/changeSet.test.ts` |
| `.lcdproj` portable format | `src/entities/project/schema.ts`, `src/renderer/core/projectInterop.ts` | `tests/utils/schema.test.ts` |
| v3 to v4 migration | `src/renderer/App.tsx`, `src/renderer/core/projectInterop.ts` | `tests/utils/projectInterop.test.ts` |
| Screen cloning and CRUD | `src/features/lcd/LcdWorkspace.tsx`, `src/renderer/store/projectStore.ts` | `npm run typecheck`, `tests/e2e/app.spec.ts` |
| BitmapObject import | `src/renderer/types/domain.ts`, `src/features/pixel-importer/PixelImporter.tsx` | `tests/utils/render.test.ts` |
| Floyd-Steinberg worker | `src/features/pixel-importer/dithering.ts`, `src/features/pixel-importer/pixelWorker.ts` | `tests/utils/dithering.test.ts` |
| Preview Mode | `src/features/preview/PreviewWorkspace.tsx`, `src/services/runtimeEngine.ts` | `tests/e2e/app.spec.ts`, `tests/utils/runtimeEngine.test.ts` |
| FSM multi-side handles and self-loop edges | `src/features/fsm/FsmWorkspace.tsx`, `src/renderer/components/StateNode.tsx` | `tests/e2e/app.spec.ts`, manual smoke |
| Transition mechanisms and conditional branching | `src/model/project.ts`, `src/services/runtimeEngine.ts`, `src/features/preview/PreviewWorkspace.tsx` | `tests/utils/runtimeEngine.test.ts` |
| Hotkeys | `src/renderer/App.tsx` | `tests/e2e/app.spec.ts` |
| Clipboard copy actions | `src/renderer/utils/clipboard.ts`, `src/main/main.ts`, `src/preload/preload.cts` | `tests/e2e/app.spec.ts`, manual Electron smoke |
| C header and binary screen export | `src/renderer/utils/codegen.ts`, `src/renderer/core/ExportEngine.ts` | `tests/utils/codegen.test.ts` |
| Legacy generated output compatibility | `src/renderer/utils/codegen.ts`, `src/renderer/utils/render.ts` | `tests/utils/legacyCodegenCharacterization.test.ts`, `npm run test:renderer` |
| Normalized compiler IR v1 | `src/compiler/`, `src/application/compilerSourceAdapter.ts` | `tests/utils/compilerIr.test.ts`, `tests/utils/compilerPerformance.test.ts`, `tests/utils/architectureBoundary.test.ts` |
| Bitmap font import/edit | `src/renderer/utils/fontImport.ts`, `src/renderer/components/LCDCanvasEditor.tsx` | `tests/utils/fontImport.test.ts` |
| FSM model <-> Mermaid/Python script converters | `src/features/fsm-script/fsmScript.ts` | `tests/utils/fsmScript.test.ts` |
| FSM semantic round-trip core | `src/fsm-interchange/*`, `src/application/fsmRoundTrip/*` | `npm run test:fsm-roundtrip`, `npm run test:fsm-security`, `npm run test:fsm-roundtrip:integration` |
| FSM Script Studio (generate, preview, explicit apply) | `src/features/fsm-script/FsmScriptStudio.tsx`, `src/features/fsm/FsmWorkspace.tsx` | `npm run test:fsm-roundtrip:acceptance`, `tests/e2e/fsm-script-*.spec.ts` |
| Controlled FSM script synchronization | `src/application/fsmScriptSession/*`, `src/features/fsm-script/FsmScriptStudio.tsx` | `npm run test:fsm-script-sync:acceptance` |
| Screen Interchange Model V1 | `src/screen-interchange/*`, `src/application/screenInterchangeFacade.ts` | `npm run test:screen-interchange:acceptance` |
| Screen interchange resource closure and traceability | `src/screen-interchange/conversion.ts`, `src/screen-interchange/validation.ts` | `tests/utils/screenInterchangeModel.test.ts`, `tests/utils/screenInterchangeSecurity.test.ts` |
| Screen DSL document session state machine | `src/application/screenDslSession/reducer.ts`, `src/application/screenDslSession/coordinator.ts` | `npm run test:screen-dsl:session` |
| Screen DSL Preview/Apply application facade | `src/application/screenDsl/*`, `src/application/index.ts` | `npm run test:screen-dsl:application`, `npm run test:screen-dsl:atomicity` |
| Screen Schema Studio pure selectors (view-model) | `src/features/screen-dsl-studio/selectors.ts` | `tests/utils/screenSchemaStudioViewModel.test.ts` (69 tests) |
| Screen Schema Studio coordinator state transitions | `src/application/screenDslSession/coordinator.ts`, `src/features/screen-dsl-studio/selectors.ts` | `tests/utils/screenSchemaStudioState.test.ts` (51 tests) |
| Screen Schema Studio full workflow integration | `src/application/screenDslSession/coordinator.ts`, `src/application/index.ts` | `tests/utils/screenSchemaStudioIntegration.test.ts` (50 tests), `npm run test:screen-dsl:ui-integration` |
| Screen DSL Studio architecture boundary | `src/features/screen-dsl-studio/`, `src/application/screenDslSession/` | `tests/utils/architectureBoundary.test.ts`, `npm run test:screen-dsl:ui` |
| Script file import (.mmd/.py/.txt) | `src/features/fsm-script/FsmScriptStudio.tsx` | `npm run typecheck`, manual smoke |
| FSM bundle import (interactive HTML/JSON) | `src/renderer/core/fsmImporter.ts`, `src/renderer/core/loadBundledFsm.ts` | `tests/utils/projectInterop.test.ts`, `npm run test:importer` |
| Compact graph layout | `src/renderer/core/compactGraphLayout.ts`, `src/renderer/components/StateNode.tsx` | `npm run test:renderer` |
| Reference command-center layout and collapsible shutters | `src/renderer/App.tsx`, `src/renderer/styles.css` | `tests/e2e/app.spec.ts`, `tests/e2e/visual.spec.ts` |
| Adaptive panes and persistent custom widths | `src/renderer/App.tsx`, `src/renderer/styles.css` | `tests/e2e/app.spec.ts` |
| Draggable FSM tiles with autosaved relative positions | `src/features/fsm/FsmWorkspace.tsx`, `src/renderer/store/projectStore.ts` | `tests/e2e/app.spec.ts` |
| i18n (EN/RU/zh), no encoding artifacts | `src/renderer/config/i18n.ts`, `src/renderer/config/operationManual.ts` | `tests/utils/i18n.test.ts`, `tests/e2e/app.spec.ts` |
| In-app interactive manual and guided tour | `src/renderer/config/operationManual.ts`, `src/renderer/App.tsx` | `tests/e2e/app.spec.ts` |
| Standalone trilingual HTML/PDF manual | `scripts/generate-manual.ts`, `docs/generated/`, `docs/manual/`, `src/renderer/components/OperationManualDialog.tsx` | `npm run docs:manual`, `tests/e2e/app.spec.ts` |
| Complete unclipped LCD rendering | `src/renderer/styles.css`, `src/renderer/components/LCDCanvasEditor.tsx` | `tests/e2e/app.spec.ts`, `tests/electron/app.electron.spec.ts` |
| Performance budgets and bundle splitting | `src/renderer/App.tsx`, `vite.config.ts` | `tests/performance/app.performance.spec.ts` |
| Desktop packaging (Windows/macOS/Linux) | `package.json` (build), `.github/workflows/build.yml`, `.github/workflows/release.yml` | GitHub Actions native runners, `npm run build:*` |
| Import security | `src/shared/lib/security.ts`, `src/entities/project/schema.ts` | `tests/utils/schema.test.ts` |
| Domain/application boundary independence | `src/application/`, `src/domain/`, `src/model/project.ts`, `src/services/projectInterop.ts`, `src/renderer/types/domain.ts` | `tests/utils/architectureBoundary.test.ts` |
| Portable `.lcdproj` migration preservation | `src/services/projectInterop.ts`, `src/services/projectMigrationService.ts` | `tests/utils/projectMigrationV5.test.ts`, `tests/utils/schema.test.ts` |

## 2026-06-16 Update

The matrix now tracks multi-side FSM handles, self-loop transitions, clipboard IPC, generated PDF export and native cross-platform packaging.

## Known Limitations

- Some workflows still require manual smoke checks until dedicated Playwright coverage is added for self-loop drawing and Electron clipboard.
- MCP, Behavior DSL, Operation Registry, Screen DSL and full live collaborative
  synchronization are deferred after Phase 4A.

## Changelog

- 2026-06-24: added Phase 1B.1 command bus, ChangeSet and store adapter rows.
- 2026-06-24: added Phase 2A compiler IR and legacy generated output rows.
- 2026-06-24: added Phase 3A.1 FSM round-trip acceptance rows.
- 2026-06-25: added Phase 3C controlled script synchronization row.
- 2026-06-25: added Phase 4A Screen Interchange Model V1 and resource closure
  rows.
- 2026-06-25: added Phase 4B.4 Screen Schema Studio view-model, coordinator state,
  integration, and architecture boundary rows (170 new tests).
- 2026-06-24: added Phase 1A domain boundary and portable migration preservation rows.
- 2026-06-16: updated traceability for FSM routing, clipboard, manual export and packaging.
