import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { handleScreenDslFileOpen } from './screenDslFiles/openHandler.js';
import { handleScreenDslFileSave } from './screenDslFiles/saveHandler.js';
import { SCREEN_DSL_FILE_OPEN_CHANNEL, SCREEN_DSL_FILE_SAVE_CHANNEL } from '../shared/screenDslFiles/channels.js';
import { startApiServer, stopApiServer, setMainWindow as setApiMainWindow } from './api/apiServer.js';
import { startMcpServer, stopMcpServer, setMcpMainWindow, setMcpProjectCache, setMcpRuntimeState } from './mcp/mcpServer.js';
import { registerSpectrophotometerSerialHandlers } from './spectrophotometerSerial/registerHandlers.js';

// The Electron entry point is emitted as CommonJS, where __dirname is native.
const _dirname = __dirname;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const STARTUP_PROJECT_MAX_BYTES = 25 * 1024 * 1024;

// Screen DSL file handlers — narrow, feature-specific (no generic filesystem bridge)
ipcMain.handle(SCREEN_DSL_FILE_OPEN_CHANNEL, () => handleScreenDslFileOpen(dialog));
ipcMain.handle(SCREEN_DSL_FILE_SAVE_CHANNEL, (_event, request: unknown) => handleScreenDslFileSave(dialog, request));
const spectrophotometerSerial = registerSpectrophotometerSerialHandlers(ipcMain);

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

  const startupProjectPath = readStartupProjectPath(process.argv);
  if (startupProjectPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      void sendStartupProject(mainWindow, startupProjectPath);
    });
  }

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(_dirname, '../renderer/index.html'));
}

function readStartupProjectPath(args: readonly string[]): string | null {
  const namedArgument = args.find((arg) => arg.startsWith('--open-project='));
  const candidate = namedArgument
    ? namedArgument.slice('--open-project='.length)
    : args.find((arg) => !arg.startsWith('-') && /\.lcdproj$|\.json$/i.test(arg));
  return candidate ? path.resolve(candidate) : null;
}

async function sendStartupProject(mainWindow: BrowserWindow, projectPath: string): Promise<void> {
  try {
    const info = await stat(projectPath);
    if (!info.isFile() || info.size > STARTUP_PROJECT_MAX_BYTES) {
      throw new Error('Project file is missing or exceeds the 25 MB startup limit.');
    }
    const content = await readFile(projectPath, 'utf8');
    mainWindow.webContents.send('project:startup-open', {
      filename: path.basename(projectPath),
      content
    });
  } catch (error) {
    console.error(`[project] startup open failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

app.whenReady().then(async () => {
  startApiServer(ipcMain);
  startMcpServer(ipcMain);
  await createWindow();
});

app.on('window-all-closed', () => {
  void spectrophotometerSerial.close();
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
