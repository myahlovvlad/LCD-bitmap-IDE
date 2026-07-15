# Testing

## Commands

```bash
npm run typecheck
npm test
npm run test:renderer
npm run test:importer
npm run test:e2e
npm run test:fsm-roundtrip:acceptance
npm run test:fsm-script-sync:acceptance
npm run test:screen-interchange:acceptance
npm run test:dev
npm run test:electron
npm run test:performance
npm run test:package:win
npm run build
```

Use `npm run check` for the cross-platform acceptance gate and `npm run check:full` for browser, development, Electron, performance and manual-generation checks.

## Coverage Areas

- `render.test.ts`: framebuffer rendering, lines, rectangles, bitmap, special elements and packing roundtrip.
- `codegen.test.ts`: C symbol sanitization, C header export, binary export and C header import.
- `fontImport.test.ts`: BDF and app `.fnt` bitmap font import.
- `projectInterop.test.ts`: legacy LCD editor import and universal project export.
- `projectMigrationV5.test.ts`: v1/v2/v4/legacy conversion to schema v5,
  event/process migration and generated control panels.
- `projectValidationService.test.ts`: dependency integrity, graph reachability
  and control-button restrictions.
- `runtimeEngine.test.ts`: button events, transitions, missing transitions and
  step mode.
- `schema.test.ts`: v4 project payload and `.lcdproj` Zod validation.
- `history.test.ts`: bounded undo/redo stack behavior.
- `dithering.test.ts`: grayscale conversion, thresholding and packed output.
- `fsmScript.test.ts`: legacy Mermaid stateDiagram-v2 and Python DSL parsing without code execution.
- `fsmSemanticRoundTrip.test.ts`: canonical FSM interchange, Mermaid/Python
  byte-stable round-trip, dry-run preview, explicit Apply, stale preview
  rejection and undo/redo.
- `fsmSecurity.test.ts`: executable Python-like constructs and unsafe IDs are
  rejected by parser diagnostics.
- `fsmRoundTripHistory.test.ts`: one-entry ChangeSet history, revision changes,
  Undo/Redo replay and no-op history behavior.
- `fsmRoundTripConflict.test.ts`: stale revision/fingerprint rejection and
  parser failure isolation.
- `fsmRoundTripLayout.test.ts`: explicit layout updates and omitted-layout
  preservation.
- `fsmRoundTripScreenLinks.test.ts`: schema-v5 save/reopen authoring equality
  and screen-link preservation.
- `fsmRoundTripHandles.test.ts`: transition handle updates and unchanged handle
  preservation.
- `fsmScriptSession.test.ts`: transient document session creation, clean graph
  refresh, dirty protection, stale result rejection and applicability checks.
- `fsmScriptPreviewCoordinator.test.ts`: debounced preview scheduling and
  preview-only mutation boundaries.
- `fsmScriptSyncIntegration.test.ts`: document session + round-trip facade
  integration, explicit Apply lifecycle, format stale behavior and typed/opaque
  behavior preservation.
- `screenInterchangeCharacterization.test.ts`: current LCD authoring order,
  visible filtering, z-index raster precedence, display dimensions and
  screen/state links.
- `screenInterchangeModel.test.ts`: Screen Interchange Model V1 package shape,
  resource refs, reconstruction, canonical serialization and fingerprints.
- `screenInterchangeFacade.test.ts`: read-only application facade behavior for
  project and single-screen packages.
- `screenInterchangeSecurity.test.ts`: missing resource refs, unsupported
  packing and object-order validation failures.
- `screenInterchangePerformance.test.ts`: synthetic package export,
  validation and fingerprint performance envelope.
- `architectureBoundary.test.ts`: AST-based dependency boundary check ensuring
  `src/application`, `src/compiler`, `src/domain`, `src/fsm-interchange`,
  `src/model`, `src/screen-interchange`, `src/services` and `src/entities` do
  not import renderer, features, React, Zustand, Electron or React Flow. It
  also prevents compiler imports from application sessions,
  Electron main/preload and command infrastructure. Additionally checks that
  `src/features/screen-dsl-studio/` does not import parsers, YAML libs,
  ChangeSet mappers, `fs`, `path`, or Electron, and that the application
  screenDsl layer has no React, Zustand, or Electron imports.
- `screenDslStudioTestHelpers.ts`: shared factory functions for all three
  Screen Schema Studio test files. No React, no Zustand, no DOM.
- `screenSchemaStudioViewModel.test.ts` (69 tests): pure selector tests for
  all `src/features/screen-dsl-studio/selectors.ts` exports, covering status
  mapping, enable/disable logic, apply disabled reason codes, diagnostic
  grouping, semantic change grouping, raster summary (128×64=1024-byte budget),
  target summary and no-op detection.
- `screenSchemaStudioState.test.ts` (51 tests): coordinator state machine tests
  verifying observable component behavior — rendering properties, source state
  transitions, format/mode isolation, preview via `coordinator.requestPreview`,
  apply state transitions, tabs/panels, accessibility state, security text
  storage.
- `screenSchemaStudioIntegration.test.ts` (50 tests): full workflow integration
  tests (workspace entry point non-DOM assertions, context wiring, preview
  workflow, apply workflow, staleness detection, undo/redo integration,
  session isolation, destructive dialog, source-range navigation).
  Environment: node only — DOM rendering tests deferred to Playwright E2E
  (Phase 4B.5).
- `legacyCodegenCharacterization.test.ts`: frozen legacy C/binary output
  hashes for current renderer-owned generation, vertical-LSB packing, symbols,
  locale selection, bitmap bytes and bundled demo output.
