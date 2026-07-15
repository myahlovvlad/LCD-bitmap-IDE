# FSM Script Synchronization Audit

Date: 2026-06-25

Branch: `refactor/controlled-script-synchronization`

Baseline commit: `f33e27f fix(fsm): harden behavior persistence compatibility`

## Scope

This audit captures the Phase 3C starting point before changing Script Studio
state ownership or synchronization architecture. The current implementation is a
strict Preview -> Apply flow with no live graph mutation from text.

## Canonical Source Policy

- `ProjectSession.project.fsm` is the only canonical engineering source of
  truth for FSM states, events, transitions, graph layout and behavior fields.
- Script text is a transient authoring document owned by UI state today.
- Unapplied script text is not project state.
- Script editing does not increment `ProjectSession.revision`.
- Script editing does not create command history.
- `previewFsmScriptImport` parses and dry-runs a ChangeSet, but does not mutate
  project state.
- `applyFsmScriptPreview` is the only Script Studio path that can mutate the FSM,
  and it requires explicit Apply.
- Script drafts are not stored in `.lcdproj` schema-v5.

## Current Ownership

| Workflow | Source file | State owner | Canonical source | Trigger | Side effect | Dirty behavior | Stale behavior | Cancellation behavior | Race risk | User feedback | Existing test | Missing test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Generate Mermaid from graph | `src/features/fsm-script/FsmScriptStudio.tsx`, `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | React local state initialized from `exportFsmScript(session, 'mermaid')` | `ProjectSession.project.fsm` | Component render and `Regenerate` button | Writes textarea state only | `Regenerate` overwrites dirty Mermaid text without confirmation | Existing preview is cleared by `discardPreview`; no document stale state | None | Low for synchronous click; medium for silent overwrite | Status says preview again only when a preview existed | E2E round-trip indirectly | Dirty overwrite protection |
| Generate Python DSL from graph | `src/features/fsm-script/FsmScriptStudio.tsx`, `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | React local state initialized from `exportFsmScript(session, 'python')` | `ProjectSession.project.fsm` | Component render and `Regenerate` button | Writes textarea state only | `Regenerate` overwrites dirty Python text without confirmation | Existing preview is cleared by `discardPreview`; no document stale state | None | Low for synchronous click; medium for silent overwrite | Status says preview again only when a preview existed | E2E round-trip indirectly | Dirty overwrite protection |
| Text editing | `src/features/fsm-script/FsmScriptStudio.tsx` | React local state (`mermaidText`, `pythonText`) | Textarea buffer only until Apply | `onChange` | Updates local state and clears preview | Dirty is implicit; no fingerprint/status | Existing preview is discarded, not marked stale | None | Low | Status only changes if a preview existed | E2E preview/apply flows | Explicit dirty state and no project mutation assertion |
| File import | `src/features/fsm-script/FsmScriptStudio.tsx` | React local state | Imported file text until Apply | Hidden file input | Reads file in renderer and replaces target buffer | Always replaces target buffer; no confirmation | Preview cleared | No async ordering guard after `file.text()` | Medium if multiple imports resolve out of order | Import status with filename and line count | Manual smoke only | Import race and dirty confirmation |
| Manual Preview | `src/features/fsm-script/FsmScriptStudio.tsx`, `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | React local `preview` | `ProjectSession.project.fsm` at preview time | Preview button | Parses, diffs and dry-runs ChangeSet | Does not change source | Preview stores `baseRevision` and `baseFingerprint` | None; synchronous parse/preview result applied immediately | Low today, high after debounce/async | Diagnostics, semantic diff, revision metadata | `tests/utils/fsmSemanticRoundTrip.test.ts`, E2E errors/stale | Request sequence protection |
| Apply | `src/features/fsm-script/FsmScriptStudio.tsx`, `src/renderer/store/projectStore.ts`, `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | Project store/session | `ProjectSession.project.fsm` | Apply button | Executes existing ChangeSet through command history | Does not automatically refresh source buffers | Rejects if revision or FSM fingerprint changed | Not async in current UI | Low | Applied/noop/rejected status | `fsmSemanticRoundTrip`, E2E round-trip/stale | Apply after project switch |
| Graph mutation | `src/renderer/store/projectStore.ts`, `src/features/fsm/FsmWorkspace.tsx` | Project store/session | `ProjectSession.project.fsm` | Graph controls, drag, command actions | Project command increments revision/history | Script buffers are not refreshed unless Regenerate clicked or component remounts | Existing preview panel detects stale by comparing preview revision to current revision | None | Medium: clean script can become obsolete silently | Stale preview banner only when preview exists | E2E stale preview | Clean refresh and dirty stale/conflict state |
| Undo/Redo | `src/renderer/store/projectStore.ts`, `src/application/projectSession.ts` | Project store/session | `ProjectSession.project.fsm` | Undo/Redo action | Applies command history patches and increments revision | Script buffers unchanged | Existing preview becomes stale by revision mismatch | None | Medium: clean buffers do not auto-refresh | Stale preview banner only when preview exists | Round-trip history utils | Script session behavior across undo/redo |
| Workspace switch | `src/renderer/App.tsx`, `src/features/fsm/FsmWorkspace.tsx` | React component tree | `ProjectSession.project.fsm` | Workspace navigation | May unmount/remount Script Studio depending workspace | Draft may be lost if `FsmScriptStudio` unmounts | No stale recalculation after remount beyond initial generation | None | Medium | No draft warning | App workspace E2E | Draft preservation/restoration |
| Format switch | `src/features/fsm-script/FsmScriptStudio.tsx` | Two React local buffers visible side by side | Separate textareas | User edits either panel | No format tab switch currently; both buffers exist simultaneously | Mermaid and Python drafts are independent while component is mounted | One shared preview object can belong to only one format | None | Low while both panels mounted | Apply buttons disabled by preview format | Existing Mermaid/Python E2E | Format-specific stale states |
| Project switch | `src/renderer/App.tsx`, `src/renderer/store/projectStore.ts` | Zustand store plus remounted UI | New `ProjectSession` | Open/demo/new/autosave restore | Replaces current project session | Script draft is lost on remount; no project-keyed draft cache | Old preview goes away with component state | None | Medium | No dirty draft warning | Basic app open tests | Project-keyed draft lifecycle |
| Parser diagnostics | `src/application/fsmRoundTrip/fsmRoundTripFacade.ts`, `src/fsm-interchange/*` | Preview result | Candidate script text | Preview button | Produces diagnostics/source map | Source retained | Invalid preview cannot apply | None | Low today | Diagnostic list | E2E errors, security tests | Auto-preview invalid state |
| Typed behavior and opaque values | `src/fsm-interchange/*`, `src/model/project.ts`, behavior tests | Project model fields | Schema-v5 behavior fields | Preview/Apply conversion | Round-trip diff/changeSet | No UI-specific handling | Current preview/apply guards protect stale project | None | Medium if generator canonicalizes opaque values unexpectedly | Diff diagnostics only | Phase 3B.1 behavior tests | Behavior compatibility inside sync session |

