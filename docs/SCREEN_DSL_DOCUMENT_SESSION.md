# Screen DSL Document Session

## Purpose

`ScreenDslDocumentSession` is a transient in-memory record of an in-progress
Screen DSL authoring task. It separates the author's editing state (draft text,
preview, diagnostics) from the committed project state.

It is not persisted in schema-v5 (`.lcdproj` files). On reload, the session
starts empty and the editor re-exports the canonical source from the project.

## Session key

`ScreenDslDocumentKey` identifies one editing context:

```
{ projectId, format, importMode, targetScreenIds }
```

`targetScreenIds` is stored sorted and deduplicated. Two keys with the same
content compare equal regardless of creation order.

A separate session exists for each distinct key — JSON create, YAML create,
JSON update targeting `[screen-a]`, etc. are all independent sessions.

## Session state

Key fields in `ScreenDslDocumentSession`:

| Field | Description |
|---|---|
| `key` | Identity of this session |
| `sourceText` | Current editor content (may differ from canonical) |
| `sourceFingerprint` | FNV1a-64 of `sourceText` |
| `canonicalBaselineFingerprint` | FNV1a-64 of last committed canonical export |
| `dirty` | `true` when `sourceFingerprint !== canonicalBaselineFingerprint` |
| `status` | Current lifecycle status (see below) |
| `baseRevision` | Project revision at session initialization |
| `baseScreenFingerprint` | Screen interchange fingerprint at initialization |
| `preview` | Last successful preview result, or `null` |
| `previewLifecycle` | Lifecycle of the held preview |
| `diagnostics` | Last validation/preview error list |
| `requestSequence` | Monotonically increasing sequence number |
| `activeRequestSequence` | Sequence of the in-flight preview request |
| `staleReason` | Why the session is stale, or `null` |
| `disposed` | `true` after `SESSION_DISPOSED` |

## Session statuses

```
empty          — created, no source text yet
clean          — source matches canonical baseline
dirty          — source differs from baseline
validating     — preview request in flight
invalid        — preview failed with errors
preview-ready  — preview succeeded, apply is available
stale          — project changed while preview was ready or dirty
applying       — Apply in progress
applied        — Apply succeeded (short-lived before coordinator resets)
failed         — Apply failed
```

## Pure reducer

`reduceScreenDslDocumentSession(session, event)` is a pure function. It never
calls parsers, async functions, `Date.now()`, or `Math.random()`. All 16 event
types are handled exhaustively. The reducer is in
`src/application/screenDslSession/reducer.ts`.

## Coordinator

`ScreenDslSessionCoordinator` (in `src/application/screenDslSession/coordinator.ts`)
owns the session map and orchestrates side effects (preview creation, apply).
It does not import React, Zustand, or Electron.