- `compilerIr.test.ts`: compiler source snapshots, IR v1 determinism,
  traceability, symbol diagnostics, canonical serialization and application
  read-only adapter behavior.
- `compilerPerformance.test.ts`: synthetic normalization sizing and duration
  observations for 100 states, 500 transitions, 100 screens and 3000 objects.
- `commandBus.test.ts`: command envelopes, expected revisions, dry-run,
  validation-before-commit and linked FSM/screen semantics.
- `changeSet.test.ts`: atomic multi-command application, dry-run candidates and
  full-batch rejection on new blocking validation errors.
- `projectStoreCommandAdapter.test.ts`: Zustand adapter revision/history
  behavior for the Phase 1B.1 vertical slice.
- `tests/e2e/app.spec.ts`: four isolated workspaces, FSM-to-LCD navigation,
  panel button editing, runtime transitions/step mode, locales and manual tour.
- `tests/e2e/fsm-script-*.spec.ts`: targeted FSM Script Studio acceptance for
  Mermaid, Python-like DSL, parser/security errors, stale previews, destructive
  changes, auto-preview, dirty protection, clean refresh, format drafts and
  workspace draft preservation. These tests use semantic selectors and do not
  use bitmap screenshot comparison as the oracle.
- `tests/e2e/visual.spec.ts`: visual regression baselines for the LCD editor and manual.
- `tests/launch/dev.spec.ts`: Vite development-server startup smoke.
- `tests/electron/app.electron.spec.ts`: source and packaged Electron startup, visible window and full LCD aspect ratio.
- `tests/performance/app.performance.spec.ts`: startup, interaction, UI-settle and long-task budgets.

Coverage thresholds are enforced by `npm run test:coverage`: 80% lines/statements/functions and 75% branches.

## Script verifiers

- `npm run test:renderer` (`scripts/verify-renderer.ts`): framebuffer/export build check.
- `npm run test:importer` (`scripts/verify-importer.ts`): bundled FSM import check.
- `npm run test:fsm-roundtrip`: FSM script compatibility and semantic
  round-trip core.
- `npm run test:fsm-security`: FSM script parser security checks.
- `npm run test:fsm-roundtrip:integration`: focused application/session
  integration coverage for FSM round-trip.
- `npm run test:fsm-roundtrip:e2e`: targeted Playwright acceptance for Script
  Studio Preview/Apply UX.
- `npm run test:fsm-roundtrip:acceptance`: unit/security + integration +
  targeted E2E gate.
- `npm run test:fsm-script-sync`: reducer and preview coordinator tests.
- `npm run test:fsm-script-sync:integration`: sync reducer/coordinator plus
  application integration.
- `npm run test:fsm-script-sync:e2e`: targeted Playwright controlled
  synchronization suite.
- `npm run test:fsm-script-sync:acceptance`: sync integration + targeted E2E +
  architecture boundary. Visual snapshots are intentionally excluded.
- `npm run test:screen-interchange`: characterization, model and facade tests.
- `npm run test:screen-interchange:security`: validation security tests.
- `npm run test:screen-interchange:performance`: synthetic export budget.
- `npm run test:screen-interchange:acceptance`: screen interchange unit,
  security, performance and architecture boundary gate.
- `npm run test:screen-dsl:ui`: pure selector (view-model) and coordinator state
  transition tests for Screen Schema Studio, plus architecture boundary gate.
- `npm run test:screen-dsl:ui-integration`: full workflow integration tests
  (Preview, Apply, Staleness, Undo/Redo, session isolation) plus application
  layer tests. No jsdom — all node-only.
- `npm run test:screen-dsl:acceptance`: full Screen DSL acceptance gate
  (core, security, application, atomicity, session, UI, UI-integration,
  performance, screen interchange acceptance, architecture boundary).

## 2026-06-16 Update

- FSM graph testing should cover multi-side handles, saved `sourceHandle` / `targetHandle` values and self-loop rendering.
- Runtime tests should cover event, button, timer and fact/condition transition mechanisms.
- Manual export verification should distinguish standalone HTML/PDF generation from browser printing of the active screen.
- Copy actions should be verified in Electron IPC and browser fallback contexts.

## Known Limitations

- macOS and Linux package artifacts are best verified on native CI runners.
- Static `docs/manual/` screenshots are placeholders until a screenshot capture pass refreshes the manual assets.
- Coverage thresholds are unchanged. Dedicated critical-module coverage gates
  for domain, services and application command APIs remain follow-up work.

## Changelog

- 2026-06-24: added command bus, ChangeSet and store adapter coverage for Phase
  1B.1.
- 2026-06-24: added Phase 2A compiler IR, legacy codegen characterization and
  compiler performance coverage.
- 2026-06-24: added Phase 3A.1 FSM round-trip integration and E2E acceptance
  coverage.
- 2026-06-24: added architecture boundary testing and regression checks for
  schema-v5 ID preservation and portable `.lcdproj` migration.
- 2026-06-25: added Phase 3C controlled script synchronization reducer,
  coordinator, integration tests and targeted E2E acceptance.
- 2026-06-25: added Phase 4A screen interchange characterization, model,
  facade, validation security, performance and acceptance scripts.
- 2026-06-25: added Phase 4B.4 Screen Schema Studio view-model, coordinator state,
  and full workflow integration test coverage (170 new tests across three files),
  extended architecture boundary assertions for the Studio layer, and
  `test:screen-dsl:ui` / `test:screen-dsl:ui-integration` scripts.
- 2026-06-16: added acceptance scope for FSM feedback edges, clipboard IPC and manual PDF export.
