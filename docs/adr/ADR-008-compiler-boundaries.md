# ADR-008: Compiler Boundaries

## Status

Accepted for Phase 2A.

## Context

The compiler must eventually support non-UI adapters such as CLI, API, MCP and
CI verification. It cannot depend on transient renderer or session state.

## Decision

`src/compiler` may depend on `src/domain` and its own submodules only. It must
not import application sessions, command history, renderer modules, React,
Zustand, Electron, DOM or Canvas APIs.

`src/application` may provide read-only adapters that create compiler source
snapshots from `ApplicationWorkspace`, but compiler normalization itself does
not create commands, history entries or revisions.

## Consequences

- Compiler normalization is pure and deterministic.
- UI selections, zoom, dialogs and active workspace do not affect IR.
- Future external adapters can call the compiler through stable source
  snapshots rather than mutating project JSON directly.
