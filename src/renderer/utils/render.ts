import { DISPLAY_CONSTRAINTS } from '../config/constants';
import type { BitmapCanvasObject, CanvasObject, FontVariant, LanguageCode, SpecialCanvasObject } from '../types/domain';
import { defaultFontRenderer, resolveLocalizedBitmapText, type FontRenderer, type FontVariantKey, type Glyph } from '../core/fonts';

export type FrameBuffer = boolean[][];

export interface RenderOptions {
  language: LanguageCode;
  width?: number;
  height?: number;
  fontRenderer?: FontRenderer;
}

export function createFrameBuffer(
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): FrameBuffer {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => false));
}

export function setPixel(frameBuffer: FrameBuffer, x: number, y: number, value = true): void {
  if (y < 0 || y >= frameBuffer.length) {
    return;
  }

  if (x < 0 || x >= frameBuffer[y].length) {
    return;
  }

  frameBuffer[y][x] = value;
}

export function renderCanvasObjects(
  objects: CanvasObject[],
  options: RenderOptions
): FrameBuffer {
  const width = options.width ?? DISPLAY_CONSTRAINTS.width;
  const height = options.height ?? DISPLAY_CONSTRAINTS.height;
  const frameBuffer = createFrameBuffer(width, height);
  const fontRenderer = options.fontRenderer ?? defaultFontRenderer;

  const sortedObjects = [...objects]
    .filter((object) => object.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const object of sortedObjects) {
    if (object.type === 'text') {
      drawText(
        frameBuffer,
        object.x,
        object.y,
        resolveLocalizedBitmapText(object.text, options.language, fontRenderer, object.fontVariant as FontVariantKey),
        object.fontVariant as FontVariantKey,
        fontRenderer
      );
    } else if (object.type === 'line') {
      drawLine(frameBuffer, object.x0, object.y0, object.x1, object.y1);
    } else if (object.type === 'rect') {
      drawRect(frameBuffer, object.x, object.y, object.width, object.height, object.filled);
    } else if (object.type === 'icon') {
      drawRect(frameBuffer, object.x, object.y, object.width, object.height, false);
    } else if (object.type === 'bitmap') {
      drawBitmap(frameBuffer, object);
    } else if (object.type === 'special') {
      drawSpecialElement(frameBuffer, object, fontRenderer);
    } else if (object.type === 'invert') {
      invertRect(frameBuffer, object.x, object.y, object.width, object.height);
    }
  }

  return frameBuffer;
}

export function drawText(
  frameBuffer: FrameBuffer,
  x: number,
  y: number,
  text: string,
  fontVariant: FontVariant,
  fontRenderer: FontRenderer = defaultFontRenderer
): void {
  const bitmask = fontRenderer.renderTextBitmask(text, fontVariant);
  for (let row = 0; row < bitmask.length; row += 1) {
    for (let col = 0; col < bitmask[row].length; col += 1) {
      if (bitmask[row][col]) {
        setPixel(frameBuffer, x + col, y + row);
      }
    }
  }
}

export function drawLine(
  frameBuffer: FrameBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  let currentX = Math.round(x0);
  let currentY = Math.round(y0);
  const targetX = Math.round(x1);
  const targetY = Math.round(y1);
  const dx = Math.abs(targetX - currentX);
  const sx = currentX < targetX ? 1 : -1;
  const dy = Math.abs(targetY - currentY);
  const sy = currentY < targetY ? 1 : -1;
  let error = dx - dy;

  while (true) {
    setPixel(frameBuffer, currentX, currentY);

    if (currentX === targetX && currentY === targetY) {
      break;
    }

    const doubledError = 2 * error;
    if (doubledError > -dy) {
      error -= dy;
      currentX += sx;
    }

    if (doubledError < dx) {
      error += dx;
      currentY += sy;
    }
  }
}

export function drawRect(
  frameBuffer: FrameBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  filled: boolean
): void {
  const left = Math.round(x);
  const top = Math.round(y);
  const right = left + Math.max(0, Math.round(width) - 1);
  const bottom = top + Math.max(0, Math.round(height) - 1);

  if (filled) {
    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        setPixel(frameBuffer, col, row);
      }
    }
    return;
  }

  drawLine(frameBuffer, left, top, right, top);
  drawLine(frameBuffer, left, bottom, right, bottom);
  drawLine(frameBuffer, left, top, left, bottom);
  drawLine(frameBuffer, right, top, right, bottom);
}

