import {
  screenInterchangeToDslDocument,
  validateScreenDslDocument,
  validateScreenDslPixelBudget,
  type ScreenDslDiagnostic,
  type ScreenDslObjectV1
} from '../screen-dsl';
import type { ScreenInterchangeObjectV1, ScreenInterchangeProjectV1 } from '../screen-interchange';
import { MAX_SCREEN_HTML_BYTES, SCREEN_HTML_FORMAT, SCREEN_HTML_VERSION, type ScreenHtmlParseResult } from './model';

const rootAttributes = new Set(['data-lcd-format', 'data-lcd-version', 'data-lcd-screen-id', 'data-lcd-width', 'data-lcd-height']);
const commonAttributes = new Set(['data-lcd-id', 'data-lcd-order', 'data-lcd-z-index', 'data-lcd-visible', 'data-lcd-locked', 'data-lcd-source', 'data-lcd-resource-refs']);
const typeAttributes: Record<string, readonly string[]> = {
  'lcd-text': ['data-lcd-x', 'data-lcd-y', 'data-lcd-font', 'data-lcd-pending-translation', 'data-lcd-text-en', 'data-lcd-text-ru', 'data-lcd-text-zh', 'data-lcd-display-language'],
  'lcd-line': ['data-lcd-x0', 'data-lcd-y0', 'data-lcd-x1', 'data-lcd-y1'],
  'lcd-rect': ['data-lcd-x', 'data-lcd-y', 'data-lcd-width', 'data-lcd-height', 'data-lcd-filled'],
  'lcd-icon': ['data-lcd-x', 'data-lcd-y', 'data-lcd-width', 'data-lcd-height', 'data-lcd-icon-id'],
  'lcd-bitmap': ['data-lcd-x', 'data-lcd-y', 'data-lcd-width', 'data-lcd-height', 'data-lcd-name', 'data-lcd-bitmap-ref'],
  'lcd-special': ['data-lcd-x', 'data-lcd-y', 'data-lcd-width', 'data-lcd-height', 'data-lcd-kind', 'data-lcd-checked', 'data-lcd-value', 'data-lcd-font', 'data-lcd-glyph-char', 'data-lcd-glyph-override-ref'],
  'lcd-invert': ['data-lcd-x', 'data-lcd-y', 'data-lcd-width', 'data-lcd-height']
};

interface ParsedTag { name: string; attributes: Record<string, string>; }

export function htmlToScreenDslDocument(source: string, basePackage: ScreenInterchangeProjectV1): ScreenHtmlParseResult {
  const diagnostics: ScreenDslDiagnostic[] = [];
  if (new TextEncoder().encode(source).length > MAX_SCREEN_HTML_BYTES) {
    return failed([diagnostic('SCREEN_HTML_SOURCE_TOO_LARGE', 'HTML source exceeds the 512 KiB limit.', '$')]);
  }
  const tags = tokenize(source, diagnostics);
  if (diagnostics.length) return failed(diagnostics);
  const root = tags[0];
  if (!root || root.name !== 'section') return failed([diagnostic('SCREEN_HTML_ROOT_REQUIRED', 'A single LCD section root is required.', '$')]);
  validateAttributeNames(root.attributes, rootAttributes, '$', diagnostics);
  if (root.attributes['data-lcd-format'] !== SCREEN_HTML_FORMAT) diagnostics.push(diagnostic('SCREEN_HTML_FORMAT', `Expected ${SCREEN_HTML_FORMAT}.`, '$.data-lcd-format'));
  if (root.attributes['data-lcd-version'] !== String(SCREEN_HTML_VERSION)) diagnostics.push(diagnostic('SCREEN_HTML_VERSION', `Expected version ${SCREEN_HTML_VERSION}.`, '$.data-lcd-version'));
  const screenId = root.attributes['data-lcd-screen-id'];
  const baseScreen = basePackage.screens.find((screen) => screen.id === screenId);
  if (!screenId || !baseScreen) diagnostics.push(diagnostic('SCREEN_HTML_SCREEN_NOT_FOUND', 'Root references a screen not present in the base package.', '$.data-lcd-screen-id'));
  const width = integer(root.attributes['data-lcd-width'], '$.data-lcd-width', diagnostics);
  const height = integer(root.attributes['data-lcd-height'], '$.data-lcd-height', diagnostics);
  if (baseScreen && (width !== baseScreen.display.width || height !== baseScreen.display.height)) diagnostics.push(diagnostic('SCREEN_HTML_DIMENSION_MISMATCH', 'HTML dimensions must match the target screen.', '$'));

  const objectIds = new Set<string>();
  const objects = tags.slice(1).map((tag, index) => parseObject(tag, index, objectIds, diagnostics)).filter((item): item is ScreenInterchangeObjectV1 => item !== null);
  if (diagnostics.length || !baseScreen) return failed(diagnostics);
  const candidate = structuredClone(basePackage);
  const screenIndex = candidate.screens.findIndex((screen) => screen.id === screenId);
  candidate.screens = candidate.screens.map((screen, index) => index === screenIndex ? {
    ...screen,
    display: { ...screen.display, width: width!, height: height! },
    objectOrder: objects.map((object) => object.id),
    objects
  } : screen);
  const document = screenInterchangeToDslDocument(candidate);
  diagnostics.push(...validateScreenDslDocument(document).diagnostics, ...validateScreenDslPixelBudget(document).diagnostics);
  return diagnostics.some((item) => item.severity === 'error') ? failed(diagnostics, screenId) : { screenId, document, diagnostics };
}

