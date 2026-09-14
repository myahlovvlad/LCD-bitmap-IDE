import type { FontRenderer } from '../core/fonts';
import type { CanvasObject, LanguageCode } from '../types/domain';
import { packFrameBuffer, renderCanvasObjects, type FrameBuffer } from './render';

export type ElementExportFormat = 'json' | 'c-header' | 'binary' | 'png';

export interface ElementExportBundle {
  object: CanvasObject;
  origin: { x: number; y: number };
  width: number;
  height: number;
  frameBuffer: FrameBuffer;
  bytes: Uint8Array;
  symbolName: string;
}

export function createElementExport(
  object: CanvasObject,
  options: { language: LanguageCode; screenWidth: number; screenHeight: number; fontRenderer: FontRenderer }
): ElementExportBundle {
  const fullFrame = renderCanvasObjects([object], {
    language: options.language,
    width: options.screenWidth,
    height: options.screenHeight,
    fontRenderer: options.fontRenderer
  });
  const bounds = object.type === 'text'
    ? findActiveBounds(fullFrame)
    : clampBounds(getDeclaredBounds(object), options.screenWidth, options.screenHeight);
  const frameBuffer = fullFrame
    .slice(bounds.y, bounds.y + bounds.height)
    .map((row) => row.slice(bounds.x, bounds.x + bounds.width));
  return {
    object,
    origin: { x: bounds.x, y: bounds.y },
    width: bounds.width,
    height: bounds.height,
    frameBuffer,
    bytes: Uint8Array.from(packFrameBuffer(frameBuffer, bounds.width, bounds.height)),
    symbolName: sanitizeSymbol(object.id)
  };
}

export function serializeElementManifest(bundle: ElementExportBundle): string {
  return JSON.stringify({
    schema: 'lcd-element/v1',
    id: bundle.object.id,
    type: bundle.object.type,
    origin: bundle.origin,
    size: { width: bundle.width, height: bundle.height },
    packing: 'vertical-lsb',
    bytes: Array.from(bundle.bytes),
    object: bundle.object
  }, null, 2);
}

export function serializeElementHeader(bundle: ElementExportBundle): string {
  const values = Array.from(bundle.bytes, (value) => `0x${value.toString(16).padStart(2, '0')}`);
  const rows: string[] = [];
  for (let index = 0; index < values.length; index += 12) rows.push(`  ${values.slice(index, index + 12).join(', ')}`);
  return `#pragma once\n#include <stdint.h>\n\n/* ${bundle.object.id}; source origin ${bundle.origin.x},${bundle.origin.y}; vertical LSB */\n#define ${bundle.symbolName.toUpperCase()}_WIDTH ${bundle.width}\n#define ${bundle.symbolName.toUpperCase()}_HEIGHT ${bundle.height}\nstatic const uint8_t ${bundle.symbolName}[${bundle.bytes.length}] = {\n${rows.join(',\n')}\n};\n`;
}

function findActiveBounds(frameBuffer: FrameBuffer): { x: number; y: number; width: number; height: number } {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = -1;
  let bottom = -1;
  frameBuffer.forEach((row, y) => row.forEach((active, x) => {
    if (!active) return;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }));
  if (right < 0 || bottom < 0) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function getDeclaredBounds(object: Exclude<CanvasObject, { type: 'text' }>): { x: number; y: number; width: number; height: number } {
  if (object.type === 'line') {
    return {
      x: Math.min(object.x0, object.x1),
      y: Math.min(object.y0, object.y1),
      width: Math.abs(object.x1 - object.x0) + 1,
      height: Math.abs(object.y1 - object.y0) + 1
    };
  }
  return {
    x: Math.round(object.x),
    y: Math.round(object.y),
    width: Math.max(1, Math.round(object.width)),
    height: Math.max(1, Math.round(object.height))
  };
}

function clampBounds(
  bounds: { x: number; y: number; width: number; height: number },
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, Math.min(screenWidth - 1, bounds.x));
  const y = Math.max(0, Math.min(screenHeight - 1, bounds.y));
  return {
    x,
    y,
    width: Math.max(1, Math.min(bounds.width - Math.max(0, -bounds.x), screenWidth - x)),
    height: Math.max(1, Math.min(bounds.height - Math.max(0, -bounds.y), screenHeight - y))
  };
}

function sanitizeSymbol(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^([^a-zA-Z_])/, '_$1');
  return normalized || 'lcd_element';
}
