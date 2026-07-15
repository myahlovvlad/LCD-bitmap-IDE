# FSM Backend Process Collision Policy

`backendProcessId` is not a free behavior container. It keeps its historical entity-reference meaning unless a value uses the reserved typed effect prefix.

## Rules

- No value means no backend behavior.
- `@lcdide.effects/v1 ...` means typed effects.
- `@lcdide.effects/<other-version> ...` is invalid unsupported typed storage.
- Safe non-reserved values are legacy backend process references.
- Non-reserved unsafe values are opaque and preserved.
- Typed effect envelopes are not looked up in `project.backendProcesses`.
- Legacy backend process IDs are not parsed as typed effects.

## Combined Storage

Schema-v5 cannot losslessly store both:

- a legacy backend process reference, and
- a typed effect list.

Structured editing must treat that combination as blocked until a future behavior persistence migration introduces a structured field.

## Operation Registry Path

Future Operation Registry integration should consume typed effect contract IDs from the effect envelope. It must not reinterpret legacy backend process IDs as operation IDs.
