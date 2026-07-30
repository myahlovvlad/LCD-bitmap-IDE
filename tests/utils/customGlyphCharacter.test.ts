import { describe, expect, it } from 'vitest';
import { normalizeCustomGlyphCharacter } from '../../src/renderer/components/LCDCanvasEditor';

describe('custom LCD glyph character input', () => {
  it('accepts one Unicode character including requested punctuation', () => {
    expect(normalizeCustomGlyphCharacter('?')).toBe('?');
    expect(normalizeCustomGlyphCharacter(' ! ')).toBe('!');
    expect(normalizeCustomGlyphCharacter('λ')).toBe('λ');
  });

  it('rejects empty and multi-character input', () => {
    expect(normalizeCustomGlyphCharacter('')).toBeNull();
    expect(normalizeCustomGlyphCharacter('?!')).toBeNull();
  });
});
