import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('opens the production Electron renderer and displays the full LCD', async () => {
  const packagedExecutable = process.env.ELECTRON_EXECUTABLE_PATH;
  const app = await electron.launch({
    ...(packagedExecutable
      ? { executablePath: resolve(packagedExecutable), args: [] }
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
      async () => window.evaluate(() => window.spectroDesigner?.platform ?? null)
    ).not.toBeNull();
    const demoButton = window.getByRole('button', { name: /Demo|Демо|Open demo|Открыть демо/ }).first();
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
    }
    await expect(window.locator('.workspace-navigation')).toBeVisible();
    await window.setViewportSize({ width: 1536, height: 864 });
    await window.locator('.workspace-navigation button[data-workspace="lcd"]').click();
    const controls = window.locator('.lcd-editor > .flex-1');
    const preview = window.locator('.lcd-editor > .lcd-display-column');
    await expect(controls).toBeVisible();
    await expect(preview).toBeVisible();
    const controlsBounds = await controls.boundingBox();
    const previewBounds = await preview.boundingBox();
    expect(previewBounds?.x).toBeGreaterThan((controlsBounds?.x ?? 0) + (controlsBounds?.width ?? 0) - 2);
    await expect.poll(() => controls.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
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
