import { DISPLAY_CONSTRAINTS, PRODUCT_IDENTITY } from '../config/constants';
import type { CanvasData, CanvasObject, LanguageCode } from '../types/domain';
import type { FontRenderer } from '../core/fonts';
import {
  packFrameBuffer,
  packFrameBufferHorizontalLsb,
  packFrameBufferHorizontalMsb,
  renderCanvasObjects,
  unpackBytesToFrameBuffer,
  type FrameBuffer
} from './render';

export const SCREEN_BYTE_LENGTH = DISPLAY_CONSTRAINTS.width * Math.ceil(DISPLAY_CONSTRAINTS.height / 8);

export interface ScreenExportOptions {
  symbolName: string;
  language: LanguageCode;
  fontRenderer?: FontRenderer;
  width?: number;
  height?: number;
}

export interface AllScreensExportOptions {
  projectSymbolName: string;
  language: LanguageCode;
  fontRenderer?: FontRenderer;
}

export interface ParsedCArray {
  symbolName: string;
  bytes: number[];
}

export function generateBytesFromObjects(
  objects: CanvasObject[],
  language: LanguageCode,
  fontRenderer?: FontRenderer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): number[] {
  return packFrameBuffer(renderCanvasObjects(objects, { language, fontRenderer, width, height }), width, height);
}

export function generateScreenCArray(objects: CanvasObject[], options: ScreenExportOptions): string {
  return generateCArray(
    sanitizeSymbolName(options.symbolName),
    generateBytesFromObjects(objects, options.language, options.fontRenderer, options.width, options.height)
  );
}

export function generateAllScreensCHeader(
  canvases: readonly CanvasData[],
  options: AllScreensExportOptions
): string {
  const baseName = sanitizeSymbolName(options.projectSymbolName || 'lcd_project');
  const guard = `${baseName.toUpperCase()}_LCD_SCREENS_H`;
  const arrays = canvases.map((canvas) =>
    generateCArray(
      screenSymbolName(baseName, canvas.stateId),
      generateBytesFromObjects(canvas.objects, options.language, options.fontRenderer, canvas.width, canvas.height)
    )
  );
  const tableRows = canvases.map((canvas) => {
    const symbolName = screenSymbolName(baseName, canvas.stateId);
    return `  { "${escapeCString(canvas.stateId)}", ${symbolName}, ${SCREEN_BYTE_LENGTH} }`;
  });

  return [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#include <stdint.h>',
    '#include <stddef.h>',
    '',
    `// ${PRODUCT_IDENTITY.documentationHeader}`,
    `// LCD screens: 1bpp, vertical pages, LSB at top`,
    '',
    'typedef struct {',
    '  const char *state_id;',
    '  const uint8_t *data;',
    '  size_t size;',
    '} lcd_screen_entry_t;',
    '',
    arrays.join('\n\n'),
    '',
    `static const lcd_screen_entry_t ${baseName}_screens[${canvases.length}] = {`,
    tableRows.join(',\n'),
    '};',
    '',
    `#define ${baseName.toUpperCase()}_SCREEN_COUNT ${canvases.length}`,
    '',
    `#endif /* ${guard} */`
  ].join('\n');
}

export function generateScreenBinary(
  objects: CanvasObject[],
  language: LanguageCode,
  fontRenderer?: FontRenderer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): Uint8Array {
  return Uint8Array.from(generateBytesFromObjects(objects, language, fontRenderer, width, height));
}

export function generateAllScreensBinary(
  canvases: readonly CanvasData[],
  language: LanguageCode,
  fontRenderer?: FontRenderer
): Uint8Array {
  const bytes = canvases.flatMap((canvas) => generateBytesFromObjects(canvas.objects, language, fontRenderer, canvas.width, canvas.height));
  return Uint8Array.from(bytes);
}

export function generateCArray(symbolName: string, bytes: readonly number[]): string {
  assertByteArray(bytes);
  const rows: string[] = [];

  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(
      `  ${bytes
        .slice(i, i + 16)
        .map((byte) => `0x${byte.toString(16).padStart(2, '0').toUpperCase()}`)
        .join(', ')}`
    );
  }

  return [
    `static const uint8_t ${sanitizeSymbolName(symbolName)}[${bytes.length}] = {`,
    rows.join(',\n'),
    '};'
  ].join('\n');
}

