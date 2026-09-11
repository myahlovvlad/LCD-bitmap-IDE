import type React from 'react';
import type { ThemePreference } from './themePreference';

export interface ThemeSelectorLabels {
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
}

export function ThemeSelector({
  preference,
  onChange,
  labels,
  testId = 'theme-selector',
  compact = false
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  labels: ThemeSelectorLabels;
  testId?: string;
  compact?: boolean;
}): React.ReactElement {
  return (
    <label className={compact ? 'theme-selector theme-selector-compact' : 'theme-selector'}>
      <span>{labels.theme}</span>
      <select
        aria-label={labels.theme}
        data-testid={testId}
        value={preference}
        onChange={(event) => onChange(event.target.value as ThemePreference)}
      >
        <option value="system">{labels.themeSystem}</option>
        <option value="light">{labels.themeLight}</option>
        <option value="dark">{labels.themeDark}</option>
      </select>
    </label>
  );
}
