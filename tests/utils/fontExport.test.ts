import { describe, expect, it } from 'vitest';
import type { GlyphSet } from '../../src/renderer/core/fonts';
import { exportGlyphSetToBdf } from '../../src/renderer/utils/fontExport';
import { parseBdfFont } from '../../src/renderer/utils/fontImport';

describe('exportGlyphSetToBdf', () => {
  const sample: GlyphSet = {
    A: { width: 5, topOffset: 1, data: ['.###.', '#...#', '#####', '#...#', '#...#'] },
    ' ': { width: 3, topOffset: 0, data: ['...', '...', '...'] },
    'Ω': { width: 4, topOffset: 0, data: ['.##.', '#..#', '#..#', '####'] },
    W: { width: 64, data: ['#'.repeat(64)] },
    N: { width: 1, nominalHeight: 8, data: ['#'] }
  };

  it('produces a well-formed BDF document with safe Unicode glyph names', () => {
    const bdf = exportGlyphSetToBdf(sample, { fontName: 'unit test' });

    expect(bdf).toContain('STARTFONT 2.1');
    expect(bdf).toContain('CHARS 5');
    expect(bdf).toContain('STARTCHAR A');
    expect(bdf).toContain('STARTCHAR space');
    expect(bdf).toContain('STARTCHAR uni03A9');
    expect(bdf).toContain('FFFFFFFFFFFFFFFF');
    expect(bdf.trim().endsWith('ENDFONT')).toBe(true);
  });

  it('round-trips bitmap rows, widths, and top offsets through the BDF importer', () => {
    const reimported = parseBdfFont(exportGlyphSetToBdf(sample));

    for (const [char, glyph] of Object.entries(sample)) {
      expect(reimported[char]?.data).toEqual(glyph.data);
      expect(reimported[char]?.width).toBe(glyph.width);
      expect(reimported[char]?.topOffset).toBe(glyph.topOffset ?? 0);
    }
  });

  it('rejects empty glyph sets', () => {
    expect(() => exportGlyphSetToBdf({})).toThrow('empty glyph set');
  });
});
