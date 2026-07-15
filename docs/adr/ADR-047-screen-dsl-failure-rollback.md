# ADR-047: Screen DSL Failure and Rollback Strategy

Status: Accepted

Date: 2026-06-25

## Context

Screen DSL Apply may fail at multiple stages: envelope validation, per-command
execution, final project validation. We needed a consistent rollback model
without adding explicit undo/restore code paths.

## Decision

Rollback is implicit. `ProjectSession` is immutable. `applyScreenDslPreview`
returns either a new session (success) or the original session (failure). Any
pre-commit failure causes the function to return `applied: false` with a
diagnostic code; `finalizeMutation` is never called.

Failure-injection for tests uses `ScreenDslApplyTestHooks`, a DI interface with
`beforeOperation`, `afterOperation`, and `beforeCommit` callbacks. Hooks are
passed as an optional second argument to `applyScreenDslPreview`. There is no
global mutable state, no `process.env` switch, and no production code path that
reads from hooks.

## Consequences

Test failures are isolated and reproducible. There is no "partial-apply" state
to recover from. The production code path is unchanged for callers that do not
pass hooks.
