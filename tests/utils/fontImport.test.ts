import { describe, expect, it } from 'vitest';
import { createMutableFontGlyphs } from '../../src/renderer/core/fonts';
import { applyImportedFont, parseAppFntFont, parseBdfFont } from '../../src/renderer/utils/fontImport';

describe('font import utils', () => {
  it('imports a minimal BDF glyph', () => {
    const glyphs = parseBdfFont([
      'STARTFONT 2.1',
      'STARTCHAR A',
      'ENCODING 65',
      'DWIDTH 3 0',
      'BBX 3 3 0 0',
      'BITMAP',
      '80',
      'E0',
      'A0',
      'ENDCHAR',
      'ENDFONT'
    ].join('\n'));

    expect(glyphs.A.width).toBe(3);
    expect(glyphs.A.data).toEqual(['#..', '###', '#.#']);
  });

  it('imports the app .fnt text format', () => {
    const glyphs = parseAppFntFont([
      'glyph Z',
      '###',
      '..#',
      '.#.',
      'endglyph'
    ].join('\n'));

    expect(glyphs.Z.data).toEqual(['###', '..#', '.#.']);
  });

  it('applies merge and replace modes', () => {
    const base = createMutableFontGlyphs();
    const merged = applyImportedFont(base, '1', { A: { width: 1, data: ['#'] } }, 'merge');
    expect(Object.keys(merged['1']).length).toBeGreaterThan(1);

    const replaced = applyImportedFont(base, '1', { A: { width: 1, data: ['#'] } }, 'replace');
    expect(Object.keys(replaced['1'])).toEqual(['A']);
  });
});
