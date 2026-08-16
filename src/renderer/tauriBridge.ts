import type { SaveScreenDslFileRequest } from '../shared/screenDslFiles/contracts';
import type { SpectroSerialCommandRequest } from '../shared/spectrophotometerSerial/contracts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface TauriGlobal {
  core?: {
    invoke?: TauriInvoke;
  };
  event?: {
    listen?: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
  };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

const invoke = window.__TAURI__?.core?.invoke;

if (invoke && !window.spectroDesigner) {
  const platform: NodeJS.Platform =
    navigator.userAgent.includes('Windows') ? 'win32'
      : navigator.userAgent.includes('Mac') ? 'darwin'
        : 'linux';

  window.spectroDesigner = {
    platform,
    clipboardWrite: (text) => invoke<boolean>('clipboard_write', { text }),
    ipcSend: (channel, payload) => {
      if (channel !== 'api:mutate-res' || !payload || typeof payload !== 'object') return;
      const response = payload as { requestId?: string; result?: unknown; error?: string };
      if (!response.requestId) return;
      void invoke('automation_respond', {
        requestId: response.requestId,
        response: response.error
          ? { status: 'failure', diagnostics: [{ code: 'automation.renderer-error', message: response.error }] }
          : response.result ?? null
      });
    },
    onMutateRequest: (handler) => {
      const listen = window.__TAURI__?.event?.listen;
      if (!listen) return;
      void listen<{ requestId: string; action: string; payload: unknown }>('automation-request', (event) => {
        handler(event.payload.requestId, event.payload.action, event.payload.payload);
      });
    },
    screenDslFiles: {
      open: () => invoke('screen_dsl_open'),
      save: (request: SaveScreenDslFileRequest) => invoke('screen_dsl_save', { request })
    },
    spectrophotometerSerial: {
      list: () => invoke('serial_list'),
      open: (path: string) => invoke('serial_open', { path }),
      close: () => invoke('serial_close'),
      status: () => invoke('serial_status'),
      command: (request: SpectroSerialCommandRequest) => invoke('serial_command', { request })
    }
  };
}
