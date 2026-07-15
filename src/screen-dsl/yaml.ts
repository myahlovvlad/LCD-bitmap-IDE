import { screenDslError } from './diagnostics';
import { parseScreenDslJson, writeCanonicalScreenDslJson } from './json';
import type { ScreenDslDocumentV1, ScreenDslParseResult } from './model';

const FORBIDDEN_YAML = [
  { pattern: /^---/m, code: 'SCREEN_DSL_YAML_MULTI_DOCUMENT', message: 'Multiple YAML documents are not supported.' },
  { pattern: /(^|\s)![A-Za-z]/, code: 'SCREEN_DSL_YAML_TAG', message: 'YAML custom tags are not allowed.' },
  { pattern: /(^|\s)&[A-Za-z0-9_-]+/, code: 'SCREEN_DSL_YAML_ANCHOR', message: 'YAML anchors are not allowed.' },
  { pattern: /(^|\s)\*[A-Za-z0-9_-]+/, code: 'SCREEN_DSL_YAML_ALIAS', message: 'YAML aliases are not allowed.' },
  { pattern: /^\s*<<\s*:/m, code: 'SCREEN_DSL_YAML_MERGE', message: 'YAML merge keys are not allowed.' }
] as const;

const ORDERED_KEYS = ['format', 'version', 'layoutMode', 'project', 'screens', 'resources'] as const;

export function parseScreenDslYaml(source: string): ScreenDslParseResult {
  for (const rule of FORBIDDEN_YAML) {
    if (rule.pattern.test(source)) {
      return { ok: false, document: null, diagnostics: [screenDslError(rule.code, rule.message)] };
    }
  }
  const record: Record<string, unknown> = {};
  const seen = new Set<string>();
  const lines = source.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('#'));
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      return {
        ok: false,
        document: null,
        diagnostics: [screenDslError('SCREEN_DSL_YAML_UNSUPPORTED_SYNTAX', 'Only canonical top-level Screen DSL YAML is supported.', '$', index + 1, 1)]
      };
    }
    const [, key, rawValue] = match;
    if (seen.has(key)) {
      return {
        ok: false,
        document: null,
        diagnostics: [screenDslError('SCREEN_DSL_DUPLICATE_KEY', `Duplicate key "${key}".`, `$ .${key}`.replace(' ', ''), index + 1, 1)]
      };
    }
    seen.add(key);
    try {
      record[key] = parseYamlScalarOrJson(rawValue, key);
    } catch (error) {
      return {
        ok: false,
        document: null,
        diagnostics: [screenDslError(
          'SCREEN_DSL_YAML_PARSE_ERROR',
          error instanceof Error ? error.message : 'Invalid YAML value.',
          `$ .${key}`.replace(' ', ''),
          index + 1,
          line.indexOf(rawValue) + 1
        )]
      };
    }
  }
  return parseScreenDslJson(JSON.stringify(record));
}

export function writeCanonicalScreenDslYaml(document: ScreenDslDocumentV1): string {
  const canonical = JSON.parse(writeCanonicalScreenDslJson(document)) as ScreenDslDocumentV1;
  return `${ORDERED_KEYS.map((key) => `${key}: ${formatYamlValue(canonical[key])}`).join('\n')}\n`;
}

function parseYamlScalarOrJson(value: string, key: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`Missing value for ${key}.`);
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    return JSON.parse(trimmed) as unknown;
  }
  return trimmed;
}

function formatYamlValue(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9_./-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}
