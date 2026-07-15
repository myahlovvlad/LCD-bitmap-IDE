# FSM Script Synchronization UX

Script Studio exposes controlled synchronization without live graph mutation.

## Actions

- Auto-preview: debounced parse/diff/dry-run after editing.
- Preview/Re-preview: explicit parse/diff/dry-run for the active format.
- Refresh: regenerate from the current graph; dirty refresh asks for
  confirmation.
- Discard: replace draft with current generated graph source.
- Apply: explicitly applies the current valid preview through the command bus.

## States

Each format shows its document status (`clean`, `dirty`, `scheduled`,
`parsing`, `invalid`, `preview-ready`, `stale` or `failed`) and whether the
source is dirty.

## Accessibility

Preview diagnostics, stale warnings and semantic diffs remain text-rendered with
stable test selectors. Apply buttons are disabled when the document is stale,
invalid, no-op or missing a valid preview.
