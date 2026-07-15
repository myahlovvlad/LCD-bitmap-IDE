# ADR-029: Screen Interchange Model V1

## Status

Accepted.

## Context

Phase 4A needs a stable LCD screen authoring exchange boundary before any
Screen DSL, external adapter or live synchronization work.

## Decision

Introduce `src/screen-interchange` with package kind
`lcd-bitmap-screen-interchange`, version `1`, and pure conversion from
schema-v5 projects/screens.

## Consequences

- Renderer, compiler backend and codegen remain unchanged.
- Screen packages can be validated, canonicalized and fingerprinted.
- External adapters must target this boundary or the application Command Bus,
  not mutate project JSON directly.
