# Screen DSL Application Integration Audit

Date: 2026-06-25

Branch: `refactor/screen-dsl-application-integration`

## Scope

Phase 4B.1/4B.2 connects the completed Screen DSL core to the application
workflow without changing schema-v5, bitmap packing, code generation, or the DSL
grammar. The current application slice supports Preview/Apply for update,
create and clone modes.

## Existing Contracts

- Read-only screen export exists in `src/application/screenInterchangeFacade.ts`.
- Project mutation flows through `ProjectCommand` and `ProjectChangeSet`.
- `executeProjectChangeSet()` applies multiple commands against a workspace and
  finalizes once, producing one revision and one history entry.
- `dryRun: true` returns a candidate session without mutating the caller.
- Undo/Redo uses recorded Immer patches from history entries.
- Renderer store wraps commands, but application facades can use command/session
  contracts without React, Zustand, Electron or DOM.

## Operation Matrix

| Operation | Existing command | Missing command | Atomic behavior | Risk |
| --- | --- | --- | --- | --- |
| Create empty screen | `screen.create` | none for generic create | ChangeSet | Existing command generates IDs from name. |
| Create from full DSL screen | `screen.dsl.apply` | none for screen aggregate import | ChangeSet | Preserves exact IDs after collision checks. |
| Rename screen | `screen.rename` | none | ChangeSet | Safe for update mode. |
| Resize screen | `screen.resize` | none | ChangeSet | Safe for explicit dimensions. |
| Replace target object list | `canvas.objects.update` | none | ChangeSet | Good first mapping for update mode. |
| Add object | `canvas.object.add` | none | ChangeSet | Useful for refined diffs. |
| Update object | `canvas.object.update` | none | ChangeSet | Typed object update exists. |
| Delete objects | `canvas.objects.delete` | none | ChangeSet | Explicit deletes possible. |
| Reorder objects | `canvas.objects.update` | dedicated reorder | ChangeSet | Full object-list replacement preserves order. |
| Import font/glyph resources | `font.glyphs.import`, `font.glyph.update` | exact global resource apply | ChangeSet | Create/clone blocks conflicting same-ID resources and reuses identical content. |
| Bitmap resources | `screen.dsl.apply` via object reconstruction | none for screen-local bitmap objects | ChangeSet | Bitmap bytes are embedded back into bitmap objects on reconstruction. |

## Required Answers

1. Can one screen be created with one command?

   Yes. Generic generated screens still use `screen.create`. Exact Screen DSL
   create/clone uses `screen.dsl.apply`, which reconstructs screens from the
   Screen Interchange package and preserves the IDs prepared by Preview.

2. Can a screen be updated without replacing the whole project?

   Yes. `screen.rename`, `screen.resize` and `canvas.objects.update` update one
   screen path through command mutations.

3. Can objects be added, deleted and reordered?

   Yes. `canvas.object.add`, `canvas.object.update`,
   `canvas.objects.delete` and `canvas.objects.update` cover object changes.
   Reorder is best represented as a full ordered object-list update today.

4. Can resources be created atomically with screens?

   Partially. Bitmap resource payloads are reconstructed into bitmap objects.
   Same-ID resources are reused only when their canonical content is identical.
   Different same-ID resources block Apply. There is still no generic global
   Screen Interchange resource command for future shared resource stores.

5. How are stable entity IDs generated?

   Existing command context uses deterministic slug + suffix against records.
   Screen DSL Preview computes proposed IDs without mutating the session. Clone
   Apply consumes a candidate package already rewritten with that preview plan.

6. Can Preview reserve IDs without mutation?

   It can plan IDs deterministically. It must not reserve them in
   `ProjectSession`; staleness checks must reject the plan if project revision
   or screen fingerprint changes.

7. How does Command Bus roll back multi-command changes?

   `executeProjectChangeSet()` accumulates mutations on a local workspace and
   calls `finalizeMutation()` once. If envelope validation or final candidate
   validation rejects the change, the original session is returned.

8. Can import be one history entry?

   Yes. A `ProjectChangeSet` is finalized as one `changeset` history entry.

9. Is there a pure rasterizer for candidate model?

   Yes. `src/renderer/utils/render.ts` is currently pure enough for tests but
   lives under `renderer`. Application layer must not import it. A later slice
   should move or wrap raster preview in a protected non-renderer module.

10. Can Electron file workflow reuse current IPC patterns?

   Yes. Current `main.ts`/`preload.cts` expose narrow IPC methods for clipboard
   and PDF export. Screen DSL file import/export should add similarly narrow
   methods with extension and payload limits, and renderer must not import `fs`.

11. Which stash files are usable?

   None. `stash@{0}` contains only `.vscode/settings.json` editor settings.

## Architecture Risks

- Exact create/clone mode cannot rely on current `screen.createFromTemplate`
  because it rewrites IDs. `screen.dsl.apply` is the application-level import
  command for screen aggregate creation.
- Application raster preview needs a protected pure raster module or a careful
  split from renderer utilities.
- Resource collision policy must block before Apply; silent overwrite would be
  unsafe.
- Stale Preview checks must include revision, source fingerprint, import mode
  and base screen fingerprint.
- UI must call application facade; parser/UI must not mutate Zustand directly.

## Initial Implementation Direction

Application facade status:

- update mode maps to `screen.rename`, `screen.resize` and
  `canvas.objects.update`;
- create mode maps to `screen.dsl.apply` and preserves exact incoming IDs;
- clone mode rewrites IDs through the deterministic preview identity plan and
  maps to `screen.dsl.apply`;
- same-ID screen collisions and same-ID resource conflicts block Apply;
- all modes use `ProjectChangeSet`, one revision increment and one history
  entry.

Remaining integration work is outside this slice: transient document session,
Screen Schema Studio UI, Electron file IPC, browser E2E and targeted Electron
workflow.
