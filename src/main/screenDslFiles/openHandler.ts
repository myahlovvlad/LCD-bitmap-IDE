/**
 * Main-process IPC handler for Screen DSL file open operations.
 * Registered on the SCREEN_DSL_FILE_OPEN_CHANNEL channel.
 *
 * Workflow:
 * 1. Open native file dialog (restricted to .lcdscreen.yaml/.yml/.json)
 * 2. User cancels → return { cancelled: true }
 * 3. Stat the selected path (reject directory, check size before read)
 * 4. Read bytes
 * 5. Validate extension
 * 6. Validate byte length
 * 7. Decode UTF-8 (fatal, UTF-16 rejection, NUL rejection)
 * 8. Return { cancelled: false, format, filename, content, byteLength }
 *
 * Security guarantees:
 * - Renderer never supplies a path — path comes from dialog only
 * - No generic filesystem bridge
 * - Extension validated before decode
 * - Size validated before read
 * - Absolute path NOT returned to renderer (only basename)
 */

import type { Dialog } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { OpenScreenDslFileResult } from '../../shared/screenDslFiles/contracts.js';
import { validateScreenDslExtension, validateScreenDslFileSize } from '../../shared/screenDslFiles/validation.js';
import { decodeScreenDslUtf8 } from '../../shared/screenDslFiles/utf8.js';
import {
  SCREEN_DSL_FILE_IS_DIRECTORY,
  SCREEN_DSL_FILE_TOO_LARGE,
  SCREEN_DSL_FILE_READ_FAILED,
  SCREEN_DSL_FILE_INTERNAL_ERROR
} from '../../shared/screenDslFiles/diagnosticCodes.js';

export async function handleScreenDslFileOpen(dialog: Dialog): Promise<OpenScreenDslFileResult> {
  const result = await dialog.showOpenDialog({
    title: 'Open Screen DSL File',
    properties: ['openFile'],
    filters: [
      { name: 'Screen DSL Files', extensions: ['lcdscreen.yaml', 'lcdscreen.yml', 'lcdscreen.json', 'yaml', 'yml', 'json'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  const filePath = result.filePaths[0];
  const basename = path.basename(filePath);

  // Validate extension before any I/O
  const extResult = validateScreenDslExtension(basename);
  if (!extResult.ok) {
    return { cancelled: false, diagnostics: extResult.diagnostics };
  }

  // Stat to reject directories and check size before reading
  let fileStats: Awaited<ReturnType<typeof stat>>;
  try {
    fileStats = await stat(filePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      cancelled: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_READ_FAILED, severity: 'error', message }]
    };
  }

  if (fileStats.isDirectory()) {
    return {
      cancelled: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_IS_DIRECTORY, severity: 'error', message: `"${basename}" is a directory.` }]
    };
  }

  const sizeErrors = validateScreenDslFileSize(fileStats.size);
  if (sizeErrors.length > 0) {
    return { cancelled: false, diagnostics: sizeErrors };
  }

  // Read bytes
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      cancelled: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_READ_FAILED, severity: 'error', message }]
    };
  }

  // Double-check actual byte length after read
  const actualSizeErrors = validateScreenDslFileSize(bytes.length);
  if (actualSizeErrors.length > 0) {
    return { cancelled: false, diagnostics: actualSizeErrors };
  }

  // Strict UTF-8 decode
  const decodeResult = decodeScreenDslUtf8(new Uint8Array(bytes));
  if (!decodeResult.ok) {
    return { cancelled: false, diagnostics: decodeResult.diagnostics };
  }

  return {
    cancelled: false,
    format: extResult.format,
    filename: basename,   // basename only — no absolute path returned to renderer
    content: decodeResult.content,
    byteLength: bytes.length
  };
}
