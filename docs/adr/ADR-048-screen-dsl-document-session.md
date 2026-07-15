# ADR-048: Screen DSL Document Session

Status: Accepted

Date: 2026-06-25

## Context

Screen Studio needs to track draft source text, in-flight preview requests,
and apply state independently of the committed project. Without explicit session
state, components would use ad-hoc local React state, making race protection and
staleness detection ad hoc as well.

This pattern was already established for FSM Script by ADR-025.

## Decision

Introduce `ScreenDslDocumentSession` in `src/application/screenDslSession/`.
The session is keyed by `{ projectId, format, importMode, targetScreenIds }` and
managed by `ScreenDslSessionCoordinator`.

State transitions are handled by `reduceScreenDslDocumentSession`, a pure
function with no async, no parsers, no `Date.now()`, and exhaustive handling of
16 event types.

The coordinator handles all side effects (preview creation, apply) and dispatches
events to the reducer. The session layer does not import React, Zustand, or
Electron.

Session state is not persisted in schema-v5. On reload the session is
reinitialized from the canonical project export.

## Consequences

Draft text is explicit application authoring state, not implicit component state.
Request-sequence protection and staleness detection are testable without a
browser. The layer boundary is enforced by `architectureBoundary.test.ts`.