export function parseCHeaderScreenArrays(
  source: string,
  expectedLength: number = SCREEN_BYTE_LENGTH
): ParsedCArray[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
  const arrays: ParsedCArray[] = [];
  const arrayRegex = /(?:static\s+)?(?:const\s+)?uint8_t\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d+)\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/g;
  let match: RegExpExecArray | null;

  while ((match = arrayRegex.exec(withoutComments)) !== null) {
    const declaredLength = Number.parseInt(match[2], 10);
    const bytes = parseByteList(match[3]);
    if (declaredLength !== bytes.length) {
      throw new Error(`C array ${match[1]} declares ${declaredLength} bytes but contains ${bytes.length}`);
    }
    if (bytes.length !== expectedLength) {
      throw new Error(`C array ${match[1]} must contain ${expectedLength} bytes for the selected screen`);
    }
    arrays.push({ symbolName: match[1], bytes });
  }

  if (arrays.length === 0) {
    throw new Error(`No static uint8_t[${expectedLength}] LCD screen arrays found in C header`);
  }

  return arrays;
}

export function bytesToFrameBuffer(bytes: readonly number[]): FrameBuffer {
  if (bytes.length !== SCREEN_BYTE_LENGTH) {
    throw new Error(`LCD screen binary must contain ${SCREEN_BYTE_LENGTH} bytes`);
  }
  return unpackBytesToFrameBuffer(bytes);
}

export function getScreenByteLength(width: number, height: number): number {
  return width * Math.ceil(height / 8);
}

export function sanitizeSymbolName(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  return sanitized.length > 0 ? sanitized : 'lcd_screen';
}

function screenSymbolName(baseName: string, stateId: string): string {
  return sanitizeSymbolName(`${baseName}_${stateId}_screen`);
}

function parseByteList(source: string): number[] {
  const tokens = source
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.map((token) => {
    const normalized = token.replace(/[uUlL]+$/g, '');
    const value = normalized.startsWith('0b') || normalized.startsWith('0B')
      ? Number.parseInt(normalized.slice(2), 2)
      : Number(normalized);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`Invalid uint8_t literal: ${token}`);
    }
    return value;
  });
}

function assertByteArray(bytes: readonly number[]): void {
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error(`Invalid byte value: ${byte}`);
    }
  }
}

function escapeCString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ─── Embedded-developer export formats ────────────────────────────────────────

export type EmbeddedExportFormat =
  | 'c-vertical-lsb'       // default, SSD1306 vertical addressing (existing)
  | 'c-horizontal-msb'     // SSD1306 horizontal addressing, ST7920
  | 'c-horizontal-lsb'     // u8x8, some e-paper
  | 'xbm'                  // X BitMap — used by u8g2, libX11, LVGL
  | 'arduino-progmem'      // Arduino AVR/ESP PROGMEM header
  | 'rust-embedded'        // Rust embedded-graphics ImageRaw
  | 'esp-idf'              // ESP-IDF DRAM_ATTR / flash attribute header
  | 'binary';              // raw byte stream

export const EMBEDDED_FORMAT_EXTENSIONS: Record<EmbeddedExportFormat, string> = {
  'c-vertical-lsb': 'h',
  'c-horizontal-msb': 'h',
  'c-horizontal-lsb': 'h',
  xbm: 'xbm',
  'arduino-progmem': 'h',
  'rust-embedded': 'rs',
  'esp-idf': 'h',
  binary: 'bin'
};

export const EMBEDDED_FORMAT_LABELS: Record<EmbeddedExportFormat, string> = {
  'c-vertical-lsb': 'C header — vertical LSB (SSD1306 native)',
  'c-horizontal-msb': 'C header — horizontal MSB (SSD1306 horiz., ST7920)',
  'c-horizontal-lsb': 'C header — horizontal LSB (u8x8)',
  xbm: 'XBM (u8g2 / libX11 / LVGL)',
  'arduino-progmem': 'Arduino PROGMEM header',
  'rust-embedded': 'Rust embedded-graphics',
  'esp-idf': 'ESP-IDF RODATA_ATTR header',
  binary: 'Raw binary'
};

export interface EmbeddedExportOptions {
  symbolName: string;
  language: LanguageCode;
  fontRenderer?: FontRenderer;
  width?: number;
  height?: number;
  /** Override byte-per-row grouping for C arrays (default 16) */
  bytesPerRow?: number;
}

