import type { Glyph, GlyphSet } from '../core/fonts';

export interface BdfExportOptions {
  /** Human-readable font name written to the BDF header. */
  fontName?: string;
  /** Nominal pixel size written to the BDF SIZE field. */
  pixelSize?: number;
}

function glyphNameFor(char: string): string {
  if (/^[A-Za-z0-9]$/.test(char)) return char;
  if (char === ' ') return 'space';

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined || Array.from(char).length !== 1) {
    throw new Error(`BDF export requires one Unicode code point per glyph key: ${JSON.stringify(char)}`);
  }
  return `uni${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Encodes one #/. pixel row as BDF hexadecimal, most-significant bit first. */
function rowToHex(row: string, width: number): string {
  const bits = row.padEnd(width, '.').slice(0, width);
  const byteCount = Math.ceil(width / 8);
  let hex = '';

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    let byte = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      const column = byteIndex * 8 + bitIndex;
      byte = (byte << 1) | (column < width && bits[column] === '#' ? 1 : 0);
    }
    hex += byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return hex;
}

function glyphWidth(glyph: Glyph): number {
  return Math.max(1, glyph.width, ...glyph.data.map((row) => row.length));
}

function serializeGlyph(char: string, glyph: Glyph): string {
  const width = glyphWidth(glyph);
  // The importer obtains topOffset from max(0, -BBX.yOffset), so this is its
  // inverse. Keep BBX at the bitmap's exact height: adding rows merely to
  // represent nominalHeight would change Glyph.data after a round trip.
  const height = Math.max(1, glyph.data.length);
  const topOffset = Math.max(0, glyph.topOffset ?? 0);
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined || Array.from(char).length !== 1) {
    throw new Error(`BDF export requires one Unicode code point per glyph key: ${JSON.stringify(char)}`);
  }
  const rows = Array.from({ length: height }, (_, index) => glyph.data[index] ?? '');

  return [
    `STARTCHAR ${glyphNameFor(char)}`,
    `ENCODING ${codePoint}`,
    `SWIDTH ${width * 1000} 0`,
    `DWIDTH ${width} 0`,
    `BBX ${width} ${height} 0 ${-topOffset}`,
    'BITMAP',
    ...rows.map((row) => rowToHex(row, width)),
    'ENDCHAR'
  ].join('\n');
}

function bdfFontName(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'LCD-bitmap-IDE-export';
}

/**
 * Exports application glyphs as BDF 2.1. The output is compatible with
 * parseBdfFont(), including wide bitmaps and Unicode glyphs.
 */
export function exportGlyphSetToBdf(glyphs: GlyphSet, options: BdfExportOptions = {}): string {
  const entries = Object.entries(glyphs);
  if (entries.length === 0) {
    throw new Error('Cannot export an empty glyph set as BDF');
  }

  const maxWidth = Math.max(...entries.map(([, glyph]) => glyphWidth(glyph)));
  const maxHeight = Math.max(...entries.map(([, glyph]) => Math.max(1, glyph.data.length)));
  const pixelSize = Math.max(1, options.pixelSize ?? maxHeight);
  const fontName = bdfFontName(options.fontName ?? 'LCD-bitmap-IDE-export');

  return [
    'STARTFONT 2.1',
    `FONT -lcdbitmapide-${fontName}-medium-r-normal--${maxHeight}-${pixelSize * 10}-75-75-c-${maxWidth * 10}-iso10646-1`,
    `SIZE ${pixelSize} 75 75`,
    `FONTBOUNDINGBOX ${maxWidth} ${maxHeight} 0 0`,
    `CHARS ${entries.length}`,
    ...entries.map(([char, glyph]) => serializeGlyph(char, glyph)),
    'ENDFONT',
    ''
  ].join('\n');
}
