/**
 * Safe filename generation for Screen DSL file exports.
 * Pure utility — no Electron, no fs, no path, no Node.js.
 *
 * Policy:
 * - Removes Windows-illegal characters: < > : " / \ | ? *
 * - Removes ASCII control characters (0x00–0x1F)
 * - Prevents path traversal (..)
 * - Removes path separators and prefixes
 * - Trims trailing spaces and dots (Windows file system constraint)
 * - Bounded to MAX_STEM_LENGTH characters for the stem
 * - Preserves safe Unicode (Cyrillic, CJK, etc.) for display names
 * - Fallback stem is 'screen' when input is empty or only illegal chars
 * - Appends canonical extension once; normalizes duplicate extensions
 * - Windows reserved device names are prefixed with 'screen-'
 */

import type { ScreenDslFileFormat } from './contracts.js';

const MAX_STEM_LENGTH = 128;

const WINDOWS_ILLEGAL_RE = /[<>:"/\\|?*\x00-\x1F]/g;
const TRAILING_SPACE_DOT_RE = /[\s.]+$/;

// Windows reserved device names (case-insensitive, with optional numeric suffix)
const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL', 'CLOCK$',
  'COM0', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT0', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

const EXTENSION_FOR_FORMAT: Record<ScreenDslFileFormat, string> = {
  yaml: '.lcdscreen.yaml',
  json: '.lcdscreen.json'
};

function sanitizeStem(raw: string): string {
  const pathSegments = raw.split(/[\\/]+/).filter((segment) => segment.length > 0);
  const basename = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : raw;

  // Strip path prefixes, traversal and Windows drive prefixes.
  let stem = basename
    .replace(/^[A-Za-z]:/, '')
    .replace(/\.\./g, ' ')
    .replace(WINDOWS_ILLEGAL_RE, '')
    .replace(TRAILING_SPACE_DOT_RE, '')
    .trim();

  if (stem.length === 0) {
    return 'screen';
  }

  // Truncate stem
  if (stem.length > MAX_STEM_LENGTH) {
    // Truncate at character boundary (handles multi-byte Unicode)
    const arr = [...stem];
    stem = arr.slice(0, MAX_STEM_LENGTH).join('');
  }

  // Check Windows reserved device name
  const upper = stem.toUpperCase();
  if (WINDOWS_RESERVED.has(upper)) {
    stem = `screen-${stem}`;
  }

  // After trimming again (truncation may create trailing dot/space)
  stem = stem.replace(TRAILING_SPACE_DOT_RE, '').trim();
  return stem.length > 0 ? stem : 'screen';
}

function stripKnownExtensions(stem: string, ext: string): string {
  // Remove the canonical extension if already present (case-insensitive)
  const lc = stem.toLowerCase();
  const extLc = ext.toLowerCase();
  if (lc.endsWith(extLc)) {
    return stem.slice(0, stem.length - ext.length);
  }
  // Also strip bare .yaml / .json / .yml suffixes to avoid double extension
  const bareExts = ['.lcdscreen.yaml', '.lcdscreen.yml', '.lcdscreen.json', '.yaml', '.yml', '.json'];
  for (const bare of bareExts) {
    if (lc.endsWith(bare)) {
      return stem.slice(0, stem.length - bare.length);
    }
  }
  return stem;
}

/**
 * Generate a safe filename for a single-screen Screen DSL export.
 * @param screenName - raw screen name or ID (may contain unsafe characters)
 * @param format - 'yaml' | 'json'
 */
export function createSafeScreenDslFilename(
  screenName: string,
  format: ScreenDslFileFormat
): string {
  const ext = EXTENSION_FOR_FORMAT[format];
  const rawStem = stripKnownExtensions(screenName, ext);
  const stem = sanitizeStem(rawStem);
  return `${stem}${ext}`;
}

/**
 * Generate a safe filename for a multi-screen (project-level) Screen DSL export.
 * @param projectName - raw project name (may contain unsafe characters)
 * @param format - 'yaml' | 'json'
 */
export function createSafeScreenDslProjectFilename(
  projectName: string,
  format: ScreenDslFileFormat
): string {
  const ext = EXTENSION_FOR_FORMAT[format];
  const rawStem = stripKnownExtensions(projectName, ext);
  const stem = sanitizeStem(rawStem);
  return `${stem}-screens${ext}`;
}

/**
 * Returns the canonical extension for a given format.
 */
export function canonicalExtensionForFormat(format: ScreenDslFileFormat): string {
  return EXTENSION_FOR_FORMAT[format];
}
