# Screen DSL Session Lifecycle

## Event types (16 total)

| Event | Trigger |
|---|---|
| `SOURCE_INITIALIZED` | Editor opens; canonical text loaded from project |
| `SOURCE_CHANGED` | User edits source text |
| `VALIDATION_STARTED` | Lint/parse pass starts |
| `VALIDATION_FAILED` | Lint/parse pass returns errors |
| `PREVIEW_STARTED` | Preview computation starts; increments `requestSequence` |
| `PREVIEW_SUCCEEDED` | Preview computation returns valid result |
| `PREVIEW_FAILED` | Preview computation returns errors |
| `PREVIEW_SUPERSEDED` | A newer request started before this result arrived |
| `PROJECT_CHANGED` | External project mutation (Undo/Redo, other command) |
| `TARGET_SELECTION_CHANGED` | User changes target screen selection |
| `APPLY_STARTED` | Apply initiated |
| `APPLY_SUCCEEDED` | Apply committed |
| `APPLY_FAILED` | Apply returned `applied: false` |
| `DISCARD_DRAFT` | User explicitly discards edits |
| `REFRESH_FROM_PROJECT` | Editor re-exports canonical source from project |
| `SESSION_DISPOSED` | Session closed |

## Request-sequence protection

`requestSequence` increments with every `PREVIEW_STARTED` event. When a
`PREVIEW_SUCCEEDED` event arrives, the reducer checks whether the event's
`requestSequence` matches the session's `activeRequestSequence`. If a newer
request has started, the old result is discarded (session status stays
`validating` waiting for the newer result).

## Stale transitions

`PROJECT_CHANGED` marks a `preview-ready` or `dirty` session as `stale`. The
held preview is cleared. A `clean` session updates its revision without going
stale (no draft to invalidate).

`TARGET_SELECTION_CHANGED` always marks stale and clears the preview.

## Apply lifecycle

```
preview-ready
  → APPLY_STARTED → applying
    → APPLY_SUCCEEDED → applied (coordinator immediately reinitializes to clean)
    → APPLY_FAILED   → failed
```

## Disposal

After `SESSION_DISPOSED`, `disposed` is set to `true`. The coordinator no longer
returns disposed sessions from `getOrCreate`. A disposed session can still be
read via `getSession` (it is not removed from the map immediately).
