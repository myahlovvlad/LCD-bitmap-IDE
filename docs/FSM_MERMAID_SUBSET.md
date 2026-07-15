# FSM Mermaid Subset

Phase 3A writes Mermaid `stateDiagram-v2` plus `lcdide:` comments. Standard
Mermaid lines remain readable, but lossless round-trip relies on the comments.

Supported directives:

- `%% lcdide:machine ...`
- `%% lcdide:state ...`
- `%% lcdide:event ...`
- `%% lcdide:layout ...`
- `%% lcdide:transition ...`

Rendered state and transition lines are included for human review. During parse,
the directive is authoritative and the following rendered transition line is
ignored to avoid duplicate transitions.

Unsupported Mermaid syntax is diagnosed instead of silently mutating the
project. Hierarchical states, parallel regions and executable actions are not
part of Phase 3A.

Phase 3A.1 E2E coverage verifies that Mermaid edits can rename a state by stable
ID, move explicit layout metadata, add events/transitions, apply atomically,
undo/redo and regenerate canonical text after autosave reload.
