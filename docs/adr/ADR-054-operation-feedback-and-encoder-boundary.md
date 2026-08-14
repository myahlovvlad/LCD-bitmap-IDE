# ADR-054: Explicit operation feedback and one display encoder boundary

Status: accepted
Date: 2026-08-14

## Context

Ephemeral local toasts could not answer whether an operation was still running, completed or failed, and operators could not revisit earlier results. Display byte length was duplicated across UI, handoff and compiler code, allowing those layers to disagree.

## Decision

1. Renderer notifications use one global store with immutable identity, source, timestamps, unread state and explicit `running`, `success` or `failure` outcome. Errors remain persistent until dismissed. Recurring failures may use a dedupe key.
2. UI notifications report only observed software outcomes. Hardware and filesystem operations may not emit success without their adapter returning a verifiable result.
3. Legacy mono vertical-LSB length and encoding are owned by `compiler/encoding/displayEncoder.ts`. Handoff, normalization and renderer compatibility helpers call that boundary.
4. New pixel formats extend this encoder contract and add a decoder; callers must not add packing formulas.

## Consequences

- Users have a keyboard/screen-reader-accessible notification history instead of transient text only.
- Running work cannot silently disappear and failures remain actionable.
- Legacy fixtures remain byte-identical while schema-v7 display work has a single extension point.
- The current encoder deliberately rejects unsupported color/packing combinations rather than guessing.
