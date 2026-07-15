# API And MCP Connector Guide

This guide describes how to operate LCD-bitmap IDE from local automation tools and AI coding agents while the Electron desktop app is running.

## Runtime Model

The UI is the source of truth. The Electron main process exposes local servers, while the renderer keeps the current project state synchronized over IPC.

```text
Desktop UI
  | project state + mutation replies
  v
Electron main process
  |-- REST API  http://127.0.0.1:8766
  |-- MCP HTTP  http://127.0.0.1:8767/mcp
```

Keep the desktop window open. Open a project or the bundled demo before calling mutation endpoints.

## REST API

Base URL:

```text
http://127.0.0.1:8766
```

Read endpoints:

```bash
curl http://127.0.0.1:8766/api/health
curl http://127.0.0.1:8766/api/project
curl http://127.0.0.1:8766/api/project/meta
curl http://127.0.0.1:8766/api/fsm/states
curl http://127.0.0.1:8766/api/fsm/transitions
curl http://127.0.0.1:8766/api/tags
curl http://127.0.0.1:8766/api/procedures
curl http://127.0.0.1:8766/api/alarms
curl http://127.0.0.1:8766/api/runtime/state
curl http://127.0.0.1:8766/api/export/formats
```

Create an FSM state:

```bash
curl -X POST http://127.0.0.1:8766/api/fsm/states \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Service Menu\",\"x\":360,\"y\":120}"
```

Create a transition:

```bash
curl -X POST http://127.0.0.1:8766/api/fsm/transitions \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"main-menu\",\"to\":\"service-menu\",\"eventId\":\"SERVICE\"}"
```

Upsert a tag:

```bash
curl -X PUT http://127.0.0.1:8766/api/tags/absorbance \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"absorbance\",\"name\":{\"en\":\"Absorbance\",\"ru\":\"Оптическая плотность\",\"zh\":\"吸光度\"},\"dataType\":\"float\",\"unit\":\"AU\",\"precision\":3,\"source\":\"simulation\"}"
```

Compile all screens:

```bash
curl -X POST http://127.0.0.1:8766/api/compile \
  -H "Content-Type: application/json" \
  -d "{\"format\":\"c-vertical-lsb\",\"scope\":\"all-screens\",\"language\":\"en\"}"
```

Fire a runtime event:

```bash
curl -X POST http://127.0.0.1:8766/api/runtime/event \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"START\"}"
```

## MCP Endpoint

Endpoint:

```text
http://127.0.0.1:8767/mcp
```

Resources:

- `project://current`
- `project://fsm`
- `project://tags`
- `project://procedures`
- `project://alarms`

Read tools:

- `get_project_summary`
- `list_fsm_states`
- `list_fsm_transitions`
- `list_tags`
- `list_procedures`
- `list_alarms`
- `get_runtime_state`
- `list_export_formats`

Write tools:

- `create_fsm_state`
- `update_fsm_state`
- `delete_fsm_state`
- `create_fsm_transition`
- `delete_fsm_transition`
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

For deterministic edits, prefer REST plus small JSON payloads. For broad structural changes, generate a `.lcdproj` file in a separate branch, open it in the app, then validate through the UI.

Batch safety checklist:

- Read state first.
- Mutate one conceptual area at a time.
- Save the project after a successful batch.
- Compile screens after LCD changes.
- Run Runtime Preview after FSM transition changes.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `connection refused` | Electron app is not running | Start `npm run electron:dev` or the packaged desktop app |
| API returns `project: null` | No project is open | Open a `.lcdproj` or the demo project |
| Mutation times out | Renderer did not reply within 5 seconds | Check the desktop app window and console |
| Runtime event has no effect | Runtime is not started or event is invalid for current state | Open Runtime, start preview, inspect available buttons/events |
| MCP client cannot connect | Client does not support HTTP/SSE MCP | Use REST fallback through shell tools |

## Security Boundary

The servers bind to `127.0.0.1` and are intended for local developer automation. They do not authenticate remote clients. Do not expose the ports through a tunnel or bind them to a public interface.
