import { expect, test } from '@playwright/test';

test('interactive workspace stays responsive within interaction budgets', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const metrics = await page.evaluate(async () => {
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push(entry.duration);
      }
    });
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Older Chromium builds may not expose longtask entries.
    }

    const dispatchDurations: number[] = [];
    const settleDurations: number[] = [];
    const search = document.querySelector<HTMLInputElement>('.state-filter input');
    const graphButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.graph-toolbar button')).slice(0, 2);
    if (!search || graphButtons.length < 2) {
      throw new Error('Performance controls are unavailable');
    }
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    for (const value of ['diagnostic', 'menu', 'system', '', 'warmup', '']) {
      const startedAt = performance.now();
      valueSetter?.call(search, value);
      search.dispatchEvent(new Event('input', { bubbles: true }));
      dispatchDurations.push(performance.now() - startedAt);
      await new Promise((resolve) => setTimeout(resolve, 0));
      settleDurations.push(performance.now() - startedAt);
    }

    for (let index = 0; index < 6; index += 1) {
      const startedAt = performance.now();
      graphButtons[index % 2].click();
      dispatchDurations.push(performance.now() - startedAt);
      await new Promise((resolve) => setTimeout(resolve, 0));
      settleDurations.push(performance.now() - startedAt);
    }

    observer.disconnect();
    return { dispatchDurations, settleDurations, longTasks };
  });

  const percentile95 = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? Number.POSITIVE_INFINITY;
  };
  const dispatchP95 = percentile95(metrics.dispatchDurations);
  const settleP95 = percentile95(metrics.settleDurations);
  await testInfo.attach('performance-metrics', {
    body: Buffer.from(JSON.stringify({ dispatchP95, settleP95, ...metrics }, null, 2)),
    contentType: 'application/json'
  });

  expect(dispatchP95).toBeLessThanOrEqual(16.7);
  expect(settleP95).toBeLessThanOrEqual(500);
  expect(metrics.longTasks.filter((duration) => duration > 200)).toEqual([]);
});

test('initial renderer becomes interactive within the startup budget', async ({ page }) => {
  const startedAt = performance.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  const elapsed = performance.now() - startedAt;
  expect(elapsed).toBeLessThan(3_000);
});
