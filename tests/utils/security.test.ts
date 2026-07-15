import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_FILE_BYTES } from '../../src/shared/constants/display';
import { assertImportFileSize, sanitizeFilename, sanitizePlainText } from '../../src/shared/lib/security';

describe('security helpers', () => {
  it('accepts policy-sized files and rejects oversized files', () => {
    expect(() => assertImportFileSize({ size: MAX_IMPORT_FILE_BYTES } as File)).not.toThrow();
    expect(() => assertImportFileSize({ size: MAX_IMPORT_FILE_BYTES + 1 } as File)).toThrow(/too large/i);
  });

  it('sanitizes paths and uses a fallback for empty names', () => {
    expect(sanitizeFilename('../Экран 1?.lcdproj')).not.toMatch(/[\\/?:]/);
    expect(sanitizeFilename('***', 'fallback')).toBe('fallback');
  });

  it('removes control and HTML-sensitive characters and truncates metadata', () => {
    expect(sanitizePlainText('<A>\u0000BC', 3)).toBe('ABC');
  });
});
