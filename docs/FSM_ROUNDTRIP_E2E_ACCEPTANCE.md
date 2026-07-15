# FSM Round-trip E2E Acceptance

Phase 3A.1 adds a targeted semantic acceptance gate for FSM Script Studio.
Playwright verifies the user journey, not bitmap pixels.

## Command

```bash
npm run test:fsm-roundtrip:e2e
```

The command builds the app, serves `dist/renderer` with the existing Playwright
static preview harness and runs only the FSM script specs.

`npm run test:fsm-roundtrip:acceptance` composes:

- `npm run test:fsm-roundtrip`
- `npm run test:fsm-security`
- `npm run test:fsm-roundtrip:integration`
- `npm run test:fsm-roundtrip:e2e`

Phase 3C adds a companion controlled synchronization gate:

```bash
npm run test:fsm-script-sync:acceptance
```

It covers reducer/coordinator behavior, document-session integration, targeted
Script Studio E2E and the architecture boundary test. Visual snapshots are not
part of this semantic gate.

## Covered Journeys

- Mermaid: edit text, Preview, semantic diff, explicit Apply, graph update,
  Undo, Redo, autosave reload and canonical regeneration.
- Python-like DSL: declarative source without import/eval/exec boilerplate,
  state update, transition handle update, transition create, Undo/Redo,
  autosave reload and authoring regeneration.
- Parser errors: unsafe and invalid Python-like DSL produces diagnostics and
  keeps Apply disabled.
- Stale preview: any project revision change after Preview shows a stale banner
  and disables Apply.
- Destructive change: delete operations are marked destructive and remain one
  atomic undoable import.
- Controlled sync: auto-preview remains preview-only, dirty drafts survive graph
  changes, clean documents refresh, format drafts are independent and workspace
  switches preserve in-memory drafts.

## Test Selectors

The E2E tests use stable semantic selectors only for meaningful controls:

- `fsm-script-studio`
- `fsm-script-source-mermaid`
- `fsm-script-source-python`
- `fsm-script-preview-*`
- `fsm-script-apply-*`
- `fsm-script-diagnostics`
- `fsm-script-semantic-diff`
- `fsm-script-stale-preview`
- `fsm-state-card-*`
- `app-undo`
- `app-redo`

CSS class chains and screenshot comparison are intentionally not the acceptance
oracle for FSM round-trip behavior.

## Known Baseline Outside This Gate

The general visual, Electron and performance suites keep their separate baseline
status. Phase 3A.1 does not update visual snapshots and does not change compiler
IR, schema-v5 or generated C/binary output.
