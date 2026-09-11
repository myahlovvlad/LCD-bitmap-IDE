# IDE Shell Redesign — design

## Purpose

Replace the crowded two-row workspace navigation with a stable engineering workbench for ECROS-5400UV. The shell must make the project identity, software version, validation state and active working area obvious without changing the `.lcdproj` model or MCP command contracts.

## Scope of the first delivery

This delivery changes the common application frame and the 2D FSM canvas interaction state. It deliberately does not rewrite the LCD editor, HMI Designer, HMI handoff or alarm workflow internals; those remain separately routable and receive the new shell around them.

## Visual and information architecture

### Top bar

One compact horizontal bar contains:

- product name;
- editable project name and project format version;
- a read-only **software version** (`v0.1.18` in the current build), derived from a single build-time application-version source;
- Open, Save and Export actions;
- Undo/Redo in an overflow menu or compact icon group;
- language selector and Settings.

The software version and project version are separate facts: the former identifies the IDE build; the latter identifies the user project. They must never be rendered as one ambiguous value.

### Activity bar and navigator

The broad tab strip becomes a left activity bar. Selecting a group opens a labelled navigator next to it; both remain visible on desktop and can be collapsed. Routes and deep links remain unchanged.

| Group | Navigator entries |
| --- | --- |
| Interface | LCD editor, Instrument panel, Texts and localization, Screen DSL |
| Logic | FSM editor, Alarms |
| Hardware | Tags, Procedures |
| Verify and deliver | HMI model, Runtime simulator, HMI handoff |

The selected entry keeps the existing router mode (`fsm`, `lcd`, `hmi`, etc.). No project data migrates and no MCP tool name changes.

### Work area

The shell provides a clear header, activity bar, navigator, workspace host and persistent status bar. Each existing workspace remains responsible for its own navigator/canvas/inspector composition. New CSS uses tonal surface separation and one-pixel dividers rather than nested cards and multiple borders.

Primary blue is reserved for the one main action exposed by a workspace. Neutral controls are quiet; destructive actions retain a distinct danger tone. Typography favors human titles over technical IDs, while IDs remain accessible as muted metadata.

### Status bar

The bottom status bar presents, in order: current display profile, FSM state/transition totals, screen and physical-control totals, blocking validation count, save status, and firmware/project model identifier. It remains non-interactive apart from links to the relevant validation view where those links already exist.

## Version source

Add one `APP_SOFTWARE_VERSION` export in renderer configuration. Vite/Electron/Tauri builds inject it from `package.json` during build; local development has an explicit fallback. The header uses only that export. The project metadata `meta.version` continues to be editable in Settings and shown as project version.

## FSM canvas interaction and retained view

The FSM canvas must behave as an editor rather than a disposable preview:

- left-drag on empty canvas makes a selection; middle/right drag (and Space + left-drag where supported) pans; wheel zooms around its cursor;
- click on a state or transition selects it without moving the viewport; context menu remains available by right click;
- node movement remains possible only in Edit mode; canvas navigation must work in both view and edit modes;
- the last 2D viewport `{ x, y, zoom }` is held in memory during tab changes and persisted in local storage by project ID;
- the first opening of a project with no saved viewport fits the represented nodes once; later switches between workspaces, selection changes, node dragging and ordinary rerenders never call `fitView`;
- manual auto-layout is an explicit exception: it updates the node layout and fits once so the result is visible;
- changing the visible subsystem/overview is a new graph representation: restore a saved viewport for that representation when present, otherwise fit once. The full graph, a subsystem and overview do not overwrite one another's viewport;
- malformed/stale cache entries are ignored safely and cause a one-time fit. Stored viewport data is UI-only and never changes the `.lcdproj` revision.

The underlying cause to remove is the current unconditional mount and signature-driven `fitView` calls. Persistence belongs in a small FSM viewport cache module, not in project graph coordinates or router state.

## Accessibility and operational safety

- All activity-bar controls have a text label/accessible name and selected state.
- Keyboard focus moves predictably from activity bar to navigator to work area.
- Status colors are paired with text, not color alone.
- Validation counts remain visible at all times, so a technician cannot mistake a simulator-ready visual state for a valid firmware handoff.
- The compact header must keep Save and Export available at widths from 1024 px upward; smaller widths may collapse secondary actions into a menu but must not hide Save.

## Boundaries and failure handling

- Router modes, store state and existing deep links are preserved.
- A missing/invalid build version renders `dev` rather than throwing or using project metadata.
- The shell adds no side effects to project mutation, simulation or export.
- Existing loaded projects and the September ECROS project display without migration.

## Acceptance checks

1. The header visibly distinguishes `Software v…` from `Project v… / schema 6`.
2. Every existing workspace can be reached from exactly one logical group; direct route navigation still displays it.
3. Switching groups and routes does not mutate the loaded project or its revision.
4. The normal desktop layout has one top bar, one left activity bar, one navigator, one work area and one status bar; it has no duplicate global navigation strip.
5. At 1280×720 the active workspace retains at least 680 px width after both side rails.
6. Renderer typecheck and focused router/UI tests pass; a manual smoke check verifies Open, Save, Export and all workspace routes.
7. In a 2D FSM canvas, pan and zoom survive FSM → LCD → FSM and a full renderer reload for the same project and graph representation.
8. Pressing auto-layout fits the newly arranged graph exactly once; selecting, dragging or returning to the tab does not reset the operator's view.
9. FSM viewport cache data never changes project revision, FSM coordinates or exported `.lcdproj` content.

## Follow-on deliveries

1. HMI model workspace: make FSM state → LCD screen → physical button → tags → procedure/alarm trace explicit.
2. HMI handoff: split into validation, supplier package and device connection steps.
3. Alarm workspace: visualise condition → impact → recovery/acknowledgement trace.
