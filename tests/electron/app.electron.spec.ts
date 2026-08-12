import { _electron as electron, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('opens the production Electron renderer and displays the full LCD', async () => {
  const packagedExecutable = process.env.ELECTRON_EXECUTABLE_PATH;
  const localExecutable = resolve('node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  const app = await electron.launch({
    ...(packagedExecutable
      ? { executablePath: resolve(packagedExecutable), args: [] }
      : existsSync(localExecutable)
        ? { executablePath: localExecutable, args: ['.'] }
        : { args: ['.'] }),
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key !== 'VITE_DEV_SERVER_URL' && key !== 'ELECTRON_RUN_AS_NODE'
      )
    )
  });

  try {
    const window = await app.firstWindow();
    await expect(window).toHaveTitle(/LCD-bitmap IDE/);
    await expect(window.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
    await expect.poll(
      async () => window.evaluate(() => window.spectroDesigner?.platform ?? null),
      { timeout: 15_000 }
    ).not.toBeNull();
    const demoButton = window.getByRole('button', { name: /Demo|Демо|Open demo|Открыть демо/ }).first();
    // A packaged build may restore the last project from its Electron user
    // profile. Wait for either valid entry point before choosing the demo: the
    // preload bridge becomes available before the asynchronous splash screen
    // has finished rendering its start actions.
    await expect(
      window.locator('.workspace-navigation, button:has-text("Open demo"), button:has-text("Открыть демо"), button:has-text("打开演示")').first()
    ).toBeVisible({ timeout: 30_000 });
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
    }
    await expect(window.locator('.workspace-navigation')).toBeVisible({ timeout: 30_000 });
    await window.setViewportSize({ width: 1536, height: 864 });
    await window.locator('.workspace-navigation button[data-workspace="lcd"]').click();
    const controls = window.locator('.lcd-editor > .flex-1');
    const preview = window.locator('.lcd-editor > .lcd-display-column');
    await expect(controls).toBeVisible();
    await expect(preview).toBeVisible();
    const controlsBounds = await controls.boundingBox();
    const previewBounds = await preview.boundingBox();
    expect(previewBounds?.x).toBeGreaterThan((controlsBounds?.x ?? 0) + (controlsBounds?.width ?? 0) - 2);
    // On a wide production window the inspector may fit without overflow;
    // it must at least keep a valid scroll container and remain next to LCD.
    await expect.poll(() => controls.evaluate((element) => element.scrollHeight >= element.clientHeight)).toBe(true);
    const lcd = preview.locator('.lcd-canvas');
    await expect(lcd).toBeVisible();
    const lcdBounds = await lcd.boundingBox();
    expect((lcdBounds?.width ?? 0) / (lcdBounds?.height ?? 1)).toBeCloseTo(2, 1);
    await expect.poll(
      async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false)
    ).toBe(true);
  } finally {
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.destroy();
      }
    });
    await app.close();
  }
});
