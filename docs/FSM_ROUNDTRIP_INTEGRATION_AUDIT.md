# FSM Round-trip Integration Audit

Date: 2026-06-24
Phase: 3A.1 - FSM Round-trip Integration Hardening and E2E UX Acceptance
Branch: `test/fsm-roundtrip-e2e-hardening`
Baseline commit: `c3fcc20`

## Phase Gate

The audit started from `D:\Vlad Myahlov\LCD-bitmap-IDE-production` on branch
`refactor/fsm-semantic-roundtrip`, then created `test/fsm-roundtrip-e2e-hardening`.
Commit `c3fcc20` is an ancestor of the branch head. The working tree was clean before
the Phase 3A.1 branch was created.

Baseline checks passed before hardening work:

- `npm run typecheck`
- `npm run test:fsm-roundtrip`
- `npm run test:fsm-security`
- `npx vitest run tests/utils/architectureBoundary.test.ts`
- `npm run test:coverage`
- `npm run test:renderer`
- `npm run test:importer`
- `npm run test:compiler`
- `npm run test:codegen-equivalence`
- `npm run test:compile-fixtures`
- `npm run build`

Phase 3A backup bundle:

- Path: `D:\Vlad Myahlov\phase-3a-complete.bundle`
- Verify result: ok, complete history, SHA-1 hash algorithm

## Integration Chain

| Link | Implementation | Public API | Input / Output | Errors | Loading / cancel | Revision / history | UI feedback | Existing tests | Missing tests | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Script editor | `src/features/fsm-script/FsmScriptStudio.tsx` | React props `session`, `onApplyPreview` | Mermaid/Python text -> preview/apply actions | Preview diagnostics are collapsed into status text | Synchronous preview/apply; file import async; no cancellation | Uses session prop snapshot | `script-status` text only | Unit coverage through facade | Component/E2E UX state coverage | Apply can implicitly preview if selected preview is absent or mismatched |
| Parser | `src/fsm-interchange/mermaid.ts`, `pythonDsl.ts` | `parseFsmMermaid`, `parseFsmPythonDsl` | Source text -> model, diagnostics, sourceMap | Line/column diagnostics | Synchronous; bounded by caller file-size guard | No mutation | Via Script Studio status | `fsmSemanticRoundTrip`, `fsmSecurity` | E2E invalid/unsafe flows | Python DSL must stay non-executable |
| Source map | parser modules | `FsmSourceMapEntry[]` | Parsed line -> entity mapping | Diagnostic positions | Synchronous | No mutation | Not rendered as dedicated list | Partial unit checks | Dedicated source map tests | Low, but UX does not expose source map yet |
| Semantic validation | `src/fsm-interchange/validation.ts` | `validateFsmInterchange` | Candidate model -> diagnostics | Unknown refs, invalid IDs, layout refs | Synchronous | No mutation | Status text only | Unit coverage | E2E invalid references | Medium UX discoverability |
| Semantic diff | `src/fsm-interchange/diff.ts` | `diffFsmInterchange` | Base/candidate -> operations | No thrown path in normal use | Synchronous | No mutation | Not rendered as structured list | Unit coverage | Integration assertions for rename/update/layout/delete | Medium: current UI hides operation detail |
| ChangeSet dry-run | `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | `previewFsmScriptImport` | Parsed model -> `ProjectChangeSet` + dry-run | Dry-run diagnostics appended to preview diagnostics | Synchronous | Captures `baseRevision` and `baseFingerprint` | Status text | Unit coverage | No-op/history/stale integration coverage | Low application risk |
| Explicit Apply | `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | `applyFsmScriptPreview` | Preview -> `ProjectCommandResult` | Invalid/noop/stale/rejected result | Synchronous | Checks revision and fingerprint before apply | Status text | Unit coverage | Store/history/selection coverage | UX risk: Apply button not disabled for stale/invalid states |
| Command Bus | `src/application/changeSet.ts`, `commandBus.ts` | `executeProjectChangeSet`, `finalizeMutation` | ChangeSet -> new session + patches | Envelope mismatch, duplicate command id | Synchronous | One history entry for ChangeSet | Store projection only | Command/changeSet tests | FSM-specific aggregate history tests | Low |
| ProjectSession | `src/application/projectSession.ts` | `createProjectSession`, `undoProjectSession`, `redoProjectSession` | Session -> revision/history update | Null when unavailable | Synchronous | Undo/redo increments revision | Store exposes canUndo/canRedo | Session tests | FSM round-trip undo/redo identity tests | Low |
| Zustand projection | `src/renderer/store/projectStore.ts` | `applyFsmScriptPreview`, `undo`, `redo` | ProjectCommandResult -> UI state | Rejected result is returned without mutation | Synchronous | Projects history into `undoStack`/`redoStack` | Selected state/transition reconciled | Store command tests | Script preview store tests | Medium: selection reconciliation needs explicit tests |
| FSM graph | `src/features/fsm/FsmWorkspace.tsx` | React workspace | Store FSM -> React Flow nodes/edges | Missing project fallback | React rendering | Reflects store projection | Graph nodes/edges update | E2E app smoke only | Round-trip graph E2E | Medium: no stable selectors yet |
| Save/export | `src/renderer/App.tsx`, compiler facade | Existing save/export actions | Project snapshot/artifacts | Existing validation/export diagnostics | UI flows | Schema-v5 unchanged | Existing UI | Importer/codegen tests | Save/reopen authoring equality | Medium because browser save/reopen is not yet covered for scripts |
| Reopen/import | `src/renderer/App.tsx`, migration service | `loadProjectSnapshot` for project open only | Snapshot -> session | Migration validation | File picker async | New session revision 0 | Existing project loaded state | Migration tests | Round-trip persistence fixture | Medium |

