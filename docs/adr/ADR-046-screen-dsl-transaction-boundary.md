# ADR-046: Screen DSL Transaction Boundary

Status: Accepted

Date: 2026-06-25

## Context

Screen DSL Apply must guarantee that project state is never partially mutated.
Earlier drafts considered tracking individual command results and rolling them
back on failure, but that required mutable intermediate state.

## Decision

The atomicity boundary is `executeProjectChangeSet` in `changeSet.ts`. It
accepts an immutable `ProjectSession` and a `ProjectChangeSet`, executes all
commands, and calls `finalizeMutation` to produce a new `ProjectSession`. It
never mutates the input session.

`applyScreenDslPreview` performs all pre-commit validation (project mismatch,
source drift, revision drift, limit checks) before calling
`executeChangeSetWithHooks`. If any check fails, the original session is
returned unchanged.

A typed `ScreenDslApplyTransaction` record is produced on each successful Apply.
Its `fingerprint` is deterministic over the operation inputs, not over time or
file-system paths.

## Consequences

No explicit rollback code is needed. Failures are handled by not proceeding to
`finalizeMutation`. The transaction fingerprint provides a stable identity for
deduplication and audit without leaking runtime state.
