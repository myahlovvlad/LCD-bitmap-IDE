# LCD-bitmap IDE Operation Manual

Version: 0.1.0

## 1. Purpose

LCD-bitmap IDE is an LCD screen and state-machine editor for monochrome instrument displays. It is intended for creating, editing, validating and exporting screen layouts for firmware integration.

The preserved prototype `LCD-редактор и bitmap_12-05-2026.html` remains in the repository as the baseline reference. The product implementation is the Vite + React + Electron application in `src/`.

> **In-app manual.** The application ships a built-in, trilingual operation manual
> (English, Russian, Simplified Chinese) opened from the **Manual** button. It is
> the primary task-oriented guide: typical jobs are documented as
> *Task → Principle & roadmap → Step-by-step*, with schematic diagrams, tables
> and keyboard-shortcut references. Its source is
> [`src/renderer/config/operationManual.ts`](../src/renderer/config/operationManual.ts).
> This file is the developer-facing companion reference.

The dialog includes full-text search, progress-tracked learning cases and a guided tour that highlights the real controls. Standalone HTML/PDF editions for all three languages are generated with:

```bash
npm run docs:manual
```

## 2. Starting The Application

Development web UI:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Electron development UI:

```bash
npm run electron:dev
```

Do not open the root `index.html` directly with `file://`. It is a Vite entrypoint and requires the dev server.

## 3. Workspace Overview

- Common project header: open, save, export, undo/redo, documentation, version
  history and language.
- Four isolated workspaces: FSM logic, LCD bitmap design, physical control-panel
  design and read-only runtime preview.
- Preview executes button-bound FSM events through the standalone runtime engine
  and records transitions, backend requests and errors in the runtime log.
- Collapsible Control panel: local snapshots, project metrics and custom display width/height.
- Panel row: show or hide Screens, State list, FSM canvas and LCD editor.
- Resizable workspace: drag vertical separators to set custom panel widths; the widths are restored locally.
- FSM canvas: state tiles can always be dragged. Their relative positions are stored in the project and picked up by autosave.
- Auto arrange: rebuilds a compact FSM layout without disabling subsequent manual positioning.

## 4. Editing LCD Screens

Select a state from the left panel. Its 128x64 LCD screen appears in the editor.

Available object tools:

- Select: select and move existing objects.
- Text: add localized text objects.
- Line: draw monochrome lines.
- Rect: draw outlines or filled rectangles.
- Special: add LCD UI controls.
- Glyph: click a text glyph to edit its bitmap.

Drag an empty region with Select active to marquee-select multiple objects.

## 5. Special Elements

Special elements are real canvas objects and are included in autosave, JSON projects, C export and binary export.

Available special elements:

- Checkbox: checked/unchecked square.
- Radio: checked/unchecked circular selector.
- Progress bar: value-driven horizontal bar.
- Battery: value-driven battery indicator.
- Signal bars: value-driven reception indicator.
- Scrollbar: value-driven horizontal or vertical scrollbar.

Select a special element to edit:

- Type
- X/Y position
- Width/height
- Checked state
- Value percentage

## 6. Fonts And Glyphs

The project includes bundled font variants and supports loading additional fonts:

- BDF files
- Simple app-specific `.fnt` files

The font loader can merge imported glyphs into an existing variant or replace the selected variant. Use the Glyph tool to edit individual glyph pixels.

## 7. Project Persistence

Autosave is stored in browser `localStorage` as a versioned project snapshot.

Manual project files are JSON snapshots containing:

- Project metadata
- FSM states and transitions
- Canvas objects for all screens
- Font glyph data and metadata
- Saved measurements

Use Save Project and Open Project for explicit file-based persistence.

## 8. Export And Import

Each LCD screen is exported as 1024 bytes:

- 128x64 pixels
- 1 bit per pixel
- Vertical pages
- LSB at top

Supported exports:

- Selected screen as C header
- Selected screen as `.bin`
- All screens as C header with lookup table
- All screens as concatenated `.bin`

Supported import:

- C headers containing `static const uint8_t name[1024] = { ... }`

Imported C arrays are added as bitmap layers on the selected screen.

## 9. Firmware Integration

The generated C arrays are intended for display drivers that accept page-packed monochrome frame buffers. Confirm that the target firmware uses the same byte order before flashing.

If the target display uses a different resolution, page order, bit order or color depth, add a device profile before using production exports.

## 10. Verification

Before release or firmware handoff, run:

```bash
npm run check
npm run check:full
npm run build
```

`npm run check` covers TypeScript, coverage, renderer/importer verification, production build and browser E2E. `npm run check:full` additionally covers the development server, Electron, performance budgets and trilingual manual generation.

## 11. Known Limitations

- The current built-in display profile is 128x64, 1bpp.
- Windows installers (`npm run dist:win`) and the Linux `tar.gz` build on any host; the Linux **AppImage** requires a Linux host or the `release.yml` CI runner.
- macOS distributables should be built on a native macOS runner.
- Code signing is not configured yet.

## 12. 2026-06-16 Update

- FSM transitions can be drawn from all four sides of a state node. The selected source/target handles are saved with the transition.
- Self-loop feedback transitions are rendered as explicit side loops.
- Transition mechanisms include event, panel button, timer and fact/condition.
- Bitmap-glyph editing uses a wider modal suitable for 128x64 imported images.
- In-app PDF export uses a generated manual HTML document in Electron instead of printing the current screen.

## 13. Changelog

- 2026-06-16: updated FSM routing, bitmap-glyph editing and manual export behavior.

## 14. API And MCP Automation

When the Electron desktop app is running, it exposes local automation surfaces for agents and scripts:

- REST API: `http://127.0.0.1:8766`
- MCP endpoint: `http://127.0.0.1:8767/mcp`

Both interfaces operate on the project that is currently open in the UI. Keep the desktop window open while an agent is working, read the current state before changing it, and validate after each batch of edits.

Recommended routes:

- Claude Code, Codex and OpenCode: use an MCP HTTP connector when the client supports it; otherwise call the REST API from the agent shell.
- LM Studio and Ollama agents: use a local tool-calling wrapper that sends JSON requests to the REST API.
- Shell scripts and CI smoke checks: use REST endpoints for health, project metadata, screen export and runtime events.

Typical agent workflow:

1. Start the desktop app with `npm run electron:dev` or launch the packaged app.
2. Open a project or the bundled demo project.
3. Check `GET http://127.0.0.1:8766/api/health`.
4. Read `/api/workspaces/capabilities` and `/api/project` before changing anything.
5. Apply small changes through REST or MCP.
6. Call `/api/validate` and inspect the UI.

Connector setup examples, curl recipes and agent prompts are maintained in `docs/API_MCP_CONNECTORS.md`.