export function invertRect(
  frameBuffer: FrameBuffer,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const left = Math.round(x);
  const top = Math.round(y);
  const right = left + Math.max(0, Math.round(width) - 1);
  const bottom = top + Math.max(0, Math.round(height) - 1);

  for (let row = top; row <= bottom; row += 1) {
    if (row < 0 || row >= frameBuffer.length) {
      continue;
    }
    for (let col = left; col <= right; col += 1) {
      if (col < 0 || col >= frameBuffer[row].length) {
        continue;
      }
      frameBuffer[row][col] = !frameBuffer[row][col];
    }
  }
}

export function drawBitmap(frameBuffer: FrameBuffer, object: BitmapCanvasObject): void {
  const bitmap = unpackBytesToFrameBuffer(object.bytes, object.width, object.height);
  for (let y = 0; y < bitmap.length; y += 1) {
    for (let x = 0; x < bitmap[y].length; x += 1) {
      if (bitmap[y][x]) {
        setPixel(frameBuffer, object.x + x, object.y + y);
      }
    }
  }
}

export function drawSpecialElement(
  frameBuffer: FrameBuffer,
  object: SpecialCanvasObject,
  fontRenderer: FontRenderer = defaultFontRenderer
): void {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  const width = Math.max(1, Math.round(object.width));
  const height = Math.max(1, Math.round(object.height));
  const value = Math.max(0, Math.min(100, object.value));
  const glyphChar = object.glyphChar ?? getSpecialElementGlyphChar(object);

  if (object.kind === 'checkbox') {
    drawGlyphToRect(
      frameBuffer,
      object.glyphOverride ?? fontRenderer.getGlyph(glyphChar, object.fontVariant ?? '1'),
      x,
      y,
      width,
      height
    );
    return;
  }

  if (object.kind === 'radio') {
    drawCircle(frameBuffer, x + Math.floor(width / 2), y + Math.floor(height / 2), Math.floor(Math.min(width, height) / 2));
    if (object.checked) {
      fillCircle(frameBuffer, x + Math.floor(width / 2), y + Math.floor(height / 2), Math.max(1, Math.floor(Math.min(width, height) / 4)));
    }
    return;
  }

  if (object.kind === 'progress') {
    drawRect(frameBuffer, x, y, width, height, false);
    const fillWidth = Math.max(0, Math.round((width - 2) * (value / 100)));
    drawRect(frameBuffer, x + 1, y + 1, fillWidth, Math.max(1, height - 2), true);
    return;
  }

  if (object.kind === 'battery') {
    drawRect(frameBuffer, x, y, Math.max(1, width - 2), height, false);
    drawRect(frameBuffer, x + width - 2, y + Math.max(1, Math.floor(height / 3)), 2, Math.max(1, Math.floor(height / 3)), true);
    const fillWidth = Math.max(0, Math.round((width - 4) * (value / 100)));
    drawRect(frameBuffer, x + 1, y + 1, fillWidth, Math.max(1, height - 2), true);
    return;
  }

  if (object.kind === 'signal') {
    const bars = 4;
    const activeBars = Math.round((value / 100) * bars);
    const barWidth = Math.max(1, Math.floor(width / (bars * 2 - 1)));
    for (let i = 0; i < bars; i += 1) {
      const barHeight = Math.max(1, Math.round((height * (i + 1)) / bars));
      drawRect(frameBuffer, x + i * barWidth * 2, y + height - barHeight, barWidth, barHeight, i < activeBars);
    }
    return;
  }

  drawRect(frameBuffer, x, y, width, height, false);
  if (width >= height) {
    const thumbWidth = Math.max(3, Math.round(width / 4));
    const thumbX = x + Math.round((width - thumbWidth) * (value / 100));
    drawRect(frameBuffer, thumbX, y + 1, thumbWidth, Math.max(1, height - 2), true);
  } else {
    const thumbHeight = Math.max(3, Math.round(height / 4));
    const thumbY = y + Math.round((height - thumbHeight) * (value / 100));
    drawRect(frameBuffer, x + 1, thumbY, Math.max(1, width - 2), thumbHeight, true);
  }
}

function getSpecialElementGlyphChar(object: SpecialCanvasObject): string {
  if (object.kind === 'checkbox') {
    return object.checked ? '☑' : '☐';
  }
  return '';
}

