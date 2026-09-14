import { describe, expect, it } from 'vitest';
import {
  normalizeThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_PREFERENCE_STORAGE_KEY,
  writeThemePreference,
  type ThemeStorage
} from '../../src/renderer/theme/themePreference';

function createMemoryStorage(initialValue: string | null = null): ThemeStorage & { value: string | null } {
  return {
    value: initialValue,
    getItem(key) {
      return key === THEME_PREFERENCE_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === THEME_PREFERENCE_STORAGE_KEY) this.value = value;
    }
  };
}

describe('IDE theme preference', () => {
  it('normalizes untrusted values to the system preference', () => {
    expect(normalizeThemePreference(undefined)).toBe('system');
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeThemePreference('unknown')).toBe('system');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
  });

  it('resolves system preference while explicit preferences ignore the system palette', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('persists and restores an explicit preference', () => {
    const storage = createMemoryStorage();

    expect(readThemePreference(storage)).toBe('system');
    expect(writeThemePreference('light', storage)).toBe(true);
    expect(storage.value).toBe('light');
    expect(readThemePreference(storage)).toBe('light');
  });

  it('falls back safely when browser storage is unavailable', () => {
    const throwingStorage: ThemeStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      }
    };

    expect(readThemePreference(throwingStorage)).toBe('system');
    expect(writeThemePreference('dark', throwingStorage)).toBe(false);
  });
});
