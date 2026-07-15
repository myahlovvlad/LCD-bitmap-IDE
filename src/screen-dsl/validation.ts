import { FontRenderer, defaultFontRenderer } from '../domain';
import { screenDslDocumentToInterchange } from './conversion';
import { screenDslError, screenDslWarning } from './diagnostics';
import {
  SCREEN_DSL_FORMAT,
  SCREEN_DSL_LAYOUT_MODE,
  SCREEN_DSL_VERSION,
  type ScreenDslDiagnostic,
  type ScreenDslDocumentV1,
  type ScreenDslValidationResult
} from './model';

const VALID_OBJECT_KINDS = new Set(['text', 'line', 'rect', 'icon', 'bitmap', 'special', 'invert']);

export function validateScreenDslDocument(document: ScreenDslDocumentV1): ScreenDslValidationResult {
  const diagnostics: ScreenDslDiagnostic[] = [];
  if (document.format !== SCREEN_DSL_FORMAT) {
    diagnostics.push(screenDslError('SCREEN_DSL_INVALID_FORMAT', `Expected ${SCREEN_DSL_FORMAT}.`, '$.format'));
  }
  if (document.version !== SCREEN_DSL_VERSION) {
    diagnostics.push(screenDslError('SCREEN_DSL_INVALID_VERSION', `Expected ${SCREEN_DSL_VERSION}.`, '$.version'));
  }
  if (document.layoutMode !== SCREEN_DSL_LAYOUT_MODE) {
    diagnostics.push(screenDslError('SCREEN_DSL_UNSUPPORTED_LAYOUT_MODE', 'Only explicit layout is supported in Phase 4B.', '$.layoutMode'));
  }
  const screenIds = new Set<string>();
  document.screens.forEach((screen, screenIndex) => {
    const screenPath = `$.screens[${screenIndex}]`;
    if (screenIds.has(screen.id)) {
      diagnostics.push(screenDslError('SCREEN_DSL_DUPLICATE_SCREEN_ID', `Duplicate screen id "${screen.id}".`, `${screenPath}.id`));
    }
    screenIds.add(screen.id);
    if (!Number.isInteger(screen.display.width) || !Number.isInteger(screen.display.height)) {
      diagnostics.push(screenDslError('SCREEN_DSL_INVALID_DISPLAY', 'Screen display dimensions must be integers.', `${screenPath}.display`));
    }
    const objectIds = new Set<string>();
    screen.objects.forEach((object, objectIndex) => {
      const objectPath = `${screenPath}.objects[${objectIndex}]`;
      if (!VALID_OBJECT_KINDS.has(object.kind)) {
        diagnostics.push(screenDslError('SCREEN_DSL_UNKNOWN_OBJECT_KIND', `Unsupported object kind "${object.kind}".`, `${objectPath}.kind`));
      }
      if (objectIds.has(object.id)) {
        diagnostics.push(screenDslError('SCREEN_DSL_DUPLICATE_OBJECT_ID', `Duplicate object id "${object.id}".`, `${objectPath}.id`));
      }
      objectIds.add(object.id);
      if (object.order !== objectIndex) {
        diagnostics.push(screenDslError('SCREEN_DSL_OBJECT_ORDER_CONFLICT', 'Object order must match array order.', `${objectPath}.order`));
      }
      if (screen.objectOrder[objectIndex] !== object.id) {
        diagnostics.push(screenDslError('SCREEN_DSL_OBJECT_ORDER_MISMATCH', 'objectOrder must match objects array.', `${screenPath}.objectOrder[${objectIndex}]`));
      }
      diagnostics.push(...validateGeometry(object, screen.display.width, screen.display.height, objectPath));
    });
  });
  diagnostics.push(...validateResourceRefs(document));
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), diagnostics };
}