function drawGlyphToRect(
  frameBuffer: FrameBuffer,
  glyph: Glyph,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const sourceHeight = Math.max(1, glyph.data.length);
  const sourceWidth = Math.max(1, glyph.width, glyph.data.reduce((max, row) => Math.max(max, row.length), 0));
  for (let row = 0; row < height; row += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((row / height) * sourceHeight));
    const sourceRow = glyph.data[sourceY] ?? '';
    for (let col = 0; col < width; col += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((col / width) * sourceWidth));
      if (sourceRow[sourceX] === '#') {
        setPixel(frameBuffer, x + col, y + row);
      }
    }
  }
}

function drawCircle(frameBuffer: FrameBuffer, cx: number, cy: number, radius: number): void {
  let x = radius;
  let y = 0;
  let error = 0;

  while (x >= y) {
    setPixel(frameBuffer, cx + x, cy + y);
    setPixel(frameBuffer, cx + y, cy + x);
    setPixel(frameBuffer, cx - y, cy + x);
    setPixel(frameBuffer, cx - x, cy + y);
    setPixel(frameBuffer, cx - x, cy - y);
    setPixel(frameBuffer, cx - y, cy - x);
    setPixel(frameBuffer, cx + y, cy - x);
    setPixel(frameBuffer, cx + x, cy - y);
    y += 1;
    if (error <= 0) {
      error += 2 * y + 1;
    } else {
      x -= 1;
      error -= 2 * x + 1;
    }
  }
}

function fillCircle(frameBuffer: FrameBuffer, cx: number, cy: number, radius: number): void {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) {
        setPixel(frameBuffer, cx + x, cy + y);
      }
    }
  }
}

export function packFrameBuffer(
  frameBuffer: FrameBuffer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): number[] {
  const bytes: number[] = [];
  const pages = Math.ceil(height / 8);

  for (let page = 0; page < pages; page += 1) {
    for (let x = 0; x < width; x += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const y = page * 8 + bit;
        if (frameBuffer[y]?.[x]) {
          byte |= 1 << bit;
        }
      }
      bytes.push(byte);
    }
  }

  return bytes;
}

export function unpackBytesToFrameBuffer(
  bytes: readonly number[],
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): FrameBuffer {
  const frameBuffer = createFrameBuffer(width, height);
  const pages = Math.ceil(height / 8);

  for (let page = 0; page < pages; page += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = bytes[page * width + x] ?? 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const y = page * 8 + bit;
        setPixel(frameBuffer, x, y, (byte & (1 << bit)) !== 0);
      }
    }
  }

  return frameBuffer;
}

/**
 * Horizontal MSB packing: left-to-right scanlines, bit 7 = leftmost pixel.
 * Used by SSD1306 in horizontal addressing mode, ST7920, many graphic LCDs.
 * Byte stride per row = ceil(width / 8).
 */
export function packFrameBufferHorizontalMsb(
  frameBuffer: FrameBuffer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): number[] {
  const bytes: number[] = [];
  const stride = Math.ceil(width / 8);
  for (let y = 0; y < height; y += 1) {
    for (let col = 0; col < stride; col += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = col * 8 + bit;
        if (x < width && frameBuffer[y]?.[x]) {
          byte |= 0x80 >> bit;
        }
      }
      bytes.push(byte);
    }
  }
  return bytes;
}

/**
 * Horizontal LSB packing: left-to-right scanlines, bit 0 = leftmost pixel.
 * Used by XBM format, u8x8, some e-paper displays.
 * Byte stride per row = ceil(width / 8).
 */
export function packFrameBufferHorizontalLsb(
  frameBuffer: FrameBuffer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): number[] {
  const bytes: number[] = [];
  const stride = Math.ceil(width / 8);
  for (let y = 0; y < height; y += 1) {
    for (let col = 0; col < stride; col += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = col * 8 + bit;
        if (x < width && frameBuffer[y]?.[x]) {
          byte |= 1 << bit;
        }
      }
      bytes.push(byte);
    }
  }
  return bytes;
}

/**
 * Vertical MSB packing: column-major pages, bit 7 = topmost pixel.
 * Used by some DOGM LCD controllers (UC1701, ST7565 with reverse COM order).
 */
export function packFrameBufferVerticalMsb(
  frameBuffer: FrameBuffer,
  width: number = DISPLAY_CONSTRAINTS.width,
  height: number = DISPLAY_CONSTRAINTS.height
): number[] {
  const bytes: number[] = [];
  const pages = Math.ceil(height / 8);
  for (let page = 0; page < pages; page += 1) {
    for (let x = 0; x < width; x += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const y = page * 8 + bit;
        if (frameBuffer[y]?.[x]) {
          byte |= 0x80 >> bit;
        }
      }
      bytes.push(byte);
    }
  }
  return bytes;
}
