# ADR-040: Screen DSL Atomic Import

Status: accepted

Screen DSL Apply must use typed commands and `ProjectChangeSet`, not project
snapshot replacement. One import must become one history entry so Undo/Redo can
restore the complete import.

Update mode maps to existing screen and canvas commands. Create and clone modes
map to a dedicated `screen.dsl.apply` command that reconstructs Screen
Interchange screens and commits them through the same `ProjectChangeSet`
history path.

The command is intentionally scoped to screen import. It does not create FSM
states from `linkedStateIds` and does not silently overwrite resource conflicts.
