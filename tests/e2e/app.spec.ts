import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
});

test('exposes four isolated workspaces', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: /Workspaces|Рабочие области/ });
  await expect(navigation.getByRole('button', { name: /FSM editor|FSM-редактор/ })).toBeVisible();
  await expect(navigation.getByRole('button', { name: /LCD editor|LCD-редактор/ })).toBeVisible();
  await expect(navigation.getByRole('button', { name: /Control panel|Панель управления/ })).toBeVisible();
  await expect(navigation.getByRole('button', { name: /Preview|Просмотр/ })).toBeVisible();

  await navigation.getByRole('button', { name: /Control panel|Панель управления/ }).click();
  await expect(page.getByLabel(/Control panel editor/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Screens' })).toHaveCount(0);

  await navigation.getByRole('button', { name: /LCD editor|LCD-редактор/ }).click();
  await expect(page.getByLabel(/LCD editor/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import image', exact: true })).toBeVisible();
  await expect(page.getByText(/Transition properties/)).toHaveCount(0);
});

test('opens the linked screen from the FSM workspace', async ({ page }) => {
  await expect(page.getByLabel(/FSM editor/)).toBeVisible();
  await page.getByRole('button', { name: /Edit layout/ }).click();

  await expect(page.getByLabel(/LCD editor/)).toBeVisible();
  await expect(page.locator('.workspace-navigation button[data-workspace="lcd"]')).toHaveClass(/active/);
  await expect(page.locator('.lcd-editor-frame .lcd-canvas').first()).toBeVisible();
});

test('keeps the LCD preview to the right of a scrollable Canvas inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.locator('.workspace-navigation button[data-workspace="lcd"]').click();

  const controls = page.locator('.lcd-editor > .flex-1');
  const preview = page.locator('.lcd-editor > .lcd-display-column');
  await expect(controls).toBeVisible();
  await expect(preview).toBeVisible();
  const controlsBox = await controls.boundingBox();
  const previewBox = await preview.boundingBox();
  expect(previewBox?.x).toBeGreaterThan((controlsBox?.x ?? 0) + (controlsBox?.width ?? 0) - 2);
  await expect.poll(() => controls.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test('collapses, resizes and persists LCD sidebars', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.locator('.workspace-navigation button[data-workspace="lcd"]').click();

  const leftSidebar = page.locator('.lcd-workspace > .workspace-sidebar');
  const leftSplitter = page.getByRole('separator', { name: 'Resize Left Sidebar' });
  const initialWidth = (await leftSidebar.boundingBox())?.width ?? 0;
  const splitterBox = await leftSplitter.boundingBox();
  if (!splitterBox) throw new Error('Left splitter is unavailable.');
  await page.mouse.move(splitterBox.x + 3, splitterBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(splitterBox.x + 83, splitterBox.y + 100);
  await page.mouse.up();
  await expect.poll(async () => (await leftSidebar.boundingBox())?.width ?? 0).toBeGreaterThan(initialWidth + 60);

  await page.getByRole('button', { name: 'Collapse Left Sidebar' }).click();
  await expect(leftSidebar).toHaveClass(/collapsed/);
  await expect.poll(async () => (await leftSidebar.boundingBox())?.width ?? 0).toBeLessThan(60);
  await page.reload();
  await page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();
  await page.locator('.workspace-navigation button[data-workspace="lcd"]').click();
  await expect(leftSidebar).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Open Left Sidebar' }).click();

  const rightSidebar = page.locator('.lcd-workspace > .workspace-inspector');
  await page.getByRole('button', { name: 'Collapse Right Sidebar' }).click();
  await expect(rightSidebar).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Open Right Sidebar' }).click();
  await expect(rightSidebar).not.toHaveClass(/collapsed/);
});

test('edits screen dimensions and copies a screen from properties', async ({ page }) => {
  await page.locator('.workspace-navigation button[data-workspace="lcd"]').click();
  const inspector = page.locator('.lcd-workspace > .workspace-inspector');
  await inspector.getByLabel('Width').fill('144');
  await inspector.getByLabel('Height').fill('72');
  await expect(inspector.getByText('144x72')).toBeVisible();
  await expect(page.locator('.lcd-canvas')).toHaveAttribute('width', '720');
  await expect(page.locator('.lcd-canvas')).toHaveAttribute('height', '360');

  const screenCount = await page.locator('.lcd-workspace .entity-card').count();
  await inspector.getByRole('button', { name: 'Copy' }).click();
  await expect(page.locator('.lcd-workspace .entity-card')).toHaveCount(screenCount + 1);
  await expect(inspector.getByLabel('Name')).toHaveValue(/Copy$/);
});

test('creates a panel button and binds it to an FSM event', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.locator('.workspace-navigation button[data-workspace="control-panel"]').click();
  await page.getByLabel('Width').fill('1100');
  await page.getByLabel('Height').fill('520');
  await expect(page.locator('.control-panel-canvas')).toHaveAttribute('width', '1100');
  await expect(page.locator('.control-panel-canvas')).toHaveAttribute('height', '520');
  await page.getByRole('button', { name: /^Button$/ }).click();

  const inspector = page.getByRole('heading', { name: 'Element properties' }).locator('..');
  await expect(inspector.getByLabel('Label')).toHaveValue('Button');
  await inspector.getByLabel('Label').fill('TEST');
  await inspector.getByLabel('FSM event').selectOption('START');
  await expect(inspector.getByLabel('FSM event')).toHaveValue('START');
  await expect(page.locator('.control-panel-canvas').getByText('TEST')).toBeVisible();
});

test('presses a virtual button and performs a runtime transition', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.locator('.workspace-navigation button[data-workspace="preview"]').click();
  await expect(page.getByLabel(/Runtime preview/)).toBeVisible();

  await page.getByRole('button', { name: 'START', exact: true }).click();

  await expect(page.locator('.runtime-lcd-card').getByRole('heading', { name: 'Measurement' })).toBeVisible();
  await expect(page.locator('.runtime-log').getByText(/tr-main-measure/)).toBeVisible();
});

test('queues runtime events in step mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.locator('.workspace-navigation button[data-workspace="preview"]').click();
  await page.getByRole('button', { name: 'Step mode' }).click();
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await expect(page.getByText('Pending: 1')).toBeVisible();

  await page.getByRole('button', { name: /^Step$/ }).click();
  await expect(page.locator('.runtime-lcd-card').getByRole('heading', { name: 'Measurement' })).toBeVisible();
});

test('blocks preview and export when validation has reference errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem('lcd-bitmap-ide.project.autosave.v5')))).toBe(true);
  await page.evaluate(() => {
    const raw = localStorage.getItem('lcd-bitmap-ide.project.autosave.v5');
    if (!raw) return;
    const payload = JSON.parse(raw);
    const state = Object.values(payload.project.fsm.states)[0] as { screenId?: string } | undefined;
    if (!state) return;
    state.screenId = 'missing-screen';
    localStorage.setItem('lcd-bitmap-ide.project.autosave.v5', JSON.stringify(payload));
  });
  await page.reload();
  await page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();

  await page.locator('.workspace-navigation button[data-workspace="preview"]').click();
  await expect(page.locator('.toast-danger').getByText(/Preview blocked/)).toBeVisible();
  await expect(page.locator('.workspace-navigation button[data-workspace="fsm"]')).toHaveClass(/active/);

  await page.locator('.project-actions').getByRole('button', { name: /Export universal|Универсальный экспорт/ }).click();
  await expect(page.locator('.toast-danger').getByText(/Export blocked/)).toBeVisible();
});

test('opens the searchable operation manual and guided tour', async ({ page }) => {
  await page.getByRole('button', { name: /^Manual$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Operation manual/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('framebuffer');
  await expect(dialog.getByRole('button', { name: /Data & export reference/i })).toBeVisible();
  await dialog.getByRole('button', { name: /Start guided tour/ }).click();
  await expect(page.getByRole('dialog', { name: /Project actions/ })).toBeVisible();
});

test('switches locales without encoding artifacts', async ({ page }) => {
  const languageButton = page.getByRole('button', { name: 'Toggle interface language' });
  const brokenEncoding = /(?:Р.|С.){3,}|�/;
  for (const expected of ['RU', 'ZH', 'EN']) {
    await languageButton.click();
    await expect(languageButton).toContainText(expected);
    expect(await page.locator('body').innerText()).not.toMatch(brokenEncoding);
  }
});

test('loads without uncaught page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  expect(errors).toEqual([]);
});
