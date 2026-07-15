# Screen Schema Studio UI Audit

Date: 2026-06-25
Phase: 4B.4 pre-implementation

## 1. Entry point decision

**Chosen:** Toolbar tab inside `LcdWorkspace.tsx` — add `'screen-dsl'` to the
`LcdToolPanel` union and a "Schema" button next to "Canvas", "Import image",
"C glyphs", "Templates". When selected, `ScreenDslStudio` renders in the
`workspace-canvas-column` main area, replacing the canvas editor.

This mirrors the pattern already used by PixelImporter, GlyphCGenerator, and
the templates panel. No new workspace mode is needed. No new workspace tab in
the top navigation bar is added.

## 2. Studio shape

Panel inside the canvas column. No modal, no drawer, no separate workspace tab.
Toggled by a toolbar button. Studio persists across canvas-column panel switches
(draft is in memory). Closing Studio = switching back to "Canvas" panel.

## 3. FSM Script Studio reuse

Pattern reused fully:
- `session: ProjectSession` prop passed from LcdWorkspace via the store
- `onApplyPreview` callback prop; store adapter calls `applyScreenDslPreview`
  from the application layer and updates Zustand state
- Controlled `<textarea>` for source text (no Monaco/CodeMirror)
- `DocumentStateBadge`-equivalent component
- Module-level coordinator cache (mirrors `draftCache` in FsmScriptStudio)

Key difference: `ScreenDslSessionCoordinator` (from `src/application/screenDslSession/`)
manages multi-format + multi-mode sessions with request-sequence protection.
The FSM Script Studio manages sessions inline; this Studio delegates to the
coordinator.

## 4. Project ID and selected screen IDs

- `projectId`: `useProjectStore((state) => state.project?.meta.id)` via prop
- `selectedScreenId`: `useProjectStore((state) => state.selectedScreenId)` via prop
- `selectedScreenId` is passed as `targetScreenIds: [selectedScreenId]` for
  `update` and `clone` modes; empty for `create` mode

No direct Zustand mutation from the Studio component.

## 5. External project change subscription

`LcdWorkspace` already re-renders when `session` changes (Zustand). The Studio
component receives `session` as a prop. A `useEffect` on `[session.project.meta.id,
session.revision]` calls `coordinator.notifyProjectChanged(key, revision, ...)`.

## 6. Session key changes

Session key changes when:
- `activeFormat` state changes → different session key
- `activeImportMode` state changes → different session key
- `targetScreenIds` changes (derived from `selectedScreenId` prop) → different key

Old session remains in coordinator cache under old key. Draft is not lost.

## 7. Source editor

`<textarea>` — controlled, `spellCheck={false}`, monospace. No CodeMirror.
Line/column computed as pure utility from cursor offset. Source selection not
programmatic in v1 (diagnostic navigation scrolls to line via `scrollIntoView`
with line-numbered ref or does line-offset calculation).

## 8. Confirmation dialog

Current codebase pattern: `globalThis.confirm()` for dirty-draft protection.
For destructive Apply confirmation: a purpose-built `<dialog>` HTML element
with focus trap (per spec requirement). New `ScreenDslApplyDialog.tsx` in
`src/features/screen-dsl-studio/`.

## 9. Raster preview component

`src/renderer/components/LCDCanvas.tsx` renders a bitmap canvas, accepts
`{ canvasData, language, scale, fontRenderer }`. The `ScreenDslPreviewResult`
contains `rasterPreview: { beforeByteLength, afterByteLength, changedScreens }`.
The raster UI shows byte summary and changed-screen list; full pixel-level
before/after display is a textual summary in v1 (no per-pixel bitmap diff
rendering requires canvas access, deferred).

## 10. Undo/Redo

`useProjectStore().undo()` / `redo()` — called from existing `App.tsx` buttons.
Studio detects external project changes via `session.revision` in the useEffect.
No separate Studio Undo stack. Studio "Undo/Redo" buttons, if added, call the
same store methods.

## 11. Business logic in UI components

Components that must NOT be copied into Studio:
- `executeProjectChangeSet` / `finalizeMutation` — command-bus internals
- `createScreenDslPreview` / `applyScreenDslPreview` — called via coordinator
  or prop adapter only
- `diffScreenInterchange` / `buildScreenDslApplyOperations` — application layer
- Zustand `set()` with raw project mutations

## 12. Stable test locators

Existing:
- `data-testid="workspace-lcd"`, `data-testid="workspace-fsm"`
- `data-testid="app-undo"`, `data-testid="app-redo"`
- `data-testid="fsm-script-studio"`

New Screen DSL Studio:
- `data-testid="screen-dsl-studio"`
- `data-testid="screen-dsl-source-json"`
- `data-testid="screen-dsl-source-yaml"`
- `data-testid="screen-dsl-preview-btn"`
- `data-testid="screen-dsl-apply-btn"`
- `data-testid="screen-dsl-generate-btn"`
- `data-testid="screen-dsl-status"`
- `data-testid="screen-dsl-diagnostics"`
- `data-testid="screen-dsl-semantic-diff"`
- `data-testid="screen-dsl-apply-dialog"`

## Architecture decisions

See `docs/adr/ADR-050-screen-schema-studio-ui.md`.

Layer boundaries confirmed:
- No parser import in `src/features/screen-dsl-studio/`
- No ChangeSet construction in renderer
- No direct Zustand project mutation
- No Electron/filesystem access
- `src/application/screenDslSession/` remains React-independent