## Required Questions

1. Where is script text stored now?

   In `FsmScriptStudio` React local state: `mermaidText` and `pythonText`.
   Initial values are computed from `exportFsmScript(session, format)`. The text
   is not stored in `ProjectSession`, Zustand, `.lcdproj`, autosave, or command
   history.

2. Does a draft survive workspace switching?

   Not reliably. A draft survives only while `FsmScriptStudio` remains mounted.
   If workspace navigation unmounts the FSM workspace or Script Studio panel,
   the draft is recreated from the current graph and user edits are lost.

3. Does a draft survive Mermaid/Python switching?

   Yes within the current component instance because Mermaid and Python are two
   separate local state values. There is no explicit format session, and there
   is only one shared preview object, so preview/stale status is not independent
   per format.

4. What happens on graph change?

   The project session revision increments through the command bus. Existing
   script text remains unchanged. Clean generated text does not refresh
   automatically. If a preview exists, the UI shows it as stale by comparing
   `preview.baseRevision` with `session.revision`; if no preview exists, the
   user gets no stale/dirty signal.

5. What happens on Undo/Redo?

   Undo/Redo applies command history patches, creates a new session revision,
   and updates the canonical project. Script buffers remain unchanged. Existing
   previews become stale through revision mismatch; absent previews get no
   document status update.

6. Can an old Preview be applied after graph change?

   No. The UI disables Apply when `preview.baseRevision !== session.revision`.
   The application facade also rejects Apply if either revision or FSM
   fingerprint differs from the preview baseline.

7. Can a slow parse result replace a newer one?

   Today preview is synchronous, so there is no async race in normal Preview.
   File import uses async `file.text()` without request sequence protection.
   Phase 3C auto-preview will need explicit sequence-bound result acceptance.

8. Can Generate from Graph destroy a dirty script?

   Yes. The `Regenerate` buttons assign the canonical generated script directly
   to the relevant text buffer. There is no dirty fingerprint, confirmation, or
   discard/refresh distinction.

9. What happens on project switch?

   `loadProjectSnapshot` replaces the project session and resets store-level
   selection/history. Script Studio local state is recreated from the new graph
   when mounted. Dirty drafts from the previous project are not preserved or
   warned about.

10. Is the script draft part of project engineering state?

    No. The draft is transient UI authoring state and is not persisted in
    schema-v5, command history, compiler input, codegen, or binary output.

## Characterization Gaps

- Clean generated script should refresh safely after graph changes.
- Dirty script must not be overwritten by graph refresh.
- Dirty script should become stale/conflicted after graph changes.
- Auto-preview must never apply a ChangeSet.
- Auto-preview result acceptance must validate project ID, revision, FSM
  fingerprint, source fingerprint and request sequence.
- Mermaid and Python drafts need independent document sessions and statuses.
- Project/workspace switches need an explicit in-memory draft policy.
- Typed guards, ordered typed effects, legacy backend process references,
  malformed canonical values and opaque behavior must remain lossless through
  preview/apply and refresh lifecycle.

## Stop Condition Review

No stop condition is present at audit time:

- `f33e27f` is in history and is the Phase 3C base.
- Working tree was clean before this audit document.
- Script Studio state ownership is identifiable.
- Preview and Apply are already separate.
- Stale Apply is guarded by revision and fingerprint.
- Schema-v5, generated C and binary output are untouched.
