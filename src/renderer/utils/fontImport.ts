import type { FontMetadata } from '../types/domain';
import type { FontGlyphs, FontVariantKey, Glyph, GlyphSet } from '../core/fonts';

export type FontImportFormat = 'bdf' | 'fnt';
export type FontMergeMode = 'merge' | 'replace';

export interface ImportedFont {
  metadata: FontMetadata;
  glyphs: GlyphSet;
}

export interface ImportFontOptions {
  filename: string;
  text: string;
  variant: FontVariantKey;
  format?: FontImportFormat;
  now?: string;
}

export function importFont(options: ImportFontOptions): ImportedFont {
  const format = options.format ?? detectFontFormat(options.filename);
  const glyphs = format === 'bdf' ? parseBdfFont(options.text) : parseAppFntFont(options.text);
  const createdAt = options.now ?? new Date().toISOString();

  return {
    metadata: {
      id: `font-${format}-${Date.now()}`,
      name: stripExtension(options.filename) || `${format.toUpperCase()} font`,
      sourceFormat: format,
      variant: options.variant,
      glyphCount: Object.keys(glyphs).length,
      createdAt
    },
    glyphs
  };
}

export function applyImportedFont(
  current: FontGlyphs,
  variant: FontVariantKey,
  glyphs: GlyphSet,
  mode: FontMergeMode
): FontGlyphs {
  return {
    ...current,
    [variant]: mode === 'replace' ? { ...glyphs } : { ...current[variant], ...glyphs }
  };
}

export function detectFontFormat(filename: string): FontImportFormat {
  return filename.toLowerCase().endsWith('.bdf') ? 'bdf' : 'fnt';
}

export function parseBdfFont(source: string): GlyphSet {
  const glyphs: GlyphSet = {};
  const lines = source.replace(/\r/g, '').split('\n');
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].startsWith('STARTCHAR')) {
      index += 1;
      continue;
    }

    const block: string[] = [];
    while (index < lines.length && !lines[index].startsWith('ENDCHAR')) {
      block.push(lines[index]);
      index += 1;
    }
    if (index < lines.length) {
      block.push(lines[index]);
    }

    const glyph = parseBdfGlyph(block);
    if (glyph) {
      glyphs[glyph.char] = glyph.glyph;
    }
    index += 1;
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error('No BDF glyphs found');
  }

  return glyphs;
}

export function parseAppFntFont(source: string): GlyphSet {
  const glyphs: GlyphSet = {};
  const lines = source.replace(/\r/g, '').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    const glyphMatch = /^(?:glyph|char)\s+(.+)$/i.exec(line) ?? /^char\s*=\s*(.+)$/i.exec(line);
    if (!glyphMatch) {
      index += 1;
      continue;
    }

    const char = decodeGlyphName(glyphMatch[1].trim());
    const rows: string[] = [];
    let nominalHeight: number | undefined;
    let topOffset: number | undefined;
    index += 1;

    while (index < lines.length && !/^end(?:glyph|char)?$/i.test(lines[index].trim())) {
      const current = lines[index].trim();
      if (/^nominalHeight\s*=/i.test(current)) {
        nominalHeight = Number.parseInt(current.split('=')[1], 10);
      } else if (/^topOffset\s*=/i.test(current)) {
        topOffset = Number.parseInt(current.split('=')[1], 10);
      } else if (/^[.#01]+$/.test(current)) {
        rows.push(current.replace(/1/g, '#').replace(/0/g, '.'));
      }
      index += 1;
    }

    if (char && rows.length > 0) {
      glyphs[char] = normalizeImportedGlyph(rows, nominalHeight, topOffset);
    }
    index += 1;
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error('No app .fnt glyphs found. Expected blocks like: glyph A ... endglyph');
  }

  return glyphs;
}

function parseBdfGlyph(block: string[]): { char: string; glyph: Glyph } | null {
  const encodingLine = block.find((line) => line.startsWith('ENCODING '));
  const bitmapIndex = block.findIndex((line) => line === 'BITMAP');
  const bbxLine = block.find((line) => line.startsWith('BBX '));
  const dwidthLine = block.find((line) => line.startsWith('DWIDTH '));
  if (!encodingLine || bitmapIndex < 0 || !bbxLine) {
    return null;
  }

  const codePoint = Number.parseInt(encodingLine.split(/\s+/)[1], 10);
  if (!Number.isFinite(codePoint) || codePoint < 0) {
    return null;
  }

  const [, widthText, heightText, , yOffsetText] = bbxLine.split(/\s+/);
  const bbxWidth = Math.max(1, Number.parseInt(widthText, 10) || 1);
  const height = Math.max(1, Number.parseInt(heightText, 10) || 1);
  const yOffset = Number.parseInt(yOffsetText, 10) || 0;
  const dwidth = dwidthLine ? Number.parseInt(dwidthLine.split(/\s+/)[1], 10) : bbxWidth;
  const bitmapLines = block.slice(bitmapIndex + 1).filter((line) => /^[0-9A-Fa-f]+$/.test(line)).slice(0, height);
  const rows = bitmapLines.map((line) => {
    const value = Number.parseInt(line, 16);
    const bits = value.toString(2).padStart(Math.ceil(bbxWidth / 8) * 8, '0').slice(0, bbxWidth);
    return bits.replace(/1/g, '#').replace(/0/g, '.');
  });

  return {
    char: String.fromCodePoint(codePoint),
    glyph: normalizeImportedGlyph(rows, height, Math.max(0, -yOffset), dwidth || bbxWidth)
  };
}

function normalizeImportedGlyph(
  rows: string[],
  nominalHeight?: number,
  topOffset?: number,
  widthOverride?: number
): Glyph {
  const width = Math.max(widthOverride ?? 1, rows.reduce((max, row) => Math.max(max, row.length), 0));
  return {
    width,
    data: rows.map((row) => row.padEnd(width, '.')),
    nominalHeight: Number.isFinite(nominalHeight) ? Math.max(1, nominalHeight ?? rows.length) : rows.length,
    topOffset: Number.isFinite(topOffset) ? Math.max(0, topOffset ?? 0) : 0
  };
}

function decodeGlyphName(value: string): string {
  const unquoted = value.replace(/^['"]|['"]$/g, '');
  if (/^U\+[0-9A-Fa-f]+$/.test(unquoted)) {
    return String.fromCodePoint(Number.parseInt(unquoted.slice(2), 16));
  }
  return Array.from(unquoted)[0] ?? '';
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
