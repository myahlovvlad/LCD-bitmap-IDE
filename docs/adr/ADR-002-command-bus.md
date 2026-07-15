# ADR-002: Application Command Bus

## Status

Accepted for Phase 1B.1.

## Context

Before Phase 1B.1, renderer Zustand actions owned project mutations directly.
That made future MCP/API adapters risky because each adapter could become a
separate mutation source with subtly different behavior.

Phase 1B.1 introduces the first vertical slice of a renderer-independent
application command bus. The slice covers:

- project metadata update (`name`, `version`)
- FSM state add/update/delete, including linked LCD screen behavior
- FSM transition add/update/delete
- LCD screen create/rename/delete, including linked FSM state behavior

## Decision

Commands are typed objects under `src/application` and execute against a
`ProjectSession`. The command bus performs:

- project ID and `expectedRevision` checks before mutation
- pure candidate project mutation
- semantic change collection
- derived `bindings` rebuild
- validation-before-commit
- optional dry-run execution

Zustand is now an adapter for this vertical slice. It creates commands, passes
the current session revision, commits only `applied` results and keeps existing
selection/history behavior around the command result.

## Consequences

Positive:

- command semantics are testable without renderer infrastructure
- future MCP can call the same Command Bus instead of writing state directly
- dry-run and ChangeSet execution share validation and revision behavior
- `src/application` is covered by the architecture boundary test

Trade-offs:

- store operations outside the Phase 1B.1 slice still use legacy mutations
- undo/redo history is still snapshot-based in the store
- command-based history and full store migration remain Phase 1B.2

## Follow-up

Phase 1B.2 should complete store migration, replace snapshot-centric history
with command/ChangeSet history where appropriate and harden revision behavior
around undo/redo.
