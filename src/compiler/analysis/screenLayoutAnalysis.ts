import type { NormalizedCanvasObjectIr, NormalizedTextObjectIr } from '../ir/screenIr';
import type { LoweredScreenIr } from '../target-ir/targetIr';
import { createCanonicalRaster, rgba, type CanonicalRaster } from '../raster/canonicalRaster';
import type { FontRenderer, LanguageCode } from '../../domain';
import { defaultFontRenderer, resolveLocalizedBitmapText } from '../../domain';

export interface ScreenObjectBounds {
  objectId: string;
  objectType: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenLayoutIssue {
  id: string;
  code: 'clipped' | 'overlap' | 'minimum-spacing';
  severity: 'error' | 'warning';
  message: string;
  objectIds: readonly string[];
  bounds: ScreenObjectBounds;
}

export interface ScreenLayoutAnalysis {
  screenId: string;
  width: number;
  height: number;
  boundingBoxes: readonly ScreenObjectBounds[];
  issues: readonly ScreenLayoutIssue[];
  overlay: CanonicalRaster;
}

export function analyzeScreenLayout(
  screen: Pick<LoweredScreenIr, 'id' | 'width' | 'height' | 'objects'>,
  language: LanguageCode,
  fontRenderer: FontRenderer = defaultFontRenderer
): ScreenLayoutAnalysis {
  const boundingBoxes = screen.objects
    .filter((object) => object.visible)
    .map((object) => boundsForObject(object, language, fontRenderer));
  const issues: ScreenLayoutIssue[] = [];
  for (const bounds of boundingBoxes) {
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > screen.width || bounds.y + bounds.height > screen.height) {
      issues.push(issue('clipped', 'error', `${bounds.objectType} "${bounds.objectId}" is clipped by the display bounds.`, [bounds.objectId], bounds, issues.length));
    }
  }
  for (let leftIndex = 0; leftIndex < boundingBoxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boundingBoxes.length; rightIndex += 1) {
      const left = boundingBoxes[leftIndex];
      const right = boundingBoxes[rightIndex];
      const intersection = intersect(left, right);
      if (intersection) {
        issues.push(issue('overlap', 'warning', `Objects "${left.objectId}" and "${right.objectId}" overlap.`, [left.objectId, right.objectId], intersection, issues.length));
      } else if (gap(left, right) < 2) {
        const union = unionBounds(left, right);
        issues.push(issue('minimum-spacing', 'warning', `Objects "${left.objectId}" and "${right.objectId}" are less than 2 px apart.`, [left.objectId, right.objectId], union, issues.length));
      }
    }
  }
  return {
    screenId: screen.id,
    width: screen.width,
    height: screen.height,
    boundingBoxes,
    issues,
    overlay: createIssueOverlay(screen.width, screen.height, issues)
  };
}

function boundsForObject(object: NormalizedCanvasObjectIr, language: LanguageCode, fontRenderer: FontRenderer): ScreenObjectBounds {
  if (object.type === 'line') {
    const x = Math.min(object.x0, object.x1);
    const y = Math.min(object.y0, object.y1);
    return bounds(object, x, y, Math.abs(object.x1 - object.x0) + 1, Math.abs(object.y1 - object.y0) + 1);
  }
  if (object.type === 'text') {
    const bitmask = fontRenderer.renderTextBitmask(resolveText(object, language, fontRenderer), object.fontVariant);
    return bounds(object, object.x, object.y, Math.max(1, ...bitmask.map((row) => row.length)), Math.max(1, bitmask.length));
  }
  return bounds(object, object.x, object.y, Math.max(1, object.width), Math.max(1, object.height));
}

function resolveText(object: NormalizedTextObjectIr, language: LanguageCode, fontRenderer: FontRenderer): string {
  return resolveLocalizedBitmapText(
    object.text,
    object.displayLanguage ?? language,
    fontRenderer,
    object.fontVariant
  );
}

function bounds(object: NormalizedCanvasObjectIr, x: number, y: number, width: number, height: number): ScreenObjectBounds {
  return { objectId: object.id, objectType: object.type, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function issue(code: ScreenLayoutIssue['code'], severity: ScreenLayoutIssue['severity'], message: string, objectIds: string[], bounds: ScreenObjectBounds, index: number): ScreenLayoutIssue {
  return { id: `layout:${code}:${index + 1}`, code, severity, message, objectIds, bounds };
}

function intersect(left: ScreenObjectBounds, right: ScreenObjectBounds): ScreenObjectBounds | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const endX = Math.min(left.x + left.width, right.x + right.width);
  const endY = Math.min(left.y + left.height, right.y + right.height);
  return endX > x && endY > y
    ? { objectId: `${left.objectId}+${right.objectId}`, objectType: 'intersection', x, y, width: endX - x, height: endY - y }
    : null;
}

function gap(left: ScreenObjectBounds, right: ScreenObjectBounds): number {
  const dx = Math.max(0, Math.max(left.x, right.x) - Math.min(left.x + left.width, right.x + right.width));
  const dy = Math.max(0, Math.max(left.y, right.y) - Math.min(left.y + left.height, right.y + right.height));
  return Math.max(dx, dy);
}

function unionBounds(left: ScreenObjectBounds, right: ScreenObjectBounds): ScreenObjectBounds {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const endX = Math.max(left.x + left.width, right.x + right.width);
  const endY = Math.max(left.y + left.height, right.y + right.height);
  return { objectId: `${left.objectId}+${right.objectId}`, objectType: 'spacing', x, y, width: endX - x, height: endY - y };
}

function createIssueOverlay(width: number, height: number, issues: readonly ScreenLayoutIssue[]): CanonicalRaster {
  const pixels = new Uint32Array(width * height);
  for (const item of issues) {
    const color = item.severity === 'error' ? rgba(255, 32, 32, 255) : rgba(255, 196, 0, 255);
    drawBorder(pixels, width, height, item.bounds, color);
  }
  return createCanonicalRaster(width, height, pixels);
}

function drawBorder(pixels: Uint32Array, width: number, height: number, bounds: ScreenObjectBounds, color: number): void {
  const left = Math.max(0, bounds.x);
  const top = Math.max(0, bounds.y);
  const right = Math.min(width - 1, bounds.x + Math.max(1, bounds.width) - 1);
  const bottom = Math.min(height - 1, bounds.y + Math.max(1, bounds.height) - 1);
  for (let x = left; x <= right; x += 1) { set(pixels, width, height, x, top, color); set(pixels, width, height, x, bottom, color); }
  for (let y = top; y <= bottom; y += 1) { set(pixels, width, height, left, y, color); set(pixels, width, height, right, y, color); }
}

function set(pixels: Uint32Array, width: number, height: number, x: number, y: number, color: number): void {
  if (x >= 0 && x < width && y >= 0 && y < height) pixels[y * width + x] = color;
}
