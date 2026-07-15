# ADR-009: Deterministic Codegen Boundary

## Status

Accepted.

## Context

Before Phase 2B, renderer utilities rendered LCD objects, packed frame buffers
and formatted C/binary exports directly. That made the production export path
hard to verify as a compiler boundary and made future backends easy to couple to
UI state.

## Decision

Introduce a compiler-owned target codegen path:

- `NormalizedCompilerIrV1` lowers to `LoweredTargetIrV1`.
- A backend SPI accepts lowered target IR and an explicit generation request.
- The legacy C backend emits artifact sets with SHA-256 digests and manifests.
- Production export buttons call the application facade, not renderer codegen
  utilities.
- Legacy renderer codegen remains as a compatibility oracle for tests.

## Consequences

- Phase 2B preserves current firmware-facing output byte-for-byte.
- Legacy quirks are named target-profile policy rather than accidental UI
  behavior.
- Future MCP, REST, plugin and device-pack work must adapt to the command/API
  boundary instead of mutating project state or formatting exports directly.
- New backends can be added after the application API and artifact contracts are
  stable.
