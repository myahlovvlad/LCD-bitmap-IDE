import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreenDslJson, parseScreenDslYaml, validateScreenDslDocument } from '../../src/screen-dsl';

const EXAMPLE_DIR = join(process.cwd(), 'examples', 'screen-dsl');
const EXAMPLES = [
  'minimal-screen.lcdscreen.json',
  'minimal-screen.lcdscreen.yaml',
  'text-and-frame.lcdscreen.yaml',
  'resource-example.lcdscreen.yaml'
];

describe('Screen DSL examples', () => {
  it.each(EXAMPLES)('parses and validates %s', (fileName) => {
    const source = readFileSync(join(EXAMPLE_DIR, fileName), 'utf8');
    const parsed = fileName.endsWith('.json')
      ? parseScreenDslJson(source)
      : parseScreenDslYaml(source);
    const validation = parsed.document ? validateScreenDslDocument(parsed.document) : { ok: false, diagnostics: parsed.diagnostics };

    expect(parsed.ok, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(validation.ok, JSON.stringify(validation.diagnostics)).toBe(true);
  });
});
