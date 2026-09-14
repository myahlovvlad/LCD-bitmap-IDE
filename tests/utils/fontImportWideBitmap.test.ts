import { describe, expect, it } from 'vitest';
import { createMutableFontGlyphs, FontRenderer } from '../../src/renderer/core/fonts';
import { applyImportedFont, parseBdfFont, summarizeImportedFont } from '../../src/renderer/utils/fontImport';

describe('custom font import integrity', () => {
  it('preserves BDF bitmap rows wider than the JavaScript safe integer width', () => {
    const glyphs = parseBdfFont(`STARTFONT 2.1
STARTCHAR WIDE
ENCODING 87
DWIDTH 64 0
BBX 64 2 0 0
BITMAP
FFFFFFFFFFFFFFFF
8000000000000001
ENDCHAR
ENDFONT`);

    expect(glyphs.W.data[0]).toBe('#'.repeat(64));
    expect(glyphs.W.data[1]).toBe(`#${'.'.repeat(62)}#`);
    expect(glyphs.W.width).toBe(64);

    const renderer = new FontRenderer(applyImportedFont(createMutableFontGlyphs(), '1', glyphs, 'replace'));
    expect(renderer.renderTextBitmask('W', '1')[0]).toEqual(Array.from({ length: 64 }, () => true));
  });

  it('reports dimensions and a deterministic preview after import', () => {
    const summary = summarizeImportedFont({
      A: { width: 3, data: ['.#.', '#.#'] },
      B: { width: 5, data: ['####.', '#...#', '####.'] }
    });

    expect(summary).toEqual({
      glyphCount: 2,
      minWidth: 3,
      maxWidth: 5,
      minHeight: 2,
      maxHeight: 3,
      previewCharacters: 'AB'
    });
  });
});
