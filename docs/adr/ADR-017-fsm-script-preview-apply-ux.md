# ADR-017: FSM Script Preview/Apply UX

Status: Accepted

Date: 2026-06-24

## Context

Phase 3A introduced a safe semantic FSM round-trip core. Phase 3A.1 hardens the
user-facing Script Studio flow before adding typed guards/effects or live sync.

The risky UX behavior was allowing Apply to implicitly run Preview when a current
preview was absent or mismatched. That made the explicit review step less clear
and was awkward for E2E acceptance.

## Decision

Script Studio uses a strict explicit Preview -> Apply contract:

- Apply is disabled until a valid preview with semantic changes exists.
- Editing, importing or regenerating script text clears the preview.
- Apply never reparses text implicitly.
- Stale previews are detected by session revision and shown in the UI.
- Diagnostics and semantic diff are rendered as stable lists.
- Destructive diff operations are marked in the preview.

The canonical Python-like DSL writer emits declarative `fsm.*` statements without
an import boilerplate line. The parser remains backward-compatible with the old
`from lcd_bitmap_ide import FSM, State, Event` line.

## Consequences

- Users must explicitly press Preview before Apply.
- E2E tests can assert disabled/enabled states deterministically.
- The script editor remains text-first and offline.
- Live synchronization is deferred to a later phase.
