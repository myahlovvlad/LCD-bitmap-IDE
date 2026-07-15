/**
 * Strict UTF-8 decoding for Screen DSL files.
 * Pure utility — no Electron, no fs, no Node.js-only APIs.
 * Uses the Web Encoding API (TextDecoder), available in both browser
 * and Node.js 18+.
 *
 * Policy:
 * - Fatal decoding: invalid or truncated sequences throw, never silently
 *   replace with U+FFFD.
 * - UTF-16 LE/BE detection via BOM (FF FE or FE FF) — rejected with
 *   SCREEN_DSL_FILE_UTF16_UNSUPPORTED.
 * - UTF-8 BOM (EF BB BF) is stripped before returning content.
 * - NUL bytes (0x00) are rejected as binary-content indicator.
 * - Binary content detection: any byte in the non-printable non-BOM
 *   range that TextDecoder reports as valid but is unlikely in text
 *   is caught by the NUL check.
 * - No encoding autodetection beyond BOM.
 */

import {
  SCREEN_DSL_FILE_INVALID_UTF8,
  SCREEN_DSL_FILE_UTF16_UNSUPPORTED,
  SCREEN_DSL_FILE_BINARY_CONTENT,
  SCREEN_DSL_FILE_EMPTY
} from './diagnosticCodes.js';
import type { ScreenDslFileDiagnostic } from './contracts.js';

export interface DecodeScreenDslUtf8Result {
  readonly ok: boolean;
  readonly content?: string;
  readonly diagnostics: readonly ScreenDslFileDiagnostic[];
}

const UTF8_BOM = [0xEF, 0xBB, 0xBF] as const;
const UTF16_LE_BOM = [0xFF, 0xFE] as const;
const UTF16_BE_BOM = [0xFE, 0xFF] as const;

function startsWithBom(bytes: Uint8Array, bom: readonly number[]): boolean {
  if (bytes.length < bom.length) return false;
  return bom.every((b, i) => bytes[i] === b);
}

/**
 * Strictly decode a Uint8Array as UTF-8.
 * Returns ok=false with a diagnostic on any encoding error.
 */
export function decodeScreenDslUtf8(bytes: Uint8Array): DecodeScreenDslUtf8Result {
  if (bytes.length === 0) {
    return {
      ok: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_EMPTY, severity: 'error', message: 'File is empty.' }]
    };
  }

  // UTF-16 LE detection
  if (startsWithBom(bytes, UTF16_LE_BOM)) {
    return {
      ok: false,
      diagnostics: [{
        code: SCREEN_DSL_FILE_UTF16_UNSUPPORTED,
        severity: 'error',
        message: 'File is UTF-16 LE encoded. Screen DSL files must be UTF-8.'
      }]
    };
  }

  // UTF-16 BE detection
  if (startsWithBom(bytes, UTF16_BE_BOM)) {
    return {
      ok: false,
      diagnostics: [{
        code: SCREEN_DSL_FILE_UTF16_UNSUPPORTED,
        severity: 'error',
        message: 'File is UTF-16 BE encoded. Screen DSL files must be UTF-8.'
      }]
    };
  }

  // Detect UTF-8 BOM and strip it
  let decodeBytes = bytes;
  if (startsWithBom(bytes, UTF8_BOM)) {
    decodeBytes = bytes.subarray(3);
  }

  // Fatal UTF-8 decoding — throws on invalid/truncated sequences
  let text: string;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(decodeBytes);
  } catch {
    return {
      ok: false,
      diagnostics: [{
        code: SCREEN_DSL_FILE_INVALID_UTF8,
        severity: 'error',
        message: 'File contains invalid UTF-8 sequences (possibly truncated or binary content).'
      }]
    };
  }

  if (text.length === 0) {
    return {
      ok: false,
      diagnostics: [{ code: SCREEN_DSL_FILE_EMPTY, severity: 'error', message: 'File is empty.' }]
    };
  }

  // NUL byte check — indicative of binary content
  if (text.includes('\x00')) {
    return {
      ok: false,
      diagnostics: [{
        code: SCREEN_DSL_FILE_BINARY_CONTENT,
        severity: 'error',
        message: 'File contains NUL bytes. Screen DSL files must be plain text.'
      }]
    };
  }

  return { ok: true, content: text, diagnostics: [] };
}
