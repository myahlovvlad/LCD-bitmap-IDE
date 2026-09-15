/**
 * Main-process IPC handler for native project (.lcdproj) file save.
 * Registered on PROJECT_FILE_SAVE_CHANNEL.
 *
 * Workflow:
 * 1. If a project path is already known (opened or previously saved this
 *    session) and forceDialog is not set, write directly to it — no dialog,
 *    matching a real desktop editor's "Save" semantics.
 * 2. Otherwise (new/unbound project, or explicit "Save As"), show a native
 *    save dialog and remember the chosen path for subsequent saves.
 *
 * Security guarantees mirror screenDslFiles: the renderer supplies content
 * and a suggested filename only — the final path always comes from either
 * the previously-tracked open/save path or a fresh dialog result, never
 * directly from the renderer. Writes are atomic (temp file + rename).
 */

import type { Dialog } from 'electron';
import path from 'node:path';
import type { SaveProjectFileRequest, SaveProjectFileResult } from '../../shared/projectFile/contracts.js';
import { PROJECT_FILE_INVALID_IPC_PAYLOAD, PROJECT_FILE_RENAME_FAILED, PROJECT_FILE_TOO_LARGE, PROJECT_FILE_WRITE_FAILED } from '../../shared/projectFile/diagnosticCodes.js';
import { atomicWriteUtf8 } from '../screenDslFiles/atomicWrite.js';
import { getCurrentProjectPath, setCurrentProjectPath } from './currentPath.js';

const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;

function validatePayload(raw: unknown): SaveProjectFileRequest | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return null;
  }
  const { suggestedFilename, content, forceDialog } = obj;
  if (typeof suggestedFilename !== 'string' || suggestedFilename.length === 0 || suggestedFilename.length > 255) return null;
  if (typeof content !== 'string') return null;
  if (forceDialog !== undefined && typeof forceDialog !== 'boolean') return null;
  const allowedKeys = new Set(['suggestedFilename', 'content', 'forceDialog']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) return null;
  }
  return { suggestedFilename, content, forceDialog };
}

export async function handleProjectFileSave(dialog: Dialog, raw: unknown): Promise<SaveProjectFileResult> {
  const payload = validatePayload(raw);
  if (!payload) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_INVALID_IPC_PAYLOAD, severity: 'error', message: 'Invalid IPC payload for project file save.' }] };
  }

  const contentBytes = Buffer.from(payload.content, 'utf-8');
  if (contentBytes.length > MAX_PROJECT_FILE_BYTES) {
    return { cancelled: false, diagnostics: [{ code: PROJECT_FILE_TOO_LARGE, severity: 'error', message: `Project content exceeds the ${MAX_PROJECT_FILE_BYTES}-byte limit.` }] };
  }

  const knownPath = payload.forceDialog ? null : getCurrentProjectPath();
  let targetPath = knownPath;

  if (!targetPath) {
    const suggested = payload.suggestedFilename.endsWith('.lcdproj') ? payload.suggestedFilename : `${payload.suggestedFilename}.lcdproj`;
    const result = await dialog.showSaveDialog({
      title: 'Save Project',
      defaultPath: suggested,
      filters: [{ name: 'LCD Bitmap Project', extensions: ['lcdproj'] }]
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }
    targetPath = result.filePath;
  }

  const writeResult = await atomicWriteUtf8(targetPath, payload.content);
  if (!writeResult.ok) {
    const code = writeResult.errorCode === 'RENAME_FAILED' ? PROJECT_FILE_RENAME_FAILED : PROJECT_FILE_WRITE_FAILED;
    return { cancelled: false, diagnostics: [{ code, severity: 'error', message: writeResult.message ?? 'Write failed.' }] };
  }

  setCurrentProjectPath(targetPath);

  return {
    cancelled: false,
    filename: path.basename(targetPath),
    byteLength: writeResult.byteLength,
    savedToKnownPath: Boolean(knownPath)
  };
}
