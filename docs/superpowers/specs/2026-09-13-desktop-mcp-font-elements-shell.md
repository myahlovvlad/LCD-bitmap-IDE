# Desktop MCP, custom fonts, element export and compact shell

## Goal

Complete the `0.1.18` desktop delivery so Electron and Tauri expose the same
authoring model, imported bitmap fonts render identically throughout the IDE,
individual LCD elements can be handed off as resources, and the active
workspace receives the maximum practical area.

## Tauri MCP contract

- Bind only to `127.0.0.1:8767` and expose the Streamable HTTP endpoint at
  `/mcp`.
- Keep the existing renderer command dispatcher as the single source of truth;
  Tauri must not implement a second project mutation model.
- Support `initialize`, `notifications/initialized`, `ping`, `tools/list` and
  `tools/call` with JSON-RPC 2.0 response semantics.
- Expose a read-only Tauri command returning running state, endpoint, protocol
  version and whether token authentication is enabled. The Settings workspace
  displays this information and a copyable connection snippet.
- A GET health probe on the MCP port reports readiness without granting project
  access. Tool calls retain loopback host/origin validation, optional bearer
  token validation, permission scopes, revision checks and idempotency.
- Server shutdown must be deterministic when the application exits.

## Custom font contract

- Accept BDF and the application `.fnt` text format, reject empty/malformed
  sources, and normalize every glyph to rectangular rows.
- Parse BDF bitmap rows without JavaScript number precision loss, including
  glyphs wider than 53 bits.
- Imported glyphs and metadata are persisted in `.lcdproj` and restored on
  reopen. The active `FontRenderer` instance is used by LCD editing, Runtime,
  layout analysis, PNG/C/binary export and HMI handoff.
- After import the UI shows font name, target variant, glyph count, height
  range, replacement/merge mode and a small pixel preview. Unsupported text
  characters remain explicit diagnostics rather than silently changing font.

## Individual LCD element export

- Export each selected canvas object independently.
- The portable `.lcd-element.json` retains schema id, source screen, source
  object, pixel bounds, display profile and language.
- Firmware forms (`.h` and `.bin`) contain a cropped origin-normalized bitmap,
  while `.png` is a pixel-perfect preview of the same crop.
- Empty visual objects are blocked with a clear diagnostic. Multiple selection
  produces one file per object with deterministic collision-safe names.
- Full-screen export remains unchanged.

## Shared desktop icon

- One vector master represents an LCD pixel grid plus a connected FSM node.
- Tauri PNG/ICO/ICNS assets and Electron Windows/macOS/Linux package icons are
  generated from that master. Package configuration points to those assets so
  no default Electron icon remains.

## Compact workspace shell

- The workspace navigator has expanded and compact states; compact state keeps
  recognizable icons, tooltips and the active-workspace indication.
- The preference is local UI state, persists across reloads, and never changes
  the project revision or saved project contents.
- `Ctrl+B` toggles the navigator. The toggle is keyboard accessible and exposes
  `aria-expanded`.
- Existing per-workspace sidebars remain independently collapsible. The main
  workspace uses `minmax(0, 1fr)` and immediately consumes released width.
- Theme tokens apply to both expanded and compact states; the 128×64 LCD device
  palette remains theme-independent.

## Acceptance

- Unit tests cover MCP protocol/status, wide BDF glyph parsing and rendering,
  font snapshot round-trip, deterministic element export, and shell preference.
- Playwright covers navigation collapse/persistence, active workspace growth,
  theme switching in both states, font import preview, and selected-element
  export controls.
- `npm test`, the application E2E suite, Electron packaged smoke test,
  `npm run build`, `npm run tauri:check`, and the GitHub release workflow pass.

