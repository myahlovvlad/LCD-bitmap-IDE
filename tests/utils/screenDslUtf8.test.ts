import { describe, expect, it } from 'vitest';
import { decodeScreenDslUtf8 } from '../../src/shared/screenDslFiles/utf8';

const bytes = (values: readonly number[]): Uint8Array => new Uint8Array(values);
const encoded = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('Screen DSL strict UTF-8 decoder', () => {
  it('decodes valid ASCII, Cyrillic, CJK and emoji', () => {
    const result = decodeScreenDslUtf8(encoded('abc Диагностика 诊断 😀'));
    expect(result.ok).toBe(true);
    expect(result.content).toBe('abc Диагностика 诊断 😀');
  });

  it('strips UTF-8 BOM', () => {
    const result = decodeScreenDslUtf8(bytes([0xef, 0xbb, 0xbf, ...encoded('format: x')]));
    expect(result.ok).toBe(true);
    expect(result.content).toBe('format: x');
  });

  it('rejects BOM-only files as empty', () => {
    const result = decodeScreenDslUtf8(bytes([0xef, 0xbb, 0xbf]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('SCREEN_DSL_FILE_EMPTY');
  });

  it('rejects empty files', () => {
    const result = decodeScreenDslUtf8(bytes([]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('SCREEN_DSL_FILE_EMPTY');
  });

  it('rejects invalid continuation bytes and truncated sequences', () => {
    expect(decodeScreenDslUtf8(bytes([0xc2, 0x20])).diagnostics[0].code).toBe('SCREEN_DSL_FILE_INVALID_UTF8');
    expect(decodeScreenDslUtf8(bytes([0xe2, 0x82])).diagnostics[0].code).toBe('SCREEN_DSL_FILE_INVALID_UTF8');
  });

  it('rejects UTF-16 BOMs', () => {
    expect(decodeScreenDslUtf8(bytes([0xff, 0xfe, 0x61, 0x00])).diagnostics[0].code).toBe('SCREEN_DSL_FILE_UTF16_UNSUPPORTED');
    expect(decodeScreenDslUtf8(bytes([0xfe, 0xff, 0x00, 0x61])).diagnostics[0].code).toBe('SCREEN_DSL_FILE_UTF16_UNSUPPORTED');
  });

  it('rejects NUL bytes as binary content', () => {
    const result = decodeScreenDslUtf8(bytes([0x61, 0x00, 0x62]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('SCREEN_DSL_FILE_BINARY_CONTENT');
  });
});
