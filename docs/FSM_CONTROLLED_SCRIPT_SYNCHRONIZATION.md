# FSM Controlled Script Synchronization

Phase 3C introduces controlled synchronization between the canonical FSM graph
and Script Studio authoring text.

## Rule

Automatic work may parse text, build Preview and refresh a clean canonical
script document. Automatic work must not apply a ChangeSet, replace a dirty
document, resolve semantic conflicts or rewrite opaque legacy behavior.

## Boundaries

- `ProjectSession.project.fsm` is the canonical engineering state.
- Script text is transient authoring state keyed by project ID and format.
- Preview is a dry-run boundary and does not change project revision or history.
- Apply is explicit and still uses the existing FSM round-trip ChangeSet.
- Script drafts are not persisted to `.lcdproj`.
- Schema-v5, generated C and binary output are unchanged.
- MCP, AI, Behavior DSL, Operation Registry and Screen DSL are not part of
  Phase 3C.

## Implementation

- `src/application/fsmScriptSession/*` owns the serializable document session,
  pure reducer helpers, source fingerprints and preview coordinator.
- `FsmScriptStudio` keeps an in-memory draft cache outside project state so
  workspace switches do not silently discard dirty text.
- Each format has its own document session and status.
- Auto-preview is debounced and sequence-bound.
- Dirty documents become stale after graph changes and are never overwritten by
  automatic refresh.

## Validation

Use:

```bash
npm run test:fsm-script-sync:acceptance
```

This gate covers reducer/coordinator behavior, application integration,
targeted E2E journeys and the architecture boundary test. It intentionally does
not include visual snapshots.
