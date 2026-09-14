import { useLayoutEffect, useState } from 'react';
import {
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference
} from './themePreference';

export interface AppThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export function useAppTheme(): AppThemeState {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());
  const [systemDark, setSystemDark] = useState(() => readSystemDarkPreference());
  const resolvedTheme = resolveTheme(preference, systemDark);

  useLayoutEffect(() => {
    const media = readSystemThemeMedia();
    if (!media) return;
    const update = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = (next: ThemePreference): void => {
    setPreferenceState(next);
    writeThemePreference(next);
  };

  return { preference, resolvedTheme, setPreference };
}

function readSystemDarkPreference(): boolean {
  return readSystemThemeMedia()?.matches ?? false;
}

function readSystemThemeMedia(): MediaQueryList | null {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  } catch {
    return null;
  }
}
