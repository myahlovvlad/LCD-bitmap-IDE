import { canonicalizeScreenInterchange } from '../screen-interchange';
import { screenDslDocumentToInterchange, screenInterchangeToDslDocument } from './conversion';
import { screenDslError } from './diagnostics';
import {
  SCREEN_DSL_FORMAT,
  SCREEN_DSL_LAYOUT_MODE,
  SCREEN_DSL_VERSION,
  type ScreenDslDocumentV1,
  type ScreenDslParseResult
} from './model';
import { validateScreenDslDocument } from './validation';

const MAX_SOURCE_BYTES = 1_000_000;
const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function parseScreenDslJson(source: string): ScreenDslParseResult {
  if (source.length > MAX_SOURCE_BYTES) {
    return fail('SCREEN_DSL_SOURCE_TOO_LARGE', 'Screen DSL JSON source exceeds parser limit.');
  }
  const scan = scanJsonObjectKeys(source);
  if (scan.length > 0) {
    return { ok: false, document: null, diagnostics: scan };
  }
  try {
    const parsed = JSON.parse(source) as unknown;
    return normalizeParsedDocument(parsed);
  } catch (error) {
    return fail('SCREEN_DSL_JSON_PARSE_ERROR', error instanceof Error ? error.message : 'Invalid JSON.');
  }
}

export function writeCanonicalScreenDslJson(document: ScreenDslDocumentV1): string {
  const interchange = canonicalizeScreenInterchange(screenDslDocumentToInterchange(document));
  const canonical = screenInterchangeToDslDocument(interchange);
  return `${JSON.stringify(canonical)}\n`;
}

export function normalizeParsedDocument(value: unknown): ScreenDslParseResult {
  const diagnostics = validateRootShape(value);
  if (diagnostics.length > 0) {
    return { ok: false, document: null, diagnostics };
  }
  const document = value as ScreenDslDocumentV1;
  const validation = validateScreenDslDocument(document);
  return { ok: validation.ok, document: validation.ok ? document : null, diagnostics: validation.diagnostics };
}

function validateRootShape(value: unknown) {
  const diagnostics = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(screenDslError('SCREEN_DSL_ROOT_NOT_OBJECT', 'Screen DSL root must be an object.'));
    return diagnostics;
  }
  const root = value as Partial<ScreenDslDocumentV1>;
  if (root.format !== SCREEN_DSL_FORMAT) {
    diagnostics.push(screenDslError('SCREEN_DSL_INVALID_FORMAT', `Expected format ${SCREEN_DSL_FORMAT}.`, '$.format'));
  }
  if (root.version !== SCREEN_DSL_VERSION) {
    diagnostics.push(screenDslError('SCREEN_DSL_INVALID_VERSION', `Expected version ${SCREEN_DSL_VERSION}.`, '$.version'));
  }
  if (root.layoutMode !== SCREEN_DSL_LAYOUT_MODE) {
    diagnostics.push(screenDslError('SCREEN_DSL_UNSUPPORTED_LAYOUT_MODE', 'Only explicit layout is supported in Phase 4B.', '$.layoutMode'));
  }
  if (!Array.isArray(root.screens)) {
    diagnostics.push(screenDslError('SCREEN_DSL_SCREENS_REQUIRED', 'screens must be an array.', '$.screens'));
  }
  if (!root.resources || typeof root.resources !== 'object' || Array.isArray(root.resources)) {
    diagnostics.push(screenDslError('SCREEN_DSL_RESOURCES_REQUIRED', 'resources must be an object.', '$.resources'));
  }
  return diagnostics;
}

function scanJsonObjectKeys(source: string) {
  const diagnostics = [];
  const stack: Array<{ keys: Set<string> }> = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"') {
      const start = index;
      const { value, end } = readJsonString(source, index);
      index = end;
      let cursor = index;
      while (/\s/.test(source[cursor] ?? '')) cursor += 1;
      if (source[cursor] === ':' && stack.length > 0) {
        const scope = stack[stack.length - 1];
        const { line, column } = positionFor(source, start);
        if (scope.keys.has(value)) {
          diagnostics.push(screenDslError('SCREEN_DSL_DUPLICATE_KEY', `Duplicate key "${value}".`, '$', line, column));
        }
        if (PROTOTYPE_KEYS.has(value)) {
          diagnostics.push(screenDslError('SCREEN_DSL_PROTOTYPE_KEY', `Prototype key "${value}" is not allowed.`, '$', line, column));
        }
        scope.keys.add(value);
      }
      continue;
    }
    if (char === '{') {
      stack.push({ keys: new Set() });
    } else if (char === '}') {
      stack.pop();
    }
    index += 1;
  }
  return diagnostics;
}

function readJsonString(source: string, start: number): { value: string; end: number } {
  let index = start + 1;
  let value = '';
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      value += char + (source[index + 1] ?? '');
      index += 2;
      continue;
    }
    if (char === '"') {
      return { value: JSON.parse(source.slice(start, index + 1)) as string, end: index + 1 };
    }
    value += char;
    index += 1;
  }
  return { value, end: index };
}

function positionFor(source: string, index: number): { line: number; column: number } {
  const prefix = source.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function fail(code: string, message: string): ScreenDslParseResult {
  return { ok: false, document: null, diagnostics: [screenDslError(code, message)] };
}
