import { describe, expect, it } from 'vitest';
import {
  ensureCanonicalExtension,
  SCREEN_DSL_MAX_FILE_BYTES,
  validateExtensionMatchesFormat,
  validateScreenDslExtension,
  validateScreenDslFileSize
} from '../../src/shared/screenDslFiles/validation';

describe('Screen DSL file validation', () => {
  it('accepts canonical and import-alias extensions case-insensitively', () => {
    expect(validateScreenDslExtension('screen.lcdscreen.yaml')).toMatchObject({ ok: true, format: 'yaml' });
    expect(validateScreenDslExtension('screen.LCDSCREEN.YML')).toMatchObject({ ok: true, format: 'yaml' });
    expect(validateScreenDslExtension('screen.lcdscreen.json')).toMatchObject({ ok: true, format: 'json' });
    expect(validateScreenDslExtension('screen.yaml')).toMatchObject({ ok: true, format: 'yaml' });
    expect(validateScreenDslExtension('screen.json')).toMatchObject({ ok: true, format: 'json' });
  });

  it('rejects missing, unsupported and dangerous double extensions', () => {
    expect(validateScreenDslExtension('').diagnostics[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
    expect(validateScreenDslExtension('screen').diagnostics[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
    expect(validateScreenDslExtension('screen.txt').diagnostics[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
    expect(validateScreenDslExtension('screen.lcdscreen.yaml.exe').diagnostics[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
    expect(validateScreenDslExtension('screen.yaml.js').diagnostics[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
  });

  it('validates extension and requested format match', () => {
    expect(validateExtensionMatchesFormat('screen.lcdscreen.yaml', 'yaml')).toEqual([]);
    expect(validateExtensionMatchesFormat('screen.lcdscreen.json', 'yaml')[0].code).toBe('SCREEN_DSL_FILE_FORMAT_EXTENSION_MISMATCH');
  });

  it('appends canonical extension only when missing', () => {
    expect(ensureCanonicalExtension('screen', 'yaml')).toBe('screen.lcdscreen.yaml');
    expect(ensureCanonicalExtension('screen.yaml', 'yaml')).toBe('screen.lcdscreen.yaml');
    expect(ensureCanonicalExtension('screen.lcdscreen.json', 'json')).toBe('screen.lcdscreen.json');
  });

  it('enforces byte-size limit', () => {
    expect(validateScreenDslFileSize(0)).toEqual([]);
    expect(validateScreenDslFileSize(SCREEN_DSL_MAX_FILE_BYTES)).toEqual([]);
    expect(validateScreenDslFileSize(SCREEN_DSL_MAX_FILE_BYTES + 1)[0].code).toBe('SCREEN_DSL_FILE_TOO_LARGE');
  });
});
