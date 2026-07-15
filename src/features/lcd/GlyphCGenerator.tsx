import type React from 'react';
import { useMemo, useState } from 'react';
import { FontRenderer, type FontGlyphs, type FontVariantKey, type Glyph } from '../../renderer/core/fonts';
import { copyToClipboard } from '../../renderer/utils/clipboard';

export function GlyphCGenerator({ fontGlyphs }: { fontGlyphs: FontGlyphs }): React.ReactElement {
  const [input, setInput] = useState('ABC123');
  const [variant, setVariant] = useState<FontVariantKey>('1');
  const [prefix, setPrefix] = useState('lcd_font');
  const output = useMemo(() => generateGlyphHeader(fontGlyphs, input, variant, prefix), [fontGlyphs, input, prefix, variant]);
  return (
    <section className="glyph-c-generator">
      <div className="glyph-c-controls">
        <label>Characters<textarea value={input} onChange={(event) => setInput(event.target.value)} /></label>
        <label>Array prefix<input value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label>
        <label>
          Font
          <select value={variant} onChange={(event) => setVariant(event.target.value as FontVariantKey)}>
            <option value="1">Font 1</option>
            <option value="2">Font 2</option>
          </select>
        </label>
        <div className="glyph-c-actions">
          <button type="button" onClick={() => void copyToClipboard(output)}>Copy C</button>
          <button type="button" onClick={() => downloadText(`${sanitizeIdentifier(prefix)}.h`, output)}>Download header</button>
        </div>
      </div>
      <div className="glyph-c-output"><h3>Generated C</h3><pre>{output}</pre></div>
    </section>
  );
}

function generateGlyphHeader(fontGlyphs: FontGlyphs, chars: string, variant: FontVariantKey, prefix: string): string {
  const renderer = new FontRenderer(fontGlyphs);
  const unique = Array.from(new Set(Array.from(chars))).filter((char) => char !== '\n' && char !== '\r');
  const body = unique.map((char) => glyphToCArray(renderer.getGlyph(char, variant), char, prefix)).join('\n\n');
  return ['#pragma once', '#include <stdint.h>', '', body || '/* No glyphs selected. */'].join('\n');
}

function glyphToCArray(glyph: Glyph, char: string, prefix: string): string {
  const name = `${sanitizeIdentifier(prefix)}_U${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') ?? '0000'}`;
  const width = Math.max(1, glyph.width);
  const rows = glyph.data.map((row) => row.padEnd(width, '.').slice(0, width));
  return [
    `/* ${JSON.stringify(char)} width=${width}, height=${rows.length} */`,
    `static const uint8_t ${name}[${rows.length}] = {`,
    rows.map((row) => `  0b${row.replace(/\./g, '0').replace(/#/g, '1')},`).join('\n'),
    '};'
  ].join('\n');
}

function sanitizeIdentifier(value: string): string {
  const cleaned = String(value || 'glyph').replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/x-c' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
