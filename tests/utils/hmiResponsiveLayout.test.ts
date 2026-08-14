import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('HMI designer responsive layout regression', () => {
  it('queries the parent column and keeps the LCD canvas inside its panel', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/renderer/styles.css'), 'utf8');

    expect(css).toMatch(/\.hmi-designer-left\s*\{\s*container-type:\s*inline-size;/);
    expect(css).not.toMatch(/\.hmi-device-panel\s*\{[^}]*container-type:/s);
    expect(css).toMatch(/\.hmi-device-display canvas\s*\{[^}]*max-width:\s*100%;[^}]*height:\s*auto;/s);
  });
});
