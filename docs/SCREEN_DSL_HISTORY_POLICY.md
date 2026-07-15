# Screen DSL History Policy

## One Apply = one history entry

`finalizeMutation` (in `src/application/commandBus.ts`) calls
`createHistoryEntry` and `appendHistoryEntry` exactly once per invocation.
`applyScreenDslPreview` calls `finalizeMutation` at most once per Apply call,
after all pre-commit checks pass.

A failed Apply never reaches `finalizeMutation`, so no history entry is created.

## Immer patches

`finalizeMutation` uses `produceWithPatches` to produce forward and inverse
Immer patches. The patches cover the entire ChangeSet — all screens, objects,
and embedded resources — in a single history entry.

## Undo/Redo behavior

One Undo restores the project to the state immediately before the Apply, removing
all created/modified screens and their objects. One Redo reapplies the same
committed object IDs.

Undo does not re-validate the DSL source text. It restores the project state via
the inverse Immer patch.

## History entry content

History entries created by Screen DSL Apply carry the same metadata as other
command-bus entries: actor ID, timestamp, command name (`screen.dsl.apply` for
create/clone; individual screen and canvas commands for update mode).
