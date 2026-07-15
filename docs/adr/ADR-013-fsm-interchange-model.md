# ADR-013: FSM Interchange Model

## Status

Accepted.

## Decision

Create `src/fsm-interchange` as a renderer-independent authoring model for FSM
round-trip. Do not use compiler IR as the editable round-trip source.

## Consequences

Stable IDs, graph layout, handles, screen links and explicit order are preserved
without changing schema-v5 project files.
