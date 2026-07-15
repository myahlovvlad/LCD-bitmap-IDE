import { describe, expect, it } from 'vitest';
import { parseScreenDslJson, parseScreenDslYaml } from '../../src/screen-dsl';

describe('Screen DSL parser security', () => {
  it('rejects duplicate JSON keys before parsing', () => {
    const result = parseScreenDslJson('{"format":"lcd-bitmap-ide/screen","format":"other"}');

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('SCREEN_DSL_DUPLICATE_KEY');
  });

  it('rejects prototype pollution keys', () => {
    const result = parseScreenDslJson('{"format":"lcd-bitmap-ide/screen","__proto__":{}}');

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('SCREEN_DSL_PROTOTYPE_KEY');
  });

  it('rejects YAML tags, anchors, aliases, merge keys and multiple documents', () => {
    expect(parseScreenDslYaml('format: !evil value').diagnostics[0].code).toBe('SCREEN_DSL_YAML_TAG');
    expect(parseScreenDslYaml('format: &anchor value').diagnostics[0].code).toBe('SCREEN_DSL_YAML_ANCHOR');
    expect(parseScreenDslYaml('format: *anchor').diagnostics[0].code).toBe('SCREEN_DSL_YAML_ALIAS');
    expect(parseScreenDslYaml('<<: {"x":1}').diagnostics[0].code).toBe('SCREEN_DSL_YAML_MERGE');
    expect(parseScreenDslYaml('---\nformat: lcd-bitmap-ide/screen').diagnostics[0].code).toBe('SCREEN_DSL_YAML_MULTI_DOCUMENT');
  });
});
