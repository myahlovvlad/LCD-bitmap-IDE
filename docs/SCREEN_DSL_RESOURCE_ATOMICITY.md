# Screen DSL Resource Atomicity

## Resource model

`LcdBitmapProject` has no separate resource registry. Resources (bitmap bytes,
glyph overrides, font references) are embedded directly in canvas objects on
their parent screen. There is no top-level resource table that can be partially
committed.

## Atomicity guarantee

Because each canvas object is part of a screen, and each screen import is a
single `screen.dsl.apply` command inside one `ProjectChangeSet`, resources are
automatically atomic with their parent screen. Either the entire screen (plus
all embedded resources) commits, or nothing commits.

## Resource conflict detection

Conflicts are detected at preview stage, not apply stage. If the source DSL
references a resource ID that already exists in the project under a different
definition, `createScreenDslPreview` adds a `SCREEN_DSL_RESOURCE_ID_CONFLICT`
diagnostic and sets `applyAllowed: false`. Apply is blocked before reaching
`finalizeMutation`.

## No partial resource apply

There is no code path where resources are committed without their parent screen,
or vice versa. `buildScreenDslApplyOperations` produces operations at screen
granularity. `executeChangeSetWithHooks` processes all commands atomically.