function tokenize(source: string, diagnostics: ScreenDslDiagnostic[]): ParsedTag[] {
  const tokens: ParsedTag[] = [];
  const regex = /<\/?([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g;
  const stack: string[] = [];
  let cursor = 0;
  for (const match of source.matchAll(regex)) {
    if (!/^\s*$/.test(source.slice(cursor, match.index))) diagnostics.push(diagnostic('SCREEN_HTML_TEXT_NOT_ALLOWED', 'Only declarative LCD elements are allowed.', '$'));
    cursor = (match.index ?? 0) + match[0].length;
    const closing = match[0].startsWith('</');
    const name = match[1].toLowerCase();
    if (closing) {
      if (match[2].trim() || stack.pop() !== name) diagnostics.push(diagnostic('SCREEN_HTML_TAG_STRUCTURE', `Unexpected closing tag ${name}.`, '$'));
      continue;
    }
    if (name !== 'section' && !(name in typeAttributes)) diagnostics.push(diagnostic('SCREEN_HTML_FORBIDDEN_ELEMENT', `Element ${name} is not an LCD layout element.`, '$'));
    const attributes = parseAttributes(match[2], '$', diagnostics);
    tokens.push({ name, attributes });
    stack.push(name);
  }
  if (!/^\s*$/.test(source.slice(cursor))) diagnostics.push(diagnostic('SCREEN_HTML_TEXT_NOT_ALLOWED', 'Only declarative LCD elements are allowed.', '$'));
  if (stack.length !== 0 || tokens.length === 0) diagnostics.push(diagnostic('SCREEN_HTML_TAG_STRUCTURE', 'HTML tags must be balanced.', '$'));
  if (tokens.filter((tag) => tag.name === 'section').length !== 1) diagnostics.push(diagnostic('SCREEN_HTML_ROOT_COUNT', 'Exactly one LCD section root is required.', '$'));
  return tokens;
}

function parseAttributes(raw: string, path: string, diagnostics: ScreenDslDiagnostic[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([A-Za-z][A-Za-z0-9-]*)\s*=\s*"([^"]*)"/g;
  for (const match of raw.matchAll(regex)) {
    if (attributes[match[1]] !== undefined) diagnostics.push(diagnostic('SCREEN_HTML_DUPLICATE_ATTRIBUTE', `Duplicate attribute ${match[1]}.`, path));
    attributes[match[1]] = decodeEntity(match[2]);
  }
  if (!/^\s*$/.test(raw.replace(regex, ''))) diagnostics.push(diagnostic('SCREEN_HTML_ATTRIBUTE_SYNTAX', 'Every attribute must be quoted.', path));
  return attributes;
}

function parseObject(tag: ParsedTag, index: number, ids: Set<string>, diagnostics: ScreenDslDiagnostic[]): ScreenInterchangeObjectV1 | null {
  const permitted = new Set([...commonAttributes, ...(typeAttributes[tag.name] ?? [])]);
  validateAttributeNames(tag.attributes, permitted, `$.objects[${index}]`, diagnostics);
  if (!(tag.name in typeAttributes)) return null;
  const common = commonObject(tag.attributes, index, ids, diagnostics);
  if (!common) return null;
  const path = `$.objects[${index}]`;
  if (tag.name === 'lcd-text') return {
    ...common, type: 'text', x: integer(tag.attributes['data-lcd-x'], `${path}.x`, diagnostics), y: integer(tag.attributes['data-lcd-y'], `${path}.y`, diagnostics),
    fontVariant: required(tag.attributes, 'data-lcd-font', path, diagnostics) as '1' | '2', pendingTranslation: booleanValue(tag.attributes['data-lcd-pending-translation'], `${path}.pendingTranslation`, diagnostics),
    text: { en: required(tag.attributes, 'data-lcd-text-en', path, diagnostics), ru: required(tag.attributes, 'data-lcd-text-ru', path, diagnostics), ...(tag.attributes['data-lcd-text-zh'] !== undefined ? { zh: tag.attributes['data-lcd-text-zh'] } : {}) },
    ...(tag.attributes['data-lcd-display-language'] ? { displayLanguage: tag.attributes['data-lcd-display-language'] as 'en' | 'ru' | 'zh' } : {})
  };
  if (tag.name === 'lcd-line') return { ...common, type: 'line', x0: integer(tag.attributes['data-lcd-x0'], `${path}.x0`, diagnostics), y0: integer(tag.attributes['data-lcd-y0'], `${path}.y0`, diagnostics), x1: integer(tag.attributes['data-lcd-x1'], `${path}.x1`, diagnostics), y1: integer(tag.attributes['data-lcd-y1'], `${path}.y1`, diagnostics) };
  const geometry = { x: integer(tag.attributes['data-lcd-x'], `${path}.x`, diagnostics), y: integer(tag.attributes['data-lcd-y'], `${path}.y`, diagnostics), width: integer(tag.attributes['data-lcd-width'], `${path}.width`, diagnostics), height: integer(tag.attributes['data-lcd-height'], `${path}.height`, diagnostics) };
  if (tag.name === 'lcd-rect') return { ...common, type: 'rect', ...geometry, filled: booleanValue(tag.attributes['data-lcd-filled'], `${path}.filled`, diagnostics) };
  if (tag.name === 'lcd-icon') return { ...common, type: 'icon', ...geometry, iconId: required(tag.attributes, 'data-lcd-icon-id', path, diagnostics) };
  if (tag.name === 'lcd-bitmap') return { ...common, type: 'bitmap', ...geometry, name: required(tag.attributes, 'data-lcd-name', path, diagnostics), bitmapRef: required(tag.attributes, 'data-lcd-bitmap-ref', path, diagnostics) };
  if (tag.name === 'lcd-special') return { ...common, type: 'special', ...geometry, kind: required(tag.attributes, 'data-lcd-kind', path, diagnostics) as ScreenInterchangeObjectV1 & string, checked: booleanValue(tag.attributes['data-lcd-checked'], `${path}.checked`, diagnostics), value: integer(tag.attributes['data-lcd-value'], `${path}.value`, diagnostics), ...(tag.attributes['data-lcd-font'] ? { fontVariant: tag.attributes['data-lcd-font'] as '1' | '2' } : {}), ...(tag.attributes['data-lcd-glyph-char'] ? { glyphChar: tag.attributes['data-lcd-glyph-char'] } : {}), ...(tag.attributes['data-lcd-glyph-override-ref'] ? { glyphOverrideRef: tag.attributes['data-lcd-glyph-override-ref'] } : {}) } as ScreenInterchangeObjectV1;
  return { ...common, type: 'invert', ...geometry };
}

function commonObject(attributes: Record<string, string>, index: number, ids: Set<string>, diagnostics: ScreenDslDiagnostic[]) {
  const path = `$.objects[${index}]`;
  const id = required(attributes, 'data-lcd-id', path, diagnostics);
  if (ids.has(id)) diagnostics.push(diagnostic('SCREEN_HTML_DUPLICATE_OBJECT_ID', `Duplicate object id ${id}.`, `${path}.id`));
  ids.add(id);
  let resourceRefs: string[] = [];
  try {
    const parsed = JSON.parse(required(attributes, 'data-lcd-resource-refs', path, diagnostics));
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) throw new Error();
    resourceRefs = parsed;
  } catch { diagnostics.push(diagnostic('SCREEN_HTML_RESOURCE_REFS', 'resourceRefs must be a JSON string array.', `${path}.resourceRefs`)); }
  return { id, order: integer(attributes['data-lcd-order'], `${path}.order`, diagnostics), zIndex: integer(attributes['data-lcd-z-index'], `${path}.zIndex`, diagnostics), visible: booleanValue(attributes['data-lcd-visible'], `${path}.visible`, diagnostics), locked: booleanValue(attributes['data-lcd-locked'], `${path}.locked`, diagnostics), source: required(attributes, 'data-lcd-source', path, diagnostics) as ScreenInterchangeObjectV1['source'], resourceRefs };
}

