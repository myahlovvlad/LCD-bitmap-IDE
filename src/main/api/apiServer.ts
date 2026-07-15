/**
 * REST API server for LCD-bitmap-IDE.
 *
 * Runs in the Electron main process on http://127.0.0.1:8766.
 * Project state is pushed from the renderer via IPC ('api:project-state') and
 * cached here. External tools (SCADA, LIMS, scripts, LLM agents) can read and
 * mutate project state over HTTP.
 *
 * READ endpoints (GET):
 *   /api/health               — liveness check
 *   /api/project              — full project JSON
 *   /api/project/meta         — project metadata
 *   /api/fsm/states           — FSM states record
 *   /api/fsm/transitions      — FSM transitions record
 *   /api/tags                 — HMI tags record
 *   /api/procedures           — backend procedures record
 *   /api/alarms               — alarm definitions record
 *   /api/runtime/state        — current runtime state
 *   /api/export/formats       — list of available export formats
 *
 * WRITE endpoints (POST/PUT/DELETE):
 *   POST   /api/fsm/states              — { title, x?, y? } → add FSM state
 *   PUT    /api/fsm/states/:id          — partial FsmState → update state
 *   DELETE /api/fsm/states/:id          — delete state
 *   POST   /api/fsm/transitions         — { from, to, eventId? } → add transition
 *   PUT    /api/fsm/transitions/:id     — partial FsmTransition → update
 *   DELETE /api/fsm/transitions/:id     — delete transition
 *   PUT    /api/tags/:id                — HmiTag (upsert)
 *   DELETE /api/tags/:id                — delete tag
 *   PUT    /api/procedures/:id          — BackendProcedure (upsert)
 *   DELETE /api/procedures/:id          — delete procedure
 *   PUT    /api/alarms/:id             — AlarmDefinition (upsert)
 *   DELETE /api/alarms/:id             — delete alarm
 *   POST   /api/compile                 — { backend?, scope?, screenId?, language? } → compile
 *   POST   /api/runtime/event           — { eventId } → fire event
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow, IpcMain } from 'electron';

export const API_PORT = 8766;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

interface ProjectStateCache {
  project: unknown;
  runtimeState: { currentStateId: string | null; isRunning: boolean } | null;
  updatedAt: string;
}

let cache: ProjectStateCache = { project: null, runtimeState: null, updatedAt: new Date().toISOString() };
let mainWindow: BrowserWindow | null = null;
let httpServer: Server | null = null;

// Pending renderer mutations: requestId → { resolve, reject, timer }
const pendingMutations = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

export function setMainWindow(win: BrowserWindow): void { mainWindow = win; }

export function startApiServer(ipcMain: IpcMain): Server {
  ipcMain.on('api:project-state', (_e, state: { project: unknown }) => {
    cache = { ...cache, project: state.project, updatedAt: new Date().toISOString() };
  });
  ipcMain.on('api:runtime-state', (_e, runtimeState: ProjectStateCache['runtimeState']) => {
    cache = { ...cache, runtimeState, updatedAt: new Date().toISOString() };
  });
  // Renderer replies to mutation requests
  ipcMain.on('api:mutate-res', (_e, { requestId, result, error }: { requestId: string; result?: unknown; error?: string }) => {
    const pending = pendingMutations.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingMutations.delete(requestId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  });

  httpServer = createServer(handleRequest);
  httpServer.listen(API_PORT, '127.0.0.1', () => {
    console.log(`[api] REST API on http://127.0.0.1:${API_PORT}`);
  });
  return httpServer;
}

export function stopApiServer(): void { httpServer?.close(); httpServer = null; }

/** Send a mutation request to the renderer and await the response (5s timeout). */
async function mutate(action: string, payload: unknown): Promise<unknown> {
  if (!mainWindow) throw new Error('No renderer window available');
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingMutations.delete(requestId);
      reject(new Error('Renderer mutation timed out (5s)'));
    }, 5000);
    pendingMutations.set(requestId, { resolve, reject, timer });
    mainWindow!.webContents.send('api:mutate-req', { requestId, action, payload });
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS_HEADERS); res.end(); return; }

  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // GET routes
  if (method === 'GET') {
    if (url === '/api/health') return json(res, { ok: true, ts: new Date().toISOString() });
    if (url === '/api/project') return json(res, { project: cache.project, updatedAt: cache.updatedAt });
    if (url === '/api/project/meta') return json(res, { meta: proj()?.['meta'] ?? null });
    if (url === '/api/fsm/states') return json(res, { states: proj()?.['fsm'] ? (proj() as any).fsm.states : null });
    if (url === '/api/fsm/transitions') return json(res, { transitions: proj()?.['fsm'] ? (proj() as any).fsm.transitions : null });
    if (url === '/api/tags') return json(res, { tags: proj()?.['tags'] ?? {} });
    if (url === '/api/procedures') return json(res, { procedures: proj()?.['procedures'] ?? {} });
    if (url === '/api/alarms') return json(res, { alarms: proj()?.['alarms'] ?? {} });
    if (url === '/api/runtime/state') return json(res, { runtimeState: cache.runtimeState });
    if (url === '/api/export/formats') return json(res, {
      formats: [
        { id: 'c-vertical-lsb', label: 'C header — vertical LSB (SSD1306 native)', ext: '.h' },
        { id: 'c-horizontal-msb', label: 'C header — horizontal MSB (SSD1306 horiz.)', ext: '.h' },
        { id: 'c-horizontal-lsb', label: 'C header — horizontal LSB', ext: '.h' },
        { id: 'xbm', label: 'XBM — u8g2 / libX11 / LVGL', ext: '.xbm' },
        { id: 'arduino-progmem', label: 'Arduino PROGMEM header', ext: '.h' },
        { id: 'rust-embedded', label: 'Rust embedded-graphics', ext: '.rs' },
        { id: 'esp-idf', label: 'ESP-IDF RODATA_ATTR header', ext: '.h' },
        { id: 'binary', label: 'Raw binary', ext: '.bin' }
      ]
    });
  }

  // Parse ID from url patterns like /api/tags/my-tag-id
  const postBody = (): Promise<unknown> => readBody(req).then((b) => JSON.parse(b));
  const idParam = (prefix: string): string | null => {
    if (url.startsWith(prefix + '/')) return decodeURIComponent(url.slice(prefix.length + 1));
    return null;
  };

  // FSM state mutations
  if (method === 'POST' && url === '/api/fsm/states') {
    postBody().then((body) => mutate('addFsmState', body).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return;
  }
  const stateId = idParam('/api/fsm/states');
  if (stateId) {
    if (method === 'PUT') { postBody().then((b) => mutate('updateFsmState', { stateId, updates: b }).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return; }
    if (method === 'DELETE') { mutate('deleteFsmState', { stateId }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 500)); return; }
  }

  // FSM transition mutations
  if (method === 'POST' && url === '/api/fsm/transitions') {
    postBody().then((body) => { const { from, to, eventId } = body as any; return mutate('addFsmTransition', { from, to, eventId }); }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 400)); return;
  }
  const transId = idParam('/api/fsm/transitions');
  if (transId) {
    if (method === 'PUT') { postBody().then((b) => mutate('updateFsmTransition', { transitionId: transId, updates: b }).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return; }
    if (method === 'DELETE') { mutate('deleteFsmTransition', { transitionId: transId }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 500)); return; }
  }

  // Tag mutations
  const tagId = idParam('/api/tags');
  if (tagId) {
    if (method === 'PUT') { postBody().then((b) => mutate('upsertHmiTag', b).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return; }
    if (method === 'DELETE') { mutate('deleteHmiTag', { tagId }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 500)); return; }
  }

  // Procedure mutations
  const procId = idParam('/api/procedures');
  if (procId) {
    if (method === 'PUT') { postBody().then((b) => mutate('upsertHmiProcedure', b).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return; }
    if (method === 'DELETE') { mutate('deleteHmiProcedure', { procedureId: procId }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 500)); return; }
  }

  // Alarm mutations
  const alarmId = idParam('/api/alarms');
  if (alarmId) {
    if (method === 'PUT') { postBody().then((b) => mutate('upsertAlarm', b).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return; }
    if (method === 'DELETE') { mutate('deleteAlarm', { alarmId }).then((r) => json(res, { ok: true, result: r })).catch((e) => json(res, { error: String(e) }, 500)); return; }
  }

  // Compile/export
  if (method === 'POST' && url === '/api/compile') {
    postBody().then((b) => mutate('compileProject', b).then((r) => json(res, { ok: true, result: r }))).catch((e) => json(res, { error: String(e) }, 400)); return;
  }

  // Runtime event
  if (method === 'POST' && url === '/api/runtime/event') {
    postBody().then((body) => {
      const { eventId } = body as { eventId: string };
      if (typeof eventId !== 'string' || !eventId) return json(res, { error: 'eventId required' }, 400);
      mainWindow?.webContents.send('api:fire-event', { eventId });
      json(res, { ok: true, eventId });
    }).catch(() => json(res, { error: 'Invalid JSON' }, 400));
    return;
  }

  json(res, { error: 'Not found', url }, 404);
}

function proj(): Record<string, unknown> | null {
  return cache.project as Record<string, unknown> | null;
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
