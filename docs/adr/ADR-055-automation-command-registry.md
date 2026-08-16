# ADR-055: One renderer-owned automation command registry

Status: accepted
Date: 2026-08-16

## Context

Electron REST, Electron MCP and UI actions had overlapping but independently maintained command mappings. Tauri had no equivalent automation transport. External writes could bypass application revisions, semantic ChangeSets, undo and consistent result reporting.

## Decision

1. `src/shared/automation/registry.ts` is the only automation capability catalogue. Every entry declares input/output JSON Schema, access, idempotency, dry-run support, permission and renderer handler.
2. The renderer owns the active project and executes all UI, Electron and Tauri automation through the same dispatcher and application command bus.
3. Every external write requires `expectedRevision`. Optional idempotency keys prevent duplicate execution, and dry-runs return semantic changes without mutating the session.
4. Every request produces a structured outcome and bounded audit event. Automation-authored changes are undoable only from the latest matching history entry.
5. Electron and Tauri bind REST/MCP to loopback. Both enforce bounded bodies, Host/Origin checks, a renderer timeout, correlation IDs, optional bearer authentication and explicit scopes.
6. MCP tool schemas and capability discovery are generated from the registry. Compatibility endpoints may translate old payloads, but may not own alternate mutation logic.

## Consequences

- REST, MCP and both desktop shells share one validation and execution path.
- New automatable UI commands must update the parity table or document an explicit `uiOnlyReason`; parity tests fail otherwise.
- The renderer must remain open because transports intentionally do not maintain a shadow project.
- Hardware execution and firmware evidence are outside this milestone and remain blocked until an adapter and target evidence are available.
