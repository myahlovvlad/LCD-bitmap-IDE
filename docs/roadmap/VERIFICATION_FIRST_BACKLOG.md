# Verification-first prioritized backlog

## P0 — contract integrity

- [x] Complete UI command registry coverage and document every intentional `uiOnlyReason`.
- [x] Route remaining direct tag/procedure/alarm mutations through the application command bus.
- [x] Add expected revision, idempotency, dry-run and audit metadata to every external mutation.
- [x] Generate REST/MCP schemas and parity tests from one registry.
- [x] Add Tauri localhost-only automation transport with origin, body, timeout and token controls.

## P1 — canonical display and evidence core

- [ ] Introduce schema v7 `DisplayProfile`, migration v6 → v7 and profile fingerprint.
- Separate `CanonicalRaster`, encoder, decoder and codegen backends.
- Add lossless encode/decode property tests for all supported profiles.
- Build deterministic screen rendering/layout analysis and issue overlays.
- Produce the 128×64 evidence bundle with decoded artifact and zero-pixel-diff proof.

## P2 — authoring scale

- Screen groups, hierarchical/manual indices, drag/keyboard reorder and API/MCP mappings.
- Safe FSM template AST with `for`, `if/else` and bounded/progress-checked `while`.
- Template registry, preview semantic diff, atomic apply/detach and one-step undo.
- FSM semantic zoom, minimap, label controls and 300-state/600-transition performance gate.

## P3 — resource pipeline

- Non-destructive image import presets, histogram/diff and deterministic dithering.
- Animation assets, frame timeline, GIF/APNG/WebP/sequence import and C/H/BIN export.
- Connector SDK for open/documented formats with conformance fixtures.

## P4 — firmware integration

- Safe generated-region/AST source patching with backup, diff and compile check.
- Bounded BIN/HEX/ELF patching that creates a new artifact by default.
- Explicit flash/readback adapters and blocked results when required addresses are absent.
- Chaos suite for partial writes, stale revisions, timeouts, disconnects and hash mismatch.

## Release gates

Software gates: typecheck, unit/compiler/FSM/Screen DSL suites, renderer smoke, production build, Tauri check, browser/Electron/visual tests. Hardware gates remain separate and must record device, adapter, firmware, addresses, observed bytes and hashes; absence of equipment is `blocked`, never `passed`.
