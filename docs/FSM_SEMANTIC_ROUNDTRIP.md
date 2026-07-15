# FSM Semantic Round-Trip

Phase 3A implements an explicit, deterministic FSM script cycle:

```text
Domain FSM
-> FsmInterchangeModelV1
-> Mermaid or Python-like DSL
-> safe parser
-> candidate FsmInterchangeModelV1
-> semantic diff
-> typed ProjectChangeSet
-> dry-run preview
-> explicit Apply
-> Command Bus history
```

Preview does not mutate the project, increment revision or create history.
Apply rejects stale previews when the session revision or FSM fingerprint has
changed. A successful import is applied as one ChangeSet and produces one undo
entry. A no-op import creates no history entry.

Phase 3A.1 hardens the integration and UX acceptance layer:

- Apply is disabled until an explicit valid Preview exists.
- Editing, importing or regenerating script text clears the current preview.
- Apply never performs an implicit Preview.
- The UI renders diagnostic and semantic diff lists with stable selectors.
- Stale previews show a banner and cannot be applied.
- Targeted Playwright journeys cover Mermaid, Python-like DSL, parser errors,
  stale previews and destructive changes.

Phase 3C adds controlled synchronization:

- Script documents are transient sessions keyed by project ID and format.
- Clean documents refresh from graph changes automatically.
- Dirty documents are preserved and marked stale instead of overwritten.
- Auto-preview is debounced and sequence-bound.
- Apply remains explicit and still uses the existing ChangeSet.
- Mermaid and Python-like DSL drafts are independent.

Deferred:

- automatic background apply
- executable Python
- MCP, REST and plugin adapters
- schema-v6
- generated C/binary changes