function validateAttributeNames(attributes: Record<string, string>, allowed: Set<string>, path: string, diagnostics: ScreenDslDiagnostic[]): void {
  for (const name of Object.keys(attributes)) if (!allowed.has(name)) diagnostics.push(diagnostic('SCREEN_HTML_FORBIDDEN_ATTRIBUTE', `Attribute ${name} is not allowed.`, path));
}
function integer(value: string | undefined, path: string, diagnostics: ScreenDslDiagnostic[]): number {
  const number = Number(value); if (!Number.isInteger(number)) diagnostics.push(diagnostic('SCREEN_HTML_INTEGER_REQUIRED', 'Value must be an integer.', path)); return Number.isInteger(number) ? number : 0;
}
function booleanValue(value: string | undefined, path: string, diagnostics: ScreenDslDiagnostic[]): boolean {
  if (value === 'true') return true; if (value === 'false') return false; diagnostics.push(diagnostic('SCREEN_HTML_BOOLEAN_REQUIRED', 'Value must be true or false.', path)); return false;
}
function required(attributes: Record<string, string>, name: string, path: string, diagnostics: ScreenDslDiagnostic[]): string {
  const value = attributes[name]; if (value === undefined) diagnostics.push(diagnostic('SCREEN_HTML_ATTRIBUTE_REQUIRED', `${name} is required.`, path)); return value ?? '';
}
function decodeEntity(value: string): string { return value.replace(/&(amp|lt|gt|quot|#39);/g, (_all, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity] ?? ''); }
function diagnostic(code: string, message: string, path: string): ScreenDslDiagnostic { return { code, severity: 'error', message, path }; }
function failed(diagnostics: readonly ScreenDslDiagnostic[], screenId: string | null = null): ScreenHtmlParseResult { return { screenId, document: null, diagnostics }; }
