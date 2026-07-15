/**
 * @module shared/lib/security
 * @description Small import/export security helpers shared by project IO,
 * screen IO, image importer and firmware export.
 */

import { MAX_IMPORT_FILE_BYTES } from '../constants/display.js';

/** Throws a user-facing error when a selected file is larger than the policy limit. */
export function assertImportFileSize(file: File): void {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`File is too large. Maximum accepted size is ${MAX_IMPORT_FILE_BYTES} bytes.`);
  }
}

/** Sanitizes filenames for local export without leaking path separators. */
export function sanitizeFilename(value: string, fallback = 'lcd-project'): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

/** Removes HTML-sensitive control characters from user-facing metadata fields. */
export function sanitizePlainText(value: string, maxLength = 240): string {
  return value.replace(/[\u0000-\u001f<>]/g, '').slice(0, maxLength);
}
