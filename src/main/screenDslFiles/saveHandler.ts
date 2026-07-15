/**
 * Main-process IPC handler for Screen DSL file save operations.
 * Registered on SCREEN_DSL_FILE_SAVE_CHANNEL.
 *
 * Workflow:
 * 1. Runtime-validate IPC payload (no TypeScript trust)
 * 2. Sanitize suggested filename
 * 3. Open native save dialog
 * 4. User cancels → return { cancelled: true }
 * 5. Validate chosen extension and match against requested format
 * 6. Append missing canonical extension
 * 7. Atomically write UTF-8 content
 * 8. Return { cancelled: false, filename, byteLength }
 *
 * Security guarantees:
 * - Renderer supplies format/operation/suggestedFilename/content only
 * - Renderer never supplies the final path (comes from dialog)
 * - Suggested filename re-sanitized in main before dialog
 * - Content size validated before write
 * - Atomic write: temp → rename
 */

import type { Dialog } from 'electron';
import path from 'node:path';
import type { SaveScreenDslFileRequest, SaveScreenDslFileResult } from '../../shared/screenDslFiles/contracts.js';
import { createSafeScreenDslFilename } from '../../shared/screenDslFiles/filename.js';
import { validateScreenDslFileSize, ensureCanonicalExtension, validateExtensionMatchesFormat } from '../../shared/screenDslFiles/validation.js';
import { atomicWriteUtf8 } from './atomicWrite.js';
import {
  SCREEN_DSL_FILE_INVALID_IPC_PAYLOAD,
  SCREEN_DSL_FILE_WRITE_FAILED,
  SCREEN_DSL_FILE_RENAME_FAILED,
  SCREEN_DSL_FILE_INTERNAL_ERROR
} from '../../shared/screenDslFiles/diagnosticCodes.js';

const ALLOWED_FORMATS = new Set(['yaml', 'json']);
const ALLOWED_OPERATIONS = new Set(['canonical-export', 'draft-save']);

/** Runtime-validate the IPC payload from the renderer. */
function validatePayload(raw: unknown): SaveScreenDslFileRequest | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  // Reject prototype-pollution keys
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return null;
  }

  const { format, operation, suggestedFilename, content } = obj;

  if (typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) return null;
  if (typeof operation !== 'string' || !ALLOWED_OPERATIONS.has(operation)) return null;
  if (typeof suggestedFilename !== 'string' || suggestedFilename.length === 0 || suggestedFilename.length > 255) return null;
  if (typeof content !== 'string') return null;

  // Extra keys not allowed — no functions, no path field, etc.
  const allowedKeys = new Set(['format', 'operation', 'suggestedFilename', 'content']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) return null;
  }

  return { format, operation, suggestedFilename, content } as SaveScreenDslFileRequest;
}

export async function handleScreenDslFileSave(dialog: Dialog, raw: unknown): Promise<SaveScreenDslFileResult> {
  const payload = validatePayload(raw);
  if (!payload) {
    return {
      cancelled: false,
      diagnostics: [{
        code: SCREEN_DSL_FILE_INVALID_IPC_PAYLOAD,
        severity: 'error',
        message: 'Invalid IPC payload for Screen DSL file save.'
      }]
    };
  }

  // Validate content size before dialog
  const contentBytes = Buffer.from(payload.content, 'utf-8');
  const sizeErrors = validateScreenDslFileSize(contentBytes.length);
  if (sizeErrors.length > 0) {
    return { cancelled: false, diagnostics: sizeErrors };
  }

  // Re-sanitize suggested filename in main (renderer-supplied, untrusted)
  const safeName = createSafeScreenDslFilename(
    payload.suggestedFilename,
    payload.format as 'yaml' | 'json'
  );

  const result = await dialog.showSaveDialog({
    title: 'Export Screen DSL File',
    defaultPath: safeName,
    filters: payload.format === 'json'
      ? [{ name: 'Screen DSL JSON', extensions: ['json'] }]
      : [{ name: 'Screen DSL YAML', extensions: ['yaml', 'yml'] }]
  });

  if (result.canceled || !result.filePath) {
    return { cancelled: true };
  }

  const chosenBasename = path.basename(result.filePath);
  const chosenExtension = validateExtensionMatchesFormat(chosenBasename, payload.format as 'yaml' | 'json');
  const hasExplicitExtension = chosenBasename.includes('.');
  if (chosenExtension.length > 0 && hasExplicitExtension) {
    return { cancelled: false, diagnostics: chosenExtension };
  }

  // Append missing canonical extension if dialog stripped it or user omitted it.
  const finalPath = hasExplicitExtension
    ? result.filePath
    : ensureCanonicalExtension(result.filePath, payload.format as 'yaml' | 'json');
  const basename = path.basename(finalPath);

  // Validate chosen extension matches format
  const mismatchErrors = validateExtensionMatchesFormat(basename, payload.format as 'yaml' | 'json');
  if (mismatchErrors.length > 0) {
    return { cancelled: false, diagnostics: mismatchErrors };
  }

  // Atomic write
  const writeResult = await atomicWriteUtf8(finalPath, payload.content);
  if (!writeResult.ok) {
    const code = writeResult.errorCode === 'RENAME_FAILED'
      ? SCREEN_DSL_FILE_RENAME_FAILED
      : SCREEN_DSL_FILE_WRITE_FAILED;
    return {
      cancelled: false,
      diagnostics: [{ code, severity: 'error', message: writeResult.message ?? 'Write failed.' }]
    };
  }

  return {
    cancelled: false,
    filename: basename,   // basename only
    byteLength: writeResult.byteLength
  };
}
