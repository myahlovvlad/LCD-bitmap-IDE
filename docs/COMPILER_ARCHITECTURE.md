# Compiler Architecture

Phase 2A introduced a renderer-independent normalized compiler IR. Phase 2B adds
a deterministic codegen boundary and moves production C/binary export through
the compiler/application facade while preserving legacy output byte-for-byte.

## Pipeline

```text
Application workspace
-> CompilerSourceSnapshot
-> Semantic validation
-> Normalized semantic IR v1
-> Canonical serialization
-> Deterministic fingerprint
-> Diagnostics and traceability report
-> Lowered Target IR v1
-> Codegen backend SPI
-> Artifact set, manifest and SHA-256 digests
-> Equivalence / compile verification tests
```

Phase 2B keeps the target deliberately narrow: the current legacy monochrome
128x64 vertical-LSB C/binary output. It does not add schema-v5 fields, device
packs, MCP, REST APIs, plugin APIs or FSM import/export round-trip behavior.

## Dependency Boundaries

- `src/compiler` may import `src/domain`.
- `src/compiler` must not import `src/application`, `src/renderer`,
  `src/features`, React, Zustand, Electron, DOM or Canvas APIs.
- `src/application` may expose read-only adapters that build
  `CompilerSourceSnapshot` from an `ApplicationWorkspace`.
- The compiler source snapshot excludes revision, history, savepoints,
  processed command IDs, selections, active workspace, zoom, dialogs, absolute
  file paths and validation timestamps from fingerprints.

The boundary is enforced by `tests/utils/architectureBoundary.test.ts`.

## Current Implementation

- Source snapshot: `src/compiler/source/*`.
- IR contracts: `src/compiler/ir/*`.
- Validation diagnostics: `src/compiler/validation/*`.
- Normalization: `src/compiler/normalization/*`.
- Canonical serialization and fingerprinting: `src/compiler/serialization/*`.
- Target IR contracts: `src/compiler/target-ir/*`.
- Target lowering and renderer-independent packing: `src/compiler/lowering/*`.
- Backend SPI and legacy C backend: `src/compiler/backends/*`.
- Artifact manifest and SHA-256 digests: `src/compiler/artifacts/*`.
- Equivalence helpers: `src/compiler/verification/*`.
- Compiler/application facade: `src/compiler/facade/*` and
  `src/application/codegenFacade.ts`.

## Compatibility Rules

- Schema-v5 remains the persisted project source of truth.
- IR v1 has its own version and is not stored as project data.
- Screen Interchange Model V1 is an authoring package boundary for screens, not
  compiler IR and not generated output. It can feed future adapters only after
  explicit validation and conversion.
- Existing C output, binary output, symbols, all-screen order, symbol-collision
  behavior and vertical-LSB packing are not changed by Phase 2B.
- The legacy all-screen table continues to report the historical fixed 1024 byte
  screen size for compatibility with existing firmware consumers.
- FSM round-trip, MCP, REST API and plugin SDK are deferred.

## Screen Interchange Relationship

Phase 4A keeps Screen Interchange outside the compiler pipeline. The compiler
still reads project/application snapshots; screen packages are used for
authoring comparison, resource closure and future adapter boundaries. No
renderer-owned C/binary output changes are introduced by Screen Interchange V1.
