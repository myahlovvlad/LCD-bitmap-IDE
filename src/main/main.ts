import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleScreenDslFileOpen } from './screenDslFiles/openHandler.js';
import { handleScreenDslFileSave } from './screenDslFiles/saveHandler.js';
import { SCREEN_DSL_FILE_OPEN_CHANNEL, SCREEN_DSL_FILE_SAVE_CHANNEL } from '../shared/screenDslFiles/channels.js';
import { startApiServer, stopApiServer, setMainWindow as setApiMainWindow } from './api/apiServer.js';
import { startMcpServer, stopMcpServer, setMcpMainWindow, setMcpProjectCache, setMcpRuntimeState } from './mcp/mcpServer.js';

// In CJS (esbuild bundle) __dirname is native; in ESM (tsc output) we derive it
declare const __dirname: string | undefined;  // native in CJS, undefined in ESM
const _dirname: string = typeof __dirname !== 'undefined' && __dirname
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

// Screen DSL file handlers — narrow, feature-specific (no generic filesystem bridge)
ipcMain.handle(SCREEN_DSL_FILE_OPEN_CHANNEL, () => handleScreenDslFileOpen(dialog));
ipcMain.handle(SCREEN_DSL_FILE_SAVE_CHANNEL, (_event, request: unknown) => handleScreenDslFileSave(dialog, request));

ipcMain.handle('clipboard-write', (_event, text: string) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

ipcMain.handle('manual-export-pdf', async (_event, html: string, filename: string) => {
  const pdfWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1400,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const data = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'custom',
        top: 0.45,
        bottom: 0.45,
        left: 0.45,
        right: 0.45
      }
    });
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export operation manual PDF',
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) {
      return false;
    }
    await writeFile(filePath, data);
    return true;
  } finally {
    pdfWindow.destroy();
  }
});

// IPC bridge: renderer pushes project state → main caches it for API/MCP
ipcMain.on('api:project-state', (_event, state: { project: unknown }) => {
  setMcpProjectCache(state.project);
});
ipcMain.on('api:runtime-state', (_event, runtimeState: { currentStateId: string | null; isRunning: boolean } | null) => {
  setMcpRuntimeState(runtimeState);
});

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'LCD-bitmap IDE',
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(_dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  setApiMainWindow(mainWindow);
  setMcpMainWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
    mainWindow.show();
  });

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Quit anyway / Выйти / 退出', 'Cancel / Отмена / 取消'],
      defaultId: 1,
      cancelId: 1,
      title: 'LCD-bitmap IDE',
      message: 'You have unsaved changes.\nВ проекте есть несохранённые изменения.\n您有未保存的更改。',
      detail: 'Closing now will discard them. Save your project first to avoid data loss.\nПри закрытии изменения будут потеряны. Сохраните проект перед выходом.\n关闭将丢弃更改，请先保存项目。'
    });
    if (choice === 0) {
      event.preventDefault();
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(_dirname, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  startApiServer(ipcMain);
  startMcpServer(ipcMain);
  await createWindow();
});

app.on('window-all-closed', () => {
  stopApiServer();
  stopMcpServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
