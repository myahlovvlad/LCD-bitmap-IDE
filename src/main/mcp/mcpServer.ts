/**
 * MCP server for LCD-bitmap-IDE.
 *
 * Implements the Model Context Protocol (JSON-RPC 2.0) over HTTP+SSE on
 * http://127.0.0.1:8767.
 *
 * Registers with Claude Desktop via claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "lcd-bitmap-ide": {
 *         "url": "http://127.0.0.1:8767/mcp"
 *       }
 *     }
 *   }
 *
 * Resources:
 *   project://current, project://fsm, project://tags, project://procedures, project://alarms
 *
 * Tools (read):
 *   get_project_summary, list_fsm_states, list_tags, list_procedures, list_alarms,
 *   get_runtime_state, list_export_formats
 *
 * Tools (write — every project mutation available in the UI is exposed here):
 *   create_fsm_state, update_fsm_state, delete_fsm_state,
 *   create_fsm_transition, update_fsm_transition, delete_fsm_transition,
 *   upsert_tag, delete_tag,
 *   upsert_procedure, delete_procedure,
 *   upsert_alarm, delete_alarm,
 *   compile_screen, fire_runtime_event
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow, IpcMain } from 'electron';

export const MCP_PORT = 8767;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept'
};

let _projectCache: unknown = null;
let _runtimeState: { currentStateId: string | null; isRunning: boolean } | null = null;
let _mainWindow: BrowserWindow | null = null;

export function setMcpProjectCache(project: unknown): void { _projectCache = project; }
export function setMcpRuntimeState(state: typeof _runtimeState): void { _runtimeState = state; }
export function setMcpMainWindow(win: BrowserWindow): void { _mainWindow = win; }

const sseClients = new Set<ServerResponse>();
let mcpServer: Server | null = null;

const pendingMutations = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

export function startMcpServer(ipcMain: IpcMain): Server {
  ipcMain.on('api:project-state', (_event, state: { project: unknown }) => {
    _projectCache = state.project;
    notifySseClients({ method: 'notifications/resources/updated', params: { uri: 'project://current' } });
  });
  ipcMain.on('api:mutate-res', (_e, { requestId, result, error }: { requestId: string; result?: unknown; error?: string }) => {
    const pending = pendingMutations.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingMutations.delete(requestId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  });

  mcpServer = createServer(handleMcpRequest);
  mcpServer.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`[mcp] MCP server (HTTP/SSE) listening on http://127.0.0.1:${MCP_PORT}`);
  });
  return mcpServer;
}

export function stopMcpServer(): void { mcpServer?.close(); mcpServer = null; }

async function mutate(action: string, payload: unknown): Promise<unknown> {
  if (!_mainWindow) throw new Error('No renderer window available');
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingMutations.delete(requestId);
      reject(new Error('Renderer mutation timed out (5s)'));
    }, 5000);
    pendingMutations.set(requestId, { resolve, reject, timer });
    _mainWindow!.webContents.send('api:mutate-req', { requestId, action, payload });
  });
}

function notifySseClients(notification: unknown): void {
  const line = `data: ${JSON.stringify(notification)}\n\n`;
  for (const client of sseClients) {
    try { client.write(line); } catch { sseClients.delete(client); }
  }
}

function handleMcpRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const url = req.url ?? '/';

  if (url === '/mcp' && req.method === 'GET' && req.headers['accept'] === 'text/event-stream') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (url === '/mcp' && req.method === 'POST') {
    readBody(req).then((body) => {
      const msg = JSON.parse(body) as { jsonrpc: string; id?: string | number; method: string; params?: unknown };
      return dispatchRpc(msg);
    }).then((response) => {
      const out = JSON.stringify(response);
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
      res.end(out);
    }).catch((err) => {
      const out = JSON.stringify(rpcError(null, -32700, err instanceof Error ? err.message : 'Parse error'));
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(out);
    });
    return;
  }

  res.writeHead(404, CORS); res.end('Not found');
}

async function dispatchRpc(msg: { jsonrpc: string; id?: string | number; method: string; params?: unknown }): Promise<unknown> {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return rpcOk(id, {
        protocolVersion: '2024-11-05',
        capabilities: { resources: { subscribe: false }, tools: {} },
        serverInfo: { name: 'lcd-bitmap-ide', version: '1.0.0' }
      });

    case 'resources/list':
      return rpcOk(id, { resources: [
        { uri: 'project://current',    name: 'Full project',   mimeType: 'application/json' },
        { uri: 'project://fsm',        name: 'FSM graph',      mimeType: 'application/json' },
        { uri: 'project://tags',       name: 'HMI tags',       mimeType: 'application/json' },
        { uri: 'project://procedures', name: 'Procedures',     mimeType: 'application/json' },
        { uri: 'project://alarms',     name: 'Alarms',         mimeType: 'application/json' }
      ]});

    case 'resources/read': {
      const uri = (params as { uri: string })?.uri;
      const p = _projectCache as Record<string, unknown> | null;
      const content = ((): unknown => {
        if (uri === 'project://current')    return p;
        if (uri === 'project://fsm')        return p?.['fsm'];
        if (uri === 'project://tags')       return p?.['tags'] ?? {};
        if (uri === 'project://procedures') return p?.['procedures'] ?? {};
        if (uri === 'project://alarms')     return p?.['alarms'] ?? {};
        return null;
      })();
      if (content === null && uri !== 'project://tags' && uri !== 'project://procedures' && uri !== 'project://alarms') {
        return rpcError(id, -32002, `Resource not found: ${uri}`);
      }
      return rpcOk(id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(content, null, 2) }] });
    }

    case 'tools/list':
      return rpcOk(id, { tools: TOOL_DEFINITIONS });

    case 'tools/call': {
      const p2 = params as { name: string; arguments?: Record<string, unknown> };
      return callTool(id, p2.name, p2.arguments ?? {});
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const TOOL_DEFINITIONS = [
  // ── Read tools ──────────────────────────────────────────────────────────
  { name: 'get_project_summary', description: 'Returns project name, schema version, FSM state count, screen count and tag count.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_fsm_states', description: 'Returns all FSM states as a JSON array.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_fsm_transitions', description: 'Returns all FSM transitions as a JSON array.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_tags', description: 'Returns all HMI tags as a JSON array.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_procedures', description: 'Returns all backend procedures as a JSON array.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_alarms', description: 'Returns all alarm definitions as a JSON array.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_runtime_state', description: 'Returns the current FSM runtime state (current state ID and running flag).', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_export_formats', description: 'Returns the embedded export formats available for screen code generation (C, XBM, Arduino, Rust, ESP-IDF, binary).', inputSchema: { type: 'object', properties: {}, required: [] } },

  // ── FSM write tools ─────────────────────────────────────────────────────
  { name: 'create_fsm_state', description: 'Creates a new FSM state with an auto-generated screen.', inputSchema: { type: 'object', properties: { title: { type: 'string', description: 'Display title for the new state.' } }, required: [] } },
  { name: 'update_fsm_state', description: 'Updates properties of an existing FSM state (e.g. title).', inputSchema: { type: 'object', properties: { stateId: { type: 'string' }, title: { type: 'string' } }, required: ['stateId'] } },
  { name: 'delete_fsm_state', description: 'Deletes an FSM state and its associated screen/transitions.', inputSchema: { type: 'object', properties: { stateId: { type: 'string' } }, required: ['stateId'] } },
  { name: 'create_fsm_transition', description: 'Creates a transition between two FSM states triggered by an event.', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, eventId: { type: 'string' } }, required: ['from', 'to'] } },
  { name: 'delete_fsm_transition', description: 'Deletes an FSM transition by id.', inputSchema: { type: 'object', properties: { transitionId: { type: 'string' } }, required: ['transitionId'] } },

  // ── Tag write tools ─────────────────────────────────────────────────────
  { name: 'upsert_tag', description: 'Creates or updates an HMI tag. Pass the full tag object (id, name, dataType, etc.).', inputSchema: { type: 'object', properties: { tag: { type: 'object', description: 'Full HmiTag object.' } }, required: ['tag'] } },
  { name: 'delete_tag', description: 'Deletes an HMI tag by id.', inputSchema: { type: 'object', properties: { tagId: { type: 'string' } }, required: ['tagId'] } },

  // ── Procedure write tools ───────────────────────────────────────────────
  { name: 'upsert_procedure', description: 'Creates or updates a backend procedure. Pass the full procedure object.', inputSchema: { type: 'object', properties: { procedure: { type: 'object', description: 'Full BackendProcedure object.' } }, required: ['procedure'] } },
  { name: 'delete_procedure', description: 'Deletes a backend procedure by id.', inputSchema: { type: 'object', properties: { procedureId: { type: 'string' } }, required: ['procedureId'] } },

  // ── Alarm write tools ───────────────────────────────────────────────────
  { name: 'upsert_alarm', description: 'Creates or updates an alarm definition. Pass the full alarm object.', inputSchema: { type: 'object', properties: { alarm: { type: 'object', description: 'Full AlarmDefinition object.' } }, required: ['alarm'] } },
  { name: 'delete_alarm', description: 'Deletes an alarm definition by id.', inputSchema: { type: 'object', properties: { alarmId: { type: 'string' } }, required: ['alarmId'] } },

  // ── Codegen / runtime ────────────────────────────────────────────────────
  { name: 'compile_screen', description: 'Compiles one or all LCD screens to an embedded export format (C header, XBM, Arduino PROGMEM, Rust embedded-graphics, ESP-IDF, or raw binary) and returns the generated source as text.', inputSchema: { type: 'object', properties: {
      format: { type: 'string', enum: ['c-vertical-lsb', 'c-horizontal-msb', 'c-horizontal-lsb', 'xbm', 'arduino-progmem', 'rust-embedded', 'esp-idf', 'binary'], description: 'Target embedded format.' },
      scope: { type: 'string', enum: ['selected-screen', 'all-screens'], description: 'Compile one screen or the whole project.' },
      screenId: { type: 'string', description: 'Screen/state id when scope is selected-screen.' }
    }, required: ['format'] } },
  { name: 'fire_runtime_event', description: 'Sends an FSM event to the running runtime engine in the IDE.', inputSchema: { type: 'object', properties: { eventId: { type: 'string', description: 'The FSM event id to fire.' } }, required: ['eventId'] } }
];

async function callTool(id: string | number | undefined, name: string, args: Record<string, unknown>): Promise<unknown> {
  const p = _projectCache as Record<string, unknown> | null;
  const fsm = p?.['fsm'] as Record<string, unknown> | undefined;

  const text = (value: unknown): unknown => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

  try {
    switch (name) {
      // ── Read tools ──
      case 'get_project_summary':
        return rpcOk(id, text({
          name: (p?.['meta'] as Record<string, unknown> | undefined)?.['name'] ?? 'unknown',
          schemaVersion: (p?.['meta'] as Record<string, unknown> | undefined)?.['schemaVersion'] ?? null,
          stateCount: (fsm?.['stateOrder'] as unknown[] | undefined)?.length ?? 0,
          screenCount: (p?.['screenOrder'] as unknown[] | undefined)?.length ?? 0,
          tagCount: Object.keys((p?.['tags'] as Record<string, unknown> | undefined) ?? {}).length,
          procedureCount: Object.keys((p?.['procedures'] as Record<string, unknown> | undefined) ?? {}).length,
          alarmCount: Object.keys((p?.['alarms'] as Record<string, unknown> | undefined) ?? {}).length
        }));
      case 'list_fsm_states':
        return rpcOk(id, text(Object.values((fsm?.['states'] as Record<string, unknown> | undefined) ?? {})));
      case 'list_fsm_transitions':
        return rpcOk(id, text(Object.values((fsm?.['transitions'] as Record<string, unknown> | undefined) ?? {})));
      case 'list_tags':
        return rpcOk(id, text(Object.values((p?.['tags'] as Record<string, unknown> | undefined) ?? {})));
      case 'list_procedures':
        return rpcOk(id, text(Object.values((p?.['procedures'] as Record<string, unknown> | undefined) ?? {})));
      case 'list_alarms':
        return rpcOk(id, text(Object.values((p?.['alarms'] as Record<string, unknown> | undefined) ?? {})));
      case 'get_runtime_state':
        return rpcOk(id, text(_runtimeState ?? { currentStateId: null, isRunning: false }));
      case 'list_export_formats':
        return rpcOk(id, text([
          { id: 'c-vertical-lsb', label: 'C header — vertical LSB (SSD1306 native)' },
          { id: 'c-horizontal-msb', label: 'C header — horizontal MSB (SSD1306 horiz., ST7920)' },
          { id: 'c-horizontal-lsb', label: 'C header — horizontal LSB' },
          { id: 'xbm', label: 'XBM — u8g2 / libX11 / LVGL' },
          { id: 'arduino-progmem', label: 'Arduino PROGMEM header' },
          { id: 'rust-embedded', label: 'Rust embedded-graphics' },
          { id: 'esp-idf', label: 'ESP-IDF RODATA_ATTR header' },
          { id: 'binary', label: 'Raw binary' }
        ]));

      // ── FSM write tools ──
      case 'create_fsm_state':
        return rpcOk(id, text(await mutate('addFsmState', { title: args['title'] })));
      case 'update_fsm_state':
        return rpcOk(id, text(await mutate('updateFsmState', { stateId: args['stateId'], updates: { title: args['title'] } })));
      case 'delete_fsm_state':
        return rpcOk(id, text(await mutate('deleteFsmState', { stateId: args['stateId'] })));
      case 'create_fsm_transition':
        return rpcOk(id, text(await mutate('addFsmTransition', { from: args['from'], to: args['to'], eventId: args['eventId'] })));
      case 'delete_fsm_transition':
        return rpcOk(id, text(await mutate('deleteFsmTransition', { transitionId: args['transitionId'] })));

      // ── Tag write tools ──
      case 'upsert_tag':
        return rpcOk(id, text(await mutate('upsertHmiTag', args['tag'])));
      case 'delete_tag':
        return rpcOk(id, text(await mutate('deleteHmiTag', { tagId: args['tagId'] })));

      // ── Procedure write tools ──
      case 'upsert_procedure':
        return rpcOk(id, text(await mutate('upsertHmiProcedure', args['procedure'])));
      case 'delete_procedure':
        return rpcOk(id, text(await mutate('deleteHmiProcedure', { procedureId: args['procedureId'] })));

      // ── Alarm write tools ──
      case 'upsert_alarm':
        return rpcOk(id, text(await mutate('upsertAlarm', args['alarm'])));
      case 'delete_alarm':
        return rpcOk(id, text(await mutate('deleteAlarm', { alarmId: args['alarmId'] })));

      // ── Codegen / runtime ──
      case 'compile_screen':
        return rpcOk(id, text(await mutate('compileProject', {
          format: args['format'],
          scope: args['scope'] ?? 'all-screens',
          screenId: args['screenId']
        })));
      case 'fire_runtime_event': {
        const eventId = args['eventId'] as string | undefined;
        if (!eventId) return rpcError(id, -32602, 'eventId is required');
        _mainWindow?.webContents.send('api:fire-event', { eventId });
        return rpcOk(id, text(`Event "${eventId}" sent to runtime.`));
      }

      default:
        return rpcError(id, -32601, `Unknown tool: ${name}`);
    }
  } catch (err) {
    return rpcError(id, -32000, err instanceof Error ? err.message : 'Tool call failed');
  }
}

function rpcOk(id: string | number | undefined, result: unknown): unknown {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
