# ADR-007: Normalized Compiler IR

## Status

Accepted for Phase 2A.

## Context

The existing C/binary generator is renderer-owned and operates directly on
canvas objects. That path must remain compatible while the project grows toward
target backends, simulator/query APIs and future semantic round-trip.

## Decision

Introduce `src/compiler` with a versioned normalized semantic IR v1. The IR is
built from a read-only `CompilerSourceSnapshot`, uses explicit project order
arrays, centralizes symbols, emits stable diagnostics and records
traceability.

Phase 2A does not switch production C/binary generation to IR.

## Consequences

- Compiler code is renderer-independent and can be tested without UI state.
- IR fingerprints are deterministic for equivalent semantic inputs.
- Symbol collisions are visible before backend migration.
- Backend-specific target lowering is deferred to Phase 2B.

## Alternatives Considered

- Move the existing renderer generator directly into compiler: rejected because
  it would risk output drift before characterization and equivalence tests.
- Persist IR in `.lcdproj`: rejected because schema-v5 remains the source of
  truth and IR versioning should evolve independently.
