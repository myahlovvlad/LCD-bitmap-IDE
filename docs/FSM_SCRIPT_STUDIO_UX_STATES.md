# FSM Script Studio UX States

FSM Script Studio is intentionally preview/apply based. Phase 3C allows
controlled auto-preview while preserving the rule that there is no auto-apply
while the user types.

## States

| State | Apply | User feedback |
| --- | --- | --- |
| Fresh generated text | Disabled | No preview panel yet |
| Edited text | Disabled | "Preview again before Apply" if a prior preview existed |
| Preview with semantic changes | Enabled | Diff list shows operation type and entity ID |
| Preview with no semantic changes | Disabled | Diff list shows "No semantic changes" |
| Parser or validation error | Disabled | Diagnostic list shows code, line, column and message |
| Stale preview | Disabled | Stale banner shows preview/current revision mismatch |
| Dirty stale document | Disabled | Source text is preserved; user can Re-preview, Refresh or Discard |
| Scheduled/parsing auto-preview | Disabled | Status reports that preview is pending/running |
| Applied preview | Disabled | Status reports one history entry; preview is cleared |

## Guarantees

- Preview never mutates project state, revision or history.
- Auto-preview never mutates project state, revision or history.
- Apply never performs an implicit Preview.
- Apply requires a valid current preview with semantic changes.
- A stale preview cannot be applied.
- Dirty drafts are not overwritten by graph refresh.
- Mermaid and Python-like DSL drafts are independent.
- Unsafe Python-like DSL is rejected before ChangeSet creation.
- A successful Apply is one command-history entry.
- Undo reverts the full import.
- Redo restores the same IDs, layout, screen links and transition handles.

## Deliberate Non-goals

- No background Apply.
- No executable Python.
- No MCP/API adapter in this phase.
- No schema-v5 changes.