## Workflow Findings

Mermaid workflow:

- Canonical export includes version, state/event/transition/layout metadata.
- Parser preserves stable state IDs, transition IDs, layout entries, handles and screen IDs through the interchange model.
- Missing: structured semantic diff UI and E2E coverage for rename + layout + transition create.

Python-like DSL workflow:

- Writer uses declarative `FSM`, `state`, `event`, `transition` calls.
- Parser blocks executable constructs and does not evaluate Python.
- Missing: E2E coverage proving no executable boilerplate and authoring round-trip after Apply/Undo/Redo.

No-op import:

- Facade returns `noop` and does not create a ChangeSet apply history entry.
- Missing: dedicated history assertion.

Stale preview:

- Application facade rejects when session revision or FSM fingerprint changed.
- Missing: visible stale UX and store/E2E coverage.

Syntax and unsafe input:

- Parser returns line/column diagnostics.
- Current UI shows the first diagnostic only in status text.
- Missing: stable diagnostic list selectors.

Destructive changes:

- Semantic diff can represent deletes and apply them atomically.
- Missing: destructive marker/confirmation UX.

Graph layout:

- Explicit layout metadata is applied; omitted layout preserves previous positions or deterministic fallback.
- Missing: dedicated layout preservation tests.

Stable IDs, screen links and transition handles:

- Interchange model contains IDs, screen IDs and transition handles.
- Missing: focused persistence tests for screen links and handles.

Undo/Redo:

- ChangeSet apply is one history entry; undo/redo replay patches and increment revision.
- Missing: FSM-specific aggregate undo/redo tests preserving IDs and layout.

## Initial Hardening Targets

1. Add stable semantic selectors for Script Studio, FSM workspace and app shell where E2E needs them.
2. Make Script Studio Apply explicit: disabled until a valid current preview exists, no implicit preview on Apply.
3. Show revision-bound preview state, diagnostic list and semantic diff list.
4. Mark stale previews when the session revision changes after preview creation.
5. Add focused integration tests for persistence, history, stale conflict, layout, screen links and transition handles.
6. Add targeted Playwright E2E specs using page objects, without screenshot comparison as the acceptance oracle.

## Out of Scope

The audit intentionally excludes typed guards/effects, schema-v6, live synchronization, MCP, REST API, plugin SDK, compiler backend changes and generated C/binary changes.
