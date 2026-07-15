# Application Command Model

Phase 1B.1 introduces `src/application` as the renderer-independent application
API for project mutations. It is intentionally narrower than the full store.

## Session

Commands run against:

```ts
interface ProjectSession {
  project: LcdBitmapProject;
  revision: number;
}
```

`revision` is in-memory session state. It is not stored in schema-v5 project
files.

## Command Envelope

Every command carries:

- `commandId`
- `projectId`
- `expectedRevision`
- optional `actor`, `reason` and `timestamp`

The bus rejects project or revision mismatches before mutation.

## Phase 1B.1 Commands

| Type | Payload |
| --- | --- |
| `project.updateMetadata` | partial `name` / `version` |
| `fsm.state.add` | none |
| `fsm.state.update` | `stateId`, partial state updates |
| `fsm.state.delete` | `stateId` |
| `fsm.transition.add` | `from`, `to`, optional `eventId`, optional handles |
| `fsm.transition.update` | `transitionId`, partial transition updates |
| `fsm.transition.delete` | `transitionId` |
| `screen.create` | optional `name` |
| `screen.rename` | `screenId`, `name` |
| `screen.delete` | `screenId` |

## Results

The command bus returns one of:

- `applied`: new session, revision incremented
- `dry-run`: original session plus candidate session
- `noop`: original session, no semantic changes
- `rejected`: original session plus diagnostics

Applied and dry-run results include `SemanticChange[]`, with entity type,
entity id, path and before/after data where useful.

## Validation Gate

The bus rebuilds derived `bindings` and validates the candidate before commit.
New validation errors reject the mutation. Existing unrelated validation errors
do not automatically block a command that does not introduce new errors.

## ChangeSet

`executeProjectChangeSet` applies a list of commands to a candidate and commits
or rejects the whole batch atomically. A ChangeSet increments the session
revision once, even when it contains multiple commands.

## Renderer Adapter

`projectStore.ts` adapts the Phase 1B.1 vertical slice to the command bus and
keeps existing UI selection and undo snapshot behavior. Operations outside this
slice remain legacy store mutations until Phase 1B.2.
