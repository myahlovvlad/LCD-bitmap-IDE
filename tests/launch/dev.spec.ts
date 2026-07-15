import { expect, test } from '@playwright/test';

test('development renderer opens without fatal errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
  await expect(page.locator('.lcd-canvas')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
