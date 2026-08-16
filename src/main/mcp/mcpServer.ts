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
 *   project://current, project://fsm, project://screens, project://control-panel,
 *   project://tags, project://procedures, project://alarms, project://validation
 *
 * Tools (read):
 *   get_project_summary, list_fsm_states, list_fsm_events, list_screens, get_screen,
 *   list_control_panel_elements, get_validation_report, list_tags, list_procedures,
 *   list_alarms, get_runtime_state, list_export_formats
 *
 * Tools (write — current externally supported mutation subset):
 *   create_fsm_state, update_fsm_state, delete_fsm_state,
 *   create_fsm_transition, update_fsm_transition, delete_fsm_transition,
 *   create_fsm_event, update_fsm_event, delete_fsm_event, update_control_panel_element,
 *   upsert_tag, delete_tag,
 *   upsert_procedure, delete_procedure,
 *   upsert_alarm, delete_alarm,
 *   compile_screen, fire_runtime_event
 */

import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow, IpcMain } from 'electron';
import { evaluateLocalHttpAccess, readBoundedRequestBody } from '../localHttpSecurity.js';
import { getAutomationDefinition, getMcpToolDefinitions } from '../../shared/automation/registry.js';
import type { AutomationOutcome } from '../../shared/automation/contracts.js';
import { AutomationAuthorizationError, authorizeLocalAutomation, createAutomationRequest, splitMcpArguments } from '../automationTransport.js';

export const MCP_PORT = 8767;

const CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-LCD-IDE-Scopes, X-Correlation-ID'
};

let _projectCache: unknown = null;
let _runtimeState: { currentStateId: string | null; isRunning: boolean } | null = null;
let _mainWindow: BrowserWindow | null = null;

export function setMcpProjectCache(project: unknown): void { _projectCache = project; }
export function setMcpRuntimeState(state: typeof _runtimeState): void { _runtimeState = state; }
export function setMcpMainWindow(win: BrowserWindow): void { _mainWindow = win; }

const sseClients = new Set<ServerResponse>();
let mcpServer: Server | null = null;
let mcpIpcHandlersRegistered = false;

const pendingMutations = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

export function startMcpServer(ipcMain: IpcMain): Server {
  if (mcpServer) return mcpServer;
  if (!mcpIpcHandlersRegistered) {
    mcpIpcHandlersRegistered = true;
    ipcMain.on('api:project-state', (_event, state: { project: unknown; revision?: number }) => {
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
  }

  const server = createServer(handleMcpRequest);
  server.once('error', (error: NodeJS.ErrnoException) => {
    console.warn(`[mcp] disabled: ${error.code ?? error.message}`);
    if (mcpServer === server) mcpServer = null;
  });
  mcpServer = server;
  server.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`[mcp] MCP server (HTTP/SSE) listening on http://127.0.0.1:${MCP_PORT}`);
  });
  return server;
}

export function stopMcpServer(): void {
  mcpServer?.close();
  mcpServer = null;
  for (const pending of pendingMutations.values()) clearTimeout(pending.timer);
  pendingMutations.clear();
  for (const client of sseClients) client.end();
  sseClients.clear();
}

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
  const access = evaluateLocalHttpAccess(req.headers, MCP_PORT);
  if (!access.allowed) {
    const out = JSON.stringify(rpcError(null, -32003, access.reason ?? 'Forbidden'));
    res.writeHead(403, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
    res.end(out);
    return;
  }
  if (access.allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', access.allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const authorization = authorizeLocalAutomation(req.headers);
  if (!authorization.allowed) {
    const out = JSON.stringify(rpcError(null, -32001, authorization.message));
    res.writeHead(401, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
    res.end(out);
    return;
  }
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
      return dispatchRpc(msg, req.headers);
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

async function dispatchRpc(msg: { jsonrpc: string; id?: string | number; method: string; params?: unknown }, headers: IncomingHttpHeaders = {}): Promise<unknown> {
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
        { uri: 'project://screens',    name: 'LCD screens',    mimeType: 'application/json' },
        { uri: 'project://control-panel', name: 'Control panel', mimeType: 'application/json' },
        { uri: 'project://tags',       name: 'HMI tags',       mimeType: 'application/json' },
        { uri: 'project://procedures', name: 'Procedures',     mimeType: 'application/json' },
        { uri: 'project://alarms',     name: 'Alarms',         mimeType: 'application/json' },
        { uri: 'project://validation', name: 'Validation report', mimeType: 'application/json' }
      ]});

    case 'resources/read': {
      const uri = (params as { uri: string })?.uri;
      const p = _projectCache as Record<string, unknown> | null;
      const content = ((): unknown => {
        if (uri === 'project://current')    return p;
        if (uri === 'project://fsm')        return p?.['fsm'];
        if (uri === 'project://screens')    return { screens: p?.['screens'] ?? {}, screenOrder: p?.['screenOrder'] ?? [] };
        if (uri === 'project://control-panel') return p?.['controlPanel'] ?? null;
        if (uri === 'project://tags')       return p?.['tags'] ?? {};
        if (uri === 'project://procedures') return p?.['procedures'] ?? {};
        if (uri === 'project://alarms')     return p?.['alarms'] ?? {};
        if (uri === 'project://validation') return p?.['validation'] ?? { issues: [], validatedAt: null };
        return null;
      })();
      if (content === null && uri !== 'project://tags' && uri !== 'project://procedures' && uri !== 'project://alarms') {
        return rpcError(id, -32002, `Resource not found: ${uri}`);
      }
      return rpcOk(id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(content, null, 2) }] });
    }

    case 'tools/list':
      return rpcOk(id, { tools: MCP_TOOL_DEFINITIONS });

    case 'tools/call': {
      const p2 = params as { name: string; arguments?: Record<string, unknown> };
      return callTool(id, p2.name, p2.arguments ?? {}, headers);
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export const MCP_TOOL_DEFINITIONS = getMcpToolDefinitions();

async function callTool(id: string | number | undefined, name: string, args: Record<string, unknown>, headers: IncomingHttpHeaders): Promise<unknown> {
  if (getAutomationDefinition(name)) {
    try {
      const request = createAutomationRequest(name, splitMcpArguments(args), headers, 'electron-mcp');
      const outcome = await mutate('automation.execute', request) as AutomationOutcome;
      return rpcOk(id, {
        content: [{ type: 'text', text: JSON.stringify(outcome, null, 2) }],
        structuredContent: outcome,
        isError: outcome.status === 'failure' || outcome.status === 'blocked' || outcome.status === 'conflict'
      });
    } catch (error) {
      const code = error instanceof AutomationAuthorizationError ? -32001 : -32000;
      return rpcError(id, code, error instanceof Error ? error.message : 'Automation tool call failed');
    }
  }
  return rpcError(id, -32601, `Unknown tool: ${name}`);
}

function rpcOk(id: string | number | undefined, result: unknown): unknown {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function readBody(req: IncomingMessage): Promise<string> {
  return readBoundedRequestBody(req);
}
