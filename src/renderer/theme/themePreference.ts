export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_STORAGE_KEY = 'lcd-bitmap-ide.ui.theme.v1';

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function readThemePreference(storage: ThemeStorage | null = browserStorage()): ThemePreference {
  if (!storage) return 'system';
  try {
    return normalizeThemePreference(storage.getItem(THEME_PREFERENCE_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function writeThemePreference(
  preference: ThemePreference,
  storage: ThemeStorage | null = browserStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

function browserStorage(): ThemeStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
