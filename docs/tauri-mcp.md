# MCP in the Tauri desktop application

The Electron build exposes the identical contract on the same ports; this page documents the Tauri transport specifically because its implementation lives in Rust rather than the Node main process. See [docs/API_MCP_CONNECTORS.md](API_MCP_CONNECTORS.md) for the shared REST/MCP reference that applies to both shells.

The Tauri build starts its local automation transports together with the application window:

- MCP (Streamable HTTP / JSON-RPC): `http://127.0.0.1:8767/mcp`
- MCP health probe: `http://127.0.0.1:8767/health`
- REST API: `http://127.0.0.1:8766/api/v1`

The endpoint is intentionally bound to loopback only. The Settings workspace shows whether both listeners are actually bound, their addresses, MCP protocol version and whether token authentication is enabled.

## MCP client configuration

Use an HTTP MCP server entry (the exact outer key depends on the client):

```json
{
  "mcpServers": {
    "lcd-bitmap-ide": {
      "type": "http",
      "url": "http://127.0.0.1:8767/mcp"
    }
  }
}
```

Start LCD-bitmap IDE and open a project before connecting the client. The server supports `initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call`. Tool calls are executed by the same application command dispatcher used by the Electron transport, so project revision checks, permissions and diagnostics remain consistent.

## Optional token

Set `LCD_IDE_AUTOMATION_TOKEN` before starting the application and send the value as `Authorization: Bearer <token>`. Initialization and health checks stay local and read-only; project tool calls require the token. Optional `X-LCD-IDE-Scopes` values are `project:read`, `project:write`, `project:destructive` and `runtime:write`.

## Diagnostics

1. Open **Settings → API & MCP servers** and check that MCP is running.
2. Request `GET http://127.0.0.1:8767/health`.
3. If the listener is unavailable, close the process currently using port `8767`, then restart the application.
4. If a tool call times out, keep the Tauri window open: commands are forwarded to the active renderer and have a five-second response timeout.
