import { describe, expect, it } from 'vitest';
import {
  createScreenDslDocumentKey,
  screenDslDocumentKeyEquals,
  serializeScreenDslDocumentKey
} from '../../src/application/screenDslSession/identity';

describe('Screen DSL session identity', () => {
  it('keys with same params are equal', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'create', ['screen-a', 'screen-b']);
    const b = createScreenDslDocumentKey('proj-1', 'json', 'create', ['screen-a', 'screen-b']);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(true);
  });

  it('target IDs are sorted canonically', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'create', ['z', 'a', 'm']);
    const b = createScreenDslDocumentKey('proj-1', 'json', 'create', ['a', 'm', 'z']);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(true);
    expect(a.targetScreenIds).toEqual(['a', 'm', 'z']);
  });

  it('duplicate target IDs are deduplicated', () => {
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', ['a', 'a', 'b']);

    expect(key.targetScreenIds).toEqual(['a', 'b']);
  });

  it('different project IDs produce different keys', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const b = createScreenDslDocumentKey('proj-2', 'json', 'create', []);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(false);
  });

  it('different formats produce different keys', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const b = createScreenDslDocumentKey('proj-1', 'yaml', 'create', []);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(false);
  });

  it('different import modes produce different keys', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const b = createScreenDslDocumentKey('proj-1', 'json', 'update', []);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(false);
  });

  it('different target screen sets produce different keys', () => {
    const a = createScreenDslDocumentKey('proj-1', 'json', 'update', ['screen-a']);
    const b = createScreenDslDocumentKey('proj-1', 'json', 'update', ['screen-b']);

    expect(screenDslDocumentKeyEquals(a, b)).toBe(false);
  });

  it('create mode can have empty target list', () => {
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);

    expect(key.targetScreenIds).toHaveLength(0);
    expect(key.importMode).toBe('create');
  });

  it('serialization is deterministic', () => {
    const key = createScreenDslDocumentKey('proj-1', 'json', 'clone', ['screen-b', 'screen-a']);
    const s1 = serializeScreenDslDocumentKey(key);
    const s2 = serializeScreenDslDocumentKey(key);

    expect(s1).toBe(s2);
  });

  it('serialization differs between YAML and JSON sessions', () => {
    const jsonKey = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const yamlKey = createScreenDslDocumentKey('proj-1', 'yaml', 'create', []);

    expect(serializeScreenDslDocumentKey(jsonKey)).not.toBe(serializeScreenDslDocumentKey(yamlKey));
  });

  it('create/update/clone sessions have different serialized keys', () => {
    const createKey = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const updateKey = createScreenDslDocumentKey('proj-1', 'json', 'update', ['s1']);
    const cloneKey = createScreenDslDocumentKey('proj-1', 'json', 'clone', ['s1']);
    const keys = [
      serializeScreenDslDocumentKey(createKey),
      serializeScreenDslDocumentKey(updateKey),
      serializeScreenDslDocumentKey(cloneKey)
    ];

    expect(new Set(keys).size).toBe(3);
  });
});