export function validateScreenDslPixelBudget(
  document: ScreenDslDocumentV1,
  fontRenderer: FontRenderer = defaultFontRenderer
): ScreenDslValidationResult {
  const diagnostics = [...validateScreenDslDocument(document).diagnostics];
  for (const screen of document.screens) {
    for (const object of screen.objects) {
      if (object.kind === 'text') {
        const text = Object.values(object.text).join('');
        for (const char of Array.from(text)) {
          if (!fontRenderer.hasGlyph(char, object.fontVariant)) {
            diagnostics.push(screenDslWarning('SCREEN_DSL_MISSING_GLYPH', `Missing bitmap glyph for "${char}".`, `$.screens.${screen.id}.objects.${object.id}.text`));
          }
        }
      }
    }
    const byteLength = Math.ceil(screen.display.height / 8) * screen.display.width;
    if (screen.display.width === 128 && screen.display.height === 64 && byteLength !== 1024) {
      diagnostics.push(screenDslError('SCREEN_DSL_PIXEL_BUDGET_INVALID', '128x64 vertical-LSB screen must be 1024 bytes.', `$.screens.${screen.id}.display`));
    }
  }
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), diagnostics };
}

function validateGeometry(object: ScreenDslDocumentV1['screens'][number]['objects'][number], width: number, height: number, path: string): ScreenDslDiagnostic[] {
  const diagnostics: ScreenDslDiagnostic[] = [];
  const numeric = Object.entries(object).filter(([key]) => ['x', 'y', 'width', 'height', 'x0', 'y0', 'x1', 'y1'].includes(key));
  for (const [key, value] of numeric) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      diagnostics.push(screenDslError('SCREEN_DSL_INVALID_GEOMETRY', `${key} must be a finite integer.`, `${path}.${key}`));
    }
  }
  const record = object as Record<string, unknown>;
  const left = hasNumber(record, 'x') ? record.x : hasNumber(record, 'x0') && hasNumber(record, 'x1') ? Math.min(record.x0, record.x1) : 0;
  const top = hasNumber(record, 'y') ? record.y : hasNumber(record, 'y0') && hasNumber(record, 'y1') ? Math.min(record.y0, record.y1) : 0;
  const right = hasNumber(record, 'x') && hasNumber(record, 'width')
    ? record.x + record.width
    : hasNumber(record, 'x0') && hasNumber(record, 'x1') ? Math.max(record.x0, record.x1) : left;
  const bottom = hasNumber(record, 'y') && hasNumber(record, 'height')
    ? record.y + record.height
    : hasNumber(record, 'y0') && hasNumber(record, 'y1') ? Math.max(record.y0, record.y1) : top;
  if (right < 0 || bottom < 0 || left >= width || top >= height) {
    diagnostics.push(screenDslWarning('SCREEN_DSL_OBJECT_OUT_OF_BOUNDS', 'Object is fully outside the screen bounds.', path));
  } else if (left < 0 || top < 0 || right > width || bottom > height) {
    diagnostics.push(screenDslWarning('SCREEN_DSL_OBJECT_PARTIALLY_OUT_OF_BOUNDS', 'Object is partially outside the screen bounds.', path));
  }
  return diagnostics;
}

function hasNumber<T extends string>(record: Record<string, unknown>, key: T): record is Record<T, number> & Record<string, unknown> {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function validateResourceRefs(document: ScreenDslDocumentV1): ScreenDslDiagnostic[] {
  const packageV1 = screenDslDocumentToInterchange(document);
  const diagnostics: ScreenDslDiagnostic[] = [];
  const hasResource = (ref: string): boolean => Boolean(packageV1.resources.fonts[ref] ?? packageV1.resources.glyphs[ref] ?? packageV1.resources.bitmaps[ref]);
  for (const screen of packageV1.screens) {
    for (const object of screen.objects) {
      for (const ref of object.resourceRefs) {
        if (!hasResource(ref)) {
          diagnostics.push(screenDslError('SCREEN_DSL_MISSING_RESOURCE', `Missing resource "${ref}".`, `$.screens.${screen.id}.objects.${object.id}.resourceRefs`));
        }
      }
      if (object.type === 'bitmap' && !packageV1.resources.bitmaps[object.bitmapRef]) {
        diagnostics.push(screenDslError('SCREEN_DSL_MISSING_BITMAP', `Missing bitmap "${object.bitmapRef}".`, `$.screens.${screen.id}.objects.${object.id}.bitmapRef`));
      }
    }
  }
  return diagnostics;
}
