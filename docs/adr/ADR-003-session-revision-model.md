# ADR-003: Session Revision Model

## Status

Accepted for Phase 1B.1.

## Context

The schema-v5 project format is a persisted data model. Command concurrency,
dry-run previews and external adapters need a mutation ordering token, but that
token should not change the project file schema during the command-bus
introduction.

## Decision

`ProjectSession` pairs a schema-v5 `LcdBitmapProject` with an in-memory
`revision` number:

```ts
interface ProjectSession {
  project: LcdBitmapProject;
  revision: number;
}
```

Each applied command or ChangeSet increments the session revision by one. A
dry-run returns a candidate session with the projected next revision while the
input session remains unchanged. Rejected and no-op commands keep the original
session revision.

Every command and ChangeSet includes `projectId` and `expectedRevision`.
Mismatches are rejected before mutation.

## Consequences

- revision is session-level state, not schema-v5 persisted state
- loading a project snapshot into Zustand starts a new local session at
  revision `0`
- external adapters must supply the current revision when command APIs are
  exposed later
- persisted project compatibility is unchanged

## Follow-up

Phase 1B.2 should define how undo/redo, command replay and long-lived external
sessions interact with revision advancement.