export function exportScreenEmbedded(
  objects: CanvasObject[],
  format: EmbeddedExportFormat,
  options: EmbeddedExportOptions
): string | Uint8Array {
  const width = options.width ?? DISPLAY_CONSTRAINTS.width;
  const height = options.height ?? DISPLAY_CONSTRAINTS.height;
  const frameBuffer = renderCanvasObjects(objects, { language: options.language, fontRenderer: options.fontRenderer, width, height });
  const sym = sanitizeSymbolName(options.symbolName);
  const bpr = options.bytesPerRow ?? 16;

  switch (format) {
    case 'c-vertical-lsb': {
      const bytes = packFrameBuffer(frameBuffer, width, height);
      return generateCArray(sym, bytes);
    }
    case 'c-horizontal-msb': {
      const bytes = packFrameBufferHorizontalMsb(frameBuffer, width, height);
      return generateCArray(sym, bytes);
    }
    case 'c-horizontal-lsb': {
      const bytes = packFrameBufferHorizontalLsb(frameBuffer, width, height);
      return generateCArray(sym, bytes);
    }
    case 'xbm':
      return generateXbm(sym, frameBuffer, width, height);
    case 'arduino-progmem': {
      const bytes = packFrameBuffer(frameBuffer, width, height);
      return generateArduinoProgmem(sym, bytes, width, height, bpr);
    }
    case 'rust-embedded': {
      const bytes = packFrameBuffer(frameBuffer, width, height);
      return generateRustEmbedded(sym, bytes, width, height, bpr);
    }
    case 'esp-idf': {
      const bytes = packFrameBuffer(frameBuffer, width, height);
      return generateEspIdfHeader(sym, bytes, width, height, bpr);
    }
    case 'binary': {
      const bytes = packFrameBuffer(frameBuffer, width, height);
      return Uint8Array.from(bytes);
    }
    default:
      throw new Error(`Unknown embedded export format: ${format as string}`);
  }
}

/**
 * X BitMap (XBM) — horizontal LSB-first, recognized by u8g2, LVGL, ImageMagick.
 * Used: u8g2_DrawXBM(), LVGL lv_img_dsc_t with CF_INDEXED_1_BIT, libX11 XReadBitmapFile.
 */
export function generateXbm(
  name: string,
  frameBuffer: FrameBuffer,
  width: number,
  height: number
): string {
  const sym = sanitizeSymbolName(name);
  const bytes = packFrameBufferHorizontalLsb(frameBuffer, width, height);
  const stride = Math.ceil(width / 8);
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += stride) {
    rows.push('  ' + bytes.slice(i, i + stride).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', '));
  }
  return [
    `#define ${sym}_width ${width}`,
    `#define ${sym}_height ${height}`,
    `static const unsigned char ${sym}_bits[] = {`,
    rows.join(',\n'),
    '};'
  ].join('\n');
}

/**
 * Arduino PROGMEM header — vertical LSB, stored in flash (AVR) or DRAM section (ESP32/ARM).
 * Usage: pgm_read_byte(&symbol_name[i])
 * Compatible: Arduino Uno/Mega/Pro Mini, ESP8266, ESP32, STM32duino.
 */
