import { expect, test } from '@playwright/test';

test('LCD workspace visual regression at 1024x720', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
  await page.locator('.workspace-navigation button[data-workspace="lcd"]').click();
  await expect(page.locator('.lcd-workspace .lcd-editor')).toBeVisible();
  await expect(page.locator('.workspace-host')).toHaveScreenshot('lcd-editor-1024.png', {
    animations: 'disabled'
  });
});

test('manual visual regression at desktop size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
  await page.getByRole('button', { name: /^Manual$/ }).click();
  await expect(page.locator('.manual-dialog')).toHaveScreenshot('manual-en-1440.png', {
    animations: 'disabled'
  });
});
