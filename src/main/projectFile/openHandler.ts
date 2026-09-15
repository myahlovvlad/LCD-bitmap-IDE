/**
 * Main-process IPC handler for native project (.lcdproj) file open.
 * Registered on PROJECT_FILE_OPEN_CHANNEL.
 *
 * Security guarantees mirror screenDslFiles: the renderer never supplies a
 * path — it comes from the native dialog only — and only a basename is
 * returned. On success, the resolved path is remembered in-process so a
 * later "Save" can write back to it directly.
 */

import type { Dialog } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { OpenProjectFileResult } from '../../shared/projectFile/contracts.js';
import { PROJECT_FILE_IS_DIRECTORY, PROJECT_FILE_READ_FAILED, PROJECT_FILE_TOO_LARGE } from '../../shared/projectFile/diagnosticCodes.js';
import { setCurrentProjectPath } from './currentPath.js';

const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;

export async function handleProjectFileOpen(dialog: Dialog): Promise<OpenProjectFileResult> {
  const result = await dialog.showOpenDialog({
    title: 'Open Project',
    properties: ['openFile'],
    filters: [{ name: 'LCD Bitmap Project', extensions: ['lcdproj', 'json'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  const filePath = result.filePaths[0];
  const basename = path.basename(filePath);

  let fileStats: Awaited<ReturnType<typeof stat>>;
  try {
    fileStats = await stat(filePath);
  } catch (err: unknown) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_READ_FAILED, severity: 'error', message: err instanceof Error ? err.message : String(err) }] };
  }

  if (fileStats.isDirectory()) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_IS_DIRECTORY, severity: 'error', message: `"${basename}" is a directory.` }] };
  }

  if (fileStats.size > MAX_PROJECT_FILE_BYTES) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_TOO_LARGE, severity: 'error', message: `"${basename}" exceeds the ${MAX_PROJECT_FILE_BYTES}-byte limit.` }] };
  }

  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_READ_FAILED, severity: 'error', message: err instanceof Error ? err.message : String(err) }] };
  }

  setCurrentProjectPath(filePath);

  return {
    cancelled: false,
    filename: basename,
    content,
    byteLength: Buffer.byteLength(content, 'utf8')
  };
}
