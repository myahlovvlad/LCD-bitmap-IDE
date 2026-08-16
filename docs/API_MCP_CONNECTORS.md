# API And MCP Connector Guide

This guide describes how to operate LCD-bitmap IDE from local automation tools and AI coding agents while either the Electron or Tauri desktop app is running.

## Runtime Model

The renderer application session is the source of truth. Electron and Tauri are transport adapters; neither owns a second project model.

```text
Desktop UI → AutomationCommandRegistry → application command bus
  ^                                      |
  | AutomationRequest/AutomationOutcome  | revision + undo + audit
Electron or Tauri transport adapter ------
  |-- REST API  http://127.0.0.1:8766
  |-- MCP HTTP  http://127.0.0.1:8767/mcp
```

Keep the desktop window open. Open a project or the bundled demo before calling mutation endpoints.

## REST API

Base URL:

```text
http://127.0.0.1:8766
```

Versioned discovery endpoints:

```bash
curl http://127.0.0.1:8766/api/v1/capabilities
curl http://127.0.0.1:8766/api/v1/revision
```

All operations use `POST /api/v1/commands/{command}`. Read `get_project_revision`, then supply that revision for writes:

```bash
curl -X POST http://127.0.0.1:8766/api/v1/commands/create_fsm_state \
  -H "Content-Type: application/json" \
  -d '{"expectedRevision":0,"idempotencyKey":"create-service-menu","input":{"title":"Service Menu"}}'
```

Dry-run an atomic batch before applying it:

```bash
curl -X POST http://127.0.0.1:8766/api/v1/commands/preview_changes \
  -H "Content-Type: application/json" \
  -d '{"expectedRevision":0,"input":{"operations":[{"command":"set_authoring_language","input":{"language":"ru"}}]}}'
```

Compile without changing the project:

```bash
curl -X POST http://127.0.0.1:8766/api/v1/commands/compile_assets \
  -H "Content-Type: application/json" \
  -d '{"input":{"format":"c-vertical-lsb","scope":"all-screens"}}'
```

The unversioned `/api/*` Electron endpoints remain compatibility aliases. New integrations should use `/api/v1` because it has explicit revision, idempotency, permission, dry-run and outcome semantics.

## Authentication And Scopes

Set an optional token before starting the desktop app:

```bash
$env:LCD_IDE_AUTOMATION_TOKEN = "replace-with-a-random-local-secret"
```

Clients then send `Authorization: Bearer …`. `X-LCD-IDE-Scopes` may restrict a session to `project:read`, `project:write`, `project:destructive` and/or `runtime:write`.

## MCP Endpoint

Endpoint:

```text
http://127.0.0.1:8767/mcp
```

Electron retains the compatibility resources below; portable clients should prefer registry tools because Tauri intentionally exposes one shared command contract rather than a second project cache:

- `project://current`
- `project://fsm`
- `project://screens`
- `project://control-panel`
- `project://tags`
- `project://procedures`
- `project://alarms`
- `project://validation`

Call `tools/list` to obtain the current generated schemas. Core tools include:

- `get_project_summary`
- `list_fsm_states`
- `list_fsm_transitions`
- `list_fsm_events`
- `list_screens`
- `get_screen`
- `list_control_panel_elements`
- `get_validation_report`
- `list_tags`
- `list_procedures`
- `list_alarms`
- `get_runtime_state`
- `list_export_formats`
- `get_capabilities`
- `get_project_revision`
- `preview_changes`
- `apply_changes`
- `undo_last_agent_change`
- `reorder_screens`
- `validate_project`
- `compile_assets`

Write tools:

- `create_fsm_state`
- `update_fsm_state`
- `delete_fsm_state`
- `create_fsm_transition`
- `update_fsm_transition`
- `delete_fsm_transition`
- `create_fsm_event`
- `update_fsm_event`
- `delete_fsm_event`
- `update_control_panel_element`
- `upsert_tag`
- `delete_tag`
- `upsert_procedure`
- `delete_procedure`
- `upsert_alarm`
- `delete_alarm`
- `compile_screen`
- `fire_runtime_event`

## Agent Workflows

### Claude Code, Codex, OpenCode

Use MCP when the client supports HTTP/SSE MCP servers. Configure a server named `lcd-bitmap-ide` with URL `http://127.0.0.1:8767/mcp`.

Recommended prompt:

```text
You are operating LCD-bitmap IDE through its MCP server.
First call get_project_summary and list_fsm_states.
Before any mutation, describe the intended state/screen/tag changes.
After each mutation, call get_project_summary again and report what changed.
Do not delete states unless explicitly requested.
```

When MCP is unavailable, use REST calls from the agent shell. Keep changes small and validate visually in the desktop app.

### LM Studio And Ollama

Most local model hosts need a thin tool wrapper. Expose a small JSON tool layer that maps model tool calls to REST requests:

```json
{
  "name": "lcd_api",
  "description": "Call LCD-bitmap IDE local REST API",
  "parameters": {
    "method": "GET|POST|PUT|DELETE",
    "path": "/api/project/meta",
    "body": {}
  }
}
```

Wrapper rules:

- Only allow `127.0.0.1:8766`.
- Log every write request.
- Require explicit user confirmation before `DELETE`.
- Read `/api/project` before write operations when the model did not inspect state in the last step.

### Scripted Batch Edits

For deterministic edits, prefer REST plus small JSON payloads. Read `project://validation` / `/api/validation` after every conceptual batch: this report is generated from the same normalized project snapshot that the editor displays.

For ECROS-5300VI/5310 projects, `npm run repair:ecros -- <input.lcdproj> [output.lcdproj]` creates a new file; it does not overwrite the source. It normalizes duplicated initial/event bindings, restores a return route from Mode F, binds physical buttons to semantic events, and registers the established ECROS tags/data sources. The actual CLI command catalogue and hardware zeroing procedure remain explicit integration work and are not fabricated by this repair.

Batch safety checklist:

- Read state first.
- Mutate one conceptual area at a time.
- Save the project after a successful batch.
- Compile screens after LCD changes.
- Run Runtime Preview after FSM transition changes.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `connection refused` | Desktop app is not running or another process owns the port | Start Electron/Tauri and inspect its automation log |
| API returns `project: null` | No project is open | Open a `.lcdproj` or the demo project |
| Mutation times out | Renderer did not reply within 5 seconds | Check the desktop app window and console |
| Runtime event has no effect | Runtime is not started or event is invalid for current state | Open Runtime, start preview, inspect available buttons/events |
| MCP client cannot connect | Client does not support HTTP/SSE MCP | Use REST fallback through shell tools |

## Security Boundary

The servers bind to `127.0.0.1`, validate Host/Origin, cap request bodies and support an optional bearer token. They are still local developer surfaces: do not expose the ports through a tunnel or bind them to a public interface.
