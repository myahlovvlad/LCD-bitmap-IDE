/**
 * Extension and file-size validation for Screen DSL files.
 * Pure utility — no Electron, no fs, no Node.js-only APIs.
 *
 * Extension policy:
 * - Canonical: .lcdscreen.yaml / .lcdscreen.yml / .lcdscreen.json
 * - Comparison is case-insensitive (Windows filesystem)
 * - Compound extension checked in full
 * - Dangerous double extension (e.g. .yaml.exe) rejected
 * - No extension rejected
 *
 * Size policy:
 * - Max SCREEN_DSL_MAX_FILE_BYTES (enforced before read in main process)
 * - Empty file caught by UTF-8 decoder
 */

import type { ScreenDslFileFormat, ScreenDslFileDiagnostic } from './contracts.js';
import {
  SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION,
  SCREEN_DSL_FILE_FORMAT_EXTENSION_MISMATCH,
  SCREEN_DSL_FILE_TOO_LARGE
} from './diagnosticCodes.js';

/** Maximum allowed file size in bytes (512 KB). */
export const SCREEN_DSL_MAX_FILE_BYTES = 512 * 1024;

/** Allowed compound extensions mapped to format. Case-insensitive. */
const ALLOWED_EXTENSIONS: ReadonlyArray<{ ext: string; format: ScreenDslFileFormat }> = [
  { ext: '.lcdscreen.yaml', format: 'yaml' },
  { ext: '.lcdscreen.yml',  format: 'yaml' },
  { ext: '.lcdscreen.json', format: 'json' },
  // Import-only aliases (non-canonical but accepted on open)
  { ext: '.yaml', format: 'yaml' },
  { ext: '.yml',  format: 'yaml' },
  { ext: '.json', format: 'json' }
];

export interface ValidateExtensionResult {
  readonly ok: boolean;
  readonly format?: ScreenDslFileFormat;
  readonly diagnostics: readonly ScreenDslFileDiagnostic[];
}

/**
 * Determine whether a filename has a supported Screen DSL extension.
 * Returns the inferred format when valid.
 *
 * @param filename - basename only (no path component)
 */
export function validateScreenDslExtension(filename: string): ValidateExtensionResult {
  if (!filename || filename.length === 0) {
    return {
      ok: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION, severity: 'error', message: 'Filename is empty.' }]
    };
  }

  const lc = filename.toLowerCase();

  // Reject files that have a suspicious dangerous extension after the DSL extension
  // e.g. ".lcdscreen.yaml.exe" or ".yaml.bat"
  const dangerousExts = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.ps1',
    '.sh', '.py', '.rb', '.pl', '.php', '.jar', '.msi', '.dll', '.so', '.dylib'
  ];
  for (const d of dangerousExts) {
    if (lc.endsWith(d)) {
      return {
        ok: false,
        diagnostics: [{
          code: SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION,
          severity: 'error',
          message: `Dangerous file extension detected: ${filename}`
        }]
      };
    }
  }

  // Check canonical and alias extensions (longest match first)
  for (const { ext, format } of ALLOWED_EXTENSIONS) {
    if (lc.endsWith(ext)) {
      return { ok: true, format, diagnostics: [] };
    }
  }

  return {
    ok: false,
    diagnostics: [{
      code: SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION,
      severity: 'error',
      message: `Unsupported extension for "${filename}". Expected .lcdscreen.yaml, .lcdscreen.yml, or .lcdscreen.json.`
    }]
  };
}

/**
 * Validate that actual content byte length does not exceed the limit.
 */
export function validateScreenDslFileSize(byteLength: number): readonly ScreenDslFileDiagnostic[] {
  if (byteLength > SCREEN_DSL_MAX_FILE_BYTES) {
    return [{
      code: SCREEN_DSL_FILE_TOO_LARGE,
      severity: 'error',
      message: `File is ${byteLength} bytes, which exceeds the ${SCREEN_DSL_MAX_FILE_BYTES}-byte limit.`
    }];
  }
  return [];
}

/**
 * Validate that the chosen save extension matches the requested format.
 * Used when user selects a custom filename in a save dialog.
 */
export function validateExtensionMatchesFormat(
  filename: string,
  format: ScreenDslFileFormat
): readonly ScreenDslFileDiagnostic[] {
  const result = validateScreenDslExtension(filename);
  if (!result.ok) return result.diagnostics;
  if (result.format !== format) {
    return [{
      code: SCREEN_DSL_FILE_FORMAT_EXTENSION_MISMATCH,
      severity: 'error',
      message: `Extension of "${filename}" implies format "${result.format}" but operation requires "${format}".`
    }];
  }
  return [];
}

/**
 * Append the canonical extension for a given format if not already present.
 * Used in the save dialog to ensure the correct extension is applied.
 */
export function ensureCanonicalExtension(filename: string, format: ScreenDslFileFormat): string {
  const canonical = format === 'json' ? '.lcdscreen.json' : '.lcdscreen.yaml';
  const lc = filename.toLowerCase();
  if (lc.endsWith('.lcdscreen.yaml') || lc.endsWith('.lcdscreen.yml') || lc.endsWith('.lcdscreen.json')) {
    return filename;
  }
  // Strip bare extension if present
  for (const bare of ['.yaml', '.yml', '.json']) {
    if (lc.endsWith(bare)) {
      return `${filename.slice(0, filename.length - bare.length)}${canonical}`;
    }
  }
  return `${filename}${canonical}`;
}
