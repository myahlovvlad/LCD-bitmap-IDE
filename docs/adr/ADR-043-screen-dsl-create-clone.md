# ADR-043: Screen DSL Create And Clone Apply

Status: accepted

Screen DSL create and clone Apply must not use `screen.createFromTemplate`
because that command intentionally derives new IDs from the template. Screen DSL
needs exact create semantics for create mode and preview-planned IDs for clone
mode.

Decision:

- add `screen.dsl.apply` as an application command;
- map create and clone previews to one `ProjectChangeSet`;
- reconstruct `LcdScreen` aggregates from Screen Interchange;
- reject same-ID screen collisions before mapping;
- reject same-ID resource conflicts before mapping;
- rewrite clone packages before semantic diff and ChangeSet mapping.

Consequences:

- one import remains one history entry;
- Undo/Redo uses existing session history patches;
- create mode preserves source IDs;
- clone mode applies the deterministic preview identity plan;
- FSM links are not copied or created implicitly.
