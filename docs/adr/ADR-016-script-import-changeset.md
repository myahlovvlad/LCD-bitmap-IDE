# ADR-016: Script Import ChangeSet

## Status

Accepted.

## Decision

Script import applies through a typed `fsm.semanticRoundTrip.apply` command
inside one `ProjectChangeSet`. Preview uses dry-run; Apply is explicit.

## Consequences

Successful imports create one history entry and are undoable/redone atomically.
Stale previews are rejected by revision and FSM fingerprint checks.
