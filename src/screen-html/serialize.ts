import type { ScreenInterchangeObjectV1, ScreenInterchangeProjectV1 } from '../screen-interchange';
import { SCREEN_HTML_FORMAT, SCREEN_HTML_VERSION } from './model';

export function screenInterchangeToHtml(packageV1: ScreenInterchangeProjectV1, requestedScreenId?: string): string {
  const screenId = requestedScreenId ?? packageV1.project.screenOrder[0];
  const screen = packageV1.screens.find((item) => item.id === screenId);
  if (!screen) throw new Error(`Screen "${screenId ?? ''}" was not found in the interchange package.`);
  const root = attributes({
    'data-lcd-format': SCREEN_HTML_FORMAT,
    'data-lcd-version': String(SCREEN_HTML_VERSION),
    'data-lcd-screen-id': screen.id,
    'data-lcd-width': String(screen.display.width),
    'data-lcd-height': String(screen.display.height)
  });
  const objects = [...screen.objects]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((object) => `  ${serializeObject(object)}`);
  return [`<section ${root}>`, ...objects, '</section>', ''].join('\n');
}

function serializeObject(object: ScreenInterchangeObjectV1): string {
  const common = {
    'data-lcd-id': object.id,
    'data-lcd-order': String(object.order),
    'data-lcd-z-index': String(object.zIndex),
    'data-lcd-visible': String(object.visible),
    'data-lcd-locked': String(object.locked),
    'data-lcd-source': object.source,
    'data-lcd-resource-refs': JSON.stringify(object.resourceRefs)
  };
  const element = `lcd-${object.type}`;
  const specific = object.type === 'text'
    ? {
      'data-lcd-x': String(object.x), 'data-lcd-y': String(object.y),
      'data-lcd-font': object.fontVariant, 'data-lcd-pending-translation': String(object.pendingTranslation),
      'data-lcd-text-en': object.text.en, 'data-lcd-text-ru': object.text.ru,
      ...(object.text.zh !== undefined ? { 'data-lcd-text-zh': object.text.zh } : {}),
      ...(object.displayLanguage ? { 'data-lcd-display-language': object.displayLanguage } : {})
    }
    : object.type === 'line'
      ? { 'data-lcd-x0': String(object.x0), 'data-lcd-y0': String(object.y0), 'data-lcd-x1': String(object.x1), 'data-lcd-y1': String(object.y1) }
      : object.type === 'rect'
        ? geometry(object, { 'data-lcd-filled': String(object.filled) })
        : object.type === 'icon'
          ? geometry(object, { 'data-lcd-icon-id': object.iconId })
          : object.type === 'bitmap'
            ? geometry(object, { 'data-lcd-name': object.name, 'data-lcd-bitmap-ref': object.bitmapRef })
            : object.type === 'special'
              ? geometry(object, {
                'data-lcd-kind': object.kind, 'data-lcd-checked': String(object.checked), 'data-lcd-value': String(object.value),
                ...(object.fontVariant ? { 'data-lcd-font': object.fontVariant } : {}),
                ...(object.glyphChar ? { 'data-lcd-glyph-char': object.glyphChar } : {}),
                ...(object.glyphOverrideRef ? { 'data-lcd-glyph-override-ref': object.glyphOverrideRef } : {})
              })
              : geometry(object);
  return `<${element} ${attributes({ ...common, ...specific })}></${element}>`;
}

function geometry(object: { x: number; y: number; width: number; height: number }, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'data-lcd-x': String(object.x), 'data-lcd-y': String(object.y),
    'data-lcd-width': String(object.width), 'data-lcd-height': String(object.height),
    ...extra
  };
}

function attributes(values: Record<string, string>): string {
  return Object.entries(values).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
