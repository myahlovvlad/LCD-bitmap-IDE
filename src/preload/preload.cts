import { contextBridge, ipcRenderer } from 'electron';
import type { SaveScreenDslFileRequest } from '../shared/screenDslFiles/contracts.js';
import { SCREEN_DSL_FILE_OPEN_CHANNEL, SCREEN_DSL_FILE_SAVE_CHANNEL } from '../shared/screenDslFiles/channels.js';

const ALLOWED_SEND_CHANNELS = new Set(['api:project-state', 'api:runtime-state', 'api:mutate-res']);

contextBridge.exposeInMainWorld('spectroDesigner', {
  platform: process.platform,
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard-write', text),
  manualExportPdf: (html: string, filename: string) => ipcRenderer.invoke('manual-export-pdf', html, filename),

  // Narrow one-way send (state push, mutation responses)
  ipcSend: (channel: string, payload: unknown) => {
    if (ALLOWED_SEND_CHANNELS.has(channel)) {
      ipcRenderer.send(channel, payload);
    }
  },

  // Renderer registers a handler for mutation requests from main → renderer
  onMutateRequest: (
    handler: (requestId: string, action: string, payload: unknown) => void
  ) => {
    ipcRenderer.on('api:mutate-req', (_event, data: { requestId: string; action: string; payload: unknown }) => {
      handler(data.requestId, data.action, data.payload);
    });
  },

  // Narrow Screen DSL file API — no generic invoke, no arbitrary path, no raw ipcRenderer
  screenDslFiles: {
    open: () => ipcRenderer.invoke(SCREEN_DSL_FILE_OPEN_CHANNEL),
    save: (request: SaveScreenDslFileRequest) => ipcRenderer.invoke(SCREEN_DSL_FILE_SAVE_CHANNEL, request)
  }
});
