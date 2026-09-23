import { describe, expect, it } from 'vitest';
import { defaultFontRenderer } from '../../src/domain/fonts';

// Regression test: the built-in font previously had no glyph for the degree
// sign (°, U+00B0), even though it's routinely needed for spectrophotometer
// units like "°C". A missing glyph doesn't throw or surface an error to
// callers (including MCP tool calls that write screen text) — FontRenderer
// silently falls back to a blank space glyph, so the failure was invisible
// until someone looked at the rendered bitmap.
describe('built-in font glyph coverage', () => {
  it('covers the degree sign in both font variants, distinct from the space fallback', () => {
    for (const variant of ['1', '2'] as const) {
      expect(defaultFontRenderer.hasGlyph('°', variant)).toBe(true);
      const degree = defaultFontRenderer.getGlyph('°', variant);
      const space = defaultFontRenderer.getGlyph(' ', variant);
      expect(degree.data).not.toEqual(space.data);
      expect(degree.data.some((row) => row.includes('#'))).toBe(true);
    }
  });

  it('covers lambda and percent, used throughout the spectrophotometer screens', () => {
    for (const variant of ['1', '2'] as const) {
      expect(defaultFontRenderer.hasGlyph('λ', variant)).toBe(true);
      expect(defaultFontRenderer.hasGlyph('%', variant)).toBe(true);
    }
  });
});
