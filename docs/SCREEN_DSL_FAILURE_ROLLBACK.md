# Screen DSL Failure and Rollback

## Implicit rollback

`applyScreenDslPreview` uses the functional / immutable `ProjectSession` model.
The input session is never mutated. If any pre-commit check fails, the function
returns `applied: false` and the caller's session reference is unchanged.
No explicit rollback step is required.

## Failure points and error codes

| Stage | Diagnostic code | Session mutated? |
|---|---|---|
| Preview lifecycle consumed | `SCREEN_DSL_APPLY_PREVIEW_CONSUMED` | no |
| Preview lifecycle failed | `SCREEN_DSL_APPLY_PREVIEW_FAILED` | no |
| Project mismatch | `SCREEN_DSL_APPLY_PROJECT_MISMATCH` | no |
| Source drift | `SCREEN_DSL_APPLY_STALE_SOURCE` | no |
| Revision drift | `SCREEN_DSL_APPLY_STALE_REVISION` | no |
| Too many operations | `SCREEN_DSL_APPLY_TOO_MANY_OPERATIONS` | no |
| Too many affected screens | `SCREEN_DSL_APPLY_TOO_MANY_SCREENS` | no |
| Too many affected objects | `SCREEN_DSL_APPLY_TOO_MANY_OBJECTS` | no |
| Hook throw (test-only) | (hook-supplied error) | no |

## Failure-injection hooks

`ScreenDslApplyTestHooks` provides three injection points:

- `beforeOperation(op, index)` — called before each command in the ChangeSet;
- `afterOperation(op, index)` — called after each command;
- `beforeCommit()` — called before `finalizeMutation`.

Hooks throw to abort. Because the session is immutable, the abort leaves the
caller session unchanged. There is no cleanup needed.

Hooks are DI only — passed as an optional second argument to
`applyScreenDslPreview`. No global state, no `process.env` switch.

## History and revision on failure

`finalizeMutation` is never called on failure. Consequently:

- `session.revision` is unchanged.
- No history entry is created.
- Undo/Redo state is unchanged.
