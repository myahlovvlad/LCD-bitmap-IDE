# FSM Script Conflict Policy

Phase 3C is conservative: it detects stale/conflicted authoring state and asks
for explicit user action instead of merging silently.

## Dirty Policy

A document is dirty when its `sourceFingerprint` differs from
`generatedSourceFingerprint`.

Dirty documents are never overwritten by automatic graph refresh.

## Stale Policy

A dirty document becomes stale when the canonical graph changes after the
document baseline. Apply is disabled until the user re-previews against the
current graph.

Clean documents may refresh automatically from the graph.

## Conflict Policy

Semantic conflicts are not auto-resolved. The current UI exposes the stale
state and keeps user text intact. The user can:

- Re-preview against the current graph.
- Refresh from graph, with confirmation for dirty text.
- Discard the draft.
- Apply only after a current valid preview exists.

Opaque legacy behavior strings are not normalized or rewritten by refresh,
preview scheduling or conflict handling.
