# ADR-032: Screen Authoring vs Raster Equality

## Status

Accepted.

## Context

LCD authoring objects and rendered pixels are related but not the same
contract. Phase 4A must not move renderer/codegen ownership.

## Decision

Screen Interchange V1 defines authoring equality. Renderer and legacy codegen
tests continue to own raster and binary equality.

## Consequences

- The interchange model remains renderer-independent.
- No generated C, binary export or visual snapshot is changed in Phase 4A.
- Future render-aware adapters must cross an explicit renderer/compiler
  boundary.
