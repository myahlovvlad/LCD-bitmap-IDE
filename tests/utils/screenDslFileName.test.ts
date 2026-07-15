import { describe, expect, it } from 'vitest';
import {
  canonicalExtensionForFormat,
  createSafeScreenDslFilename,
  createSafeScreenDslProjectFilename
} from '../../src/shared/screenDslFiles/filename';

describe('Screen DSL safe filenames', () => {
  it('creates canonical filenames for JSON and YAML', () => {
    expect(createSafeScreenDslFilename('Main Menu', 'yaml')).toBe('Main Menu.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('Main Menu', 'json')).toBe('Main Menu.lcdscreen.json');
    expect(canonicalExtensionForFormat('yaml')).toBe('.lcdscreen.yaml');
    expect(canonicalExtensionForFormat('json')).toBe('.lcdscreen.json');
  });

  it('preserves safe Unicode names', () => {
    expect(createSafeScreenDslFilename('Диагностика', 'yaml')).toBe('Диагностика.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('诊断', 'json')).toBe('诊断.lcdscreen.json');
  });

  it('removes invalid path and Windows filename characters', () => {
    expect(createSafeScreenDslFilename('../C:\\bad<name>|?', 'yaml')).toBe('badname.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('screen/name*with"chars', 'json')).toBe('namewithchars.lcdscreen.json');
  });

  it('protects Windows reserved device names', () => {
    expect(createSafeScreenDslFilename('CON', 'yaml')).toBe('screen-CON.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('prn', 'json')).toBe('screen-prn.lcdscreen.json');
    expect(createSafeScreenDslFilename('COM1', 'yaml')).toBe('screen-COM1.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('LPT9', 'json')).toBe('screen-LPT9.lcdscreen.json');
    expect(createSafeScreenDslFilename('CLOCK$', 'yaml')).toBe('screen-CLOCK$.lcdscreen.yaml');
  });

  it('normalizes duplicate extensions', () => {
    expect(createSafeScreenDslFilename('main.lcdscreen.yaml', 'yaml')).toBe('main.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('main.yaml', 'yaml')).toBe('main.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('main.json', 'json')).toBe('main.lcdscreen.json');
  });

  it('falls back for empty and dot-only names', () => {
    expect(createSafeScreenDslFilename('', 'yaml')).toBe('screen.lcdscreen.yaml');
    expect(createSafeScreenDslFilename('...', 'json')).toBe('screen.lcdscreen.json');
  });

  it('bounds very long stems deterministically', () => {
    const filename = createSafeScreenDslFilename('x'.repeat(300), 'yaml');
    expect(filename).toHaveLength(128 + '.lcdscreen.yaml'.length);
    expect(filename.endsWith('.lcdscreen.yaml')).toBe(true);
  });

  it('creates project-level multi-screen filenames', () => {
    expect(createSafeScreenDslProjectFilename('Universal LCD', 'yaml')).toBe('Universal LCD-screens.lcdscreen.yaml');
  });
});