export function generateArduinoProgmem(
  symbolName: string,
  bytes: readonly number[],
  width: number,
  height: number,
  bytesPerRow = 16
): string {
  const sym = sanitizeSymbolName(symbolName);
  const guard = `${sym.toUpperCase()}_H`;
  const rows = chunkBytes(bytes, bytesPerRow).map(
    (row) => '  ' + row.map((b) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')
  );
  return [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#include <Arduino.h>',
    '#include <avr/pgmspace.h>',
    '',
    `// LCD bitmap: 1bpp, vertical pages, LSB at top (SSD1306 native)`,
    `// Dimensions: ${width}x${height} px  |  ${bytes.length} bytes`,
    `// Generated by ${PRODUCT_IDENTITY.name ?? 'LCD-bitmap-IDE'}`,
    '',
    `static const uint8_t PROGMEM ${sym}[${bytes.length}] = {`,
    rows.join(',\n'),
    '};',
    '',
    `#define ${sym.toUpperCase()}_WIDTH  ${width}`,
    `#define ${sym.toUpperCase()}_HEIGHT ${height}`,
    `#define ${sym.toUpperCase()}_BYTES  ${bytes.length}`,
    '',
    `#endif /* ${guard} */`
  ].join('\n');
}

/**
 * Rust embedded-graphics compatible const byte array.
 * Usage: ImageRaw::<BinaryColor>::new(&SYMBOL_NAME, WIDTH)
 * Compatible: embedded-graphics 0.8+, embassy, RTIC, probe-rs.
 */
export function generateRustEmbedded(
  symbolName: string,
  bytes: readonly number[],
  width: number,
  height: number,
  bytesPerRow = 16
): string {
  const sym = sanitizeSymbolName(symbolName).toUpperCase();
  const rows = chunkBytes(bytes, bytesPerRow).map(
    (row) => '    ' + row.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')
  );
  return [
    `// LCD bitmap — 1bpp vertical-page LSB (SSD1306 native)`,
    `// Dimensions: ${width}×${height} px  |  ${bytes.length} bytes`,
    `// Generated by ${PRODUCT_IDENTITY.name ?? 'LCD-bitmap-IDE'}`,
    `//`,
    `// Usage:`,
    `//   use embedded_graphics::{image::ImageRaw, pixelcolor::BinaryColor, prelude::*};`,
    `//   let img = ImageRaw::<BinaryColor>::new(&${sym}, ${width});`,
    `//   img.draw(&mut display)?;`,
    '',
    `pub const ${sym}_WIDTH: u32 = ${width};`,
    `pub const ${sym}_HEIGHT: u32 = ${height};`,
    `pub const ${sym}: [u8; ${bytes.length}] = [`,
    rows.join(',\n'),
    '];'
  ].join('\n');
}

/**
 * ESP-IDF compatible header — vertical LSB in DRAM/flash.
 * Supports DRAM_ATTR (fast RAM) or RODATA_ATTR (SPI flash).
 * Compatible: ESP-IDF v4/v5, ESP32-S2/S3/C3/C6/H2, LVGL port.
 */
export function generateEspIdfHeader(
  symbolName: string,
  bytes: readonly number[],
  width: number,
  height: number,
  bytesPerRow = 16,
  storageClass: 'DRAM_ATTR' | 'RODATA_ATTR' | 'IRAM_ATTR' | '' = 'RODATA_ATTR'
): string {
  const sym = sanitizeSymbolName(symbolName);
  const guard = `${sym.toUpperCase()}_H`;
  const attr = storageClass ? `${storageClass} ` : '';
  const rows = chunkBytes(bytes, bytesPerRow).map(
    (row) => '    ' + row.map((b) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')
  );
  return [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#include <stdint.h>',
    '#include <stddef.h>',
    '#include "esp_attr.h"',
    '',
    `/* LCD bitmap — 1bpp, vertical pages, LSB at top (SSD1306/SSD1309 native) */`,
    `/* Dimensions: ${width}x${height} px  |  ${bytes.length} bytes              */`,
    `/* Generated by ${PRODUCT_IDENTITY.name ?? 'LCD-bitmap-IDE'}                */`,
    '',
    `static const ${attr}uint8_t ${sym}[${bytes.length}] = {`,
    rows.join(',\n'),
    '};',
    '',
    `#define ${sym.toUpperCase()}_WIDTH   ${width}`,
    `#define ${sym.toUpperCase()}_HEIGHT  ${height}`,
    `#define ${sym.toUpperCase()}_BYTES   ${bytes.length}`,
    '',
    `#endif /* ${guard} */`
  ].join('\n');
}

/**
 * Render frame buffer to PNG Blob using the browser Canvas 2D API.
 * Available only in browser/renderer process (not in Electron main).
 * pixel=1 → white (#FFFFFF), pixel=0 → black (#000000) (standard LCD polarity).
 */
export async function generatePngBlob(
  objects: CanvasObject[],
  language: LanguageCode,
  fontRenderer?: FontRenderer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height,
  scale = 4
): Promise<Blob> {
  const frameBuffer = renderCanvasObjects(objects, { language, fontRenderer, width, height });
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FFFFFF';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frameBuffer[y]?.[x]) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

function chunkBytes(bytes: readonly number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < bytes.length; i += size) {
    chunks.push([...bytes.slice(i, i + size)]);
  }
  return chunks;
}
