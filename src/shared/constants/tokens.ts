/**
 * @module shared/constants/tokens
 * @description Canvas-rendering colors for the LCD pixel simulator.
 *
 * App-level design tokens (backgrounds, buttons, borders, typography) live in
 * src/renderer/styles.css as CSS custom properties (--dk-*).  Do not add
 * duplicate UI color constants here — extend the CSS :root block instead.
 *
 * These constants are used exclusively by LCDCanvas (Canvas 2D API) where
 * CSS variables cannot be applied directly to canvas fill/stroke calls.
 */
export const DESIGN_TOKENS = {
  lcd: {
    background: '#87aa5c',
    activePixel: '#202a1b',
    inactivePixel: 'rgba(32, 42, 27, 0.08)',
    frame: '#18230b',
    frameBorder: '#0b0f19'
  }
} as const;
